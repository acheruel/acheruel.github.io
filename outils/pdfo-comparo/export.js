// PDFo Comparo : export du PDF comparé et de la liste des changements (CSV).
//
// Mode visuel, export vectoriel : chaque page est superposée sans être convertie en image.
// L'ancienne page est placée dans un groupe de transparence isolé (fond blanc, désaturation,
// puis teinte en mode « Écran » : le noir devient la couleur « supprimé »). La nouvelle page
// reçoit la couleur « ajouté ». Les deux groupes sont combinés en mode « Produit » : ce qui est
// commun aux deux devient foncé, ce qui n'existe que d'un côté garde sa couleur. Le fichier
// reste léger, net à tout zoom, et s'écrit en quelques secondes.
import { pdfLib, mul } from "../commun/pdf-outils.js";

const HEADER = 30; // bandeau d'en-tête ajouté au-dessus de chaque page comparée (pt)
const AMBER = [0.86, 0.52, 0.02];
const NAVY = [0.063, 0.176, 0.255];
const MUTED = [0.337, 0.431, 0.486];

const rgb01 = c => c.map(v => v / 255);

/** Prépare les polices et un « nettoyeur » de texte compatible WinAnsi (Helvetica standard). */
async function fonts(out, L) {
  const reg = await out.embedFont(L.StandardFonts.Helvetica);
  const bold = await out.embedFont(L.StandardFonts.HelveticaBold);
  const ok = new Set(reg.getCharacterSet());
  const MAP = { "−": "-", "‐": "-", "‑": "-", "→": "->", "←": "<-", "↔": "<->", "≤": "<=", "≥": ">=", "Ø": "Ø", "⌀": "Ø", "\u202f": " ", "\u2009": " ", "\u2002": " ", "\u2003": " ", "∞": "inf", "±": "±", "≈": "~", "φ": "phi", "Δ": "Delta" };
  const clean = s => {
    let r = "";
    for (const ch of String(s ?? "")) {
      const m = MAP[ch] ?? ch;
      for (const c of m) r += ok.has(c.codePointAt(0)) ? c : c === "\n" ? " " : "?";
    }
    return r;
  };
  return { reg, bold, clean };
}

/** Coupe un texte pour tenir dans une largeur (avec « … » si besoin, sur maxLines lignes). */
function wrap(text, font, size, width, maxLines = 1) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= width) { cur = t; continue; }
    if (cur) lines.push(cur);
    cur = w;
    while (font.widthOfTextAtSize(cur, size) > width && cur.length > 1) {
      // Mot plus long que la colonne : coupé.
      let k = cur.length;
      while (k > 1 && font.widthOfTextAtSize(cur.slice(0, k), size) > width) k--;
      lines.push(cur.slice(0, k));
      cur = cur.slice(k);
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines);
    let last = keep[maxLines - 1] + "…";
    while (font.widthOfTextAtSize(last, size) > width && last.length > 2) last = last.slice(0, -2) + "…";
    keep[maxLines - 1] = last;
    return keep;
  }
  return lines.length ? lines : [""];
}

/**
 * Exporte le PDF comparé.
 * job : { mode, A, B, pairs, text, opts, labels (textes traduits), raster(pair) }
 */
