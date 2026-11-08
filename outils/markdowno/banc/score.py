"""Note les sorties Markdown de chaque outil : texte, titres, tableaux, figures, équations, bruit, jetons."""
import json, re, sys, html, glob, pathlib, difflib, collections
import pymupdf

ROOT = pathlib.Path(__file__).parent
GT = json.load(open(ROOT / "verite.json"))
DOCS = ["hif18046-extrait", "if12027-extrait"]

try:
    import tiktoken
    ENC = tiktoken.get_encoding("o200k_base")
    def ntok(s): return len(ENC.encode(s, disallowed_special=()))
except Exception:  # pas de réseau pour le vocabulaire : approximation
    ENC = None
    def ntok(s): return round(len(s) / 4)


def norm(s):
    s = html.unescape(s)
    s = s.replace("\\", "")
    s = re.sub(r"<[^>]+>", " ", s)            # balises HTML
    s = re.sub(r"[*_`]+", "", s)               # gras / italique / code
    s = s.replace("–", "-").replace("—", "-").replace("−", "-").replace("‐", "-")
    s = s.replace(" ", " ").replace("ﬁ", "fi").replace("ﬂ", "fl")
    s = re.sub(r"\s+", " ", s)
    return s.strip().lower()


def words(s):
    return re.findall(r"[a-z0-9]+(?:[.,][0-9]+)*", norm(s))


def table_rows(md):
    """Unités « ligne de tableau » : lignes Markdown |…| et <tr>…</tr> HTML."""
    rows = [l for l in md.splitlines() if l.strip().startswith("|") and not re.fullmatch(r"[\s|:\-]+", l)]
    rows += re.findall(r"<tr[^>]*>(.*?)</tr>", md, flags=re.S | re.I)
    return [" | " + norm(r.replace("<td", " | <td").replace("<th", " | <th")) + " | " for r in rows]


def cell_in(cell, row):
    c = norm(cell)
    # valeur courte (ex. « B », « 42 ») : doit être une cellule ou un mot entier
    if len(c) <= 3:
        return re.search(r"(^|[\s|(])" + re.escape(c) + r"($|[\s|),])", row) is not None
    return c in row


def score_tables(md, tables):
    rows = table_rows(md)
    lines = [norm(l) for l in md.splitlines()]
    flat = norm(md)
    res = []
    for t in tables:
        strict = loose = present = 0
        for r in t["rows"]:
            if any(all(cell_in(c, row) for c in r) for row in rows): strict += 1
            if any(all(cell_in(c, " " + l + " ") for c in r) for l in lines): loose += 1
            if all(norm(c) in flat for c in r): present += 1
        n = len(t["rows"])
        res.append({"id": t["id"], "n": n, "strict": strict, "loose": loose, "present": present})
    return res


def chunks(md, size=1200):
    """Découpe comme un pipeline RAG simple : par paragraphes, morceaux d'environ `size` caractères."""
    out, cur = [], ""
    for para in re.split(r"\n\s*\n", md):
        if len(cur) + len(para) > size and cur:
            out.append(cur); cur = ""
        while len(para) > size * 2:
            out.append(para[:size]); para = para[size:]
        cur += para + "\n\n"
    if cur.strip(): out.append(cur)
    return out


def score_rag(md, questions, k=3):
    """BM25 sur les morceaux ; réussi si la réponse est dans un des k premiers morceaux."""
    import math
    ch = chunks(md)
    toks = [words(c) for c in ch]
    N = len(ch); avg = sum(map(len, toks)) / max(1, N)
    df = collections.Counter(w for t in toks for w in set(t))
    res = []
    for q in questions:
        qw = words(q["q"])
        def bm25(t):
            tf = collections.Counter(t); s = 0
            for w in qw:
                if w in tf:
                    idf = math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5))
                    s += idf * tf[w] * 2.2 / (tf[w] + 1.2 * (0.25 + 0.75 * len(t) / avg))
            return s
        top = sorted(range(N), key=lambda i: -bm25(toks[i]))[:k]
        ok = any(all(norm(a) in norm(ch[i]) for a in q["a"]) for i in top)
        res.append({"q": q["q"], "ok": bool(ok)})
    return res


REF_PAGES = {}


def ref_text(doc):
    d = pymupdf.open(ROOT / "pdfs" / f"{doc}.pdf")
    REF_PAGES[doc] = d.page_count
    return "\n".join(p.get_text() for p in d)


def ref_headings(doc):
    """Titres du sommaire (signets) du PDF original situés dans les pages de l'extrait."""
    pages = set(json.load(open(ROOT / "pdfs" / f"{doc}.pages.json")))
    src = pymupdf.open(ROOT / "pdfs" / (doc.replace("-extrait", "") + ".pdf"))
    return [t for lvl, t, p in src.get_toc() if p in pages and len(t.strip()) > 3]


