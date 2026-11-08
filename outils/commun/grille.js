// Grille d'un tableau dessiné dans une image (tableau inséré comme image, page numérisée).
// Fonctions pures sur une image RGBA { data, width, height } : elles tournent dans le navigateur
// (ImageData d'un canevas) comme dans Node (banc d'essai).
//
// Méthode : les filets du tableau sont de longues suites de pixels sombres, horizontales ou
// verticales. Leurs positions donnent les lignes et les colonnes de la grille ; une frontière
// entre deux cases voisines existe si un filet la couvre vraiment. Les cases sans frontière
// entre elles forment une cellule fusionnée (rowspan, colspan), comme dans un tableau vectoriel.

const DARK = 165;          // niveau de gris sous lequel un pixel est « encre »
const GAP = 2;             // trou toléré dans un filet (pixels)

function binarize({ data, width: W, height: H }) {
  const ink = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
    const a = data[p + 3] / 255;
    const y = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000 * a + 255 * (1 - a);
    ink[i] = y < DARK ? 1 : 0;
  }
  return ink;
}

/** Suites d'encre d'au moins `min` pixels sur une ligne (dir "h") ou une colonne (dir "v"). */
function runs(ink, W, H, dir, min) {
  const out = [];
  const N = dir === "h" ? H : W, L = dir === "h" ? W : H;
  for (let k = 0; k < N; k++) {
    let start = -1, last = -1;
    for (let j = 0; j <= L; j++) {
      const on = j < L && (dir === "h" ? ink[k * W + j] : ink[j * W + k]);
      if (on) { if (start < 0) start = j; last = j; continue; }
      if (start >= 0 && (j - last > GAP || j === L)) {
        if (last - start + 1 >= min) out.push({ k, a: start, b: last });
        start = -1;
      }
    }
  }
  return out;
}

/** Suites voisines (épaisseur du filet) réunies en filets : { pos, a, b, t }. */
function lines(segs) {
  segs.sort((s, u) => s.k - u.k || s.a - u.a);
  const out = [];
  for (const s of segs) {
    const l = out.find(l => s.k - l.k1 <= 2 && s.a < l.b && s.b > l.a);
    if (l) { l.k1 = s.k; l.a = Math.min(l.a, s.a); l.b = Math.max(l.b, s.b); l.sum += s.k; l.n++; }
    else out.push({ k0: s.k, k1: s.k, a: s.a, b: s.b, sum: s.k, n: 1 });
  }
  return out.filter(l => l.k1 - l.k0 <= 8).map(l => ({ pos: Math.round(l.sum / l.n), a: l.a, b: l.b, t: l.k1 - l.k0 + 1 }));
}

/** Positions proches (moins de `tol` pixels) réunies. */
function cluster(values, tol) {
  const v = [...values].sort((a, b) => a - b), out = [];
  for (const x of v) {
    const last = out[out.length - 1];
    if (last && x - last.max <= tol) { last.max = x; last.sum += x; last.n++; }
    else out.push({ max: x, sum: x, n: 1 });
  }
  return out.map(c => Math.round(c.sum / c.n));
}

/**
 * Cherche une grille de tableau dans l'image.
 * opts.minArea : part de l'image que la grille doit couvrir (0,25 pour une image de tableau, moins sur une page numérisée).
 * Retourne null, ou { xs, ys, cells: [{ r0, r1, c0, c1, box: { x0, y0, x1, y1 } }], box, ink, lineMask }.
 * xs, ys : positions des filets (pixels) ; une cellule couvre les cases r0..r1 × c0..c1.
 */