export async function exportPdf(job, onProgress) {
  const L = await pdfLib();
  const out = await L.PDFDocument.create();
  out.setTitle(job.labels.docTitle);
  out.setCreator("PDFo Comparo · acheruel.github.io");
  out.setProducer("PDFo Comparo (pdf-lib)");
  const F = await fonts(out, L);
  const ctx = out.context;

  // Documents sources pour l'incrustation vectorielle (repli sur l'image si impossible).
  const loadSrc = async bytes => {
    try {
      const d = await L.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
      return d.isEncrypted ? null : d;
    } catch { return null; }
  };
  let srcA = null, srcB = null;
  if (job.opts.vector) [srcA, srcB] = await Promise.all([loadSrc(job.A.bytes), loadSrc(job.B.bytes)]);
  const vector = job.opts.vector && srcA && srcB;

  const gsRef = dict => ctx.register(ctx.obj({ Type: "ExtGState", ...dict }));
  const GS = vector ? { sat: gsRef({ BM: "Saturation" }), scr: gsRef({ BM: "Screen" }), mul: gsRef({ BM: "Multiply" }) } : null;
  const embCache = new Map();
  const embed = async (src, idx, info, key) => {
    if (embCache.has(key)) return embCache.get(key);
    const [l, b, r, t] = info.view;
    let ref = null;
    try {
      const e = await out.embedPage(src.getPage(idx), { left: l, bottom: b, right: r, top: t }, [1, 0, 0, 1, 0, 0]);
      ref = e.ref;
    } catch { ref = null; } // page sans contenu
    embCache.set(key, ref);
    return ref;
  };

  // Groupe teinté : page source (matrice m) sur fond blanc, désaturée puis teintée.
  const tinted = (ref, m, W, H, color) => {
    const ops = [L.setFillingRgbColor(1, 1, 1), L.rectangle(0, 0, W, H), L.fill()];
    if (ref) ops.push(L.pushGraphicsState(), L.concatTransformationMatrix(...m), L.drawObject("P"), L.popGraphicsState());
    ops.push(
      L.pushGraphicsState(), L.setGraphicsState("GSat"), L.setFillingRgbColor(0.5, 0.5, 0.5), L.rectangle(0, 0, W, H), L.fill(), L.popGraphicsState(),
      L.pushGraphicsState(), L.setGraphicsState("GScr"), L.setFillingRgbColor(...color), L.rectangle(0, 0, W, H), L.fill(), L.popGraphicsState()
    );
    const form = ctx.formXObject(ops, {
      BBox: [0, 0, W, H],
      Resources: { XObject: ref ? { P: ref } : {}, ExtGState: { GSat: GS.sat, GScr: GS.scr } },
      Group: { S: "Transparency", CS: "DeviceRGB", I: true, K: false }
    });
    return ctx.register(form);
  };

  const colDel = rgb01(job.opts.colDel), colAdd = rgb01(job.opts.colAdd);
  const lb = job.labels;

  // ---------------------------------------------------------- En-tête des pages comparées
  const header = (page, W, H, title, sub, legend = true) => {
    page.drawRectangle({ x: 0, y: H, width: W, height: HEADER, color: L.rgb(0.94, 0.957, 0.969) });
    page.drawRectangle({ x: 0, y: H, width: W, height: 0.8, color: L.rgb(0.86, 0.9, 0.92) });
    page.drawText(F.clean(title), { x: 10, y: H + 17, size: 9.5, font: F.bold, color: L.rgb(...NAVY) });
    page.drawText(F.clean(sub), { x: 10, y: H + 6.5, size: 7.5, font: F.reg, color: L.rgb(...MUTED) });
    if (!legend) return;
    let x = W - 10;
    const items = job.mode === "text"
      ? [[colAdd, lb.legendAddText], [colDel, lb.legendDelText]]
      : [[[0.15, 0.17, 0.2], lb.legendSame], [colAdd, lb.legendAdd], [colDel, lb.legendDel]];
    for (const [c, txt] of items) {
      const t = F.clean(txt);
      const w = F.reg.widthOfTextAtSize(t, 7.5);
      x -= w;
      page.drawText(t, { x, y: H + 11, size: 7.5, font: F.reg, color: L.rgb(...MUTED) });
      x -= 13;
      page.drawRectangle({ x, y: H + 10, width: 9, height: 7, color: L.rgb(...c) });
      x -= 12;
    }
  };

  const drawZones = (page, zones, H, dx = 0, dy = 0) => {
    zones.forEach((z, i) => {
      page.drawRectangle({
        x: dx + z.x0, y: dy + H - z.y1, width: z.x1 - z.x0, height: z.y1 - z.y0,
        borderColor: L.rgb(...AMBER), borderWidth: 1.1, borderOpacity: 0.95
      });
      const label = String(i + 1);
      const w = F.bold.widthOfTextAtSize(label, 7) + 6;
      page.drawRectangle({ x: dx + z.x0, y: dy + H - z.y0, width: w, height: 10, color: L.rgb(...AMBER) });
      page.drawText(label, { x: dx + z.x0 + 3, y: dy + H - z.y0 + 2.5, size: 7, font: F.bold, color: L.rgb(1, 1, 1) });
    });
  };

  const flip = H => [1, 0, 0, -1, 0, H];

  // ---------------------------------------------------------- Page de synthèse
  if (job.opts.summary) summaryPages(out, L, F, job);

  // ---------------------------------------------------------- Pages comparées
  const pairs = job.pairs.filter(p => job.opts.includeSame || p.status !== "same");
  let done = 0;
  for (const p of pairs) {
    onProgress?.(++done, pairs.length);
    const iA = p.a !== null ? await job.A.info(p.a) : null;
    const iB = p.b !== null ? await job.B.info(p.b) : null;
    const title = lb.pairTitle(p);
    const sub = lb.pairSub(p);

    if (job.mode === "text") {
      // Côte à côte : ancienne à gauche, nouvelle à droite, mots surlignés.
      const gap = 16;
      const wA = iA ? iA.w : 0, wB = iB ? iB.w : 0;
      const W = wA + wB + (iA && iB ? gap : 0);
      const H = Math.max(iA ? iA.h : 0, iB ? iB.h : 0);
      const page = out.addPage([W, H + HEADER]);
      const place = async (src, D, idx, inf, x0, key) => {
        if (vector) {
          const ref = await embed(src, idx, inf, key);
          if (ref) {
            const name = page.node.newXObject("P", ref);
            page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(...mul(inf.vt, [1, 0, 0, -1, x0, H])), L.drawObject(name), L.popGraphicsState());
          }
        } else {
          const img = await job.rasterPage(D, idx);
          const im = await out.embedJpg(img.bytes);
          page.drawImage(im, { x: x0, y: H - inf.h, width: inf.w, height: inf.h });
        }
      };
      if (iA) await place(srcA, job.A, p.a, iA, 0, "A" + p.a);
      if (iB) await place(srcB, job.B, p.b, iB, iA ? wA + gap : 0, "B" + p.b);
      if (iA && iB) page.drawRectangle({ x: wA + gap / 2 - 0.4, y: 0, width: 0.8, height: H, color: L.rgb(0.8, 0.85, 0.88) });
      const hl = (boxes, x0, c) => {
        for (const b of boxes) {
          page.drawRectangle({ x: x0 + b.x0 - 0.5, y: H - b.y1 - 0.5, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1, color: L.rgb(...c), opacity: 0.38, blendMode: L.BlendMode.Multiply });
        }
      };
      hl(p.hlA || [], 0, colDel);
      hl(p.hlB || [], iA ? wA + gap : 0, colAdd);
      header(page, W, H, title, sub);
      continue;
    }

    // Mode visuel
    const ref = iB || iA;
    const W = ref.w, H = ref.h;
    const page = out.addPage([W, H + HEADER]);
    if (vector) {
      const T = p.T || { s: 1, tx: 0, ty: 0 };
      if (iA && iB) {
        const rA = await embed(srcA, p.a, iA, "A" + p.a);
        const rB = await embed(srcB, p.b, iB, "B" + p.b);
        const mA = mul(mul(iA.vt, [T.s, 0, 0, T.s, T.tx, T.ty]), flip(H));
        const mB = mul(iB.vt, flip(H));
        const gB = page.node.newXObject("GB", tinted(rB, mB, W, H, colAdd));
        const gA = page.node.newXObject("GA", tinted(rA, mA, W, H, colDel));
        const gm = page.node.newExtGState("GM", GS.mul);
        page.pushOperators(
          L.pushGraphicsState(), L.drawObject(gB), L.popGraphicsState(),
          L.pushGraphicsState(), L.setGraphicsState(gm), L.drawObject(gA), L.popGraphicsState()
        );
      } else {
        const only = iA ? { src: srcA, idx: p.a, inf: iA, key: "A" + p.a, col: colDel } : { src: srcB, idx: p.b, inf: iB, key: "B" + p.b, col: colAdd };
        const r = await embed(only.src, only.idx, only.inf, only.key);
        const g = page.node.newXObject("G", tinted(r, mul(only.inf.vt, flip(H)), W, H, only.col));
        page.pushOperators(L.pushGraphicsState(), L.drawObject(g), L.popGraphicsState());
      }
    } else {
      const img = await job.rasterPair(p);
      const im = await out.embedJpg(img.bytes);
      page.drawImage(im, { x: 0, y: 0, width: W, height: H });
    }
    if (iA && !iB || !iA && iB) {
      page.drawRectangle({ x: 1.5, y: 1.5, width: W - 3, height: H - 3, borderColor: L.rgb(...(iA ? colDel : colAdd)), borderWidth: 3 });
    }
    if (job.opts.zones && p.zones) drawZones(page, p.zones, H);
    header(page, W, H, title, sub);
  }

  // ---------------------------------------------------------- Liste des changements
  if (job.opts.summary) changesPages(out, L, F, job);

  return new Blob([await out.save({ useObjectStreams: true })], { type: "application/pdf" });
}