def ref_captions(text):
    caps = []
    for l in text.splitlines():
        m = re.match(r"\s*(Figure \d+(?:-\d+)?)\.?\s+([A-Z(].{8,})", l)
        if m and not re.search(r"\b(shows|show|illustrates|presents|is|are)\b", m.group(2)[:25]):
            caps.append(l.strip())
    return list(dict.fromkeys(caps))


def score_doc(md, doc):
    ref = ref_text(doc)
    rw, ow = words(ref), words(md)
    rc, oc = collections.Counter(rw), collections.Counter(ow)
    common = sum((rc & oc).values())
    recall = common / max(1, len(rw))
    precision = common / max(1, len(ow))
    sm = difflib.SequenceMatcher(None, rw, ow, autojunk=False)
    order = sum(b.size for b in sm.get_matching_blocks()) / max(1, len(rw))

    heads_ref = ref_headings(doc)
    md_heads = [norm(re.sub(r"^#+\s*", "", l)) for l in md.splitlines() if re.match(r"^#{1,6}\s", l)]
    def head_found(t):
        n = norm(t)
        return any(n in h or (len(h) > 6 and difflib.SequenceMatcher(None, n, h).ratio() > 0.85) for h in md_heads)
    heads_ok = sum(head_found(t) for t in heads_ref)

    caps = ref_captions(ref)
    flat = norm(md)
    caps_ok = sum(norm(c)[:45] in flat for c in caps)
    n_img = len(re.findall(r"!\[[^\]]*\]\([^)]+\)", md)) + md.count("<!-- image -->") + len(re.findall(r"<img\b", md))

    tabs = score_tables(md, GT[doc]["tables"])
    eqs = []
    for e in GT[doc].get("equations", []):
        ok = any(all(a in l for a in e["all"]) for l in (norm(x) for x in md.splitlines()))
        eqs.append({"id": e["id"], "ok": ok})

    rag = score_rag(md, GT[doc].get("questions", []))
    lines = [l.strip() for l in md.splitlines() if l.strip()]
    rep = collections.Counter(l for l in lines if not l[0] in "<>|!#-*_[" and len(l) > 3)
    repeated = sum(c for l, c in rep.items() if c >= 3)
    lone_numbers = sum(1 for l in lines if re.fullmatch(r"\d{1,3}", l))
    cid = len(re.findall(r"\(cid:\d+\)", md)) + md.count("�")

    return {
        "chars": len(md), "tokens": ntok(md), "words": len(rw),
        "text_recall": round(recall, 3), "text_precision": round(precision, 3), "order": round(order, 3),
        "headings_ref": len(heads_ref), "headings_ok": heads_ok, "md_headings": len(md_heads),
        "captions_ref": len(caps), "captions_ok": caps_ok, "images": n_img,
        "tables": tabs, "equations": eqs, "rag": rag,
        "noise_repeated_lines": repeated, "noise_page_numbers": lone_numbers, "noise_bad_glyphs": cid,
    }


def main():
    out = {}
    for tool_dir in sorted(glob.glob(str(ROOT / "out" / "*"))):
        tool = pathlib.Path(tool_dir).name
        for doc in DOCS:
            f = pathlib.Path(tool_dir) / f"{doc}.md"
            if not f.exists():
                continue
            md = f.read_text(encoding="utf-8")
            meta = json.load(open(f.with_suffix(".json"))) if f.with_suffix(".json").exists() else {}
            s = score_doc(md, doc)
            s["seconds"] = meta.get("seconds")
            s["pages"] = REF_PAGES[doc]
            s["peak_rss_mb"] = meta.get("peak_rss_mb")
            out.setdefault(tool, {})[doc] = s
    json.dump(out, open(ROOT / "resultats.json", "w"), indent=1, ensure_ascii=False)
    hdr = f"{'outil':22} {'doc':6} {'s':>6} {'rappel':>6} {'préc':>5} {'ordre':>5} {'titres':>7} {'légend':>7} {'img':>4} {'tab strict':>10} {'tab ligne':>9} {'tab prés':>8} {'éq':>3} {'rép':>4} {'jetons':>7} rag"
    print(hdr)
    for tool, docs in out.items():
        for doc, s in docs.items():
            T = s["tables"]; n = sum(t["n"] for t in T)
            print(f"{tool:22} {doc[:6]:6} {s['seconds'] or 0:6.1f} {s['text_recall']:6.3f} {s['text_precision']:5.2f} {s['order']:5.2f} "
                  f"{s['headings_ok']:>3}/{s['headings_ref']:<3} {s['captions_ok']:>3}/{s['captions_ref']:<3} {s['images']:4} "
                  f"{sum(t['strict'] for t in T):>6}/{n:<3} {sum(t['loose'] for t in T):>5}/{n:<3} {sum(t['present'] for t in T):>4}/{n:<3} "
                  f"{sum(e['ok'] for e in s['equations'])}/{len(s['equations'])} {s['noise_repeated_lines']:4} {s['tokens']:7}")


if __name__ == "__main__":
    main()
