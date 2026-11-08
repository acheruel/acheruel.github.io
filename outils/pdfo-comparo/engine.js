// PDFo Comparo : moteur d'analyse dans le navigateur.
// Documents (pdf.js), empreintes de pages, appariement, recalage automatique, comparaison
// visuelle par masques d'encre, zones de changements et comparaison du texte.
import { openPdf, readFile, looksLikePdf, pageInfo, pageWords, renderPage, dropCanvas, idle } from "../commun/pdf-outils.js";
import { diffSeq, groupChanges, alignPages, dice, correlation, fitSimilarity, wordKey } from "./algos.js";

const FP = 32; // côté de l'empreinte visuelle d'une page (pixels)
export const MM = 72 / 25.4; // points par millimètre

// ---------------------------------------------------------------- Document
export class Doc {
  constructor(name, size, bytes, pdf) {
    this.name = name;
    this.size = size;
    this.bytes = bytes;
    this.pdf = pdf;
    this.n = pdf.numPages;
    this._pages = new Map();
    this._info = new Map();
    this._words = new Map();
    this._thumbs = new Map();
  }

  static async load(file, askPassword) {
    // { name, bytes } (exemples) ou File (attention : File.bytes est une méthode dans les navigateurs récents).
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : await readFile(file);
    if (!looksLikePdf(bytes)) throw Object.assign(new Error("not-pdf"), { code: "not-pdf" });
    const pdf = await openPdf(bytes, askPassword);
    return new Doc(file.name, bytes.length, bytes, pdf);
  }

  async page(i) {
    if (!this._pages.has(i)) this._pages.set(i, this.pdf.getPage(i + 1));
    return this._pages.get(i);
  }

  async info(i) {
    if (!this._info.has(i)) this._info.set(i, pageInfo(await this.page(i)));
    return this._info.get(i);
  }

  /** Mots positionnés (espace d'affichage) avec leur clé de comparaison. */
  async words(i) {
    if (!this._words.has(i)) {
      this._words.set(i, (async () => {
        const page = await this.page(i);
        try {
          const { words } = await pageWords(page, await this.info(i));
          return words;
        } catch {
          return [];
        }
      })());
    }
    return this._words.get(i);
  }

  /** Vignette (≈ 150 px) et empreinte 32 × 32 en niveaux d'encre. */
  async thumb(i) {
    if (!this._thumbs.has(i)) {
      this._thumbs.set(i, (async () => {
        const page = await this.page(i);
        const inf = await this.info(i);
        const scale = 150 / Math.max(inf.w, inf.h);
        const canvas = await renderPage(page, { scale });
        const fpC = document.createElement("canvas");
        fpC.width = fpC.height = FP;
        const ctx = fpC.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, 0, FP, FP);
        const px = ctx.getImageData(0, 0, FP, FP).data;
        const fp = new Float32Array(FP * FP);
        for (let k = 0; k < fp.length; k++) fp[k] = 255 - (0.3 * px[4 * k] + 0.59 * px[4 * k + 1] + 0.11 * px[4 * k + 2]);
        return { canvas, fp };
      })());
    }
    return this._thumbs.get(i);
  }

  destroy() {
    for (const t of this._thumbs.values()) t.then(x => dropCanvas(x.canvas)).catch(() => {});
    // pdf.js 6 : on détruit la tâche de chargement (libère le travailleur et la mémoire).
    try { (this.pdf.loadingTask || this.pdf).destroy?.(); } catch { /* déjà libéré */ }
  }
}

// ---------------------------------------------------------------- Appariement
/** Multiensemble des mots significatifs d'une page. */
function tokenBag(words) {
  const bag = new Map();
  let n = 0;
  for (const w of words) {
    const k = wordKey(w.s, true).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (k.length < 2 && !/\d/.test(k)) continue;
    bag.set(k, (bag.get(k) || 0) + 1);
    n++;
  }
  return { bag, n };
}

/**
 * Apparie les pages retenues de A et B. detect = false : appariement page à page.
 * Retourne [{ a, b, sim }] (indices de pages, null pour une page seule).
 */
