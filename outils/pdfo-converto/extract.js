// PDFo Converto : extraction de la structure d'un PDF (pdf.js), dans le navigateur.
// Titres (taille et graisse des polices, signets), paragraphes (mots coupés recomposés), listes,
// tableaux (détectés grâce aux filets vectoriels), en-têtes et pieds de page répétés, deux colonnes.
// Le résultat est une liste de blocs utilisée pour le Markdown et le Word.
import { mul, idle, pdfjs } from "../commun/pdf-outils.js";

const SUPER = { "1": "¹", "2": "²", "3": "³", "o": "º", "e": "ᵉ", "er": "ᵉʳ" };
const BULLET = /^([•▪◦●○■□►▶➢➤✓✔·\-–—*])\s+/;
const NUMBERED = /^((?:\d{1,3}|[a-zA-Z]|[ivxlcdm]{1,5})[.)])\s+/i;

/**
 * Extrait la structure des pages retenues.
 * opts : { tables, margins, styles, figures, onProgress(i, n) }
 * Retourne { blocks, outline, bodySize, pages }.
 * Bloc : { type: "h", level, text, page } | { type: "p", runs: [{ t, b, i }], page }
 *        | { type: "li", ordered, marker, level, runs, page }
 *        | { type: "table", rows: [[cell]], spans: [[[rs, cs]]], parts: [{ page, box, asset }], page }
 *        | { type: "figure", kind: "image" | "vector" | "scan", caption, labels: [texte], box, page, n, asset }
 *        | { type: "pagebreak", page }
 * box : { x0, y0, x1, y1 } en points, repère d'affichage de la page (y vers le bas).
 */
export async function extract(pdf, pageIdx, opts = {}) {
  const OPS = (await pdfjs()).OPS;
  const pages = [];
  for (let k = 0; k < pageIdx.length; k++) {
    const i = pageIdx[k];
    const page = await pdf.getPage(i + 1);
    pages.push(await readPage(page, i, OPS, opts));
    opts.onProgress?.(k + 1, pageIdx.length);
    page.cleanup();
    await idle();
  }
  if (opts.margins !== false) dropRepeated(pages);
  if (opts.figures) dropRepeatedFigures(pages);

  // Taille du corps de texte : la plus fréquente (pondérée par le nombre de caractères).
  const sizes = new Map();
  for (const p of pages) for (const ln of p.lines) {
    const s = Math.round(ln.size * 2) / 2;
    sizes.set(s, (sizes.get(s) || 0) + ln.text.length);
  }
  const bodySize = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  // Niveaux de titres : tailles nettement plus grandes que le corps (4 au plus).
  const big = [...sizes.keys()].filter(s => s >= bodySize * 1.12 && sizes.get(s) >= 3).sort((a, b) => b - a);
  const levels = [];
  for (const s of big) if (!levels.length || levels[levels.length - 1] - s > 0.6) levels.push(s);
  const levelOf = size => {
    let lv = 0;
    for (let j = 0; j < levels.length && j < 3; j++) if (size >= levels[j] - 0.3) { lv = j + 1; break; }
    return lv;
  };

  const outline = await readOutline(pdf);
  const outlineByPage = new Map();
  for (const o of outline) {
    if (o.page === null) continue;
    if (!outlineByPage.has(o.page)) outlineByPage.set(o.page, []);
    outlineByPage.get(o.page).push(o);
  }

  const blocks = [];
  let figNo = 0;
  for (const p of pages) {
    if (blocks.length) blocks.push({ type: "pagebreak", page: p.index });
    const marks = outlineByPage.get(p.index) || [];
    let figOnPage = 0, tabOnPage = 0;
    const tag = `p${String(p.index + 1).padStart(3, "0")}`;
    for (const it of p.flow) {
      if (it.table) {
        blocks.push({ type: "table", rows: it.table.rows, spans: it.table.spans, parts: [{ page: p.index, box: it.box, asset: `images/${tag}-tableau${++tabOnPage}.png` }], page: p.index });
        continue;
      }
      if (it.figure) {
        const f = it.figure;
        // Photo ou page numérisée : JPEG ; dessin vectoriel (traits fins) : PNG.
        const ext = f.kind === "vector" ? "png" : "jpg";
        blocks.push({ type: "figure", kind: f.kind, caption: f.caption, labels: f.labels, box: f.box, page: p.index, n: ++figNo, asset: `images/${tag}-figure${++figOnPage}.${ext}` });
        continue;
      }
      buildBlocks(it.lines, p.index, { bodySize, levelOf, levelsCount: Math.min(levels.length, 3), marks, styles: opts.styles !== false }, blocks);
    }
  }
  mergeContinuedTables(blocks);
  resolveHyphens(blocks);
  return { blocks, outline, bodySize, pages: pages.length };
}

