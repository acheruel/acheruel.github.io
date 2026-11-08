"""Granite-Docling 258M (le modèle de Parsade) par le pipeline VLM de Docling, sur CPU.
Usage : python run_granite.py <pdf> <sortie.md>"""
import sys, time, json, pathlib
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import VlmPipelineOptions
from docling.datamodel import vlm_model_specs
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.vlm_pipeline import VlmPipeline

pdf, out = sys.argv[1], pathlib.Path(sys.argv[2])
t_import = time.perf_counter()
opts = VlmPipelineOptions(vlm_options=vlm_model_specs.GRANITEDOCLING_TRANSFORMERS)
conv = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_cls=VlmPipeline, pipeline_options=opts)})
conv.initialize_pipeline(InputFormat.PDF)
t0 = time.perf_counter()
res = conv.convert(pdf)
md = res.document.export_to_markdown()
t1 = time.perf_counter()
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(md, encoding="utf-8")
json.dump({"tool": "granite-docling", "seconds": round(t1 - t0, 1), "load_seconds": round(t0 - t_import, 1), "chars": len(md)},
          open(out.with_suffix(".json"), "w"), indent=1)
print("granite-docling", f"{t1 - t0:.0f}s", len(md))
