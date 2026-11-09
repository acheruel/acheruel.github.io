// MarkDownO : moteur PDF. Structure du PDF par le moteur de PDFo Converto (titres, signets,
// tableaux à cellules fusionnées, figures), puis OCR local des zones en image (tableaux insérés
// comme images, texte des figures, pages numérisées). Tout tourne dans le navigateur.
import { openPdf, renderPage, dropCanvas, safeName, parseRange } from "../commun/pdf-outils.js";
import { extract } from "../commun/pdf-extract.js";
import { toMarkdown, splitChapters, chapterFiles, blockAssets } from "../commun/pdf-writers.js";
import { ocrBlocks } from "../commun/ocr.js";

const toBytes = (canvas, type, q) => new Promise(res => canvas.toBlob(async b => res(new Uint8Array(await b.arrayBuffer())), type, q));

/** Image d'une zone de page (figure ou tableau), 2 000 px au plus : PNG pour traits fins, JPEG pour photos. */
export async function renderCrop(pdf, i, box, kind) {
  const page = await pdf.getPage(i + 1);
  const vp = page.getViewport({ scale: 1 });
  const pad = kind === "scan" ? 0 : 6;
  const x0 = Math.max(0, box.x0 - pad), y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(vp.width, box.x1 + pad), y1 = Math.min(vp.height, box.y1 + pad);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const scale = Math.min(4, 2000 / Math.max(w, h));
  const c = await renderPage(page, { scale, offsetX: -x0 * scale, offsetY: -y0 * scale, width: w * scale, height: h * scale });
  const type = kind === "vector" || kind === "table" ? "image/png" : "image/jpeg";
  const bytes = await toBytes(c, type, 0.86);
  dropCanvas(c);
  page.cleanup();
  return { bytes, type };
}

/**
 * Convertit un PDF.
 * opts : { ocr: "auto" | "off", figures: "text" | "images", split: "one" | "chapters", pages: "" (ex. « 1-10 »),
 *          pageMarkers, labels (libellés des fiches), chapterLabels }
 * hooks : { onStep(key, i, n), onOcrStatus(m), isCancelled() }
 * Retourne { files: [{ name, md }], md, assets: [{ path, bytes, type }], info,
 *            chapters: [{ title, from, to, md }] (vide sans chapitres), figures: [{ n, page, box, kind, caption, path, chapter }] }.
 */
export async function convertPdf(bytes, name, opts, hooks = {}) {
  const pdf = await openPdf(bytes, null, { fontExtraProperties: true });
  try {
    const all = [...Array(pdf.numPages).keys()];
    const idx = opts.pages ? parseRange(opts.pages, pdf.numPages) || all : all;
    const t0 = performance.now();
    const x = await extract(pdf, idx, { tables: true, margins: true, styles: true, figures: true, onProgress: (i, n) => hooks.onStep?.("read", i, n) });
    let blocks = x.blocks, ocr = null;
    if (opts.ocr !== "off") {
      const r = await ocrBlocks(pdf, blocks, { labels: opts.labels, onStatus: hooks.onOcrStatus, isCancelled: hooks.isCancelled, onProgress: (i, n) => hooks.onStep?.("ocr", i, n) });
      if (!r) return null;
      blocks = r.blocks; ocr = r.stats;
    }
    const mdOpts = { pageMarkers: !!opts.pageMarkers, figures: opts.figures, tableFmt: "auto", tableImages: false, labels: opts.labels };
    const base = safeName(name.replace(/\.pdf$/i, ""));
    // Chapitres toujours calculés : aperçu et figures par chapitre, même pour une sortie en un fichier.
    const chapters = splitChapters(blocks, x.outline);
    const split = opts.split === "chapters" && chapters;
    let files;
    if (split) {
      const title = (await pdf.getMetadata().catch(() => null))?.info?.Title || base;
      files = chapterFiles(chapters, title, { ...opts.chapterLabels, mdOpts });
    } else {
      files = [{ name: `${base}.md`, md: toMarkdown(blocks, mdOpts) }];
    }
    const list = blockAssets(blocks, { figures: opts.figures, tableImages: false });
    const assets = [];
    for (let k = 0; k < list.length; k++) {
      if (hooks.isCancelled?.()) return null;
      hooks.onStep?.("images", k, list.length);
      const a = list[k];
      assets.push({ path: a.path, ...(await renderCrop(pdf, a.page, a.box, a.kind)) });
    }
    const chapterOf = new Map();
    (chapters || []).forEach((c, k) => { for (const b of c.blocks) chapterOf.set(b, k); });
    const figures = blocks.filter(b => b.type === "figure").map(b => ({
      n: b.n, page: b.page, box: b.box, kind: b.kind, caption: b.caption || "", path: b.asset, chapter: chapterOf.get(b) ?? -1
    }));
    const chapterList = (chapters || []).map((c, k) => ({
      title: c.title || opts.chapterLabels?.intro || "", from: c.from, to: c.to,
      md: split ? files[k + 1].md : toMarkdown(c.blocks, mdOpts)
    }));
    const content = blocks.filter(b => b.type !== "pagebreak");
    const info = {
      pages: idx.length, of: pdf.numPages,
      tables: content.filter(b => b.type === "table").length,
      ocrTables: content.filter(b => b.type === "table" && b.ocr).length,
      figures: content.filter(b => b.type === "figure").length,
      uncertain: ocr ? ocr.uncertain : 0, ocrZones: ocr ? ocr.zones : 0, scans: ocr ? ocr.scans : 0,
      chapters: split ? chapters.length : 0,
      seconds: (performance.now() - t0) / 1000
    };
    const md = files.length === 1 ? files[0].md : files.map(f => f.md).join("\n\n---\n\n");
    return { files, md, assets, info, chapters: chapterList, figures };
  } finally {
    try { pdf.loadingTask?.destroy(); } catch { /* déjà libéré */ }
  }
}