export async function pairPages(A, idxA, B, idxB, { detect = true, onProgress } = {}) {
  if (!detect) {
    const out = [];
    for (let k = 0; k < Math.max(idxA.length, idxB.length); k++) out.push({ a: idxA[k] ?? null, b: idxB[k] ?? null, sim: null });
    return out;
  }
  const total = idxA.length + idxB.length;
  let done = 0;
  const prep = async (D, idx) => {
    const out = [];
    for (const i of idx) {
      const [{ fp }, words] = await Promise.all([D.thumb(i), D.words(i)]);
      out.push({ fp, ...tokenBag(words) });
      onProgress?.(++done, total);
    }
    return out;
  };
  const pa = await prep(A, idxA);
  const pb = await prep(B, idxB);
  const S = pa.map(x => pb.map(y => {
    const vis = Math.max(0, correlation(x.fp, y.fp));
    if (x.n >= 8 && y.n >= 8) return 0.6 * dice(x.bag, x.n, y.bag, y.n) + 0.4 * vis;
    return vis;
  }));
  return alignPages(S, idxA.length, idxB.length).map(p => ({
    a: p.a === null ? null : idxA[p.a],
    b: p.b === null ? null : idxB[p.b],
    sim: p.a !== null && p.b !== null ? S[p.a][p.b] : null
  }));
}

// ---------------------------------------------------------------- Recalage automatique
/**
 * Transformation T (A → B, espace d'affichage en points) : x_B = s·x_A + tx.
 * 1) Par le texte : mots présents une seule fois sur chaque page (consensus robuste).
 * 2) Sinon par l'image : cadre de l'encre, puis recherche locale de la translation.
 */
export async function autoAlign(A, ia, B, ib) {
  const [wa, wb, infA, infB] = await Promise.all([A.words(ia), B.words(ib), A.info(ia), B.info(ib)]);
  const diag = Math.hypot(infB.w, infB.h);
  const accept = plausible(infA, infB);
  const uniq = ws => {
    const m = new Map();
    for (const w of ws) {
      const k = wordKey(w.s, false);
      if (k.length < 2 && !/\d/.test(k)) continue;
      m.set(k, m.has(k) ? null : w);
    }
    return m;
  };
  const ua = uniq(wa), ub = uniq(wb);
  const pts = [];
  for (const [k, w] of ua) {
    const v = w && ub.get(k);
    if (!v) continue;
    pts.push({ ax: (w.x0 + w.x1) / 2, ay: (w.y0 + w.y1) / 2, bx: (v.x0 + v.x1) / 2, by: (v.y0 + v.y1) / 2 });
  }
  if (pts.length >= 4) {
    const fit = fitSimilarity(pts, Math.max(1.5, 0.0025 * diag), { minInliers: 4, accept });
    if (fit && fit.inliers >= Math.max(4, 0.25 * pts.length)) return { s: fit.s, tx: fit.tx, ty: fit.ty, method: "text", support: fit.inliers };
  }
  return imageAlign(A, ia, B, ib, infA, infB);
}

/**
 * Un décalage d'impression garde la page presque entière dans la page de l'autre version :
 * la page A transformée doit recouvrir la page B à au moins 85 % (rapport intersection / union).
 * Un « décalage » plus grand est en réalité du contenu qui a glissé (texte refondu).
 */
export function plausible(infA, infB, minIoU = 0.85) {
  return (s, tx, ty) => {
    const x0 = tx, y0 = ty, x1 = tx + s * infA.w, y1 = ty + s * infA.h;
    const ix = Math.max(0, Math.min(x1, infB.w) - Math.max(x0, 0));
    const iy = Math.max(0, Math.min(y1, infB.h) - Math.max(y0, 0));
    const inter = ix * iy;
    const union = s * s * infA.w * infA.h + infB.w * infB.h - inter;
    return union > 0 && inter / union >= minIoU;
  };
}

