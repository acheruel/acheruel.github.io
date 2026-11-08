"""A few manually verified FHWA anchors, not a global accuracy score."""
import json
import re
from html import unescape
from pathlib import Path
import argparse
from run import probes


def table_rows(md):
    # Keep only explicit Markdown/HTML rows, never flattened paragraphs.
    # Parse HTML separately to avoid a greedy Markdown match across the document.
    rows = re.findall(r"^\|[^\n]*\|[ \t]*$", md, re.M) + re.findall(r"<tr\b[^>]*>.*?</tr>", md, re.S)
    return [unescape(re.sub(r"<[^>]*>|[*_`\\]", " ", r)) for r in rows]


def number(row, value):
    return bool(re.search(r"(?<![\d.])" + re.escape(value) + r"(?![\d.])", row))


def real_probes(md, document):
    rows = table_rows(md)
    if document == "hif18046":
        return {"table93_first_row_167_33_and_146_5": any(number(r, "167.33") and number(r, "146.5") for r in rows),
                "table94_first_row_118_353_and_106_557": any(number(r, "118.353") and number(r, "106.557") for r in rows)}
    if document == "if12027":
        def has(label, a, b):
            return any(label in re.sub(r"\s+", "", r).lower() and number(r, a) and number(r, b) for r in rows)
        return {"table11_3_rd_deck_55_9_69_0": has("rd(deck)", "55.9", "69.0"),
                "table11_3_rib_max_34_3_48_0": has("ribspice(max)", "34.3", "48.0"),
                "table11_3_deck_splice_40_0_69_0": has("deckplatesplice", "40.0", "69.0"),
                "table11_3_rf_fb_28_3_69_0": has("rf(fb.)", "28.3", "69.0")}
    return None


def evaluate(data):
    results = {}
    for engine in ["pdfo", "markitdown", "mdflux", "pymupdf", "docling"]:
        path = data / (engine + ".json")
        report = json.loads(path.read_text())
        for run in report["runs"]:
            if run["status"] != "ok": continue
            md = (data / run["output"]).read_text()
            run["probes"] = probes(md, run["document"])
            run["real_probes"] = real_probes(md, run["document"])
        path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        results[engine] = {r["document"]: r.get("real_probes") or r.get("probes") for r in report["runs"]}
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, required=True)
    evaluate(p.parse_args().data)
