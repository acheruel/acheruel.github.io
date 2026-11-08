"""Run the actual PDFo engine in Chromium against the same corpus as Python."""
import argparse
import hashlib
import json
import statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
from run import probes

p = argparse.ArgumentParser()
p.add_argument("--data", type=Path, required=True)
p.add_argument("--url", default="http://127.0.0.1:8765/outils/markdowno/lab/")
p.add_argument("--chromium", default="/usr/bin/chromium")
a = p.parse_args()
report = {"engine": "pdfo", "version": "240dd23 (extract.js / writers.js), pdf.js 6.4.299", "runs": [],
          "timing": "Browser: PDF loading + extraction + Markdown + image crops. No Python imports; not directly equivalent to native Python execution."}
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=a.chromium, headless=True, args=["--no-sandbox"])
    page = browser.new_page()
    # A static directory listing is sufficient; engine import is the production implementation.
    page.goto(a.url)
    report["browser"] = browser.version
    report["webgpu"] = page.evaluate("async () => ({api: !!navigator.gpu, adapter: !!(navigator.gpu && await navigator.gpu.requestAdapter())})")
    for item in json.loads((a.data / "corpus.json").read_text()):
        run = {"document": item["id"], "pages": item["pages"], "input_sha256": item["sha256"], "seconds": [], "status": "ok"}
        hashes = []
        try:
            for rep in range(3):
                result = page.evaluate("""async name => {
                    const {convertPDFo} = await import('./engines.js');
                    const bytes = new Uint8Array(await (await fetch('./data/' + name + '.pdf')).arrayBuffer());
                    const result = await convertPDFo(bytes);
                    result.assets = result.assets.map(a => ({...a, bytes: Array.from(a.bytes)}));
                    return result;
                }""", item["id"])
                run["seconds"].append(round(result["seconds"], 4))
                hashes.append(hashlib.sha256(result["markdown"].encode()).hexdigest())
            out = a.data / "pdfo" / item["id"]
            out.mkdir(parents=True, exist_ok=True)
            (out / "output.md").write_text(result["markdown"])
            for asset in result["assets"]:
                target = out / asset["path"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(bytes(asset["bytes"]))
            run.update({k: result[k] for k in ["characters", "headings", "table_rows", "image_links"]})
            run.update(warm_median_s=statistics.median(run["seconds"][1:]), stable_output=len(set(hashes)) == 1,
                       probes=probes(result["markdown"], item["id"]), output=f'pdfo/{item["id"]}/output.md')
        except Exception as exc:
            run.update(status="error", error=str(exc)[:2000])
        report["runs"].append(run)
        (a.data / "pdfo.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(run), flush=True)
    browser.close()