async function inkSmall(D, i, k) {
  const page = await D.page(i);
  const c = await renderPage(page, { scale: k });
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const ink = new Uint8Array(c.width * c.height);
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const j = y * c.width + x;
      if (255 - (0.3 * px[4 * j] + 0.59 * px[4 * j + 1] + 0.11 * px[4 * j + 2]) > 60) {
        ink[j] = 1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const W = c.width, H = c.height;
  dropCanvas(c);
  return { ink, W, H, box: x1 >= 0 ? [x0, y0, x1, y1] : null };
}

async function imageAlign(A, ia, B, ib, infA, infB) {
  const k = 700 / Math.max(infB.w, infB.h);
  const [a, b] = await Promise.all([inkSmall(A, ia, k), inkSmall(B, ib, k)]);
  const none = { s: 1, tx: 0, ty: 0, method: "none", support: 0 };
  if (!a.box || !b.box) return none;
  const dilB = dilate(b.ink, b.W, b.H, 1);
  // Recouvrement : part de l'encre de A (transformée) qui tombe sur l'encre de B.
  const score = (s, txp, typ) => {
    let hit = 0, tot = 0;
    for (let y = 0; y < a.H; y += 1) {
      for (let x = 0; x < a.W; x += 1) {
        if (!a.ink[y * a.W + x]) continue;
        tot++;
        const X = Math.round(s * x + txp), Y = Math.round(s * y + typ);
        if (X >= 0 && Y >= 0 && X < b.W && Y < b.H && dilB[Y * b.W + X]) hit++;
      }
    }
    return tot ? hit / tot : 0;
  };
  const cands = [{ s: 1, tx: 0, ty: 0 }];
  const [ax0, ay0, ax1, ay1] = a.box, [bx0, by0, bx1, by1] = b.box;
  const sx = (bx1 - bx0) / Math.max(1, ax1 - ax0), sy = (by1 - by0) / Math.max(1, ay1 - ay0);
  if (Math.abs(sx - sy) < 0.02 * Math.max(sx, sy) && sx > 0.5 && sx < 2) {
    const s = (sx + sy) / 2;
    cands.push({ s, tx: bx0 - s * ax0, ty: by0 - s * ay0 });
  }
  cands.push({ s: 1, tx: bx0 - ax0, ty: by0 - ay0 });
  let best = null;
  const ok = plausible(infA, infB);
  for (const c of cands) {
    if (!ok(c.s, c.tx / k, c.ty / k)) continue;
    let cur = { ...c, sc: score(c.s, c.tx, c.ty) };
    // Recherche locale de la translation (pas de 2 px puis 1 px).
    for (const step of [3, 1]) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
          const sc = score(cur.s, cur.tx + dx, cur.ty + dy);
          if (sc > cur.sc + 1e-4) { cur = { s: cur.s, tx: cur.tx + dx, ty: cur.ty + dy, sc }; improved = true; }
        }
      }
    }
    if (!best || cur.sc > best.sc) best = cur;
  }
  const id = score(1, 0, 0);
  if (!best || best.sc < id + 0.02) return none;
  if (!plausible(infA, infB)(best.s, best.tx / k, best.ty / k)) return none;
  return { s: best.s, tx: best.tx / k, ty: best.ty / k, method: "image", support: Math.round(best.sc * 100) };
}

// ---------------------------------------------------------------- Masques et zones
/** Dilatation d'un masque binaire (carré de demi-côté r), en deux passes linéaires. */
export function dilate(mask, W, H, r) {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let last = -1e9;
    for (let x = 0; x < W; x++) { if (mask[row + x]) last = x; if (x - last <= r) tmp[row + x] = 1; }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (mask[row + x]) last = x; if (last - x <= r) tmp[row + x] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; }
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; }
  }
  return out;
}

const darkness = (canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const d = new Uint8Array(canvas.width * canvas.height);
  for (let j = 0; j < d.length; j++) d[j] = 255 - ((77 * px[4 * j] + 151 * px[4 * j + 1] + 28 * px[4 * j + 2]) >> 8);
  return d;
};

/**
 * Rend les deux pages d'une paire dans le repère de B (A recalée par T).
 * res : nombre de pixels sur le grand côté de B. Retourne les canevas et les niveaux d'encre.
 */
