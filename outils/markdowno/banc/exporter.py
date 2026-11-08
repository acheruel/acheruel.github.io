"""Exporte les résultats du banc d'essai vers le comparateur du site (outils/markdowno/comparateur/donnees/)."""
import json, shutil, pathlib, datetime, sys

ROOT = pathlib.Path(__file__).parent
DEST = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "acheruel.github.io/outils/markdowno/comparateur/donnees")
R = json.load(open(ROOT / "resultats.json", encoding="utf-8"))

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
    {"id": "markdowno", "name": "MarkDownO 1.1", "where": "browser", "license": "",
     "engine": {"fr": "structure de PDFo Converto + OCR des zones en image (Tesseract.js), ce site", "en": "PDFo Converto structure + OCR of image areas (Tesseract.js), this site"},
     "note": {"fr": "Le meilleur sur les tableaux (vectoriels et en image), dans le navigateur. Grille retrouvée dans l'image, cellule par cellule ; valeurs douteuses signalées sous le tableau. Limites : « 1,2, or 3 » lu « 1.2. 0r3 », croquis seulement marqués [dessin], équations lues mais sans leur forme (« bh? · 12 »).",
              "en": "Best on tables (vector and image), in the browser. Grid found in the image, cell by cell; doubtful values flagged under the table. Limits: \"1,2, or 3\" read as \"1.2. 0r3\", sketches only marked [drawing], equations read without their layout (\"bh? · 12\")."}},
    {"id": "converto", "name": "PDFo Converto 1.1", "where": "browser", "license": "",
     "engine": {"fr": "règles, pdf.js (ce site), sans OCR", "en": "rules, pdf.js (this site), no OCR"},
     "note": {"fr": "Le plus rapide ; tableaux vectoriels exacts (HTML, cellules fusionnées, libellés de ligne hors grille depuis la 1.1). Pas d'OCR : tableaux en image et équations perdus ; d'où MarkDownO.",
              "en": "Fastest; exact vector tables (HTML, merged cells, row labels outside the grid since 1.1). No OCR: image tables and equations lost; hence MarkDownO."}},
    {"id": "docling", "name": "Docling 2.149", "where": "python", "license": "MIT",
     "engine": {"fr": "modèles de mise en page et TableFormer, OCR RapidOCR", "en": "layout and TableFormer models, RapidOCR OCR"},
     "note": {"fr": "Très bon sur les tableaux, y compris en image (avec RapidOCR, aucune décimale perdue), et tous les titres. Mais 9 s par page sur un portable (2 Go de mémoire, 1 à 2 min de chargement), cellules fusionnées répétées dans un tableau Markdown, équations non lues.",
              "en": "Very good on tables, image ones included (with RapidOCR, no decimal lost), and every heading. But 9 s per page on a laptop (2 GB of memory, 1 to 2 min to load), merged cells repeated in a Markdown table, equations not read."}},
    {"id": "markitdown", "name": "MarkItDown 0.1.9", "where": "browser", "license": "MIT",
     "engine": {"fr": "pdfminer (ancien moteur PDF de MarkDownO)", "en": "pdfminer (former MarkDownO PDF engine)"},
     "note": {"fr": "Texte brut : ni titres, ni tableaux Markdown, ni images. Les valeurs d'un tableau restent sur une ligne, sans en-têtes de colonnes.",
              "en": "Plain text: no headings, no Markdown tables, no images. Table values stay on one line, without column headers."}},
    {"id": "mdflux", "name": "mdflux 0.3.1", "where": "python", "license": "MIT",
     "engine": {"fr": "MarkItDown + nettoyage + OCR RapidOCR", "en": "MarkItDown + clean-up + RapidOCR OCR"},
     "why": {"fr": "Application de bureau, mesurée par l'autre banc (PR #3) : c'est MarkItDown suivi d'un nettoyage par règles. Son OCR ne s'active que si le PDF entier est numérisé : les tableaux en image d'un PDF texte restent perdus.",
             "en": "Desktop app, measured by the other test bench (PR #3): it is MarkItDown followed by rule-based clean-up. Its OCR only kicks in when the whole PDF is scanned: image tables in a text PDF are still lost."}},
    {"id": "opendataloader", "name": "OpenDataLoader PDF 2.5.20", "where": "java", "license": "Apache-2.0",
     "engine": {"fr": "règles (Java, appelé depuis Python)", "en": "rules (Java, called from Python)"},
     "note": {"fr": "Rapide ; tableaux vectoriels comme Converto 1.0 ; extrait toutes les images. Titres incomplets, pas d'OCR en mode local.",
              "en": "Fast; vector tables like Converto 1.0; extracts every image. Incomplete headings, no OCR in local mode."}},
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
     "note": {"fr": "Lit les 3 équations en image avec leur forme ; presque tous les titres. Mais il a faussé le tableau 13 à cellules fusionnées (« 0.61 » devient « 0.6 | 1 ») et lit les tableaux en image moins bien que MarkDownO et Docling.",
              "en": "Reads the 3 image equations with their layout; nearly all headings. But it corrupted merged-cell table 13 (\"0.61\" became \"0.6 | 1\") and reads image tables less well than MarkDownO and Docling."}},
    {"id": "marker", "name": "Marker", "where": "python", "license": "GPL-3.0 (1.10), Apache-2.0 (2.1)",
     "engine": {"fr": "modèles Surya (mise en page, OCR, tableaux, équations)", "en": "Surya models (layout, OCR, tables, equations)"},
     "why": {"fr": "Essayé sur un portable sans carte graphique, sans résultat : Marker 2.1 exige le serveur llama.cpp (binaire non installé) ; Marker 1.10 n'avait pas fini les 32 premières pages après 45 min (reconnaissance du texte estimée à plus de 3 h). Inutilisable sans carte graphique.", "en": "Tried on a laptop without a GPU, no result: Marker 2.1 needs the llama.cpp server (binary not installed); Marker 1.10 had not finished the first 32 pages after 45 min (text recognition estimated at over 3 h). Unusable without a GPU."}},
    {"id": "parsade", "name": "Parsade (Granite-Docling 258M)", "where": "browser", "license": "Apache-2.0 (modèle)",
     "engine": {"fr": "modèle vision-langage dans le navigateur (WebGPU)", "en": "vision-language model in the browser (WebGPU)"},
     "why": {"fr": "Service en ligne non lancé (téléversement dans son interface, WebGPU). Son modèle, Granite-Docling 258M, essayé via Docling sur CPU : 7 pages à tableaux non terminées en 33 min.", "en": "Online service not run (upload in its interface, WebGPU). Its model, Granite-Docling 258M, tried through Docling on CPU: 7 table pages not finished in 33 min."}},
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
    json.dump(out, open(DEST / "resultats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("exporté :", DEST, len(scores), "outils")


if __name__ == "__main__":
    main()
