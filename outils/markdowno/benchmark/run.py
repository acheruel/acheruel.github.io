"""Measured conversion adapters. No API keys, no LLM rewriting, no hidden fallback.

One process per engine. First conversion and subsequent timings are kept separately.
Run engines sequentially for comparable CPU measurements. See README.md.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import re
import resource
import shutil
import statistics
import sys
import time
from pathlib import Path


def metrics(text):
    return {"characters": len(text),
            "headings": len(re.findall(r"^#{1,6}\s", text, re.M)),
            "table_rows": len(re.findall(r"^\|.*\|\s*$", text, re.M)) + text.count("<tr>"),
            "image_links": len(re.findall(r"!\[[^\]]*\]\([^)]+\)", text))}


def probes(text, fixture):
    """Presence is NOT correctness; association requires a single table row."""
    if fixture not in ("native", "scan", "mixed"):
        return None
    text = re.sub(r"\\([_*`])", r"\1", text)
    compact = re.sub(r"[*_`<>]", " ", text)
    rows = [re.sub(r"<[^>]*>", " ", r) for r in re.split(r"\n|</tr>", text)]
    result = {"values_present": all(v in compact for v in ["125.5", "188.25", "240", "360"]),
              "beam_a_row": any(all(v in r for v in ["Beam A", "125.5", "188.25"]) and ("|" in r or "<td" in text) for r in rows),
              "beam_b_row": any(all(v in r for v in ["Beam B", "240", "360"]) and ("|" in r or "<td" in text) for r in rows)}
    if fixture != "mixed":
        positions = [text.find("ORDER_" + x) for x in ["ALPHA", "BETA", "GAMMA", "DELTA"]]
        result["column_order"] = all(x >= 0 for x in positions) and positions == sorted(positions)
        result["figure_labels"] = "80 kN" in text and "12 m" in text
    return result


def adapter(engine, mdflux):
    if engine == "markitdown":
        from markitdown import MarkItDown
        converter = MarkItDown(enable_plugins=False)
        return lambda path, out: converter.convert_local(str(path)).markdown
    if engine == "mdflux":
        sys.path.insert(0, str(mdflux / "app/src-tauri/resources/sidecar"))
        import cleanup
        import ocr
        from markitdown import MarkItDown
        converter = MarkItDown(enable_plugins=False)
        def convert(path, out):
            text = ocr.ocr_pdf(str(path), intra_op_threads=4) if ocr.is_scanned_pdf(str(path)) else converter.convert_local(str(path)).markdown
            return cleanup.clean(text, "pdf", {r: True for r in cleanup.RULE_ORDER})[0]
        return convert
    if engine == "pymupdf":
        import pymupdf4llm
        return lambda path, out: pymupdf4llm.to_markdown(str(path), write_images=True, image_path=str(out / "images"), image_format="png", dpi=144, show_progress=False)
    if engine == "docling":
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
        from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice
        from docling_core.types.doc import ImageRefMode
        opts = PdfPipelineOptions()
        opts.do_ocr = True
        opts.ocr_options = TesseractCliOcrOptions(lang=["eng"])
        opts.do_table_structure = True
        opts.generate_picture_images = True
        opts.images_scale = 2
        opts.accelerator_options = AcceleratorOptions(num_threads=4, device=AcceleratorDevice.CPU)
        converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})
        def convert(path, out):
            result = converter.convert(path)
            result.document.save_as_json(out / "document.json")
            result.document.save_as_markdown(out / "output.md", image_mode=ImageRefMode.REFERENCED)
            return (out / "output.md").read_text()
        return convert
    raise ValueError(engine)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--engine", choices=["markitdown", "mdflux", "pymupdf", "docling"], required=True)
    p.add_argument("--data", type=Path, required=True)
    p.add_argument("--file", type=Path, help="Compare your own PDF; use a separate --data directory, e.g. /tmp/my-pdf-test")
    p.add_argument("--mdflux", type=Path)
    p.add_argument("--repeats", type=int, default=3)
    p.add_argument("--only", nargs="*")
    args = p.parse_args()
    if args.repeats < 1: p.error("--repeats must be positive")
    if args.engine == "mdflux" and not args.mdflux: p.error("--mdflux is required")
    data = args.data.resolve()
    if args.file:
        import pymupdf
        source = args.file.resolve()
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        data.mkdir(parents=True, exist_ok=True)
        manifest = data / "corpus.json"
        if manifest.exists():
            existing = json.loads(manifest.read_text())
            if len(existing) != 1 or existing[0]["sha256"] != digest or existing[0]["id"] != "custom":
                p.error("--file needs a new output directory or the same custom PDF corpus")
        else:
            with pymupdf.open(source) as doc:
                entry = dict(id="custom", title=source.name, pages=list(range(1, len(doc)+1)),
                             original_pages=len(doc), sha256=digest, url=None)
            shutil.copyfile(source, data / "custom.pdf")
            manifest.write_text(json.dumps([entry], indent=2))
    versions = {}
    for name in ["markitdown", "pdfminer.six", "pdfplumber", "pymupdf", "pymupdf4llm", "docling", "docling-core", "rapidocr", "onnxruntime", "torch"]:
        try: versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError: pass
    report = {"engine": args.engine, "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "python": platform.python_version(), "platform": platform.platform(), "versions": versions,
              "threads": 4, "runs": [], "timing": "Conversion + Markdown/assets export; excludes imports/setup, network install and browser UI. First call may include model download. warm_median_s uses repetitions 2..N. RSS is process lifetime high-water mark, not incremental per-file memory."}
    report_path = data / f"{args.engine}.json"
    t = time.perf_counter()
    convert = adapter(args.engine, args.mdflux)
    report["setup_s"] = time.perf_counter() - t
    for item in json.loads((data / "corpus.json").read_text()):
        name = item["id"]
        if args.only and name not in args.only: continue
        out = data / args.engine / name
        out.mkdir(parents=True, exist_ok=True)
        run = {"document": name, "pages": item["pages"], "input_sha256": item["sha256"], "status": "ok", "seconds": []}
        try:
            outputs = []
            for rep in range(args.repeats):
                t = time.perf_counter()
                text = convert(data / (name + ".pdf"), out)
                run["seconds"].append(round(time.perf_counter() - t, 4))
                # Make generated local image links portable in the static lab.
                text = text.replace(str(out) + "/", "")
                text = text.replace(os.path.relpath(out) + "/", "")
                outputs.append(hashlib.sha256(text.encode()).hexdigest())
                (out / "output.md").write_text(text)
            run.update(metrics(text))
            run["probes"] = probes(text, name)
            run["stable_output"] = len(set(outputs)) == 1
            run["warm_median_s"] = statistics.median(run["seconds"][1:]) if len(run["seconds"]) > 1 else None
            run["output"] = f"{args.engine}/{name}/output.md"
        except Exception as exc:
            run.update(status="error", error=f"{type(exc).__name__}: {exc}"[:2000])
        run["process_peak_rss_mib"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)
        report["runs"].append(run)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(json.dumps(run), flush=True)


if __name__ == "__main__":
    main()
