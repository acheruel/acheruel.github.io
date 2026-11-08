"""Lance un moteur PDF -> Markdown sur un PDF ; écrit out/<tool>/<nom>.md et .json (temps, mémoire)."""
import sys, time, json, pathlib

tool, pdf, outdir = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
outdir.mkdir(parents=True, exist_ok=True)
name = pathlib.Path(pdf).stem
t_import = time.perf_counter()
extra = {}

if tool == "markitdown":
    from markitdown import MarkItDown
    t0 = time.perf_counter()
    md = MarkItDown().convert(pdf).text_content

elif tool in ("pymupdf4llm", "pymupdf4llm-classic"):
    # 2.x : modèle de mise en page (pymupdf-layout) + OCR RapidOCR actifs par défaut s'ils sont installés.
    import pymupdf4llm
    if tool == "pymupdf4llm-classic":
        pymupdf4llm.use_layout(False)
    t0 = time.perf_counter()
    img_dir = outdir / f"{name}_images"
    md = pymupdf4llm.to_markdown(pdf, write_images=True, image_path=str(img_dir), image_format="png", dpi=110)

elif tool == "pymupdf4llm-navigateur":
    # pymupdf4llm 0.0.27 + PyMuPDF 1.26.3 : la combinaison disponible dans Pyodide 0.29 (navigateur).
    import pymupdf4llm
    t0 = time.perf_counter()
    md = pymupdf4llm.to_markdown(pdf)

elif tool == "opendataloader":
    import opendataloader_pdf, tempfile, glob
    t0 = time.perf_counter()
    tmp = tempfile.mkdtemp()
    opendataloader_pdf.convert(input_path=[pdf], output_dir=tmp, format="markdown")
    md = open(glob.glob(f"{tmp}/**/*.md", recursive=True)[0], encoding="utf-8").read()

elif tool in ("docling", "docling-noocr"):
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling_core.types.doc import ImageRefMode
    o = PdfPipelineOptions()
    o.do_ocr = tool == "docling"
    o.do_table_structure = True
    o.table_structure_options.mode = TableFormerMode.ACCURATE
    o.generate_picture_images = True
    o.images_scale = 1.5
    conv = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=o)})
    conv.initialize_pipeline(InputFormat.PDF)
    t0 = time.perf_counter()
    res = conv.convert(pdf)
    res.document.save_as_markdown(outdir / f"{name}.md", image_mode=ImageRefMode.REFERENCED,
                                  artifacts_dir=pathlib.Path(f"{name}_images"))
    md = (outdir / f"{name}.md").read_text(encoding="utf-8")

elif tool == "marker":
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    from marker.output import text_from_rendered
    models = create_model_dict()
    t0 = time.perf_counter()
    rendered = PdfConverter(artifact_dict=models, config={"pdftext_workers": 1})(pdf)  # Windows : pas de processus fils
    md, _, images = text_from_rendered(rendered)
    d = outdir / f"{name}_images"
    d.mkdir(exist_ok=True)
    for k, im in images.items():
        im.save(d / k)
        md = md.replace(f"]({k})", f"]({name}_images/{k})")
else:
    raise SystemExit("outil inconnu " + tool)

t1 = time.perf_counter()
(outdir / f"{name}.md").write_text(md, encoding="utf-8")
try:  # Linux, macOS
    import resource
    peak = max(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss) / 1024
except ImportError:  # Windows
    import psutil
    peak = psutil.Process().memory_info().peak_wset / 2**20
json.dump({"tool": tool, "pdf": pdf, "seconds": round(t1 - t0, 2), "load_seconds": round(t0 - t_import, 2),
           "peak_rss_mb": round(peak), "chars": len(md), **extra},
          open(outdir / f"{name}.json", "w"), indent=1, default=str)
print(tool, name, f"{t1 - t0:.1f}s", len(md), "car.")
