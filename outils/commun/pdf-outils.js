// Socle commun des outils PDF du site (PDFo Comparo, PDFo Converto) : pdf.js, mots positionnés,
// rendu de pages, scripts tiers chargés à la demande, téléchargement et archives .zip.
// Tout se passe dans le navigateur : aucun fichier n'est envoyé.

const VENDOR = new URL("../vendor/", import.meta.url);
const PDFJS_DIR = new URL("pdfjs-6.4.299/", VENDOR);

let pdfjsPromise = null;
/** Charge pdf.js (module) une seule fois. */
export function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(new URL("pdf.min.js", PDFJS_DIR).href).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", PDFJS_DIR).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * Ouvre un PDF avec pdf.js. `bytes` est copié : l'original reste utilisable (pdf-lib, etc.).
 * askPassword(reason) → Promise<string|null> pour les fichiers protégés.
 * extra : options pdf.js supplémentaires (ex. fontExtraProperties pour connaître le nom des polices).
 */
export async function openPdf(bytes, askPassword, extra = {}) {
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: bytes.slice(),
    cMapUrl: new URL("cmaps/", PDFJS_DIR).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", PDFJS_DIR).href,
    wasmUrl: new URL("wasm/", PDFJS_DIR).href,
    isEvalSupported: false,
    enableXfa: false,
    verbosity: 0,
    ...extra
  });
  if (askPassword) {
    task.onPassword = async (update, reason) => {
      const pw = await askPassword(reason === lib.PasswordResponses.INCORRECT_PASSWORD ? "incorrect" : "needed");
      if (pw === null || pw === undefined) task.destroy(); else update(pw);
    };
  }
  return task.promise;
}

/** Lit un File en Uint8Array. */
export async function readFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}

/** Vrai si les octets commencent par l'en-tête %PDF (tolère quelques octets parasites). */
export function looksLikePdf(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

// ---------------------------------------------------------------- Géométrie
/** Composition « appliquer m puis n » (convention PDF, vecteur ligne). */
export function mul(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
  ];
}
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/**
 * Informations d'une page en « espace d'affichage » : points PDF, origine en haut à gauche,
 * rotation /Rotate appliquée (comme à l'écran). vt : espace utilisateur PDF → affichage.
 */
export function pageInfo(page) {
  const vp = page.getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height, vt: vp.transform.slice(), view: page.view.slice(), rotate: page.rotate || 0 };
}

// ---------------------------------------------------------------- Rendu
/**
 * Rend une page dans un canevas. scale : pixels par point. offset/size permettent de rendre
 * la page déplacée dans un canevas de taille imposée (recalage d'une page sur une autre).
 */
export async function renderPage(page, { scale = 1, offsetX = 0, offsetY = 0, width, height, background = "#fff", canvas } = {}) {
  const viewport = page.getViewport({ scale, offsetX, offsetY });
  const c = canvas || document.createElement("canvas");
  c.width = Math.max(1, Math.round(width ?? viewport.width));
  c.height = Math.max(1, Math.round(height ?? viewport.height));
  const ctx = c.getContext("2d", { willReadFrequently: false });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvas: null, canvasContext: ctx, viewport, background }).promise;
  return c;
}

/** Libère la mémoire d'un canevas. */
export function dropCanvas(c) {
  if (c) { c.width = 0; c.height = 0; }
}

// ---------------------------------------------------------------- Texte
const measureCtx = (() => {
  let ctx = null;
  return () => ctx || (ctx = document.createElement("canvas").getContext("2d"));
})();

/**
 * Mots d'une page avec leur boîte en espace d'affichage (points, y vers le bas).
 * Chaque élément de texte pdf.js est découpé aux espaces ; la position de chaque mot est
 * estimée avec la chasse d'une police générique, mise à l'échelle de la largeur réelle.
 * Retourne { words: [{ s, x0, y0, x1, y1, h, line }], items } triés en ordre de lecture.
 */
