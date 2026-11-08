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
 * opts : { tables, margins, styles, onProgress(i, n) }
 * Retourne { blocks, outline, bodySize, pages }.
 * Bloc : { type: "h", level, text, page } | { type: "p", runs: [{ t, b, i }], page }
 *        | { type: "li", ordered, marker, level, runs, page } | { type: "table", rows: [[cell]], page }
 *        | { type: "pagebreak", page }
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
  for (const p of pages) {
    if (blocks.length) blocks.push({ type: "pagebreak", page: p.index });
    const marks = outlineByPage.get(p.index) || [];
    for (const it of p.flow) {
      if (it.table) { blocks.push({ type: "table", rows: it.table, page: p.index }); continue; }
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
  const free = frags.filter((_, k) => inTable[k] < 0 || !tableRows[inTable[k]]);
  const lines = toLines(free);

  // Ordre de lecture : tableaux insérés à leur hauteur, deux colonnes si détectées.
  const ordered = orderColumns(lines, W);
  const flow = [];
  const tabs = tables.map((tb, ti) => ({ y: tb.y0, rows: tableRows[ti] })).filter(t => t.rows).sort((a, b) => a.y - b.y);
  let cur = [];
  for (const ln of ordered) {
    while (tabs.length && tabs[0].y < ln.y - ln.size && !ln.col) {
      if (cur.length) { flow.push({ lines: cur }); cur = []; }
      flow.push({ table: tabs.shift().rows });
    }
    cur.push(ln);
  }
  if (cur.length) flow.push({ lines: cur });
  for (const t of tabs) flow.push({ table: t.rows });
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
  const out = rows.map(row => keepC.map(c => row[c])).filter(row => row.some(Boolean));
  if (keepC.length < 2 || out.length < 2) return null;
  return out;
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
    p.flow = p.flow.filter(f => f.table || f.lines.length);
  }
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