// ---------------------------------------------------------------- Synthèse
function summaryPages(out, L, F, job) {
  const lb = job.labels;
  const PW = 612, PH = 792, M = 46;
  let page = out.addPage([PW, PH]);
  let y = PH - M;
  const text = (s, x, yy, size = 9, font = F.reg, color = [0.09, 0.216, 0.294]) =>
    page.drawText(F.clean(s), { x, y: yy, size, font, color: L.rgb(...color) });

  // Bandeau titre
  page.drawRectangle({ x: 0, y: PH - 70, width: PW, height: 70, color: L.rgb(...NAVY) });
  page.drawText(F.clean(lb.docTitle), { x: M, y: PH - 38, size: 17, font: F.bold, color: L.rgb(1, 1, 1) });
  page.drawText(F.clean(lb.generated), { x: M, y: PH - 55, size: 8.5, font: F.reg, color: L.rgb(0.77, 0.85, 0.88) });
  y = PH - 98;

  // Fichiers
  const fileRow = (tag, name, extra, col) => {
    page.drawRectangle({ x: M, y: y - 4, width: 6, height: 14, color: L.rgb(...rgb01(col)) });
    text(tag, M + 14, y, 8, F.bold, MUTED);
    text(wrap(F.clean(name), F.bold, 10, PW - 2 * M - 120, 1)[0], M + 100, y, 10, F.bold);
    text(extra, M + 100, y - 12, 8, F.reg, MUTED);
    y -= 32;
  };
  fileRow(lb.oldTag, job.A.name, lb.fileExtra(job.A, job.idxA), job.opts.colDel);
  fileRow(lb.newTag, job.B.name, lb.fileExtra(job.B, job.idxB), job.opts.colAdd);

  // Chiffres clés
  y -= 4;
  const stats = lb.stats(job);
  const boxW = (PW - 2 * M - 3 * 8) / 4;
  stats.slice(0, 4).forEach((s, i) => {
    const x = M + i * (boxW + 8);
    page.drawRectangle({ x, y: y - 40, width: boxW, height: 48, color: L.rgb(0.94, 0.957, 0.969), borderColor: L.rgb(0.86, 0.9, 0.92), borderWidth: 0.6 });
    text(String(s.value), x + 10, y - 16, 18, F.bold, s.color ? rgb01(s.color) : NAVY);
    text(s.label, x + 10, y - 31, 7.5, F.reg, MUTED);
  });
  y -= 62;
  for (const line of lb.settings(job)) { text(line, M, y, 8, F.reg, MUTED); y -= 12; }
  y -= 10;

  // Tableau des pages
  text(lb.pagesTableTitle, M, y, 11, F.bold, NAVY);
  y -= 16;
  const cols = job.mode === "text"
    ? [[lb.colOld, 70], [lb.colNew, 70], [lb.colState, 110], [lb.colChanges, 270]]
    : [[lb.colOld, 62], [lb.colNew, 62], [lb.colState, 96], [lb.colZones, 150], [lb.colAlign, 150]];
  const headerRow = () => {
    page.drawRectangle({ x: M, y: y - 5, width: PW - 2 * M, height: 17, color: L.rgb(...NAVY) });
    let x = M + 6;
    for (const [c, w] of cols) { text(c, x, y, 7.5, F.bold, [1, 1, 1]); x += w; }
    y -= 17;
  };
  headerRow();
  job.pairs.forEach((p, i) => {
    if (y < M + 20) {
      page = out.addPage([PW, PH]);
      y = PH - M;
      headerRow();
    }
    if (i % 2) page.drawRectangle({ x: M, y: y - 5, width: PW - 2 * M, height: 15, color: L.rgb(0.965, 0.976, 0.984) });
    const cells = lb.pairCells(p);
    let x = M + 6;
    cells.forEach((c, k) => {
      const [, w] = cols[k];
      const col = k === 2 ? lb.stateColor(p) : [0.09, 0.216, 0.294];
      text(wrap(F.clean(c), k === 2 ? F.bold : F.reg, 8, w - 8, 1)[0], x, y, 8, k === 2 ? F.bold : F.reg, col);
      x += w;
    });
    y -= 15;
  });
}

