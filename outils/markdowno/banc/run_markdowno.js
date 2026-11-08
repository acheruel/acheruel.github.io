// Fait tourner le vrai moteur PDF de MarkDownO 0.3 dans Chromium sans tête : structure de PDFo Converto
// (pdf-extract.js, pdf-writers.js), puis OCR local des zones en image (ocr.js, Tesseract.js depuis jsDelivr).
// Usage : node run_markdowno.js <fichier.pdf> <sortie.md>
// Nécessite Playwright (npm i -D playwright, puis npx playwright install chromium).
// Un petit serveur HTTP local sert le dépôt (pour les modules) et le PDF.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(process.env.REPO || path.join(__dirname, "../../.."));
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".wasm": "application/wasm", ".json": "application/json", ".pdf": "application/pdf" };

(async () => {
  const [pdfPath, outMd] = process.argv.slice(2);
  if (!pdfPath || !outMd) { console.error("usage : node run_markdowno.js <fichier.pdf> <sortie.md>"); process.exit(1); }
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = url === "/__pdf" ? path.resolve(pdfPath) : path.join(REPO, url.endsWith("/") ? url + "index.html" : url);
    if (!file.startsWith(REPO) && file !== path.resolve(pdfPath)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  }).listen(0, "127.0.0.1");
  await new Promise(r => server.once("listening", r));
  const port = server.address().port;

  const browser = await chromium.launch({ channel: process.env.CHANNEL || "msedge" });
  const page = await browser.newPage();
  page.on("pageerror", e => console.error("pageerror", e.message));
  await page.goto(`http://127.0.0.1:${port}/outils/pdfo-converto/`);
  const r = await page.evaluate(async () => {
    const { openPdf } = await import("/outils/commun/pdf-outils.js");
    const { extract } = await import("/outils/commun/pdf-extract.js");
    const { toMarkdown } = await import("/outils/commun/pdf-writers.js");
    const { ocrBlocks, ocrEngine } = await import("/outils/commun/ocr.js");
    await ocrEngine(); // chargement du moteur et des langues exclu du temps (comme les modèles des autres outils)
    const bytes = new Uint8Array(await (await fetch("/__pdf")).arrayBuffer());
    const t0 = performance.now();
    const pdf = await openPdf(bytes, null, { fontExtraProperties: true });
    const idx = [...Array(pdf.numPages).keys()];
    // Réglages par défaut de l'outil : tableaux, marges retirées, styles, figures en fiches.
    const x = await extract(pdf, idx, { tables: true, margins: true, styles: true, figures: true });
    const o = await ocrBlocks(pdf, x.blocks, {});
    const md = toMarkdown(o.blocks, { pageMarkers: false, figures: "text", tableFmt: "auto", tableImages: false });
    const t1 = performance.now();
    return {
      md, seconds: (t1 - t0) / 1000, pages: pdf.numPages,
      figures: o.blocks.filter(b => b.type === "figure").length, tables: o.blocks.filter(b => b.type === "table").length, ocr: o.stats
    };
  });
  fs.mkdirSync(path.dirname(path.resolve(outMd)), { recursive: true });
  fs.writeFileSync(outMd, r.md);
  fs.writeFileSync(outMd.replace(/\.md$/, ".json"), JSON.stringify({
    tool: "markdowno", pdf: pdfPath, seconds: +r.seconds.toFixed(2), chars: r.md.length, figures: r.figures, tables: r.tables, pages: r.pages, ocr: r.ocr
  }, null, 1));
  console.log("markdowno", path.basename(pdfPath), r.seconds.toFixed(1) + " s", r.md.length, "car.", r.tables, "tableaux", r.figures, "figures", JSON.stringify(r.ocr));
  await browser.close();
  server.close();
})();