export async function renderPair(A, ia, B, ib, T, res) {
  const infB = ib !== null ? await B.info(ib) : await A.info(ia);
  let k = res / Math.max(infB.w, infB.h);
  const maxPx = 18e6;
  if (infB.w * infB.h * k * k > maxPx) k = Math.sqrt(maxPx / (infB.w * infB.h));
  const W = Math.round(infB.w * k), H = Math.round(infB.h * k);
  const out = { k, W, H, cA: null, cB: null, dA: null, dB: null };
  if (ib !== null) {
    out.cB = await renderPage(await B.page(ib), { scale: k, width: W, height: H });
    out.dB = darkness(out.cB);
  }
  if (ia !== null) {
    const t = ib !== null ? T : { s: 1, tx: 0, ty: 0 };
    out.cA = await renderPage(await A.page(ia), { scale: k * t.s, offsetX: t.tx * k, offsetY: t.ty * k, width: W, height: H });
    out.dA = darkness(out.cA);
  }
  return out;
}

/**
 * Rendu haute définition d'une région (points, repère de B) pour la netteté au zoom.
 * kd : pixels par point. Même structure que renderPair, limitée à la région.
 */
export async function renderRegion(A, ia, B, ib, T, kd, x0, y0, w, h) {
  const W = Math.max(1, Math.round(w * kd)), H = Math.max(1, Math.round(h * kd));
  const out = { k: kd, W, H, cA: null, cB: null, dA: null, dB: null };
  if (ib !== null) {
    out.cB = await renderPage(await B.page(ib), { scale: kd, offsetX: -x0 * kd, offsetY: -y0 * kd, width: W, height: H });
    out.dB = darkness(out.cB);
  }
  if (ia !== null) {
    const t = ib !== null ? T : { s: 1, tx: 0, ty: 0 };
    out.cA = await renderPage(await A.page(ia), { scale: kd * t.s, offsetX: (t.tx - x0) * kd, offsetY: (t.ty - y0) * kd, width: W, height: H });
    out.dA = darkness(out.cA);
  }
  return out;
}

/**
 * Masques des différences. tolMm : tolérance de position (mm sur le papier).
 * Un trait est « supprimé » s'il est dans A et qu'aucune encre de B n'est à moins de la tolérance.
 */
export function diffMasks(r, tolMm, thr = 48, minRad = 0) {
  const { W, H, k } = r;
  const N = W * H;
  const rad = Math.max(minRad, Math.round(tolMm * MM * k));
  const inkA = new Uint8Array(N), inkB = new Uint8Array(N), seeA = new Uint8Array(N), seeB = new Uint8Array(N);
  const lo = thr >> 1;
  if (r.dA) for (let j = 0; j < N; j++) { inkA[j] = r.dA[j] > thr; seeA[j] = r.dA[j] > lo; }
  if (r.dB) for (let j = 0; j < N; j++) { inkB[j] = r.dB[j] > thr; seeB[j] = r.dB[j] > lo; }
  const nearA = dilate(seeA, W, H, rad), nearB = dilate(seeB, W, H, rad);
  const removed = new Uint8Array(N), added = new Uint8Array(N);
  let nRem = 0, nAdd = 0, nInk = 0;
  for (let j = 0; j < N; j++) {
    if (inkA[j] && !nearB[j]) { removed[j] = 1; nRem++; }
    if (inkB[j] && !nearA[j]) { added[j] = 1; nAdd++; }
    if (inkA[j] || inkB[j]) nInk++;
  }
  // nearA / nearB servent aussi à l'affichage (encre propre à une version, en niveaux continus).
  return { removed, added, nearA, nearB, nRem, nAdd, nInk, rad };
}

/**
 * Zones de changements : grille de cellules, regroupement des cellules proches (gapMm),
 * puis composantes connexes. Boîtes en points, repère d'affichage de B.
 */
