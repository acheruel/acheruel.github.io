"""Build a small, explicitly selected corpus; original PDFs stay outside the repo."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlretrieve

import pymupdf
from reportlab.pdfgen import canvas

SOURCES = {
    "hif18046": ("https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf", [54, 85, 598, 660]),
    "if12027": ("https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf", [34, 60, 128, 241]),
}


def prepare(originals, output, fetch=False):
    output.mkdir(parents=True, exist_ok=True)
    corpus = []
    for name, (url, pages) in SOURCES.items():
        original = originals / (name + ".pdf")
        if fetch and not original.exists():
            originals.mkdir(parents=True, exist_ok=True)
            urlretrieve(url, original)
        with pymupdf.open(original) as doc:
            sample = pymupdf.open()
            for page in pages:
                sample.insert_pdf(doc, from_page=page - 1, to_page=page - 1)
            sample.save(output / (name + ".pdf"), garbage=4, deflate=True)
            corpus.append(dict(id=name, title=doc.metadata["title"], url=url,
                               original_pages=len(doc), pages=pages,
                               original_sha256=hashlib.sha256(original.read_bytes()).hexdigest()))
    # Known-answer fixture: a ruled table, a diagram, an image-only copy, then
    # a mixed page whose ordinary text must not suppress OCR of its embedded table.
    raw = io.BytesIO()
    c = canvas.Canvas(raw, pagesize=(612, 792), invariant=1)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, 735, "BRIDGE TEST - reference fixture")
    c.setFont("Helvetica", 12)
    c.drawString(50, 705, "Table 1. Design loads (kN). Keep row and column associations.")
    rows = [("Member", "Service (kN)", "Ultimate (kN)"),
            ("Beam A", "125.5", "188.25"), ("Beam B", "240.0", "360.0")]
    for i, row in enumerate(rows):
        y = 660 - i * 30
        for x, value in zip([60, 220, 380], row): c.drawString(x, y, value)
    for y in [680, 650, 620, 590]: c.line(50, y, 550, y)
    for x in [50, 210, 370, 550]: c.line(x, 590, x, 680)
    c.drawString(50, 540, "Figure 1. Simply supported beam, span 12 m, load 80 kN.")
    c.line(80, 450, 500, 450)
    c.line(290, 520, 290, 450)
    c.line(290, 450, 282, 466); c.line(290, 450, 298, 466)
    c.drawString(300, 490, "80 kN"); c.drawString(260, 420, "12 m")
    c.drawString(50, 350, "ORDER_ALPHA starts the left column.")
    c.drawString(50, 330, "ORDER_BETA ends the left column.")
    c.drawString(330, 350, "ORDER_GAMMA starts right.")
    c.drawString(330, 330, "ORDER_DELTA ends right.")
    c.save()
    native = pymupdf.open(stream=raw.getvalue(), filetype="pdf")
    native.save(output / "native.pdf")
    scan = pymupdf.open()
    scan.new_page(width=612, height=792).insert_image(native[0].rect, stream=native[0].get_pixmap(matrix=pymupdf.Matrix(2, 2)).tobytes("png"))
    scan.save(output / "scan.pdf", deflate=True)
    mixed = pymupdf.open()
    p = mixed.new_page(width=612, height=792)
    p.insert_text((50, 50), "Mixed page: this paragraph is selectable but the design table below is an image. " * 2, fontsize=10)
    p.insert_image(pymupdf.Rect(50, 100, 550, 190), stream=native[0].get_pixmap(clip=pymupdf.Rect(50, 112, 550, 202), matrix=pymupdf.Matrix(2, 2)).tobytes("png"))
    mixed.save(output / "mixed.pdf", deflate=True)
    for name in ["native", "scan", "mixed"]:
        corpus.append(dict(id=name, title={"native":"Fixture native : tableau, dessin, colonnes", "scan":"Fixture numérisée : même page sans texte", "mixed":"Fixture mixte : texte + tableau en image"}[name], pages=[1], original_pages=1, url=None))
    for item in corpus:
        path = output / (item["id"] + ".pdf")
        item["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        item["bytes"] = path.stat().st_size
        with pymupdf.open(path) as doc:
            for i, page in enumerate(doc):
                page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(output / f'{item["id"]}-{i+1}.png')
    (output / "corpus.json").write_text(json.dumps(corpus, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--originals", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--fetch", action="store_true")
    a = p.parse_args()
    prepare(a.originals, a.output, a.fetch)