// ---------------------------------------------------------------- Lecture d'une page
async function readPage(page, index, OPS, opts) {
  const vp = page.getViewport({ scale: 1 });
  const vt = vp.transform;
  const W = vp.width, H = vp.height;
  // La liste d'opérations charge les polices (graisse) et donne les filets des tableaux.
  const ol = await page.getOperatorList();
  const tc = await page.getTextContent();
  const fontInfo = new Map();
  const styleOf = name => {
    if (fontInfo.has(name)) return fontInfo.get(name);
    let b = false, i = false;
    try {
      if (page.commonObjs.has(name)) {
        const f = page.commonObjs.get(name);
        const n = `${f.name || ""} ${f.loadedName || ""}`;
        b = !!f.bold || !!f.black || /bold|black|heavy|semibold|demi/i.test(n);
        i = !!f.italic || /italic|oblique/i.test(n);
      }
    } catch { /* police non chargée */ }
    const r = { b, i };
    fontInfo.set(name, r);
    return r;
  };

  // Fragments de texte horizontaux en espace d'affichage.
  const frags = [], vertical = [];
  for (const it of tc.items) {
    if (!it.str) continue;
    let str = it.str;
    if (/[\uf020-\uf0ff]/.test(str)) str = str.replace(/[\uf020-\uf0ff]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xf000));
    const m = mul(it.transform, vt);
    const size = Math.hypot(m[2], m[3]);
    if (!str.trim()) { if (str.length && frags.length) frags[frags.length - 1].sp = true; continue; }
    if (Math.abs(m[1]) > 0.2 * Math.abs(m[0]) || m[0] <= 0) { vertical.push(str.trim()); continue; }
    const st = styleOf(it.fontName);
    frags.push({ t: str, x0: m[4], x1: m[4] + it.width, y: m[5], size, b: st.b, i: st.i, eol: it.hasEOL });
  }

  // Tableaux à partir des filets.
  const tables = opts.tables === false ? [] : findTables(ol, OPS, vt, W, H);
  const inTable = new Array(frags.length).fill(-1);
  frags.forEach((f, k) => {
    const cx = (f.x0 + f.x1) / 2, cy = f.y - 0.3 * f.size;
    tables.forEach((tb, ti) => { if (inTable[k] < 0 && cx > tb.x0 && cx < tb.x1 && cy > tb.y0 && cy < tb.y1) inTable[k] = ti; });
  });
  const tableRows = tables.map((tb, ti) => fillTable(tb, frags.filter((_, k) => inTable[k] === ti)));
  // Grille d'une seule ligne ou colonne (simple cadre) : son texte revient dans le flux.
  let free = frags.filter((_, k) => inTable[k] < 0 || !tableRows[inTable[k]]);

  // Figures : images du PDF et dessins vectoriels. Leur texte (cotes, légendes d'axes) quitte le
  // flux des paragraphes et reste attaché à la figure.
  const realTables = tables.filter((_, ti) => tableRows[ti]);
  const figures = opts.figures ? findFigures(graphics(ol, OPS, vt, W, H), realTables, free, W, H) : [];
  if (figures.length) {
    const inside = (f, b, m) => { const cx = (f.x0 + f.x1) / 2, cy = f.y - 0.3 * f.size; return cx >= b.x0 - m && cx <= b.x1 + m && cy >= b.y0 - m && cy <= b.y1 + m; };
    for (const fg of figures) {
      // Dessin : les libellés courts posés juste au bord (« PILE 1 », cotes) en font partie.
      const m = fg.kind === "vector" ? 14 : 2;
      const mine = new Set(free.filter(f => inside(f, fg.box, 2) || (m > 2 && f.t.trim().length <= 30 && inside(f, fg.box, m))));
      free = free.filter(f => !mine.has(f));
      for (const f of mine) {
        if (fg.kind !== "vector") break;
        const b = fg.box;
        fg.box = { x0: Math.min(b.x0, f.x0), y0: Math.min(b.y0, f.y - f.size), x1: Math.max(b.x1, f.x1), y1: Math.max(b.y1, f.y + 0.25 * f.size) };
      }
      fg.labels = toLines([...mine]).map(l => l.text);
    }
  }
  let lines = toLines(free);
  for (const fg of figures) lines = attachCaption(fg, lines);

  // Ordre de lecture : tableaux et figures insérés à leur hauteur, deux colonnes si détectées.
  const ordered = orderColumns(lines, W);
  const flow = [];
  const objs = [
    ...tables.map((tb, ti) => ({ y: tb.y0, item: tableRows[ti] && { table: tableRows[ti], box: { x0: tb.x0, y0: tb.y0, x1: tb.x1, y1: tb.y1 } } })),
    ...figures.map(fg => ({ y: fg.box.y0, item: { figure: fg } }))
  ].filter(o => o.item).sort((a, b) => a.y - b.y);
  let cur = [];
  for (const ln of ordered) {
    while (objs.length && objs[0].y < ln.y - ln.size && !ln.col) {
      if (cur.length) { flow.push({ lines: cur }); cur = []; }
      flow.push(objs.shift().item);
    }
    cur.push(ln);
  }
  if (cur.length) flow.push({ lines: cur });
  for (const o of objs) flow.push(o.item);
  if (vertical.length) flow.push({ lines: [{ text: vertical.join(" "), runs: [{ t: vertical.join(" "), b: false, i: false }], x0: 0, x1: 0, y: H, size: 0, vertical: true }] });

  return { index, W, H, lines, flow };
}

/** Regroupe les fragments en lignes (même ligne de base), avec les espaces nécessaires. */
function toLines(frags) {
  const sorted = frags.slice().sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const lines = [];
  for (const f of sorted) {
    const ln = lines[lines.length - 1];
    if (ln && Math.abs(f.y - ln.y) <= 0.4 * Math.min(f.size, ln.size)) ln.frags.push(f);
    else lines.push({ y: f.y, size: f.size, frags: [f] });
  }
  // Exposants et indices (petits caractères décalés) : rattachés à la ligne voisine.
  for (let k = lines.length - 1; k >= 0; k--) {
    const ln = lines[k];
    const small = Math.max(...ln.frags.map(f => f.size));
    const host = [lines[k + 1], lines[k - 1]].find(o => o && small < 0.8 * o.size && Math.abs(o.y - ln.y) < 0.75 * o.size &&
      ln.frags.every(f => f.x0 >= Math.min(...o.frags.map(g => g.x0)) - o.size && f.x1 <= Math.max(...o.frags.map(g => g.x1)) + 3 * o.size));
    if (!host) continue;
    for (const f of ln.frags) {
      const sup = SUPER[f.t.trim()];
      host.frags.push({ ...f, t: f.y < host.y && sup ? sup : f.t.trim(), sup: true, size: host.size });
    }
    lines.splice(k, 1);
  }
  return lines.map(ln => {
    ln.frags.sort((a, b) => a.x0 - b.x0);
    const runs = [];
    let prev = null, text = "";
    for (const f of ln.frags) {
      let t = f.t;
      if (prev) {
        const gap = f.x0 - prev.x1;
        const needSpace = !f.sup && (gap > 0.12 * f.size || prev.sp) && !/\s$/.test(text) && !/^\s/.test(t);
        if (needSpace) t = " " + t;
      }
      const last = runs[runs.length - 1];
      if (last && last.b === f.b && last.i === f.i) last.t += t; else runs.push({ t, b: f.b, i: f.i });
      text += t;
      prev = f;
    }
    const size = Math.max(...ln.frags.map(f => f.size));
    return { y: ln.y, size, x0: ln.frags[0].x0, x1: Math.max(...ln.frags.map(f => f.x1)), text: text.replace(/\s+/g, " ").trim(), runs, frags: ln.frags };
  }).filter(l => l.text);
}