export function findZones(r, m, { gapMm = 4, minPx = 8 } = {}) {
  const { W, H, k } = r;
  const cell = Math.max(3, Math.round(1.2 * MM * k));
  const GW = Math.ceil(W / cell), GH = Math.ceil(H / cell);
  const cDel = new Int32Array(GW * GH), cAdd = new Int32Array(GW * GH);
  for (let y = 0; y < H; y++) {
    const gy = ((y / cell) | 0) * GW;
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (m.removed[j]) cDel[gy + ((x / cell) | 0)]++;
      else if (m.added[j]) cAdd[gy + ((x / cell) | 0)]++;
    }
  }
  const flag = new Uint8Array(GW * GH);
  for (let g = 0; g < flag.length; g++) flag[g] = cDel[g] + cAdd[g] > 0 ? 1 : 0;
  const gap = Math.max(1, Math.ceil((gapMm * MM * k) / cell));
  const grown = dilate(flag, GW, GH, gap);
  const label = new Int32Array(GW * GH).fill(-1);
  const zones = [];
  const stack = [];
  for (let g0 = 0; g0 < grown.length; g0++) {
    if (!grown[g0] || label[g0] >= 0) continue;
    const z = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, del: 0, add: 0 };
    label[g0] = zones.length;
    stack.push(g0);
    while (stack.length) {
      const g = stack.pop();
      const gx = g % GW, gy = (g / GW) | 0;
      if (flag[g]) {
        if (gx < z.x0) z.x0 = gx; if (gx > z.x1) z.x1 = gx;
        if (gy < z.y0) z.y0 = gy; if (gy > z.y1) z.y1 = gy;
        z.del += cDel[g]; z.add += cAdd[g];
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ng = ny * GW + nx;
        if (grown[ng] && label[ng] < 0) { label[ng] = zones.length; stack.push(ng); }
      }
    }
    zones.push(z);
  }
  const pad = 1.5 * MM;
  let out = zones
    .filter(z => z.x1 >= 0 && z.del + z.add >= minPx)
    .map(z => ({
      del: z.del, add: z.add,
      x0: Math.max(0, (z.x0 * cell) / k - pad), y0: Math.max(0, (z.y0 * cell) / k - pad),
      x1: Math.min(W / k, ((z.x1 + 1) * cell) / k + pad), y1: Math.min(H / k, ((z.y1 + 1) * cell) / k + pad),
      text: []
    }));
  // Des cadres qui se chevauchent prêtent à confusion : on les réunit.
  let merged = true;
  while (merged && out.length < 1500) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
          out[i] = { del: a.del + b.del, add: a.add + b.add, x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), text: [] };
          out.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  out = out.map(z => {
    const tot = z.del + z.add;
    return { ...z, kind: z.del < 0.12 * tot ? "add" : z.add < 0.12 * tot ? "del" : "mod" };
  });
  // Ordre de lecture : bandes horizontales, puis de gauche à droite.
  const band = 40;
  out.sort((a, b) => Math.floor(a.y0 / band) - Math.floor(b.y0 / band) || a.x0 - b.x0);
  return out.slice(0, 400);
}

/**
 * Image affichée, dans l'esprit du PDF comparé : l'encre garde ses niveaux (bords lissés, texte
 * net) au lieu d'être seuillée en aplats. Encre commune en gris (opacité réglable), encre propre à
 * l'ancienne en couleur « supprimé », propre à la nouvelle en couleur « ajouté », combinées en
 * produit (comme le mode « Produit » de l'export). « thick » ajoute un liseré pâle autour des
 * traits modifiés (rayon en pixels du canevas) pour les repérer sans empâter les lettres.
 * view : "overlay" | "old" | "new". Retourne un ImageData.
 */