export function findGrid(img, { minArea = 0.25 } = {}) {
  const { width: W, height: H } = img;
  const ink = binarize(img);
  const hl = lines(runs(ink, W, H, "h", Math.max(40, 0.12 * W)));
  // Un filet vertical relie deux filets horizontaux ; un jambage de lettre (« l », « ( ») ne touche rien.
  const touches = (y, x) => hl.some(h => Math.abs(h.pos - y) <= 6 + h.t && x >= h.a - 6 && x <= h.b + 6);
  const vl = lines(runs(ink, W, H, "v", Math.max(24, 0.06 * H))).filter(l => touches(l.a, l.pos) && touches(l.b, l.pos));
  if (hl.length < 2 || vl.length < 2) return null;
  // Zone du tableau : là où filets horizontaux et verticaux se croisent.
  const X0 = Math.min(...hl.map(l => l.a)), X1 = Math.max(...hl.map(l => l.b));
  const Y0 = Math.min(...vl.map(l => l.a)), Y1 = Math.max(...vl.map(l => l.b));
  const H2 = hl.filter(l => l.pos >= Y0 - 4 && l.pos <= Y1 + 4);
  const V2 = vl.filter(l => l.pos >= X0 - 4 && l.pos <= X1 + 4);
  const ys = cluster(H2.map(l => l.pos), 6), xs = cluster(V2.map(l => l.pos), 6);
  if (ys.length < 3 || xs.length < 3) return null;
  if ((xs[xs.length - 1] - xs[0]) * (ys[ys.length - 1] - ys[0]) < minArea * W * H) return null;

  // Couverture d'un filet entre deux points (part des pixels avec de l'encre à ±2 px).
  const covered = (dir, pos, a, b) => {
    let hit = 0, n = 0;
    const lo = a + 3, hi = b - 3;
    for (let j = lo; j <= hi; j++, n++) {
      for (let d = -2; d <= 2; d++) {
        const p = pos + d;
        const on = dir === "h" ? (p >= 0 && p < H && ink[p * W + j]) : (p >= 0 && p < W && ink[j * W + p]);
        if (on) { hit++; break; }
      }
    }
    return n > 0 ? hit / n : 0;
  };
  const R = ys.length - 1, C = xs.length - 1;
  // Frontières : vert[r][c] entre les cases (r, c) et (r, c+1) ; horiz[r][c] entre (r, c) et (r+1, c).
  const vert = [], horiz = [];
  for (let r = 0; r < R; r++) {
    vert.push([]);
    for (let c = 0; c < C - 1; c++) vert[r].push(covered("v", xs[c + 1], ys[r], ys[r + 1]) > 0.6);
  }
  for (let r = 0; r < R - 1; r++) {
    horiz.push([]);
    for (let c = 0; c < C; c++) horiz[r].push(covered("h", ys[r + 1], xs[c], xs[c + 1]) > 0.6);
  }
  // Cases reliées (pas de frontière) : cellule fusionnée. Rectangle englobant de chaque groupe.
  const id = new Int32Array(R * C).fill(-1);
  const cells = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (id[r * C + c] >= 0) continue;
    const cell = { r0: r, r1: r, c0: c, c1: c };
    const stack = [[r, c]];
    id[r * C + c] = cells.length;
    while (stack.length) {
      const [i, j] = stack.pop();
      cell.r0 = Math.min(cell.r0, i); cell.r1 = Math.max(cell.r1, i);
      cell.c0 = Math.min(cell.c0, j); cell.c1 = Math.max(cell.c1, j);
      const next = [];
      if (j + 1 < C && !vert[i][j]) next.push([i, j + 1]);
      if (j > 0 && !vert[i][j - 1]) next.push([i, j - 1]);
      if (i + 1 < R && !horiz[i][j]) next.push([i + 1, j]);
      if (i > 0 && !horiz[i - 1][j]) next.push([i - 1, j]);
      for (const [a, b] of next) if (id[a * C + b] < 0) { id[a * C + b] = cells.length; stack.push([a, b]); }
    }
    cells.push(cell);
  }
  for (const cl of cells) cl.box = { x0: xs[cl.c0], y0: ys[cl.r0], x1: xs[cl.c1 + 1], y1: ys[cl.r1 + 1] };
  // Une « grille » d'une seule cellule (un cadre) n'est pas un tableau.
  if (cells.length < 4) return null;
  // Masque des filets (pour les effacer avant la lecture du texte).
  const lineMask = new Uint8Array(W * H);
  for (const l of H2) for (let y = l.pos - Math.ceil(l.t / 2) - 1; y <= l.pos + Math.ceil(l.t / 2) + 1; y++) if (y >= 0 && y < H) lineMask.fill(1, y * W + l.a, y * W + l.b + 1);
  for (const l of V2) for (let y = l.a; y <= l.b; y++) for (let x = l.pos - Math.ceil(l.t / 2) - 1; x <= l.pos + Math.ceil(l.t / 2) + 1; x++) if (x >= 0 && x < W) lineMask[y * W + x] = 1;
  return { xs, ys, cells, box: { x0: xs[0], y0: ys[0], x1: xs[C], y1: ys[R] }, rows: R, cols: C, lineMask };
}