/**
 * Deux colonnes : si beaucoup de lignes ont un grand blanc au même endroit (gouttière), chaque
 * bande de texte est lue colonne de gauche puis colonne de droite.
 */
function orderColumns(lines, W) {
  const gaps = [];
  for (const ln of lines) {
    for (let k = 1; k < ln.frags.length; k++) {
      const g = ln.frags[k].x0 - ln.frags[k - 1].x1;
      if (g > 2.2 * ln.size) gaps.push((ln.frags[k].x0 + ln.frags[k - 1].x1) / 2);
    }
  }
  if (lines.length < 12 || gaps.length < 0.3 * lines.length) return lines;
  const mid = gaps.filter(g => g > 0.3 * W && g < 0.7 * W);
  if (mid.length < 0.3 * lines.length) return lines;
  mid.sort((a, b) => a - b);
  const gutter = mid[Math.floor(mid.length / 2)];
  const near = mid.filter(g => Math.abs(g - gutter) < 12).length;
  if (near < 0.25 * lines.length) return lines;
  // Découpe des lignes à la gouttière.
  const L = [], R = [], out = [];
  const flush = () => { out.push(...L.splice(0), ...R.splice(0)); };
  for (const ln of lines) {
    const left = ln.frags.filter(f => f.x1 <= gutter + 2), right = ln.frags.filter(f => f.x0 >= gutter - 2);
    if (left.length + right.length < ln.frags.length) { flush(); out.push(ln); continue; } // ligne pleine largeur
    if (left.length) L.push({ ...toLines(left)[0], col: 1 });
    if (right.length) R.push({ ...toLines(right)[0], col: 2 });
  }
  flush();
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- Tableaux
/** Filets horizontaux et verticaux de la page (traits fins, bords de rectangles). */
function rules(ol, OPS, vt, W, H) {
  const hs = [], vs = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let white = false; // remplissage blanc courant (fond de cellule invisible)
  const stack = [];
  const PAINT_STROKE = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const PAINT_FILL = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const P = (x, y) => { const m = mul(ctm, vt); return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
  for (let k = 0; k < ol.fnArray.length; k++) {
    const fn = ol.fnArray[k], args = ol.argsArray[k];
    if (fn === OPS.save) stack.push([ctm.slice(), white]);
    else if (fn === OPS.restore) [ctm, white] = stack.pop() || [[1, 0, 0, 1, 0, 0], false];
    else if (fn === OPS.setFillRGBColor) {
      const c = String(args[0] || "");
      const v = c.startsWith("#") ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : Array.from(args).map(Number);
      white = v.length >= 3 && v.every(x => x >= 240);
    } else if (fn === OPS.setFillGray) white = Number(args[0]) >= 0.94;
    else if (fn === OPS.transform) ctm = mul(args, ctm);
    else if (fn === OPS.constructPath) {
      const paint = args[0];
      const stroke = PAINT_STROKE.has(paint), fill = PAINT_FILL.has(paint) && !white;
      if (!stroke && !fill) continue;
      const data = args[1] && args[1][0];
      if (!data) continue;
      // Sous-chemins : suites de points (moveTo 0, lineTo 1, curveTo 2, quadraticCurveTo 3, closePath 4).
      const subs = [];
      let cur = null, curved = false;
      for (let j = 0; j < data.length;) {
        const op = data[j];
        if (op === 0) { cur = [P(data[j + 1], data[j + 2])]; subs.push(cur); j += 3; }
        else if (op === 1) { cur?.push(P(data[j + 1], data[j + 2])); j += 3; }
        else if (op === 2) { curved = true; cur?.push(P(data[j + 5], data[j + 6])); j += 7; }
        else if (op === 3) { curved = true; cur?.push(P(data[j + 3], data[j + 4])); j += 5; }
        else if (op === 4) { if (cur?.length) cur.push(cur[0]); j += 1; }
        else break;
      }
      if (curved) continue;
      for (const pts of subs) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const w = x1 - x0, h = y1 - y0;
        if (w * h > 0.8 * W * H) continue; // fond de page
        const axisAligned = pts.every((p, n) => n === 0 || Math.abs(p[0] - pts[n - 1][0]) < 0.6 || Math.abs(p[1] - pts[n - 1][1]) < 0.6);
        if (!axisAligned) continue;
        if (w < 2.5 && h > 3) vs.push({ x: (x0 + x1) / 2, a: y0, b: y1 });
        else if (h < 2.5 && w > 3) hs.push({ y: (y0 + y1) / 2, a: x0, b: x1 });
        else if (pts.length >= 4 && w > 3 && h > 3 && (fill || stroke)) {
          hs.push({ y: y0, a: x0, b: x1 }, { y: y1, a: x0, b: x1 });
          vs.push({ x: x0, a: y0, b: y1 }, { x: x1, a: y0, b: y1 });
        } else if (stroke && pts.length >= 2) {
          for (let n = 1; n < pts.length; n++) {
            const [ax, ay] = pts[n - 1], [bx, by] = pts[n];
            if (Math.abs(ay - by) < 0.6 && Math.abs(ax - bx) > 3) hs.push({ y: (ay + by) / 2, a: Math.min(ax, bx), b: Math.max(ax, bx) });
            else if (Math.abs(ax - bx) < 0.6 && Math.abs(ay - by) > 3) vs.push({ x: (ax + bx) / 2, a: Math.min(ay, by), b: Math.max(ay, by) });
          }
        }
      }
    }
  }
  return { hs: mergeSegs(hs, "y"), vs: mergeSegs(vs, "x") };
}

/** Fusionne les segments colinéaires qui se touchent. */
function mergeSegs(segs, key) {
  segs.sort((p, q) => p[key] - q[key] || p.a - q.a);
  const out = [];
  for (const s of segs) {
    const last = out.find(o => Math.abs(o[key] - s[key]) < 1.5 && s.a <= o.b + 2 && s.b >= o.a - 2);
    if (last) { last.a = Math.min(last.a, s.a); last.b = Math.max(last.b, s.b); }
    else out.push({ ...s });
  }
  return out;
}

const cluster = (vals, tol) => {
  const s = vals.slice().sort((a, b) => a - b);
  const out = [];
  for (const v of s) { if (!out.length || v - out[out.length - 1] > tol) out.push(v); }
  return out;
};

/** Grilles formées par des filets qui se croisent (au moins 2 × 2). */
function findTables(ol, OPS, vt, W, H) {
  const { hs, vs } = rules(ol, OPS, vt, W, H);
  if (hs.length < 2 || vs.length < 2) return [];
  const tol = 2.5;
  // Composantes connexes de filets qui se croisent.
  const N = hs.length + vs.length;
  const parent = [...Array(N).keys()];
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  hs.forEach((h, i) => vs.forEach((v, j) => {
    if (v.x >= h.a - tol && v.x <= h.b + tol && h.y >= v.a - tol && h.y <= v.b + tol) parent[find(i)] = find(hs.length + j);
  }));
  const groups = new Map();
  for (let k = 0; k < N; k++) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { h: [], v: [] });
    if (k < hs.length) groups.get(r).h.push(hs[k]); else groups.get(r).v.push(vs[k - hs.length]);
  }
  const tables = [];
  for (const g of groups.values()) {
    if (g.h.length < 2 || g.v.length < 2) continue;
    let ys = cluster(g.h.map(h => h.y), tol), xs = cluster(g.v.map(v => v.x), tol);
    if (ys.length < 2 || xs.length < 2) continue;
    // Un vrai séparateur couvre une bonne part du tableau ; les bords d'un fond de texte
    // (surlignage d'un paragraphe dans une cellule) ne couvrent qu'une cellule.
    const X0 = xs[0], X1 = xs[xs.length - 1], Y0 = ys[0], Y1 = ys[ys.length - 1];
    const cover = (segs, key, at) => segs.filter(s => Math.abs(s[key] - at) < tol).reduce((n, s) => n + (s.b - s.a), 0);
    xs = xs.filter((x, k) => k === 0 || k === xs.length - 1 || cover(g.v, "x", x) >= 0.25 * (Y1 - Y0));
    ys = ys.filter((y, k) => k === 0 || k === ys.length - 1 || cover(g.h, "y", y) >= 0.25 * (X1 - X0));
    if (ys.length - 1 < 2 && xs.length - 1 < 2) continue;
    tables.push({ xs, ys, h: g.h, v: g.v, x0: xs[0], x1: xs[xs.length - 1], y0: ys[0], y1: ys[ys.length - 1] });
  }
  return tables;
}