export function compose(r, m, { colDel, colAdd, fade = 0.35, thick = 1, view = "overlay" }) {
  const { W, H } = r;
  const N = W * H;
  const img = new ImageData(W, H);
  const px = img.data;
  const showA = view !== "new", showB = view !== "old";
  const f = view === "overlay" ? fade : 1; // vues seules : l'inchangé reste noir, lisible
  const haloDel = showA && thick > 0 ? dilate(m.removed, W, H, thick) : null;
  const haloAdd = showB && thick > 0 ? dilate(m.added, W, H, thick) : null;
  const HALO = 0.2;
  // Absorption de chaque couleur (1 − composante) : multiplier par (1 − encre × absorption).
  const kD = colDel.map(c => 1 - c / 255), kA = colAdd.map(c => 1 - c / 255);
  const dA = showA ? r.dA : null, dB = showB ? r.dB : null;
  const nearA = m.nearA, nearB = m.nearB;
  for (let j = 0, o = 0; j < N; j++, o += 4) {
    const a = dA ? dA[j] / 255 : 0, b = dB ? dB[j] / 255 : 0;
    const del = a && !(nearB && nearB[j]) ? a : 0; // encre de l'ancienne sans voisine dans la nouvelle
    const add = b && !(nearA && nearA[j]) ? b : 0;
    const com = Math.max(a - del, b - add) * f;
    let R = 1 - com, G = R, B = 1 - com * 0.94;
    if (haloDel && haloDel[j] && del < 0.25) { const h = HALO * (1 - del); R *= 1 - h * kD[0]; G *= 1 - h * kD[1]; B *= 1 - h * kD[2]; }
    if (haloAdd && haloAdd[j] && add < 0.25) { const h = HALO * (1 - add); R *= 1 - h * kA[0]; G *= 1 - h * kA[1]; B *= 1 - h * kA[2]; }
    if (del) { R *= 1 - del * kD[0]; G *= 1 - del * kD[1]; B *= 1 - del * kD[2]; }
    if (add) { R *= 1 - add * kA[0]; G *= 1 - add * kA[1]; B *= 1 - add * kA[2]; }
    px[o] = R * 255 + 0.5; px[o + 1] = G * 255 + 0.5; px[o + 2] = B * 255 + 0.5; px[o + 3] = 255;
  }
  return img;
}

// ---------------------------------------------------------------- Texte
const keyOf = (w, ic) => wordKey(w.s, ic);

/**
 * Mots d'une paire de pages en mode visuel : ceux de A sont ramenés dans le repère de B.
 * Le texte est ensuite comparé zone par zone (voir attachText).
 */
export async function pairTextChanges(A, ia, B, ib, T, ignoreCase) {
  const wa = ia !== null ? await A.words(ia) : [];
  const wb = ib !== null ? await B.words(ib) : [];
  return {
    ignoreCase,
    a: wa.map(w => ({ s: w.s, x0: T.s * w.x0 + T.tx, y0: T.s * w.y0 + T.ty, x1: T.s * w.x1 + T.tx, y1: T.s * w.y1 + T.ty })),
    b: wb
  };
}

/**
 * Texte de chaque zone : les mots des deux versions dont le centre tombe dans la zone sont
 * comparés en séquence (ordre de lecture). La liste affiche alors « 24 000 → 25 500 » ;
 * un texte simplement déplacé à l'intérieur de la zone n'est pas signalé comme modifié.
 */
export function attachText(zones, tc) {
  const tol = 2;
  // Un mot appartient à la zone si son centre y tombe ou si la zone en couvre le quart.
  const inside = (z, w) => {
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
    if (cx >= z.x0 - tol && cx <= z.x1 + tol && cy >= z.y0 - tol && cy <= z.y1 + tol) return true;
    const ix = Math.min(z.x1, w.x1) - Math.max(z.x0, w.x0), iy = Math.min(z.y1, w.y1) - Math.max(z.y0, w.y0);
    return ix > 0 && iy > 0 && ix * iy >= 0.25 * Math.max(1e-6, (w.x1 - w.x0) * (w.y1 - w.y0));
  };
  for (const z of zones) {
    const a = tc.a.filter(w => inside(z, w)), b = tc.b.filter(w => inside(z, w));
    if (!a.length && !b.length) continue;
    const ka = a.map(w => keyOf(w, tc.ignoreCase)), kb = b.map(w => keyOf(w, tc.ignoreCase));
    z.text = groupChanges(diffSeq(ka, kb), ka).slice(0, 8).map(c => ({
      kind: c.kind,
      oldText: c.del.map(i => a[i].s).join(" "),
      newText: c.add.map(i => b[i].s).join(" ")
    }));
  }
}

/**
 * Comparaison du texte sur l'ensemble des pages retenues (mode « Texte seulement »).
 * Le texte coule d'une page à l'autre : un ajout en page 1 ne décale pas toute la suite.
 */