export async function pageWords(page, info = pageInfo(page)) {
  const tc = await page.getTextContent({ disableNormalization: false });
  const ctx = measureCtx();
  const words = [];
  for (const [itemNo, it] of tc.items.entries()) {
    if (!it.str || !it.str.trim()) continue;
    // Polices de symboles (Word « Symbol », « Wingdings ») : U+F020–U+F0FF → caractère ASCII.
    if (/[\uf020-\uf0ff]/.test(it.str)) it.str = it.str.replace(/[\uf020-\uf0ff]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xf000));
    const st = tc.styles[it.fontName] || {};
    const m = mul(it.transform, info.vt); // espace texte → affichage
    const fs = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]) || 1;
    // Direction de la ligne de base et vecteur « vers le haut » en espace d'affichage.
    let ux = m[0], uy = m[1];
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul; uy /= ul;
    // Vecteur « vers le haut » du texte (image de l'axe y du texte ; y écran vers le bas).
    const vl = Math.hypot(m[2], m[3]) || 1;
    const vx = m[2] / vl, vy = m[3] / vl;
    const asc = st.ascent && st.ascent > 0.2 ? st.ascent : 0.8;
    const desc = st.descent && st.descent < 0 ? st.descent : -0.2;
    const width = it.width * (Math.hypot(info.vt[0], info.vt[1]) || 1);
    const family = st.fontFamily || "sans-serif";
    ctx.font = `100px ${family}`;
    const str = it.str;
    const total = ctx.measureText(str).width || str.length;
    // Un nombre avec espaces de milliers (« 24 000 », « 3 500,00 ») reste un seul mot.
    const re = /\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+(?:[.,]\d+)?(?!\d)|\S+/g;
    let mm;
    while ((mm = re.exec(str))) {
      const a = (ctx.measureText(str.slice(0, mm.index)).width / total) * width;
      const b = (ctx.measureText(str.slice(0, mm.index + mm[0].length)).width / total) * width;
      const ox = m[4], oy = m[5];
      const pts = [];
      for (const d of [a, b]) {
        for (const k of [asc, desc]) {
          pts.push([ox + ux * d + vx * k * fs, oy + uy * d + vy * k * fs]);
        }
      }
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      words.push({
        s: mm[0],
        x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
        h: fs, dir: Math.abs(ux) >= Math.abs(uy) ? (ux >= 0 ? 0 : 2) : (uy >= 0 ? 1 : 3), item: itemNo,
        bx: ox + ux * a, by: oy + uy * a // origine du mot sur la ligne de base
      });
    }
  }
  return { words: readingOrder(words), styles: tc.styles };
}

/**
 * Ordre de lecture géométrique : lignes de haut en bas, mots de gauche à droite.
 * Plus stable que l'ordre du flux PDF quand deux logiciels produisent le même document.
 */
export function readingOrder(words) {
  const horiz = words.filter(w => w.dir === 0);
  const other = words.filter(w => w.dir !== 0);
  horiz.sort((a, b) => a.by - b.by || a.x0 - b.x0);
  const lines = [];
  for (const w of horiz) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(w.by - last.by) <= Math.max(1.5, 0.45 * Math.min(w.h, last.h))) {
      last.words.push(w);
      last.h = Math.max(last.h, w.h);
    } else {
      lines.push({ by: w.by, h: w.h, words: [w] });
    }
  }
  const out = [];
  const head = /^\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})*$/, tail = /^\d{3}(?:[.,]\d+)?$/;
  lines.forEach((ln, i) => {
    ln.words.sort((a, b) => a.x0 - b.x0);
    let prev = null;
    for (const w of ln.words) {
      const gap = prev ? w.x0 - prev.x1 : 0;
      // Morceaux d'un même mot écrits séparément (« l » « ’ » « équipement ») : collés.
      // Groupes de milliers écrits en éléments séparés : réunis (« 24 » + « 000 »).
      // Même ligne de base et même taille de police, sinon ce sont deux textes distincts
      // qui se chevauchent (fréquent sur un plan : cote posée sur un titre).
      const aligned = prev && Math.abs(w.by - prev.by) < 0.15 * w.h && Math.abs(w.h - prev.h) < 0.1 * w.h;
      const glued = aligned && gap < 0.1 * w.h && gap > -0.05 * w.h && prev.item !== w.item;
      const thousands = aligned && head.test(prev.s) && tail.test(w.s) && gap > 0 && gap < 0.6 * w.h;
      if (glued || thousands) {
        prev.s += glued ? w.s : " " + w.s;
        prev.item = w.item;
        prev.x1 = Math.max(prev.x1, w.x1); prev.y0 = Math.min(prev.y0, w.y0); prev.y1 = Math.max(prev.y1, w.y1);
        continue;
      }
      w.line = i;
      out.push(w);
      prev = w;
    }
  });
  // Textes verticaux (cotes de plans) : regroupés par colonne, à la fin.
  other.sort((a, b) => a.dir - b.dir || Math.round(a.bx) - Math.round(b.bx) || a.by - b.by);
  let li = lines.length;
  let prev = null;
  for (const w of other) {
    if (!prev || prev.dir !== w.dir || Math.abs(prev.bx - w.bx) > Math.max(1.5, 0.45 * w.h)) li++;
    w.line = li;
    out.push(w);
    prev = w;
  }
  return out;
}