/** Remplit la grille : cellules fusionnées (filet absent), texte de chaque cellule. */
function fillTable(tb, frags) {
  const { xs, ys } = tb;
  const R = ys.length - 1, C = xs.length - 1;
  if (R < 1 || C < 1) return null;
  const tol = 2.5;
  const hasV = (x, ya, yb) => tb.v.some(v => Math.abs(v.x - x) < tol && v.a <= ya + tol && v.b >= yb - tol);
  const hasH = (y, xa, xb) => tb.h.some(h => Math.abs(h.y - y) < tol && h.a <= xa + tol && h.b >= xb - tol);
  const id = (r, c) => r * C + c;
  const parent = [...Array(R * C).keys()];
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) {
    const ym = (ys[r] + ys[r + 1]) / 2;
    if (!hasV(xs[c + 1], ym - 1, ym + 1)) parent[find(id(r, c + 1))] = find(id(r, c));
  }
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C; c++) {
    const xm = (xs[c] + xs[c + 1]) / 2;
    if (!hasH(ys[r + 1], xm - 1, xm + 1)) parent[find(id(r + 1, c))] = find(id(r, c));
  }
  // Ancre d'un groupe : sa cellule en haut à gauche.
  const anchor = new Map();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const g = find(id(r, c));
    if (!anchor.has(g)) anchor.set(g, id(r, c));
  }
  const cells = Array.from({ length: R * C }, () => []);
  for (const f of frags) {
    const cx = (f.x0 + f.x1) / 2, cy = f.y - 0.3 * f.size;
    const c = xs.findIndex((x, k) => k < C && cx >= x && cx < xs[k + 1]);
    const r = ys.findIndex((y, k) => k < R && cy >= y && cy < ys[k + 1]);
    if (r < 0 || c < 0) continue;
    cells[anchor.get(find(id(r, c)))].push(f);
  }
  const rows = [];
  for (let r = 0; r < R; r++) {
    const row = [];
    for (let c = 0; c < C; c++) {
      const fs = cells[id(r, c)];
      row.push(fs.length ? toLines(fs).map(l => l.text).join("\n") : "");
    }
    rows.push(row);
  }
  // Colonnes et lignes entièrement vides (filets décoratifs) retirées.
  const keepC = [...Array(C).keys()].filter(c => rows.some(row => row[c]));
  const keepR = [...Array(R).keys()].filter(r => keepC.some(c => rows[r][c]));
  if (keepC.length < 2 || keepR.length < 2) return null;
  // Cellules fusionnées : étendue [lignes, colonnes] de chaque ancre, [0, 0] pour une cellule
  // couverte. Un groupe qui n'est pas un rectangle (filet manquant isolé) reste en cellules simples.
  const box = new Map();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const g = find(id(r, c));
    const b = box.get(g) || { r0: r, r1: r, c0: c, c1: c, n: 0 };
    b.r0 = Math.min(b.r0, r); b.r1 = Math.max(b.r1, r); b.c0 = Math.min(b.c0, c); b.c1 = Math.max(b.c1, c); b.n++;
    box.set(g, b);
  }
  const kr = new Set(keepR), kc = new Set(keepC);
  const between = (set, a, b) => { let n = 0; for (let v = a; v <= b; v++) if (set.has(v)) n++; return n; };
  const spans = keepR.map(r => keepC.map(c => {
    const g = find(id(r, c)), b = box.get(g), a = anchor.get(g);
    if (b.n === 1 || b.n !== (b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1)) return [1, 1];
    if (a === id(r, c)) return [between(kr, b.r0, b.r1), between(kc, b.c0, b.c1)];
    return kr.has(Math.floor(a / C)) && kc.has(a % C) ? [0, 0] : [1, 1];
  }));
  return { rows: keepR.map(r => keepC.map(c => rows[r][c])), spans };
}

