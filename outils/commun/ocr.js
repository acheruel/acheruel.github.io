// OCR local des zones en image d'un PDF : tableaux insérés comme images, texte des figures,
// équations dessinées, pages numérisées. Tesseract.js (Apache 2.0) tourne dans le navigateur ;
// seuls le moteur et les données de langue (environ 6 Mo) sont téléchargés depuis jsDelivr,
// une fois, puis gardés en cache. Le fichier ne quitte pas l'appareil.
//
// Tableau en image : la grille est retrouvée dans l'image (grille.js), puis chaque cellule est
// lue séparément, agrandie deux fois (le point décimal d'un « 85.2 » se perd sinon). Une
// cellule numérique est relue à une autre échelle : si les deux lectures diffèrent, la valeur
// est signalée « à vérifier ». Un chiffre faux bien formaté est pire qu'un chiffre absent.
import { renderPage, dropCanvas } from "./pdf-outils.js";
import { findGrid, eraseLines, crop, hasInk, gridTable } from "./grille.js";

const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js";
export const OCR_ENGINE = "Tesseract.js 7.0.0";
const DPI = 300;
const NUMERIC = /^[-+−±]?\(?\d[\d\s.,/%()<>=≤≥×x-]*$/;

let enginePromise = null;
/** Moteur OCR (un seul, réutilisé). onStatus({ status, progress }) pendant le chargement. */
export function ocrEngine({ langs = ["eng", "fra"], onStatus } = {}) {
  if (!enginePromise) {
    enginePromise = (async () => {
      const T = (await import(TESSERACT)).default;
      const w = await T.createWorker(langs, 1, { logger: m => onStatus?.(m) });
      await w.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
      return w;
    })().catch(e => { enginePromise = null; throw e; });
  }
  return enginePromise;
}
export async function stopOcr() {
  if (!enginePromise) return;
  const p = enginePromise;
  enginePromise = null;
  try { await (await p).terminate(); } catch { /* déjà arrêté */ }
}

/** ImageData → canevas, agrandi k fois (lissage de qualité). */
function canvasOf(img, k = 1) {
  const src = document.createElement("canvas");
  src.width = img.width; src.height = img.height;
  src.getContext("2d").putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  if (k === 1) return src;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  src.width = src.height = 0;
  return c;
}

const DIGITS = "0123456789.,-+/()%<>= ";
/** Valeur numérique, éventuellement abîmée par l'OCR (« a7.7 », « 3O.5 ») : surtout des chiffres. */
function looksNumeric(s) {
  if (!s || s.length > 16 || /\s\S+\s/.test(s)) return false;
  const al = s.replace(/[^\p{L}\p{N}]/gu, "");
  const d = (al.match(/\d/g) || []).length;
  return d >= 1 && d / al.length >= 0.6;
}

/** Bruit d'OCR sur un croquis : beaucoup de « mots » d'un ou deux signes, ou des symboles isolés. */
function noise(s, confidence) {
  const tok = s.split(/\s+/).filter(Boolean);
  if (tok.length < 5 || confidence >= 75) return false;
  const bad = tok.filter(x => x.length <= 2 && !/^\d+$/.test(x) || /[^\p{L}\p{N}.,:;()\-+/%=<>'’"°]/u.test(x)).length;
  return bad / tok.length > 0.55;
}

async function read(w, canvas, psm, whitelist = "") {
  await w.setParameters({ tessedit_pageseg_mode: String(psm), tessedit_char_whitelist: whitelist });
  const r = await w.recognize(canvas, {}, { text: true, blocks: psm !== 7 && psm !== 6 ? true : false });
  canvas.width = canvas.height = 0;
  return r.data;
}

/** Zone d'une page rendue à 300 ppp (6 000 px au plus sur le grand côté) : ImageData. */
async function renderRegion(pdf, pageIndex, box, pad = 4) {
  const page = await pdf.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: 1 });
  const x0 = Math.max(0, box.x0 - pad), y0 = Math.max(0, box.y0 - pad);
  const x1 = Math.min(vp.width, box.x1 + pad), y1 = Math.min(vp.height, box.y1 + pad);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const scale = Math.min(DPI / 72, 6000 / Math.max(w, h));
  const c = await renderPage(page, { scale, offsetX: -x0 * scale, offsetY: -y0 * scale, width: w * scale, height: h * scale });
  const img = c.getContext("2d").getImageData(0, 0, c.width, c.height);
  dropCanvas(c);
  page.cleanup();
  return { width: img.width, height: img.height, data: img.data };
}

// Retours à la ligne : « In-\nplane » → « In-plane » ; sinon un espace.
const clean = s => s.replace(/[|]/g, " ").replace(/(\p{L})-\s*\n\s*(?=\p{L})/gu, "$1-").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

/**
 * Tableau dessiné dans l'image : { rows, spans, uncertain: [{ r0, c0, value, alt }] } ou null.
 */
async function readTable(w, img, grid, L) {
  const cleanImg = eraseLines(img, grid.lineMask);
  const texts = [], uncertain = [];
  for (const cl of grid.cells) {
    if (!hasInk(img, cl.box, grid.lineMask)) { texts.push(""); continue; }
    const b = cl.box;
    const part = crop(cleanImg, { x0: b.x0 + 2, y0: b.y0 + 2, x1: b.x1 - 2, y1: b.y1 - 2 });
    const r1 = await read(w, canvasOf(part, 2), 6);
    let text = clean(r1.text);
    if (looksNumeric(text)) {
      // Deuxième lecture, à une autre échelle et limitée aux chiffres ; désaccord : la valeur est
      // signalée. Une lettre dans un nombre (« a7.7 ») cède la place à la lecture en chiffres.
      const r2 = await read(w, canvasOf(part, 3), 7, DIGITS);
      const alt = clean(r2.text);
      // « N46 » contre « 46 » : la lecture en chiffres a seulement perdu la lettre, pas de doute.
      if (alt && alt !== text && text.replace(/\p{L}/gu, "").trim() !== alt) {
        const first = text;
        // Lettre qui ressemble à un chiffre (a→4, O→0, l→1, S→5) : la lecture en chiffres l'emporte.
        const confusable = /\p{L}/u.test(first) && !/[^\d\s.,\-+/()%<>=oOIlSsZzBgqaAQD|]/.test(first);
        text = confusable && NUMERIC.test(alt) ? alt : /\p{L}/u.test(first) ? first : r2.confidence > r1.confidence ? alt : first;
        uncertain.push({ cell: texts.length, value: text, alt: text === first ? alt : first });
      }
    } else if (text && ((r1.confidence < 45 && !/\d[.,]\d|[<>=≤≥]\s*\d/.test(text)) || noise(text, r1.confidence))) {
      // Croquis dans une cellule : l'OCR n'en tire que du bruit.
      text = L.drawing;
    }
    texts.push(text);
  }
  const t = gridTable(grid, texts);
  if (t.rows.length < 2 || Math.max(...t.rows.map(r => r.filter(Boolean).length)) < 2) return null;
  // Position (ligne, colonne) des valeurs incertaines, pour les citer.
  const where = k => { const cl = grid.cells[k]; return { r0: cl.r0, c0: cl.c0 }; };
  return { ...t, uncertain: uncertain.map(u => ({ ...where(u.cell), value: u.value, alt: u.alt })) };
}

/** Copie de l'image avec un rectangle peint en blanc. */
function whiteOut(img, box) {
  const data = new Uint8ClampedArray(img.data);
  for (let y = Math.max(0, box.y0 - 4); y < Math.min(img.height, box.y1 + 4); y++) data.fill(255, (y * img.width + Math.max(0, box.x0 - 4)) * 4, (y * img.width + Math.min(img.width, box.x1 + 4)) * 4);
  return { data, width: img.width, height: img.height };
}

/** Texte d'une zone sans grille (figure, équation, page numérisée) : paragraphes, mots sûrs seulement. */
async function readText(w, img, scan) {
  const k = img.width < 900 ? 2 : 1;
  const d = await read(w, canvasOf(img, k), scan ? 3 : 11);
  const paras = [];
  for (const b of d.blocks || []) for (const p of b.paragraphs || []) {
    const lines = (p.lines || []).map(l => (l.words || []).filter(x => x.confidence >= (scan ? 50 : 70) && (x.text.length > 1 || /\d/.test(x.text))).map(x => x.text).join(" ")).filter(Boolean);
    if (lines.length) paras.push({ text: lines.join(scan ? " " : "\n"), y: (p.bbox?.y0 ?? 0) / k });
  }
  return { paras, confidence: d.confidence };
}

/**
 * OCR des blocs d'une extraction (pdf-extract.js) : les figures en image et les pages numérisées
 * sont lues. Un tableau trouvé dans une image devient un bloc « table » marqué ocr ; le texte
 * d'une figure va dans sa fiche ; une page numérisée devient des paragraphes.
 * opts : { onProgress(i, n), onStatus, isCancelled(), labels: { drawing } }
 * Retourne { blocks, stats: { zones, tables, figures, scans, uncertain, seconds } }.
 */
export async function ocrBlocks(pdf, blocks, opts = {}) {
  const L = { drawing: "[dessin]", ...opts.labels };
  const todo = blocks.filter(b => b.type === "figure" && (b.kind === "image" || b.kind === "scan"));
  const stats = { zones: todo.length, tables: 0, figures: 0, scans: 0, uncertain: 0, seconds: 0 };
  if (!todo.length) return { blocks, stats };
  const t0 = performance.now();
  const w = await ocrEngine({ onStatus: opts.onStatus });
  const out = [];
  let k = 0, tabNo = 0;
  for (const b of blocks) {
    if (!todo.includes(b)) { out.push(b); continue; }
    if (opts.isCancelled?.()) return null;
    opts.onProgress?.(k++, todo.length);
    const img = await renderRegion(pdf, b.page, b.box, b.kind === "scan" ? 0 : 4);
    // Page numérisée : un tableau peut n'en occuper qu'une partie.
    const grid = findGrid(img, { minArea: b.kind === "scan" ? 0.03 : 0.25 });
    const table = grid ? await readTable(w, img, grid, L) : null;
    if (table && b.kind === "scan") {
      // Le tableau à sa place, entre les paragraphes au-dessus et au-dessous ; le reste de la page lu sans lui.
      stats.scans++; stats.tables++;
      stats.uncertain += table.uncertain.length;
      const { paras } = await readText(w, whiteOut(img, grid.box), true);
      const s = (b.box.x1 - b.box.x0) / img.width;
      const tbox = { x0: b.box.x0 + grid.box.x0 * s, y0: b.box.y0 + grid.box.y0 * s, x1: b.box.x0 + grid.box.x1 * s, y1: b.box.y0 + grid.box.y1 * s };
      const tag = `p${String(b.page + 1).padStart(3, "0")}`;
      const para = p => ({ type: "p", runs: [{ t: p.text, b: false, i: false }], page: b.page, ocr: true });
      out.push({ ...b, ocr: true, labels: [] });
      for (const p of paras.filter(p => p.y < grid.box.y0)) out.push(para(p));
      out.push({ type: "table", rows: table.rows, spans: table.spans, page: b.page,
        parts: [{ page: b.page, box: tbox, asset: `images/${tag}-tableau-ocr${++tabNo}.png` }],
        ocr: { uncertain: table.uncertain, engine: OCR_ENGINE } });
      for (const p of paras.filter(p => p.y >= grid.box.y0)) out.push(para(p));
      continue;
    }
    if (table) {
      stats.tables++;
      stats.uncertain += table.uncertain.length;
      const tag = `p${String(b.page + 1).padStart(3, "0")}`;
      out.push({ type: "table", rows: table.rows, spans: table.spans, page: b.page, caption: b.caption,
        parts: [{ page: b.page, box: b.box, asset: `images/${tag}-tableau-ocr${++tabNo}.png` }],
        ocr: { uncertain: table.uncertain, engine: OCR_ENGINE } });
      continue;
    }
    const { paras } = await readText(w, img, b.kind === "scan");
    if (b.kind === "scan") {
      stats.scans++;
      out.push({ ...b, ocr: true, labels: [] });
      for (const p of paras) out.push({ type: "p", runs: [{ t: p.text, b: false, i: false }], page: b.page, ocr: true });
    } else {
      if (paras.length) stats.figures++;
      out.push({ ...b, ocr: true, labels: paras.length ? paras.map(p => p.text.replace(/\n/g, " · ")) : b.labels });
    }
  }
  opts.onProgress?.(todo.length, todo.length);
  stats.seconds = (performance.now() - t0) / 1000;
  return { blocks: out, stats };
}
