"""Browser integration: corpus, previews, ZIP assets, imports, local PDF, mobile."""
import argparse
import json
import os
from pathlib import Path
import zipfile
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument("--url", default="http://127.0.0.1:8765/outils/markdowno/lab/")
p.add_argument("--chromium", default="/usr/bin/chromium")
p.add_argument("--markitdown", action="store_true", help="Also test the CDN/PyPI-dependent browser engine")
a = p.parse_args()
data = Path(__file__).resolve().parent.parent / "lab/data"
errors = []
with sync_playwright() as pw:
    options = dict(executable_path=a.chromium, headless=True, args=["--no-sandbox"])
    if a.markitdown and os.environ.get("HTTPS_PROXY"):
        options["proxy"] = {"server": os.environ["HTTPS_PROXY"], "bypass": "127.0.0.1,localhost"}
    browser = pw.chromium.launch(**options)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(a.url)
    page.wait_for_function("!document.querySelector('#save-b').disabled")
    assert page.locator("#metrics tr").count() == 5
    assert page.locator("#output-b table").count() > 0
    for item in json.loads((data / "corpus.json").read_text()):
        page.select_option("#corpus", item["id"])
        for engine in ["pdfo", "markitdown", "mdflux", "pymupdf", "docling"]:
            page.select_option("#engine-a", engine)
            page.wait_for_function("!document.querySelector('#save-a').disabled")
            assert "introuvable" not in page.locator("#output-a").inner_text()
            # Scroll to load lazy images before checking their bytes are renderable.
            for img in page.locator("#output-a img").all():
                img.scroll_into_view_if_needed()
                img.evaluate("img => img.decode()")
                assert img.evaluate("img => img.naturalWidth > 0")
    page.select_option("#corpus", "hif18046")
    page.wait_for_function("!document.querySelector('#save-b').disabled")
    with page.expect_download() as dl:
        page.click("#save-b")
    z = zipfile.ZipFile(dl.value.path())
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["source"]["pages"] == [54, 85, 598, 660]
    assert "document.md" in z.namelist()
    assert any(n.endswith(".png") for n in z.namelist())
    page.select_option("#view", "source")
    page.wait_for_selector("#output-b pre")
    page.select_option("#view", "render")
    page.locator("#import-a").set_input_files({"name": "untrusted.md", "mimeType": "text/markdown", "buffer": b'<script>window.BAD=1</script><img src="https://invalid.example/x" onerror="window.BAD=1">[bad](javascript:alert(1))\n\n# Imported'})
    page.wait_for_function("document.querySelector('#meta-a').textContent.includes('Import :')")
    assert page.evaluate("window.BAD") is None
    assert page.locator("#output-a script, #output-a img, #output-a [onerror], #output-a a[href^='javascript:']").count() == 0
    page.locator("#pdf").set_input_files(data / "native.pdf")
    page.wait_for_function("document.querySelector('#status').textContent.includes('PDF prêt')")
    page.click("#run-a")
    page.wait_for_function("!document.querySelector('#save-a').disabled")
    assert "125.5" in page.locator("#output-a").inner_text()
    if a.markitdown:
        page.click("#run-b")
        page.wait_for_function("!document.querySelector('#run-b').disabled", timeout=330000)
        assert "125.5" in page.locator("#output-b").inner_text(), page.locator("#status").inner_text()
    page.select_option("#corpus", "if12027")
    page.wait_for_function("!document.querySelector('#save-b').disabled")
    page.screenshot(path="/tmp/markdowno-lab-desktop.png", full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(200)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile horizontal overflow"
    page.screenshot(path="/tmp/markdowno-lab-mobile.png", full_page=True)
    assert not errors, errors
    print("PASS: 25 saved outputs, asset rendering, ZIP+provenance, raw/rendered view, sanitized import, local PDFo, mobile layout" + (", local MarkItDown" if a.markitdown else ""))
    browser.close()