// ---------------------------------------------------------------- Figures
/**
 * Éléments graphiques de la page, en espace d'affichage : tracés (boîte, courbe ou non, rempli,
 * contour, rectangle seul) et images (photos, pages numérisées). Les XObject formulaires sont suivis.
 */
function graphics(ol, OPS, vt, W, H) {
  const paths = [], images = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let white = false;
  const stack = [];
  const PAINT_STROKE = new Set([OPS.stroke, OPS.closeStroke, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const PAINT_FILL = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  const IMAGE = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintJpegXObject].filter(v => v !== undefined));
  const boxOf = pts => {
    const m = mul(ctm, vt);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
      if (X < x0) x0 = X;
      if (X > x1) x1 = X;
      if (Y < y0) y0 = Y;
      if (Y > y1) y1 = Y;
    }
    return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x1), y1: Math.min(H, y1) };
  };
  for (let k = 0; k < ol.fnArray.length; k++) {
    const fn = ol.fnArray[k], args = ol.argsArray[k];
    if (fn === OPS.save) stack.push([ctm.slice(), white]);
    else if (fn === OPS.restore) [ctm, white] = stack.pop() || [[1, 0, 0, 1, 0, 0], false];
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push([ctm.slice(), white]);
      const m = args && args[0];
      if (m && m.length === 6) ctm = mul(Array.from(m), ctm);
    } else if (fn === OPS.paintFormXObjectEnd) [ctm, white] = stack.pop() || [[1, 0, 0, 1, 0, 0], false];
    else if (fn === OPS.transform) ctm = mul(args, ctm);
    else if (fn === OPS.setFillRGBColor) {
      const c = String(args[0] || "");
      const v = c.startsWith("#") ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : Array.from(args).map(Number);
      white = v.length >= 3 && v.every(x => x >= 240);
    } else if (fn === OPS.setFillGray) white = Number(args[0]) >= 0.94;
    else if (IMAGE.has(fn)) {
      const b = boxOf([[0, 0], [1, 0], [0, 1], [1, 1]]);
      if (b.x1 - b.x0 > 2 && b.y1 - b.y0 > 2) images.push(b);
    } else if (fn === OPS.constructPath) {
      const paint = args[0];
      const stroke = PAINT_STROKE.has(paint), fill = PAINT_FILL.has(paint) && !white;
      if (!stroke && !fill) continue;
      const data = args[1] && args[1][0];
      if (!data) continue;
      const pts = [];
      let curved = false, moves = 0;
      for (let j = 0; j < data.length;) {
        const op = data[j];
        if (op === 0) { pts.push([data[j + 1], data[j + 2]]); moves++; j += 3; }
        else if (op === 1) { pts.push([data[j + 1], data[j + 2]]); j += 3; }
        else if (op === 2) { curved = true; pts.push([data[j + 1], data[j + 2]], [data[j + 3], data[j + 4]], [data[j + 5], data[j + 6]]); j += 7; }
        else if (op === 3) { curved = true; pts.push([data[j + 1], data[j + 2]], [data[j + 3], data[j + 4]]); j += 5; }
        else if (op === 4) j += 1;
        else break;
      }
      if (!pts.length) continue;
      const b = boxOf(pts);
      if (b.x1 < b.x0 || b.y1 < b.y0) continue;
      // Rectangle seul (cadre, fond de ligne) : 4 ou 5 sommets tous sur les coins de sa boîte.
      // Repéré pour ne pas compter des fonds de cellules ou de lignes comme un dessin.
      const onCorner = ([x, y]) => {
        const m = mul(ctm, vt), X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
        return (Math.abs(X - b.x0) < 0.6 || Math.abs(X - b.x1) < 0.6) && (Math.abs(Y - b.y0) < 0.6 || Math.abs(Y - b.y1) < 0.6);
      };
      const rect = !curved && moves === 1 && (pts.length === 4 || pts.length === 5) && pts.every(onCorner);
      paths.push({ ...b, curved, fill, stroke, rect, n: Math.max(1, moves) });
    }
  }
  return { paths, images };
}

const CAPTION = /^(fig(?:ure)?s?\.?|photo(?:graphie)?s?|image|illustration|graphique|sch[ée]ma|croquis|plan|carte|diagramme|chart|graph|diagram|drawing|map|exhibit)\s*(?:n[o°º]\.?\s*)?(?:\d|[A-Z][-.]?\d)/i;

/**
 * Regroupe les éléments graphiques proches (grille d'occupation) et garde les groupes qui
 * forment une figure : une image assez grande, ou un dessin d'au moins quelques tracés où le
 * texte reste minoritaire (un cadre autour d'un paragraphe n'est pas une figure).
 */
