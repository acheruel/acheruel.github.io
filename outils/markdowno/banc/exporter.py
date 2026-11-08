"""Exporte les résultats du banc d'essai vers le comparateur du site (outils/markdowno/comparateur/donnees/)."""
import json, shutil, pathlib, datetime, sys

ROOT = pathlib.Path(__file__).parent
DEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "acheruel.github.io/outils/markdowno/comparateur/donnees")
R = json.load(open(ROOT / "resultats.json"))

DOCS = [
    {"id": "hif18046-extrait", "full": "hif18046", "short": "FHWA-HIF-18-046",
     "title": {"fr": "Analyse raffinée des ponts", "en": "Refined Analysis in Bridge Design"},
     "source": "https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf"},
    {"id": "if12027-extrait", "full": "if12027", "short": "FHWA-IF-12-027",
     "title": {"fr": "Dalles orthotropes en acier", "en": "Orthotropic Steel Bridges"},
     "source": "https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf"},
]
FULL_PAGES = {"hif18046": 709, "if12027": 291}

TOOLS = [
    {"id": "converto", "name": "PDFo Converto 1.0", "where": "browser", "license": "",
     "engine": {"fr": "règles, pdf.js (ce site)", "en": "rules, pdf.js (this site)"},
     "note": {"fr": "Le plus rapide ; tableaux vectoriels exacts (HTML, cellules fusionnées). Perd les étiquettes de ligne hors grille (tableaux 60 et 62). Pas d'OCR : tableaux en image et équations perdus.",
              "en": "Fastest; exact vector tables (HTML, merged cells). Loses row labels outside the grid (tables 60 and 62). No OCR: image tables and equations lost."}},
    {"id": "markitdown", "name": "MarkItDown 0.1.9", "where": "browser", "license": "MIT",
     "engine": {"fr": "pdfminer (moteur actuel de MarkDownO)", "en": "pdfminer (current MarkDownO engine)"},
     "note": {"fr": "Texte brut : ni titres, ni tableaux Markdown, ni images. Les valeurs d'un tableau restent sur une ligne, sans en-têtes de colonnes.",
              "en": "Plain text: no headings, no Markdown tables, no images. Table values stay on one line, without column headers."}},
    {"id": "mdflux", "name": "mdflux 0.3.1", "where": "python", "license": "MIT",
     "engine": {"fr": "MarkItDown + nettoyage + OCR RapidOCR", "en": "MarkItDown + clean-up + RapidOCR OCR"},
     "why": {"fr": "Application de bureau, pas lancée ici. Sur un PDF qui contient du texte, c'est MarkItDown suivi d'un nettoyage par règles (doublons, lignes recollées, titres devinés). Son OCR ne s'active que si le PDF entier est numérisé (moins de 30 caractères par page) : les tableaux en image d'un PDF texte restent perdus.",
             "en": "Desktop app, not run here. On a PDF that has text, it is MarkItDown followed by rule-based clean-up (duplicates, re-joined lines, guessed headings). Its OCR only kicks in when the whole PDF is scanned (under 30 characters per page): image tables in a text PDF are still lost."}},
    {"id": "opendataloader", "name": "OpenDataLoader PDF 2.5.20", "where": "java", "license": "Apache-2.0",
     "engine": {"fr": "règles (Java, appelé depuis Python)", "en": "rules (Java, called from Python)"},
     "note": {"fr": "Rapide ; tableaux vectoriels comme Converto ; extrait toutes les images. Titres incomplets, pas d'OCR en mode local.",
              "en": "Fast; vector tables like Converto; extracts every image. Incomplete headings, no OCR in local mode."}},
    {"id": "pymupdf4llm-classic", "name": "pymupdf4llm 2.1 classique", "where": "python", "license": "AGPL-3.0",
     "engine": {"fr": "règles (MuPDF), sans modèle", "en": "rules (MuPDF), no model"},
     "note": {"fr": "Sans modèle : aucun titre trouvé sur ces manuels ; tableaux vectoriels corrects.",
              "en": "Without the model: no headings found on these manuals; vector tables are fine."}},
    {"id": "pymupdf4llm-navigateur", "name": "pymupdf4llm 0.0.27", "where": "python", "license": "AGPL-3.0",
     "engine": {"fr": "MuPDF 1.26, version qui existe dans Pyodide", "en": "MuPDF 1.26, the version available in Pyodide"},
     "note": {"fr": "Pourrait tourner dans le navigateur (PyMuPDF est dans Pyodide 0.29) ; mesuré en Python natif. N'apporte rien de plus que Converto.",
              "en": "Could run in the browser (PyMuPDF ships with Pyodide 0.29); measured in native Python. Adds nothing over Converto."}},
    {"id": "pymupdf4llm", "name": "pymupdf4llm 2.1 + Layout + OCR", "where": "python", "license": "AGPL-3.0",
     "engine": {"fr": "modèle de mise en page + RapidOCR (MuPDF)", "en": "layout model + RapidOCR (MuPDF)"},
     "note": {"fr": "Le seul à lire les tableaux en image et les équations (OCR) et à trouver presque tous les titres. Mais 10 fois plus lent, et il a faussé le tableau 13 à cellules fusionnées (« 0.61 » devient « 0.6 | 1 »).",
              "en": "The only one that reads image tables and equations (OCR) and finds nearly all headings. But 10 times slower, and it corrupted merged-cell table 13 (\"0.61\" became \"0.6 | 1\")."}},
    {"id": "docling", "name": "Docling 2.149", "where": "python", "license": "MIT",
     "engine": {"fr": "modèles de mise en page et TableFormer, OCR", "en": "layout and TableFormer models, OCR"},
     "why": {"fr": "Non mesuré : ses modèles se téléchargent depuis Hugging Face, bloqué dans l'environnement de test. Le script du banc d'essai le lance sur un poste (banc/run_tool.py docling).",
             "en": "Not measured: its models download from Hugging Face, which was blocked in the test environment. The test script runs it on a computer (banc/run_tool.py docling)."}},
    {"id": "marker", "name": "Marker 2.1", "where": "python", "license": "Apache-2.0",
     "engine": {"fr": "modèles Surya (mise en page, OCR, tableaux, équations)", "en": "Surya models (layout, OCR, tables, equations)"},
     "why": {"fr": "Non mesuré, même raison que Docling (modèles sur Hugging Face). Lourd sans carte graphique.",
             "en": "Not measured, same reason as Docling (models on Hugging Face). Heavy without a GPU."}},
]