/** Copie de l'image où les filets sont peints en blanc (l'OCR ne les prend plus pour des « | » ou des « I »). */
export function eraseLines(img, mask) {
  const out = new Uint8ClampedArray(img.data);
  for (let i = 0; i < mask.length; i++) if (mask[i]) { const p = i * 4; out[p] = out[p + 1] = out[p + 2] = 255; out[p + 3] = 255; }
  return { data: out, width: img.width, height: img.height };
}

/** Sous-image (rectangle en pixels). */
export function crop(img, { x0, y0, x1, y1 }) {
  const W = img.width;
  x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
  x1 = Math.min(W, Math.round(x1)); y1 = Math.min(img.height, Math.round(y1));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(img.data.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4), y * w * 4);
  return { data, width: w, height: h };
}

/** La cellule contient-elle de l'encre (hors filets) ? Évite d'appeler l'OCR sur des cases vides. */
export function hasInk(img, box, mask) {
  const W = img.width;
  let n = 0;
  for (let y = Math.round(box.y0) + 3; y < Math.round(box.y1) - 3; y++) for (let x = Math.round(box.x0) + 3; x < Math.round(box.x1) - 3; x++) {
    const i = y * W + x;
    if (mask && mask[i]) continue;
    const p = i * 4;
    if ((img.data[p] * 299 + img.data[p + 1] * 587 + img.data[p + 2] * 114) / 1000 < DARK && ++n > 12) return true;
  }
  return false;
}

/**
 * Lignes et fusions du tableau à partir du texte de chaque cellule.
 * Retourne { rows: [[texte]], spans: [[[rs, cs]]] } au format des tableaux de PDFo
 * (cellule couverte par une fusion : span [0, 0]).
 */
export function gridTable(grid, texts) {
  const rows = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(""));
  const spans = Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols }, () => [0, 0]));
  grid.cells.forEach((cl, k) => {
    rows[cl.r0][cl.c0] = texts[k] || "";
    spans[cl.r0][cl.c0] = [cl.r1 - cl.r0 + 1, cl.c1 - cl.c0 + 1];
  });
  // Lignes ou colonnes entièrement vides (filet double, cadre décalé) : retirées.
  const keepR = rows.map((r, i) => r.some(Boolean) || spans[i].some(([a]) => a > 1));
  const keepC = rows[0].map((_, j) => rows.some(r => r[j]) || spans.some(s => s[j][1] > 1));
  const fixSpan = (i, j) => {
    let [rs, cs] = spans[i][j];
    if (!rs) return [0, 0];
    let r2 = 0, c2 = 0;
    for (let a = i; a < i + rs; a++) if (keepR[a]) r2++;
    for (let b = j; b < j + cs; b++) if (keepC[b]) c2++;
    return [Math.max(1, r2), Math.max(1, c2)];
  };
  const outRows = [], outSpans = [];
  for (let i = 0; i < grid.rows; i++) {
    if (!keepR[i]) continue;
    const r = [], s = [];
    for (let j = 0; j < grid.cols; j++) {
      if (!keepC[j]) continue;
      r.push(rows[i][j]);
      s.push(fixSpan(i, j));
    }
    outRows.push(r); outSpans.push(s);
  }
  return { rows: outRows, spans: outSpans };
}