// ---------------------------------------------------------------- Scripts tiers
const scriptCache = new Map();
/** Charge un script classique de outils/vendor/ (pdf-lib, fflate, marked, pptxgenjs). */
export function vendorScript(file, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (!scriptCache.has(file)) {
    scriptCache.set(file, new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = new URL(file, VENDOR).href;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = () => { scriptCache.delete(file); reject(new Error(`Échec du chargement de ${file}`)); };
      document.head.append(s);
    }));
  }
  return scriptCache.get(file);
}
export const pdfLib = () => vendorScript("pdf-lib-1.17.1.min.js", "PDFLib");
export const fflate = () => vendorScript("fflate-0.8.3.min.js", "fflate");
export const marked = () => vendorScript("marked-18.1.1.umd.js", "marked");
export const pptxgen = () => vendorScript("pptxgenjs-4.0.1.bundle.js", "PptxGenJS");

// ---------------------------------------------------------------- Fichiers
/** Télécharge un Blob sous un nom donné. */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Archive .zip. entries : [{ name, data: Uint8Array|string, store?: bool }].
 * Les images déjà compressées (JPEG, PNG) sont stockées sans recompression.
 */
export async function zip(entries) {
  const ff = await fflate();
  const enc = new TextEncoder();
  const obj = {};
  for (const e of entries) {
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    obj[e.name] = [data, { level: e.store ? 0 : 6 }];
  }
  return new Blob([ff.zipSync(obj)], { type: "application/zip" });
}

/** Nom de fichier sûr (sans caractères interdits sous Windows), sans extension. */
export function safeName(s, fallback = "document") {
  const clean = String(s || "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim();
  return (clean || fallback).slice(0, 120);
}

/** Taille lisible (Ko, Mo). */
export function fmtBytes(n, locale = "fr-CA") {
  const u = locale.startsWith("fr") ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${u[i]}`;
}

/** Laisse respirer l'interface entre deux tâches lourdes. */
export const idle = () => new Promise(r => setTimeout(r, 0));

/**
 * Analyse une liste de pages « 1-3, 5, 8-10 » (base 1) en indices (base 0) valides.
 * Vide ou « toutes / all » : toutes les pages. Retourne null si la saisie est invalide.
 */
export function parseRange(text, count) {
  const s = String(text || "").trim().toLowerCase();
  if (!s || s === "toutes" || s === "tout" || s === "all") return [...Array(count).keys()];
  const out = [];
  for (const part of s.split(/[,;]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)?\s*[-–à]\s*(\d+)?$/) || p.match(/^(\d+)$/);
    if (!m) return null;
    let a, b;
    if (m.length === 2) { a = b = +m[1]; } else { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : count; }
    if (a < 1 || b < a || a > count) return null;
    for (let i = a; i <= Math.min(b, count); i++) out.push(i - 1);
  }
  return out.length ? [...new Set(out)] : null;
}

/** Échappe le texte pour l'insérer dans du HTML. */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