function findFigures(g, tables, frags, W, H) {
  const pageArea = W * H;
  const textChars = frags.reduce((n, f) => n + f.t.length, 0);
  const inTable = b => tables.some(t => b.x0 >= t.x0 - 3 && b.x1 <= t.x1 + 3 && b.y0 >= t.y0 - 3 && b.y1 <= t.y1 + 3);
  const items = [];
  for (const p of g.paths) {
    const w = p.x1 - p.x0, h = p.y1 - p.y0;
    if (w < 0.3 && h < 0.3) continue;
    if (w * h > 0.8 * pageArea || inTable(p)) continue;
    // Filets de séparation et cadres de page : ils relieraient tout ce qu'ils longent.
    if ((h < 2.5 && w > 0.45 * W) || (w < 2.5 && h > 0.45 * H)) continue;
    if (p.rect && (w > 0.5 * W || h > 0.5 * H)) continue;
    items.push({ ...p, img: false });
  }
  let scan = false;
  for (const im of g.images) {
    const a = (im.x1 - im.x0) * (im.y1 - im.y0);
    if (a > 0.6 * pageArea) {
      // Très grande image : fond d'une page qui a du texte, page numérisée (ni texte, ni marge),
      // sinon une grande figure (capture d'écran sur une diapositive).
      if (textChars >= 200) continue;
      if (a > 0.85 * pageArea && textChars < 20) { scan = true; continue; }
    }
    if (inTable(im)) continue;
    items.push({ ...im, img: true, rect: false, curved: false, n: 1 });
  }
  if (scan) return [{ kind: "scan", box: { x0: 0, y0: 0, x1: W, y1: H }, labels: [], caption: "" }];
  if (!items.length) return [];

  // Grille d'occupation : cellules de 4 pt, éléments élargis de 6 pt pour relier les traits voisins.
  const CELL = 4, GAP = 6;
  const GW = Math.ceil(W / CELL) + 1, GH = Math.ceil(H / CELL) + 1;
  const grid = new Uint8Array(GW * GH);
  const mark = (x0, y0, x1, y1) => {
    const a = Math.max(0, Math.floor((x0 - GAP) / CELL)), b = Math.min(GW - 1, Math.floor((x1 + GAP) / CELL));
    const c = Math.max(0, Math.floor((y0 - GAP) / CELL)), d = Math.min(GH - 1, Math.floor((y1 + GAP) / CELL));
    for (let y = c; y <= d; y++) grid.fill(1, y * GW + a, y * GW + b + 1);
  };
  for (const it of items) {
    const w = it.x1 - it.x0, h = it.y1 - it.y0;
    if (it.rect && it.stroke && !it.fill && w > 30 && h > 30) {
      // Cadre : seulement son pourtour (un cadre autour d'un texte ne doit pas l'avaler).
      mark(it.x0, it.y0, it.x1, it.y0); mark(it.x0, it.y1, it.x1, it.y1);
      mark(it.x0, it.y0, it.x0, it.y1); mark(it.x1, it.y0, it.x1, it.y1);
    } else mark(it.x0, it.y0, it.x1, it.y1);
  }
  const label = new Int32Array(GW * GH).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < grid.length; s++) {
    if (!grid[s] || label[s] >= 0) continue;
    const id = comps.length;
    comps.push({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0, img: 0, rects: 0 });
    label[s] = id;
    stack.push(s);
    while (stack.length) {
      const q = stack.pop(), x = q % GW, y = (q / GW) | 0;
      if (x > 0 && grid[q - 1] && label[q - 1] < 0) { label[q - 1] = id; stack.push(q - 1); }
      if (x < GW - 1 && grid[q + 1] && label[q + 1] < 0) { label[q + 1] = id; stack.push(q + 1); }
      if (y > 0 && grid[q - GW] && label[q - GW] < 0) { label[q - GW] = id; stack.push(q - GW); }
      if (y < GH - 1 && grid[q + GW] && label[q + GW] < 0) { label[q + GW] = id; stack.push(q + GW); }
    }
  }
  for (const it of items) {
    const gx = Math.min(GW - 1, Math.max(0, Math.floor(it.x0 / CELL))), gy = Math.min(GH - 1, Math.max(0, Math.floor(it.y0 / CELL)));
    const c = comps[label[gy * GW + gx]];
    if (!c) continue;
    c.x0 = Math.min(c.x0, it.x0); c.y0 = Math.min(c.y0, it.y0); c.x1 = Math.max(c.x1, it.x1); c.y1 = Math.max(c.y1, it.y1);
    c.n += it.n;
    if (it.rect) c.rects++;
    if (it.img) c.img += (it.x1 - it.x0) * (it.y1 - it.y0);
  }
  const out = [];
  for (const c of comps) {
    if (!c.n) continue;
    const w = c.x1 - c.x0, h = c.y1 - c.y0, area = w * h;
    if (w < 36 || h < 24) continue;
    const photo = c.img >= 1600 && c.img >= 0.3 * area;
    // Dessin : assez de tracés, et pas seulement des rectangles (fonds de lignes surlignées).
    const drawing = c.n >= 8 && c.rects < 0.8 * c.n;
    if (!photo && !drawing) continue;
    // Texte dans le groupe : au-delà d'un tiers de la surface, c'est une mise en page, pas une figure.
    let textArea = 0;
    for (const f of frags) {
      const cx = (f.x0 + f.x1) / 2, cy = f.y - 0.3 * f.size;
      if (cx >= c.x0 && cx <= c.x1 && cy >= c.y0 && cy <= c.y1) textArea += (f.x1 - f.x0) * f.size;
    }
    if (!photo && textArea > 0.33 * area) continue;
    // Logo ou ornement dans les marges du haut et du bas.
    if ((c.y1 < 0.1 * H || c.y0 > 0.93 * H) && area < 0.08 * pageArea) continue;
    out.push({ kind: photo && c.n <= 3 ? "image" : "vector", box: { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }, labels: [], caption: "" });
  }
  // Figures qui se chevauchent (dessin posé sur une photo) : réunies. Deux parties d'un même
  // dessin (ligne de cotes au-dessus d'une élévation) sont aussi réunies si elles se touchent presque.
  out.sort((a, b) => a.box.y0 - b.box.y0);
  const near = (a, b, both) => {
    const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1), gy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
    if (gx < 0 && gy < 0) return true;
    return both && ((gx <= 28 && gy < 0) || (gy <= 28 && gx < 0));
  };
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) for (let j = out.length - 1; j > i; j--) {
      const a = out[i].box, b = out[j].box;
      if (near(a, b, out[i].kind === "vector" && out[j].kind === "vector")) {
        out[i].box = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
        if (out[j].kind === "vector") out[i].kind = "vector";
        out.splice(j, 1);
        merged = true;
        break;
      }
    }
  }
  return out;
}

/**
 * Légende : ligne « Figure 3 – … », « Photo 2 : … » juste sous la figure ou juste au-dessus,
 * avec ses lignes de suite ; elle quitte le flux et accompagne la figure. Une légende placée
 * dans le cadre de la figure est reprise de son texte.
 */