def flat(s):
    T = s["tables"]
    return {
        "pages": s["pages"], "seconds": s["seconds"], "words": s["words"], "text_recall": s["text_recall"],
        "order": s["order"], "headings_ok": s["headings_ok"], "headings_n": s["headings_ref"],
        "tables_ok": sum(t["strict"] for t in T), "tables_n": sum(t["n"] for t in T),
        "present_ok": sum(t["present"] for t in T), "present_n": sum(t["n"] for t in T),
        "tables_detail": [{"id": t["id"], "ok": t["strict"], "present": t["present"], "n": t["n"]} for t in T],
        "equations_ok": sum(e["ok"] for e in s["equations"]), "equations_n": len(s["equations"]),
        "images": s["images"], "captions_ok": s["captions_ok"], "captions_n": s["captions_ref"], "figures_n": s["captions_ref"],
        "rag_ok": sum(q["ok"] for q in s["rag"]), "rag_n": len(s["rag"]), "tokens": s["tokens"],
    }


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    scores = {}
    for tool, docs in R.items():
        for doc, s in docs.items():
            f = flat(s)
            full = next(d["full"] for d in DOCS if d["id"] == doc)
            fj = ROOT / "full" / tool / f"{full}.json"
            if fj.exists():
                f["full_seconds"] = json.load(open(fj))["seconds"]
                f["full_pages"] = FULL_PAGES[full]
            scores.setdefault(tool, {})[doc] = f
            src = ROOT / "out" / tool / f"{doc}.md"
            (DEST / "sorties" / tool).mkdir(parents=True, exist_ok=True)
            shutil.copy(src, DEST / "sorties" / tool / f"{doc}.md")
    docs = []
    for d in DOCS:
        pages = json.load(open(ROOT / "pdfs" / f"{d['id']}.pages.json"))
        shutil.copy(ROOT / "pdfs" / f"{d['id']}.pdf", DEST / f"{d['id']}.pdf")
        docs.append({**{k: v for k, v in d.items() if k != "full"}, "pdf": f"{d['id']}.pdf",
                     "pagesSample": len(pages), "pagesFull": FULL_PAGES[d["full"]], "pageNumbers": pages})
    out = {"date": datetime.date.today().isoformat(), "docs": docs, "tools": TOOLS, "scores": scores}
    json.dump(out, open(DEST / "resultats.json", "w"), ensure_ascii=False, indent=1)
    print("exporté :", DEST, len(scores), "outils")


if __name__ == "__main__":
    main()