export async function textCompare(A, idxA, B, idxB, { ignoreCase = false, skipMargins = true, onProgress } = {}) {
  const collect = async (D, idx, side) => {
    const pages = [];
    for (const i of idx) {
      const ws = await D.words(i);
      pages.push({ i, info: await D.info(i), words: ws.map(w => ({ ...w, page: i })) });
      onProgress?.(side, i);
      await idle();
    }
    if (skipMargins) dropRepeatedMargins(pages);
    return pages.flatMap(p => p.words);
  };
  const wa = await collect(A, idxA, "a");
  const wb = await collect(B, idxB, "b");
  const ta = tokens(wa, ignoreCase), tb = tokens(wb, ignoreCase);
  const changes = groupChanges(diffSeq(ta.keys, tb.keys), ta.keys).map((c, n) => {
    // Retour des jetons aux mots (un mot coupé en fin de ligne forme un seul jeton).
    const delW = c.del.flatMap(i => ta.words[i]), addW = c.add.flatMap(i => tb.words[i]);
    const del = delW.map(i => wa[i]), add = addW.map(i => wb[i]);
    const at = (t, pos, ws) => { const j = t.words[Math.min(pos, t.words.length - 1)]; return j ? ws[j[0]].page : null; };
    return {
      n: n + 1, kind: c.kind, del: delW, add: addW,
      pageA: del.length ? del[0].page : at(ta, c.aPos, wa),
      pageB: add.length ? add[0].page : at(tb, c.bPos, wb),
      oldText: del.map(w => w.s).join(" "), newText: add.map(w => w.s).join(" ")
    };
  });
  return { wa, wb, changes, nA: wa.length, nB: wb.length };
}

/**
 * Jetons de comparaison : un mot par jeton, sauf les mots coupés en fin de ligne
 * (« au- » + « dessus ») qui sont recomposés. Les traits d'union entre lettres sont ignorés
 * dans la clé, pour que « au-dessus » et « au- dessus » soient égaux.
 */
function tokens(words, ignoreCase) {
  const keys = [], map = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i], nx = words[i + 1];
    let k = keyOf(w, ignoreCase), idx = [i];
    if (nx && /\p{L}-$/u.test(w.s) && nx.line !== w.line && /^\p{Ll}/u.test(nx.s)) {
      k = k.slice(0, -1) + keyOf(nx, ignoreCase);
      idx = [i, i + 1];
      i++;
    }
    keys.push(k.replace(/(\p{L})-(?=\p{L})/gu, "$1"));
    map.push(idx);
  }
  return { keys, words: map };
}

/**
 * Retire les en-têtes et pieds de page répétés (numéros de page, titre courant, en-tête de
 * tableau repris sur chaque page) : lignes situées dans les 18 % du haut ou les 9 % du bas,
 * dont le texte (chiffres neutralisés) revient sur au moins la moitié des pages.
 * La première occurrence est gardée : un changement de titre reste signalé une fois.
 */
function dropRepeatedMargins(pages) {
  if (pages.length < 2) return;
  const lineKey = ws => ws.map(w => w.s).join(" ").toLowerCase().replace(/\d+/g, "#");
  const margins = pages.map(p => {
    const byLine = new Map();
    for (const w of p.words) {
      const cy = (w.y0 + w.y1) / 2;
      if (cy > 0.18 * p.info.h && cy < 0.91 * p.info.h) continue;
      if (!byLine.has(w.line)) byLine.set(w.line, []);
      byLine.get(w.line).push(w);
    }
    return [...byLine.values()].map(ws => ({ key: lineKey(ws), ws }));
  });
  const count = new Map();
  for (const lines of margins) for (const k of new Set(lines.map(l => l.key))) count.set(k, (count.get(k) || 0) + 1);
  const min = Math.max(2, Math.ceil(pages.length / 2));
  const seen = new Set();
  pages.forEach((p, i) => {
    const drop = new Set();
    for (const l of margins[i]) {
      if (count.get(l.key) < min) continue;
      if (!seen.has(l.key)) { seen.add(l.key); continue; }
      l.ws.forEach(w => drop.add(w));
    }
    if (drop.size) p.words = p.words.filter(w => !drop.has(w));
  });
}

export { readFile };
