// Photo Rapporto : mise en page du rapport, partagée par l'aperçu (canevas) et l'export (jsPDF).
// layout() produit, pour chaque page, une liste d'opérations en points PDF (1/72 po) :
//   { k: "text", x, y, s, size, bold, color, align }  (y = ligne de base)
//   { k: "line", x1, y1, x2, y2, color, w }
//   { k: "rect", x, y, w, h, fill, r }
//   { k: "img", src: "photo" | "logo", i, x, y, w, h }
// Les deux rendus lisent les mêmes opérations : l'aperçu est fidèle au PDF.
(() => {
  "use strict";

  const PAPER = { letter: [612, 792], a4: [595.28, 841.89] };
  const COL = { navy: "#102d41", ink: "#17374b", muted: "#566e7c", teal: "#007f78", line: "#dce5eb", soft: "#f3f6f8", frame: "#eef2f5" };
  // [colonnes, rangées] selon le nombre de photos par page
  const GRID = {
    portrait: { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] },
    landscape: { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2] }
  };
  // Légende : taille du texte et nombre maximal de lignes par photo
  const CAP = { 1: { size: 10, lines: 6 }, 2: { size: 9.5, lines: 4 }, 4: { size: 9, lines: 3 }, 6: { size: 8.5, lines: 2 } };
  const M = 42;          // marges
  const GX = 16, GY = 16; // gouttières entre les photos

  // Polices standard du PDF (Helvetica, WinAnsi) : on remplace les caractères hors jeu.
  const WIN = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
  const SUBST = { "≥": ">=", "≤": "<=", "−": "-", "‐": "-", "‑": "-", "→": "->", "←": "<-", "≈": "~", "✓": "v", " ": " ", " ": " ", " ": " ", "​": "", "\t": " " };
  function clean(str) {
    let out = "";
    for (const ch of String(str ?? "").normalize("NFC")) {
      const c = ch.codePointAt(0);
      if (ch === "\n" || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN.has(ch)) out += ch;
      else if (ch in SUBST) out += SUBST[ch];
      else if (ch === "\r") continue;
      else {
        const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
        out += /^[\x20-\x7e]+$/.test(base) ? base : "?";
      }
    }
    return out;
  }

  function measurer() {
    const doc = new window.jspdf.jsPDF({ unit: "pt" });
    const set = (size, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); };
    const width = (s, size, bold) => { set(size, bold); return doc.getTextWidth(s); };
    const wrap = (s, size, bold, maxW) => {
      if (!s) return [];
      set(size, bold);
      return doc.splitTextToSize(s, maxW);
    };
    // Coupe une ligne trop longue avec des points de suspension.
    const fit = (s, size, bold, maxW) => {
      if (width(s, size, bold) <= maxW) return s;
      let lo = 0, hi = s.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (width(s.slice(0, mid).trimEnd() + "…", size, bold) <= maxW) lo = mid; else hi = mid - 1;
      }
      return s.slice(0, lo).trimEnd() + "…";
    };
    const clamp = (lines, n, size, bold, maxW) => {
      if (lines.length <= n) return lines;
      const out = lines.slice(0, n);
      out[n - 1] = fit(out[n - 1] + "…", size, bold, maxW);
      if (!out[n - 1].endsWith("…")) out[n - 1] += "…";
      return out;
    };
    return { width, wrap, fit, clamp };
  }

  // input : { photos: [{ w, h, caption, taken, name }], info, extra, opts, logo: { w, h } | null, t, fmtDate, fmtDateTime }
  function layout(input) {
    const { photos, info, opts, t } = input;
    const m = measurer();
    let [W, H] = PAPER[opts.paper] || PAPER.letter;
    if (opts.orientation === "landscape") [W, H] = [H, W];
    const landscape = W > H;
    const CW = W - 2 * M;
    const title = clean(info.title || t.defaultTitle);
    const pages = [];
    let ops;
    const text = (s, x, y, size, o = {}) => ops.push({ k: "text", s, x, y, size, bold: !!o.bold, color: o.color || COL.ink, align: o.align || "left" });
    const line = (x1, y1, x2, y2, color = COL.line, w = 0.75) => ops.push({ k: "line", x1, y1, x2, y2, color, w });
    const rect = (x, y, w, h, fill, r = 0) => ops.push({ k: "rect", x, y, w, h, fill, r });
    const logoBox = (maxW, maxH) => {
      if (!input.logo) return null;
      const s = Math.min(maxW / input.logo.w, maxH / input.logo.h);
      return { w: input.logo.w * s, h: input.logo.h * s };
    };

    // Champs du projet, dans l'ordre d'affichage, seulement ceux qui sont remplis.
    const entries = [
      ["projectNo", info.projectNo], ["contractNo", info.contractNo], ["client", info.client],
      ["location", info.location], ["author", info.author],
      ["reportDate", info.reportDate && input.fmtDate(info.reportDate)],
      ["visitDate", info.visitDate && input.fmtDate(info.visitDate)], ["weather", info.weather]
    ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => [t.fields[k], v]);
    for (const f of input.extra || []) if ((f.label || "").trim() || (f.value || "").trim()) entries.push([f.label || "—", f.value || "—"]);
    const fields = entries.map(([label, value]) => [clean(label).toUpperCase(), clean(value)]);

    // Grille des champs sur fond clair ; renvoie le bas du bloc.
    function fieldGrid(x, y, w, cols) {
      if (!fields.length) return y;
      const pad = 12, gap = 16;
      const colW = (w - 2 * pad - (cols - 1) * gap) / cols;
      const rows = [];
      for (let i = 0; i < fields.length; i += cols) {
        const cells = fields.slice(i, i + cols).map(([label, value]) => ({
          label: m.fit(label, 6.8, true, colW),
          lines: m.clamp(m.wrap(value, 9.5, false, colW), 2, 9.5, false, colW)
        }));
        rows.push({ cells, h: 11 + Math.max(...cells.map(c => c.lines.length)) * 12.5 });
      }
      const total = rows.reduce((a, r) => a + r.h, 0) + (rows.length - 1) * 8 + 2 * pad - 2;
      rect(x, y, w, total, COL.soft, 4);
      let cy = y + pad;
      for (const row of rows) {
        row.cells.forEach((c, j) => {
          const cx = x + pad + j * (colW + gap);
          text(c.label, cx, cy + 6.5, 6.8, { bold: true, color: COL.muted });
          c.lines.forEach((ln, k) => text(ln, cx, cy + 18.5 + k * 12.5, 9.5, { color: COL.ink }));
        });
        cy += row.h + 8;
      }
      return y + total;
    }

    function notesBlock(x, y, w, maxLines) {
      const notes = clean(info.notes || "").trim();
      if (!notes) return y;
      text(clean(t.notes).toUpperCase(), x, y + 7, 6.8, { bold: true, color: COL.muted });
      const lines = m.clamp(m.wrap(notes, 9.5, false, w), maxLines, 9.5, false, w);
      lines.forEach((ln, k) => text(ln, x, y + 21 + k * 13, 9.5));
      return y + 21 + (lines.length - 1) * 13 + 4;
    }

    // En-tête courant (pages de photos) et pied de page.
    const subline = clean([info.projectName, info.projectNo && `${t.project} ${info.projectNo}`, info.contractNo && `${t.contract} ${info.contractNo}`].filter(Boolean).join("  ·  "));
    function runningHeader() {
      let x = M;
      const lb = logoBox(96, 24);
      if (lb) { ops.push({ k: "img", src: "logo", x: M, y: M + 13 - lb.h / 2, w: lb.w, h: lb.h }); x += lb.w + 12; }
      const dateTxt = info.reportDate ? clean(input.fmtDate(info.reportDate)) : "";
      const dateW = dateTxt ? m.width(dateTxt, 8, false) + 16 : 0;
      text(m.fit(title, 9.5, true, W - M - x - dateW), x, M + 9, 9.5, { bold: true, color: COL.navy });
      if (subline) text(m.fit(subline, 8, false, W - M - x - dateW), x, M + 21, 8, { color: COL.muted });
      if (dateTxt) text(dateTxt, W - M, M + 9, 8, { color: COL.muted, align: "right" });
      line(M, M + 30, W - M, M + 30);
      return M + 44;
    }
    const FOOT_Y = H - M + 14;
    const CONTENT_BOTTOM = FOOT_Y - 24;
    const newPage = (kind) => { ops = []; pages.push({ kind, ops }); };

    // Page de garde
    function coverPage() {
      newPage("cover");
      const lb = logoBox(170, 60);
      if (lb) ops.push({ k: "img", src: "logo", x: M, y: M, w: lb.w, h: lb.h });
      let y = landscape ? H * 0.2 : H * 0.27;
      const kicker = clean(info.projectNo ? `${t.project} ${info.projectNo}` : t.defaultTitle).toUpperCase();
      text(kicker, M, y, 9, { bold: true, color: COL.teal });
      y += 30;
      m.clamp(m.wrap(title, 28, true, CW), 3, 28, true, CW).forEach((ln, k) => text(ln, M, y + k * 33, 28, { bold: true, color: COL.navy }));
      y += (Math.min(3, m.wrap(title, 28, true, CW).length) - 1) * 33;
      if (info.projectName) {
        const pn = m.clamp(m.wrap(clean(info.projectName), 14, false, CW), 2, 14, false, CW);
        pn.forEach((ln, k) => text(ln, M, y + 24 + k * 18, 14, { color: COL.ink }));
        y += 24 + (pn.length - 1) * 18;
      }
      y += 18;
      rect(M, y, 56, 3, COL.teal);
      y += 24;
      y = fieldGrid(M, y, CW, landscape ? 4 : 3);
      y += fields.length ? 22 : 0;
      const room = Math.max(3, Math.floor((CONTENT_BOTTOM - 30 - y) / 13));
      notesBlock(M, y, CW, room);
      line(M, FOOT_Y - 11, W - M, FOOT_Y - 11);
      text(clean(t.photoCount(photos.length)), M, FOOT_Y, 8, { color: COL.muted });
      if (info.author) text(m.fit(clean(`${t.fields.author} : ${info.author}`), 8, false, CW / 2), W - M, FOOT_Y, 8, { color: COL.muted, align: "right" });
    }

    // Bloc d'identification en haut de la première page (sans page de garde) ; renvoie le bas du bloc.
    function firstPageBlock() {
      newPage("first");
      const lb = logoBox(140, 46);
      let right = W - M;
      if (lb) { ops.push({ k: "img", src: "logo", x: W - M - lb.w, y: M - 4, w: lb.w, h: lb.h }); right -= lb.w + 18; }
      const tw = right - M;
      const tl = m.clamp(m.wrap(title, 20, true, tw), 2, 20, true, tw);
      tl.forEach((ln, k) => text(ln, M, M + 16 + k * 24, 20, { bold: true, color: COL.navy }));
      let y = M + 16 + (tl.length - 1) * 24;
      if (info.projectName) {
        const pn = m.clamp(m.wrap(clean(info.projectName), 11.5, false, tw), 2, 11.5, false, tw);
        pn.forEach((ln, k) => text(ln, M, y + 19 + k * 15, 11.5));
        y += 19 + (pn.length - 1) * 15;
      }
      y = Math.max(y + 12, lb ? M - 4 + lb.h + 8 : 0);
      rect(M, y, CW, 1.6, COL.teal);
      y += 14;
      y = fieldGrid(M, y, CW, landscape ? 4 : 3);
      if (fields.length) y += 14;
      y = notesBlock(M, y, CW, 10);
      return y + 6;
    }

    // Grille des photos
    const per = [1, 2, 4, 6].includes(+opts.perPage) ? +opts.perPage : 2;
    const [cols, rows] = GRID[landscape ? "landscape" : "portrait"][per];
    const cap = CAP[per];
    const top = M + 44;
    const cellW = (CW - (cols - 1) * GX) / cols;
    const cellH = (CONTENT_BOTTOM - top - (rows - 1) * GY) / rows;
    const leading = cap.size * 1.32;

    const metaOf = (p, n) => {
      const label = opts.numbering ? `${t.photo} ${n}` : "";
      const rest = [opts.showDate && p.taken ? input.fmtDateTime(p.taken) : "", opts.showFile ? p.name : ""].filter(Boolean).join("  ·  ");
      return { label: clean(label), rest: clean(rest) };
    };
    const hasMeta = photos.some((p, i) => { const mm = metaOf(p, i + 1); return mm.label || mm.rest; });
    const wrapped = photos.map(p => m.wrap(clean(p.caption || "").trim(), cap.size, false, cellW));
    const capLines = Math.min(cap.lines, Math.max(0, ...wrapped.map(l => l.length)));
    const capH = (hasMeta || capLines) ? 9 + (hasMeta ? 11 : 0) + capLines * leading + 1 : 0;

    function cell(p, n, lines, x, y, h) {
      const boxH = h - capH;
      rect(x, y, cellW, boxH, COL.frame, 3);
      const s = Math.min(cellW / p.w, boxH / p.h);
      const iw = p.w * s, ih = p.h * s;
      ops.push({ k: "img", src: "photo", i: p.index, x: x + (cellW - iw) / 2, y: y + (boxH - ih) / 2, w: iw, h: ih });
      let cy = y + boxH + 9;
      const meta = metaOf(p, n);
      if (hasMeta) {
        cy += 8;
        let mx = x;
        if (meta.label) {
          text(meta.label, x, cy, 9, { bold: true, color: COL.teal });
          mx += m.width(meta.label, 9, true) + 8;
        }
        if (meta.rest) text(m.fit(meta.rest, 8, false, x + cellW - mx), mx, cy, 8, { color: COL.muted });
        cy += 3;
      }
      m.clamp(lines, capLines, cap.size, false, cellW).forEach((ln, k) => text(ln, x, cy + (k + 1) * leading - 2, cap.size));
    }

    let i = 0;
    const placeRows = (y0, nRows, h) => {
      for (let r = 0; r < nRows && i < photos.length; r++) {
        for (let c = 0; c < cols && i < photos.length; c++, i++) {
          cell(photos[i], i + 1, wrapped[i], M + c * (cellW + GX), y0 + r * (h + GY), h);
        }
      }
    };

    if (opts.cover) coverPage();
    else {
      const y = firstPageBlock();
      const rem = CONTENT_BOTTOM - y;
      let n = Math.floor((rem + GY) / (cellH + GY));
      let h = cellH;
      if (n === 0 && rem >= 0.55 * cellH) { n = 1; h = rem; }
      placeRows(y, Math.min(n, rows), h);
    }
    while (i < photos.length) {
      newPage("photos");
      placeRows(runningHeader(), rows, cellH);
    }

    // Pieds de page (sauf page de garde)
    const total = pages.length;
    pages.forEach((pg, k) => {
      if (pg.kind === "cover") return;
      ops = pg.ops;
      line(M, FOOT_Y - 11, W - M, FOOT_Y - 11);
      const pageTxt = clean(t.page(k + 1, total));
      const left = clean([title, info.projectNo].filter(Boolean).join("  ·  "));
      text(m.fit(left, 7.5, false, CW - m.width(pageTxt, 7.5, false) - 24), M, FOOT_Y, 7.5, { color: COL.muted });
      text(pageTxt, W - M, FOOT_Y, 7.5, { color: COL.muted, align: "right" });
    });

    return { W, H, pages: pages.map(p => p.ops) };
  }

  // Aperçu : dessine une page sur un canevas, à la largeur voulue (px CSS).
  // getImage(op) renvoie une image prête (miniature) ou null.
  function drawPage(canvas, doc, index, widthPx, getImage) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const s = widthPx / doc.W;
    canvas.width = Math.round(widthPx * dpr);
    canvas.height = Math.round(doc.H * s * dpr);
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${doc.H * s}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, doc.W, doc.H);
    for (const op of doc.pages[index]) {
      if (op.k === "text") {
        ctx.font = `${op.bold ? "700 " : ""}${op.size}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = op.color;
        ctx.textAlign = op.align;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(op.s, op.x, op.y);
      } else if (op.k === "line") {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.w;
        ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
      } else if (op.k === "rect") {
        ctx.fillStyle = op.fill;
        ctx.beginPath();
        if (op.r && ctx.roundRect) ctx.roundRect(op.x, op.y, op.w, op.h, op.r); else ctx.rect(op.x, op.y, op.w, op.h);
        ctx.fill();
      } else if (op.k === "img") {
        const img = getImage(op);
        if (img) ctx.drawImage(img, op.x, op.y, op.w, op.h);
        else { ctx.fillStyle = COL.line; ctx.fillRect(op.x, op.y, op.w, op.h); }
      }
    }
  }

  // Export : construit le PDF. getImage(op) renvoie (async) { data: Uint8Array, format: "JPEG" | "PNG" }.
  async function toPDF(doc, getImage, meta = {}, onProgress = () => {}) {
    const { jsPDF } = window.jspdf;
    const orientation = doc.W > doc.H ? "landscape" : "portrait";
    const pdf = new jsPDF({ unit: "pt", format: [doc.W, doc.H], orientation, compress: true });
    pdf.setProperties({ title: clean(meta.title || ""), subject: clean(meta.subject || ""), author: clean(meta.author || ""), creator: "Photo Rapporto · acheruel.github.io" });
    const imgOps = doc.pages.flat().filter(op => op.k === "img" && op.src === "photo").length;
    let done = 0;
    for (let p = 0; p < doc.pages.length; p++) {
      if (p > 0) pdf.addPage([doc.W, doc.H], orientation);
      for (const op of doc.pages[p]) {
        if (op.k === "text") {
          pdf.setFont("helvetica", op.bold ? "bold" : "normal");
          pdf.setFontSize(op.size);
          pdf.setTextColor(op.color);
          pdf.text(op.s, op.x, op.y, { align: op.align, baseline: "alphabetic" });
        } else if (op.k === "line") {
          pdf.setDrawColor(op.color);
          pdf.setLineWidth(op.w);
          pdf.line(op.x1, op.y1, op.x2, op.y2);
        } else if (op.k === "rect") {
          pdf.setFillColor(op.fill);
          if (op.r) pdf.roundedRect(op.x, op.y, op.w, op.h, op.r, op.r, "F"); else pdf.rect(op.x, op.y, op.w, op.h, "F");
        } else if (op.k === "img") {
          const im = await getImage(op);
          if (im) pdf.addImage(im.data, im.format, op.x, op.y, op.w, op.h, im.alias, "NONE");
          if (op.src === "photo") onProgress(++done, imgOps);
        }
      }
    }
    return pdf.output("blob");
  }

  window.PhotoReport = { layout, drawPage, toPDF, clean };
})();