function changesPages(out, L, F, job) {
  const lb = job.labels;
  const rows = lb.changeRows(job);
  if (!rows.length) return;
  const PW = 612, PH = 792, M = 46;
  const cols = [[lb.colN, 26], [lb.colType, 74], [lb.colPages, 62], [lb.colOldText, 179], [lb.colNewText, 179]];
  let page, y;
  const text = (s, x, yy, size = 8, font = F.reg, color = [0.09, 0.216, 0.294]) =>
    page.drawText(s, { x, y: yy, size, font, color: L.rgb(...color) });
  const newPage = () => {
    page = out.addPage([PW, PH]);
    y = PH - M;
    text(F.clean(lb.changesTitle), M, y, 13, F.bold, NAVY);
    y -= 22;
    page.drawRectangle({ x: M, y: y - 5, width: PW - 2 * M, height: 17, color: L.rgb(...NAVY) });
    let x = M + 5;
    for (const [c, w] of cols) { text(F.clean(c), x, y, 7.5, F.bold, [1, 1, 1]); x += w; }
    y -= 18;
  };
  newPage();
  rows.forEach((r, i) => {
    const cells = [String(r.n), r.type, r.pages, r.oldText, r.newText].map(F.clean);
    const lines = cells.map((c, k) => wrap(c, F.reg, 7.5, cols[k][1] - 8, 4));
    const h = Math.max(...lines.map(l => l.length)) * 9.5 + 5;
    if (y - h < M) newPage();
    if (i % 2) page.drawRectangle({ x: M, y: y - h + 7, width: PW - 2 * M, height: h, color: L.rgb(0.965, 0.976, 0.984) });
    let x = M + 5;
    lines.forEach((ls, k) => {
      const color = k === 3 ? rgb01(job.opts.colDel).map(v => v * 0.8) : k === 4 ? rgb01(job.opts.colAdd).map(v => v * 0.8) : [0.09, 0.216, 0.294];
      ls.forEach((ln, j) => text(ln, x, y - j * 9.5, 7.5, k === 1 ? F.bold : F.reg, color));
      x += cols[k][1];
    });
    y -= h;
  });
}

// ---------------------------------------------------------------- CSV
/** Liste des changements en CSV (séparateur « ; », UTF-8 avec BOM pour Excel). */
export function exportCsv(rows, headers) {
  const q = v => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(q).join(";"), ...rows.map(r => r.map(q).join(";"))];
  return new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