function attachCaption(fg, lines) {
  const k = fg.labels.findIndex(t => CAPTION.test(t));
  if (k >= 0) { fg.caption = fg.labels[k]; fg.labels.splice(k, 1); return lines; }
  const b = fg.box;
  let best = -1, bestD = Infinity;
  lines.forEach((ln, n) => {
    if (!CAPTION.test(ln.text) || ln.x1 < b.x0 - 24 || ln.x0 > b.x1 + 24) return;
    const top = ln.y - ln.size;
    const d = top >= b.y1 - 2 ? top - b.y1 : b.y0 - ln.y;
    if (d >= -2 && d <= 30 && d < bestD) { best = n; bestD = d; }
  });
  if (best < 0) return lines;
  const used = [best];
  let cap = lines[best].text, prev = lines[best];
  for (let n = best + 1; n < lines.length && used.length < 3; n++) {
    const ln = lines[n];
    if (ln.y - prev.y > 1.5 * prev.size || Math.abs(ln.size - prev.size) > 0.6 || Math.abs(ln.x0 - lines[best].x0) > 2 * ln.size || CAPTION.test(ln.text)) break;
    if (ln.y > b.y0 - 2 && ln.y < b.y1 + 2) break;
    cap += " " + ln.text;
    used.push(n);
    prev = ln;
  }
  fg.caption = cap.replace(/\s+/g, " ").trim();
  return lines.filter((_, n) => !used.includes(n));
}

/**
 * Mots coupés en fin de ligne : « exi- gences » → « exigences », mais « au- dessus » →
 * « au-dessus ». On cherche la forme dans le reste du document ; à défaut, un préfixe de
 * trois lettres au plus garde son trait d'union.
 */
function resolveHyphens(blocks) {
  const words = new Set();
  const textOf = b => b.type === "h" ? b.text : b.runs ? b.runs.map(r => r.t).join("") : "";
  for (const b of blocks) for (const w of textOf(b).toLowerCase().split(/[^\p{L}\p{N}\u00ad-]+/u)) if (w && !w.includes("\u00ad")) words.add(w);
  const fix = t => t.replace(/(\p{L}+)\u00ad(\p{L}+)/gu, (m, a, b) => {
    const joined = (a + b).toLowerCase(), dashed = (a + "-" + b).toLowerCase();
    if (words.has(joined)) return a + b;
    if (words.has(dashed) || a.length <= 3) return a + "-" + b;
    return a + b;
  }).replace(/\u00ad/g, "-");
  for (const b of blocks) if (b.runs) for (const r of b.runs) if (r.t.includes("\u00ad")) r.t = fix(r.t);
}

/** Un tableau qui continue sur la page suivante (même en-tête, même nombre de colonnes) est réuni. */
function mergeContinuedTables(blocks) {
  let k = 1;
  while (k < blocks.length) {
    const b = blocks[k];
    let j = k - 1;
    while (j >= 0 && blocks[j].type === "pagebreak") j--;
    const a = blocks[j];
    // Seul un saut de page sépare deux tableaux de même largeur : c'est le même tableau.
    if (b.type === "table" && a && a.type === "table" && j < k - 1 && a.rows[0].length === b.rows[0].length) {
      const same = b.rows[0].join("|") === a.rows[0].join("|");
      a.rows.push(...(same ? b.rows.slice(1) : b.rows));
      if (a.spans && b.spans) a.spans.push(...(same ? b.spans.slice(1) : b.spans));
      if (a.parts && b.parts) a.parts.push(...b.parts);
      blocks.splice(j + 1, k - j); // retire les sauts de page et le tableau fusionné
      k = j + 1;
      continue;
    }
    k++;
  }
}

// ---------------------------------------------------------------- Blocs
function buildBlocks(lines, page, ctx, out) {
  const { bodySize, levelOf, levelsCount, marks, styles } = ctx;
  const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  let para = null;
  const flush = () => { if (para) { out.push(para.block); para = null; } };
  // Interligne habituel de la page (médiane des écarts entre lignes de même taille).
  const gaps = [];
  for (let n = 1; n < lines.length; n++) {
    const a = lines[n - 1], b = lines[n], g = b.y - a.y;
    if (Math.abs(a.size - b.size) < 0.5 && g > 0.8 * b.size && g < 2.6 * b.size) gaps.push(g / b.size);
  }
  gaps.sort((a, b) => a - b);
  const leading = gaps.length >= 3 ? gaps[Math.floor(gaps.length / 2)] : 1.3;
  const runsOf = ln => styles ? ln.runs.map(r => ({ ...r })) : [{ t: ln.text, b: false, i: false }];
  const appendRuns = (block, ln) => {
    const last = block.runs[block.runs.length - 1];
    const prevText = last ? last.t : "";
    let rs = runsOf(ln);
    if (/\p{L}-$/u.test(prevText) && /^\p{Ll}/u.test(ln.text)) {
      last.t = prevText.slice(0, -1) + "\u00ad"; // mot coupé en fin de ligne (résolu plus tard)
    } else if (rs.length) {
      rs[0] = { ...rs[0], t: " " + rs[0].t };
    }
    for (const r of rs) {
      const l2 = block.runs[block.runs.length - 1];
      if (l2 && l2.b === r.b && l2.i === r.i) l2.t += r.t; else block.runs.push(r);
    }
  };

  for (let n = 0; n < lines.length; n++) {
    const ln = lines[n];
    const prev = lines[n - 1];
    const text = ln.text;
    // Titre : signet de la page, grande taille, ou ligne courte entièrement en gras.
    const mark = marks.find(m => norm(m.title) && norm(m.title) === norm(text));
    let level = mark ? Math.min(mark.depth + 1, 4) : levelOf(ln.size);
    const allBold = styles && ln.runs.every(r => r.b || !r.t.trim());
    if (!level && allBold && text.length <= 80 && !/[.,;]$/.test(text) && Math.abs(ln.size - bodySize) < 1.5 && !BULLET.test(text) && /\p{L}/u.test(text)) {
      const next = lines[n + 1];
      const isolated = !next || next.y - ln.y > 1.25 * ln.size || !(next.runs.every(r => r.b || !r.t.trim()));
      if (isolated) level = Math.min(levelsCount + 1, 4);
    }
    if (level && text.length <= 200) {
      flush();
      const last = out[out.length - 1];
      // Titre sur deux lignes : on prolonge le précédent.
      if (last && last.type === "h" && last.level === level && last.page === page && prev && ln.y - prev.y < 1.6 * ln.size && last.y !== undefined) {
        last.text += " " + text; last.y = ln.y;
      } else out.push({ type: "h", level, text, page, y: ln.y });
      continue;
    }
    // Élément de liste
    const bm = text.match(BULLET), nm = !bm && text.match(NUMBERED);
    if (bm || (nm && text.length > nm[0].length)) {
      flush();
      const marker = (bm || nm)[1];
      const body = text.slice((bm || nm)[0].length);
      const runs = runsOf(ln);
      // On retire la puce du premier fragment.
      let cut = (bm || nm)[0].length;
      while (cut > 0 && runs.length) {
        const r = runs[0];
        if (r.t.length <= cut) { cut -= r.t.length; runs.shift(); } else { r.t = r.t.slice(cut); cut = 0; }
      }
      if (runs[0]) runs[0].t = runs[0].t.replace(/^\s+/, "");
      const listX = ln.x0;
      const lvl = levelFromIndent(out, listX, ln.size);
      para = { block: { type: "li", ordered: !!nm, marker, level: lvl, runs: runs.length ? runs : [{ t: body, b: false, i: false }], page, x0: listX }, x0: ln.x0, textX: ln.x0, y: ln.y, size: ln.size, x1: ln.x1 };
      continue;
    }
    // Paragraphe : continuation si l'interligne et la taille sont semblables.
    if (para) {
      const gap = ln.y - para.y;
      const sameSize = Math.abs(ln.size - para.size) <= 0.15 * para.size;
      const close = gap > 0 && gap <= Math.max(1.65, 1.18 * leading) * para.size;
      const prevEnded = /[.!?:]$/.test(prev?.text || "") && prev && (prev.x1 - prev.x0) < 0.7 * (para.x1 - para.x0);
      const aligned = para.block.type === "li" ? ln.x0 > para.x0 + 0.3 * ln.size : Math.abs(ln.x0 - para.textX) < 3 * ln.size;
      if (sameSize && close && aligned && !prevEnded) {
        appendRuns(para.block, ln);
        para.y = ln.y; para.x1 = Math.max(para.x1, ln.x1);
        continue;
      }
      flush();
    }
    para = { block: { type: "p", runs: runsOf(ln), page }, x0: ln.x0, textX: ln.x0, y: ln.y, size: ln.size, x1: ln.x1 };
  }
  flush();
}

/** Niveau d'imbrication d'une liste d'après le retrait par rapport aux éléments précédents. */
function levelFromIndent(out, x0, size) {
  for (let k = out.length - 1; k >= 0 && k >= out.length - 30; k--) {
    const b = out[k];
    if (b.type !== "li") { if (b.type !== "pagebreak") break; continue; }
    if (x0 > b.x0 + 0.8 * size) return Math.min(b.level + 1, 3);
    if (Math.abs(x0 - b.x0) <= 0.8 * size) return b.level;
  }
  return 0;
}

// ---------------------------------------------------------------- En-têtes et pieds de page
/** Lignes du haut (12 %) ou du bas (8 %) répétées sur au moins la moitié des pages. */
function dropRepeated(pages) {
  if (pages.length < 2) return;
  const key = l => l.text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
  const marginal = (p, l) => l.y < 0.12 * p.H || l.y > 0.92 * p.H;
  const count = new Map();
  for (const p of pages) for (const k of new Set(p.lines.filter(l => marginal(p, l)).map(key))) count.set(k, (count.get(k) || 0) + 1);
  // Deux pages : la ligne doit figurer sur les deux ; sinon sur au moins la moitié (3 au minimum).
  const min = pages.length === 2 ? 2 : Math.max(3, Math.ceil(pages.length / 2));
  const seen = new Set();
  for (const p of pages) {
    // En-tête répété (titre courant) : gardé à sa première apparition ; pied de page : retiré.
    const drop = new Set(p.lines.filter(l => {
      if (!marginal(p, l) || count.get(key(l)) < min) return false;
      if (l.y < 0.12 * p.H && !seen.has(key(l))) { seen.add(key(l)); return false; }
      return true;
    }));
    if (!drop.size) continue;
    p.lines = p.lines.filter(l => !drop.has(l));
    for (const f of p.flow) if (f.lines) f.lines = f.lines.filter(l => !drop.has(l));
    p.flow = p.flow.filter(f => f.table || f.figure || f.lines.length);
  }
}

/** Figure au même endroit sur au moins la moitié des pages (logo, filigrane) : décor, retirée. */
function dropRepeatedFigures(pages) {
  if (pages.length < 2) return;
  const key = b => [b.x0, b.y0, b.x1, b.y1].map(v => Math.round(v / 6)).join(",");
  const count = new Map();
  for (const p of pages) for (const k of new Set(p.flow.filter(f => f.figure && f.figure.kind !== "scan").map(f => key(f.figure.box)))) count.set(k, (count.get(k) || 0) + 1);
  const min = pages.length === 2 ? 2 : Math.max(3, Math.ceil(pages.length / 2));
  for (const p of pages) p.flow = p.flow.filter(f => !f.figure || f.figure.kind === "scan" || count.get(key(f.figure.box)) < min);
}

// ---------------------------------------------------------------- Signets
/** Signets du PDF à plat : { title, depth, page } (page : index base 0 ou null). */
export async function readOutline(pdf) {
  let items;
  try { items = await pdf.getOutline(); } catch { return []; }
  if (!items) return [];
  const out = [];
  const walk = async (list, depth) => {
    for (const it of list) {
      let page = null;
      try {
        let dest = it.dest;
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) page = typeof dest[0] === "number" ? dest[0] : await pdf.getPageIndex(dest[0]);
      } catch { page = null; }
      out.push({ title: (it.title || "").trim(), depth, page });
      if (it.items?.length && depth < 5) await walk(it.items, depth + 1);
    }
  };
  await walk(items, 0);
  return out;
}
