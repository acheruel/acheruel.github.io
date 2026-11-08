// PDFo Converto : interface. Un PDF → Markdown, images, pages séparées, Word ou PowerPoint.
import { openPdf, readFile, looksLikePdf, renderPage, dropCanvas, download, zip, safeName, fmtBytes, parseRange, esc, pdfLib, pptxgen, idle } from "../commun/pdf-outils.js";
import { renderMarkdown } from "../commun/markdown.js";
import { extract } from "./extract.js";
import { toMarkdown, splitChapters, chapterFiles, toDocx } from "./writers.js";

const $ = id => document.getElementById(id);
const LS = "pdfo-converto:opts";
const DEFAULTS = {
  format: "md", mdSplit: "auto", tables: true, margins: true, styles: true, pageMarkers: false,
  imgFormat: "jpg", dpi: "150", quality: 0.86,
  splitMode: "each", every: 5, ranges: "",
  docxMode: "text", pageBreaks: false,
  pptDpi: "170", notes: true
};
const EXAMPLE = "exemples/rapport-inspection-exemple.pdf";

const TXT = {
  fr: {
    locale: "fr-CA",
    meta: (n, size) => `${n} page${n > 1 ? "s" : ""} · ${size}`,
    opening: "Ouverture du PDF…",
    notPdf: name => `« ${name} » n'est pas un PDF.`,
    openFail: name => `Impossible d'ouvrir « ${name} ».`,
    password: (name, again) => `${again ? "Mot de passe incorrect. " : ""}« ${name} » est protégé. Mot de passe :`,
    badRange: "Liste de pages invalide (ex. : 1-10, 15, 18-20).",
    ready: n => `Prêt : ${n} page${n > 1 ? "s" : ""} à convertir.`,
    reading: (i, n) => `Lecture de la structure… page ${i} sur ${n}`,
    rendering: (i, n) => `Rendu des pages… ${i} sur ${n}`,
    building: "Assemblage du fichier…",
    saved: (name, size) => `Enregistré : ${name} (${size}).`,
    failed: "La conversion a échoué.",
    copied: "Markdown copié dans le presse-papiers.",
    copyFail: "Copie impossible : utilisez le téléchargement.",
    noText: "Aucun texte trouvé : ce PDF est sans doute numérisé (image). Essayez Images, Word (images des pages) ou PowerPoint.",
    chapters: (n, src) => n ? `<b>${n} chapitres</b> détectés (${src === "outline" ? "signets du PDF" : "titres de niveau 1"}).` : "Aucun chapitre détecté (ni signets, ni titres de niveau 1).",
    autoOne: "Automatique : un seul fichier pour un document court.",
    autoSplit: "Automatique : un fichier par chapitre, avec un sommaire.",
    intro: "Début du document", toc: "Sommaire :", tocFile: "Sommaire",
    pagesOf: (a, b) => a === b ? `p. ${a}` : `p. ${a}–${b}`,
    page: n => `Page ${n}`,
    files: n => `${n} fichier${n > 1 ? "s" : ""}`,
    slide: n => `Diapositive ${n}`,
    docxText: "Titres, paragraphes, listes et tableaux modifiables, dans le style du document Word.",
    docxImages: "Chaque page devient une image : mise en page exacte, mais texte non modifiable.",
    dl: { md: "Télécharger le .md", mdZip: "Télécharger les chapitres (.zip)", img: "Télécharger les images", imgOne: "Télécharger l'image", split: "Télécharger les PDF (.zip)", splitOne: "Télécharger le PDF", docx: "Télécharger le .docx", pptx: "Télécharger le .pptx" },
    emptyPreview: "L'aperçu s'affichera ici.",
    invalidRanges: "Plages invalides : ex. 1-3, 4-10, 11-20."
  },
  en: {
    locale: "en-CA",
    meta: (n, size) => `${n} page${n > 1 ? "s" : ""} · ${size}`,
    opening: "Opening the PDF…",
    notPdf: name => `“${name}” is not a PDF.`,
    openFail: name => `Could not open “${name}”.`,
    password: (name, again) => `${again ? "Wrong password. " : ""}“${name}” is protected. Password:`,
    badRange: "Invalid page list (e.g. 1-10, 15, 18-20).",
    ready: n => `Ready: ${n} page${n > 1 ? "s" : ""} to convert.`,
    reading: (i, n) => `Reading the structure… page ${i} of ${n}`,
    rendering: (i, n) => `Rendering pages… ${i} of ${n}`,
    building: "Building the file…",
    saved: (name, size) => `Saved: ${name} (${size}).`,
    failed: "The conversion failed.",
    copied: "Markdown copied to the clipboard.",
    copyFail: "Could not copy: use the download instead.",
    noText: "No text found: this PDF is probably scanned (an image). Try Images, Word (page images) or PowerPoint.",
    chapters: (n, src) => n ? `<b>${n} chapters</b> found (${src === "outline" ? "PDF bookmarks" : "level 1 headings"}).` : "No chapters found (no bookmarks, no level 1 headings).",
    autoOne: "Automatic: a single file for a short document.",
    autoSplit: "Automatic: one file per chapter, with a table of contents.",
    intro: "Front matter", toc: "Contents:", tocFile: "Contents",
    pagesOf: (a, b) => a === b ? `p. ${a}` : `pp. ${a}–${b}`,
    page: n => `Page ${n}`,
    files: n => `${n} file${n > 1 ? "s" : ""}`,
    slide: n => `Slide ${n}`,
    docxText: "Editable headings, paragraphs, lists and tables, in Word's own styles.",
    docxImages: "Each page becomes an image: exact layout, but the text cannot be edited.",
    dl: { md: "Download the .md", mdZip: "Download the chapters (.zip)", img: "Download the images", imgOne: "Download the image", split: "Download the PDFs (.zip)", splitOne: "Download the PDF", docx: "Download the .docx", pptx: "Download the .pptx" },
    emptyPreview: "The preview will appear here.",
    invalidRanges: "Invalid ranges: e.g. 1-3, 4-10, 11-20."
  }
};
const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
const t = () => TXT[lang()];

// ---------------------------------------------------------------- État
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
const state = {
  file: null, pdf: null, n: 0, idx: [],
  opts: { ...DEFAULTS, ...store.get() },
  extracted: null, extractKey: "",
  md: null, chapter: 0, mdView: "render",
  thumbs: new Map(),
  busy: false, token: 0
};

const statusEl = $("status"), progressEl = $("progress");
function status(msg, { warn = false, busy = false } = {}) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("is-warn", warn);
  statusEl.classList.toggle("is-busy", busy);
}
function progress(i, n) {
  progressEl.hidden = !n;
  if (n) progressEl.firstElementChild.style.width = `${Math.round((100 * i) / n)}%`;
}
const base = () => safeName(state.file?.name || "document");

// ---------------------------------------------------------------- Options
function renderOpts() {
  const o = state.opts;
  document.querySelectorAll(".seg[data-opt]").forEach(seg => seg.querySelectorAll("button").forEach(b => {
    const on = b.dataset.value === String(o[seg.dataset.opt]);
    b.classList.toggle("selected", on);
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }));
  document.querySelectorAll("input[type=checkbox][data-opt]").forEach(c => { c.checked = !!o[c.dataset.opt]; });
  document.querySelectorAll("input[type=range][data-opt], input[type=number][data-opt], input[type=text][data-opt]").forEach(c => {
    if (document.activeElement !== c) c.value = o[c.dataset.opt];
  });
  document.querySelector('[data-out="quality"]').textContent = `${Math.round(o.quality * 100)} %`;
  document.querySelector("[data-only-jpg]").hidden = o.imgFormat !== "jpg";
  document.querySelectorAll("[data-split]").forEach(el => { el.hidden = el.dataset.split !== o.splitMode; });
  document.querySelectorAll("[data-docx]").forEach(el => { el.hidden = el.dataset.docx !== o.docxMode; });
  $("docx-hint").textContent = o.docxMode === "text" ? t().docxText : t().docxImages;
  // Onglets de format
  document.querySelectorAll("#formats [data-format]").forEach(b => {
    const on = b.dataset.format === o.format;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== o.format; });
}
const EXTRACT_KEYS = ["tables", "margins", "styles"];
let previewTimer = 0;
function onOpt(key, value) {
  state.opts[key] = value;
  store.set(state.opts);
  if (EXTRACT_KEYS.includes(key)) state.extracted = null;
  if (key !== "quality") state.md = null;
  renderOpts();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, key === "ranges" || key === "every" ? 350 : 0);
}
document.querySelectorAll(".seg[data-opt]").forEach(seg => {
  seg.addEventListener("click", e => { const b = e.target.closest("button"); if (b) onOpt(seg.dataset.opt, b.dataset.value); });
  seg.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = [...seg.querySelectorAll("button")];
    const i = bs.findIndex(b => b.classList.contains("selected"));
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
    onOpt(seg.dataset.opt, n.dataset.value);
    n.focus();
    e.preventDefault();
  });
});
document.querySelectorAll("input[type=checkbox][data-opt]").forEach(c => c.addEventListener("change", () => onOpt(c.dataset.opt, c.checked)));
document.querySelectorAll("input[type=range][data-opt]").forEach(c => c.addEventListener("input", () => onOpt(c.dataset.opt, +c.value)));
document.querySelectorAll("input[type=number][data-opt]").forEach(c => c.addEventListener("input", () => { const v = Math.max(1, parseInt(c.value, 10) || 1); onOpt(c.dataset.opt, v); }));
document.querySelectorAll("input[type=text][data-opt]").forEach(c => c.addEventListener("input", () => onOpt(c.dataset.opt, c.value)));

$("formats").addEventListener("click", e => {
  const b = e.target.closest("[data-format]");
  if (b) onOpt("format", b.dataset.format);
});
$("formats").addEventListener("keydown", e => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const bs = [...$("formats").querySelectorAll("[data-format]")];
  const i = bs.findIndex(b => b.getAttribute("aria-selected") === "true");
  const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
  onOpt("format", n.dataset.format);
  n.focus();
  e.preventDefault();
});

// ---------------------------------------------------------------- Fichier
const drop = $("drop");
$("pick").addEventListener("click", () => $("file-input").click());
$("change").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", e => { const f = e.target.files[0]; if (f) load(f); e.target.value = ""; });
for (const el of [drop, document.body]) {
  el.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
  el.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  el.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("is-over");
    const f = [...e.dataTransfer.files].find(x => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name));
    if (f) load(f);
  });
}
$("example").addEventListener("click", async () => {
  status(t().opening, { busy: true });
  const bytes = new Uint8Array(await (await fetch(EXAMPLE)).arrayBuffer());
  load({ name: EXAMPLE.split("/").pop(), bytes });
});
$("range").addEventListener("input", e => {
  const idx = state.pdf ? parseRange(e.target.value, state.n) : null;
  e.target.classList.toggle("is-invalid", !!state.pdf && idx === null);
  if (!idx) return;
  state.idx = idx;
  state.extracted = null; state.md = null;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 400);
});

async function load(file) {
  const x = t();
  status(x.opening, { busy: true });
  try {
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : await readFile(file);
    if (!looksLikePdf(bytes)) { status(x.notPdf(file.name), { warn: true }); return; }
    let again = false;
    // fontExtraProperties : nom des polices, pour reconnaître le gras et l'italique.
    const pdf = await openPdf(bytes, reason => { const pw = window.prompt(t().password(file.name, again || reason === "incorrect")); again = true; return pw; }, { fontExtraProperties: true });
    try { state.pdf?.loadingTask?.destroy(); } catch { /* déjà libéré */ }
    state.token++;
    Object.assign(state, { file: { name: file.name, size: bytes.length, bytes }, pdf, n: pdf.numPages, idx: [...Array(pdf.numPages).keys()], extracted: null, md: null, chapter: 0 });
    state.thumbs.clear();
    $("range").value = "";
    $("range").classList.remove("is-invalid");
    drop.hidden = true;
    $("file-card").hidden = $("formats").hidden = $("work").hidden = false;
    $("file-name").textContent = file.name;
    $("file-meta").textContent = x.meta(pdf.numPages, fmtBytes(bytes.length, x.locale));
    thumb(0).then(url => { $("file-thumb").style.backgroundImage = `url(${url})`; });
    $("download").disabled = false;
    updatePreview();
  } catch (err) {
    console.error(err);
    status(x.openFail(file.name), { warn: true });
  }
}

// Vignettes (≈ 260 px de haut), mises en cache.
async function thumb(i) {
  if (state.thumbs.has(i)) return state.thumbs.get(i);
  const p = (async () => {
    const page = await state.pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    const c = await renderPage(page, { scale: 260 / Math.max(vp.width, vp.height) });
    const url = c.toDataURL("image/jpeg", 0.82);
    dropCanvas(c);
    return url;
  })();
  state.thumbs.set(i, p);
  return p;
}
const thumbObserver = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target;
    thumbObserver.unobserve(el);
    thumb(+el.dataset.page).then(url => { el.style.backgroundImage = `url(${url})`; }).catch(() => {});
  }
}, { rootMargin: "300px" });

async function pageRatio(i) {
  const page = await state.pdf.getPage(i + 1);
  const vp = page.getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height };
}

// ---------------------------------------------------------------- Structure (Markdown, Word)
async function getExtract() {
  const o = state.opts;
  const key = `${state.idx.join(",")}|${o.tables}|${o.margins}|${o.styles}`;
  if (state.extracted && state.extractKey === key) return state.extracted;
  const token = state.token;
  const r = await extract(state.pdf, state.idx, {
    tables: o.tables, margins: o.margins, styles: o.styles,
    onProgress: (i, n) => { if (token === state.token) { status(t().reading(i, n), { busy: true }); progress(i, n); } }
  });
  progress(0, 0);
  if (token !== state.token) return null;
  state.extracted = r;
  state.extractKey = key;
  return r;
}

/** Fichiers Markdown selon le découpage choisi : [{ name, title, md }]. */
async function getMarkdown() {
  if (state.md) return state.md;
  const r = await getExtract();
  if (!r) return null;
  const x = t(), o = state.opts;
  const chapters = splitChapters(r.blocks, r.outline);
  const source = r.outline.filter(q => q.page !== null).length >= 2 ? "outline" : "headings";
  const wantSplit = o.mdSplit === "chapters" || (o.mdSplit === "auto" && chapters && state.idx.length >= 25);
  let files;
  const mdOpts = { pageMarkers: o.pageMarkers };
  if (wantSplit && chapters) {
    const title = (await state.pdf.getMetadata().catch(() => null))?.info?.Title || base();
    files = chapterFiles(chapters, title, { intro: x.intro, toc: x.toc, tocFile: x.tocFile, pages: x.pagesOf, mdOpts });
  } else {
    files = [{ name: `${base()}.md`, title: base(), md: toMarkdown(r.blocks, mdOpts) }];
  }
  let hint = x.chapters(chapters ? chapters.length : 0, source);
  if (o.mdSplit === "auto") hint += " " + (files.length > 1 ? x.autoSplit : x.autoOne);
  state.md = { files, hint, empty: !r.blocks.some(b => b.type !== "pagebreak") };
  state.chapter = Math.min(state.chapter, files.length - 1);
  return state.md;
}

// ---------------------------------------------------------------- Aperçus
const preview = $("preview");
let previewToken = 0;
async function updatePreview() {
  if (!state.pdf) return;
  const token = ++previewToken;
  const f = state.opts.format;
  const x = t();
  preview.classList.toggle("is-grid", ["img", "split", "pptx"].includes(f) || (f === "docx" && state.opts.docxMode === "images"));
  $("md-view").hidden = f !== "md";
  $("chapter").hidden = true;
  $("copy").hidden = f !== "md";
  setDownloadLabel();
  try {
    if (f === "md") {
      const md = await getMarkdown();
      if (!md || token !== previewToken) return;
      $("chapters-hint").innerHTML = md.hint;
      const sel = $("chapter");
      if (md.files.length > 1) {
        sel.innerHTML = md.files.map((fl, k) => `<option value="${k}" ${k === state.chapter ? "selected" : ""}>${esc(fl.name)}</option>`).join("");
        sel.hidden = false;
      }
      const cur = md.files[state.chapter];
      if (md.empty) { preview.innerHTML = `<p class="cv-empty">${esc(x.noText)}</p>`; status(x.noText, { warn: true }); return; }
      if (state.mdView === "source") {
        const pre = document.createElement("pre");
        pre.className = "md-source";
        pre.textContent = cur.md;
        preview.replaceChildren(pre);
      } else {
        const div = document.createElement("div");
        div.className = "md-preview";
        div.append(await renderMarkdown(cur.md));
        if (token !== previewToken) return;
        preview.replaceChildren(div);
      }
      status(x.ready(state.idx.length));
      return;
    }
    if (f === "docx" && state.opts.docxMode === "text") {
      const r = await getExtract();
      if (!r || token !== previewToken) return;
      if (!r.blocks.some(b => b.type !== "pagebreak")) { preview.innerHTML = `<p class="cv-empty">${esc(x.noText)}</p>`; status(x.noText, { warn: true }); return; }
      const div = document.createElement("div");
      div.className = "md-preview cv-docpage";
      div.append(await renderMarkdown(toMarkdown(r.blocks, {})));
      if (token !== previewToken) return;
      preview.replaceChildren(div);
      status(x.ready(state.idx.length));
      return;
    }
    if (f === "split") {
      const groups = splitGroups();
      if (!groups) { preview.innerHTML = `<p class="cv-empty">${esc(x.invalidRanges)}</p>`; status(x.invalidRanges, { warn: true }); return; }
      const ul = document.createElement("ul");
      ul.className = "cv-files";
      ul.innerHTML = groups.map(g => `<li><i class="cv-sheet" data-page="${g[0]}"></i><b>${esc(splitName(g))}</b><span>${esc(x.pagesOf(g[0] + 1, g[g.length - 1] + 1))} · ${g.length} p.</span></li>`).join("");
      preview.replaceChildren(ul);
      ul.querySelectorAll("[data-page]").forEach(el => thumbObserver.observe(el));
      status(`${x.ready(state.idx.length)} ${x.files(groups.length)}.`);
      return;
    }
    // Grilles : images, diapositives, Word en images
    const ratio = await pageRatio(state.idx[0]);
    const ul = document.createElement("ul");
    ul.className = "cv-grid" + (f === "pptx" ? " is-slides" : "");
    ul.style.setProperty("--ratio", (ratio.w / ratio.h).toFixed(4));
    const ext = state.opts.imgFormat === "png" ? "png" : "jpg";
    ul.innerHTML = state.idx.map((i, k) => {
      const cap = f === "img" ? `${base()}_p${String(i + 1).padStart(3, "0")}.${ext}` : f === "pptx" ? x.slide(k + 1) : x.page(i + 1);
      return `<li><i class="cv-sheet" data-page="${i}"></i><span class="cv-cap">${esc(cap)}</span></li>`;
    }).join("");
    preview.replaceChildren(ul);
    ul.querySelectorAll("[data-page]").forEach(el => thumbObserver.observe(el));
    status(x.ready(state.idx.length));
  } catch (err) {
    console.error(err);
    if (token === previewToken) status(x.failed, { warn: true });
  }
}
$("md-view").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.mdView = b.dataset.value;
  $("md-view").querySelectorAll("button").forEach(x => { const on = x === b; x.classList.toggle("selected", on); x.setAttribute("aria-checked", String(on)); });
  updatePreview();
});
$("chapter").addEventListener("change", e => { state.chapter = +e.target.value; updatePreview(); });

function setDownloadLabel() {
  const d = t().dl, f = state.opts.format;
  let label = d[f];
  if (f === "md" && state.md && state.md.files.length > 1) label = d.mdZip;
  if (f === "img" && state.idx.length === 1) label = d.imgOne;
  if (f === "split") { const g = splitGroups(); label = g && g.length === 1 ? d.splitOne : d.split; }
  $("download-label").textContent = label;
}

// ---------------------------------------------------------------- Découpage
function splitGroups() {
  const o = state.opts, idx = state.idx;
  if (o.splitMode === "each") return idx.map(i => [i]);
  if (o.splitMode === "every") {
    const n = Math.max(1, +o.every || 1), out = [];
    for (let k = 0; k < idx.length; k += n) out.push(idx.slice(k, k + n));
    return out;
  }
  const parts = String(o.ranges || "").split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out = [];
  for (const p of parts) {
    const g = parseRange(p, state.n);
    if (!g) return null;
    out.push(g);
  }
  return out;
}
const pad = n => String(n).padStart(3, "0");
const splitName = g => `${base()}_p${pad(g[0] + 1)}${g.length > 1 ? `-${pad(g[g.length - 1] + 1)}` : ""}.pdf`;

// ---------------------------------------------------------------- Téléchargements
const toBytes = (canvas, type, q) => new Promise(res => canvas.toBlob(async b => res(new Uint8Array(await b.arrayBuffer())), type, q));

async function renderAll(dpi, type, q, each) {
  const total = state.idx.length;
  for (let k = 0; k < total; k++) {
    const i = state.idx[k];
    status(t().rendering(k + 1, total), { busy: true });
    progress(k, total);
    const page = await state.pdf.getPage(i + 1);
    const c = await renderPage(page, { scale: dpi / 72 });
    const bytes = await toBytes(c, type, q);
    const vp = page.getViewport({ scale: 1 });
    await each({ i, k, bytes, w: vp.width, h: vp.height, cw: c.width, ch: c.height });
    dropCanvas(c);
    page.cleanup();
    await idle();
  }
  progress(0, 0);
}

async function pageText(i) {
  const page = await state.pdf.getPage(i + 1);
  const tc = await page.getTextContent();
  let s = "";
  for (const it of tc.items) s += it.str + (it.hasEOL ? "\n" : "");
  return s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

$("download").addEventListener("click", async () => {
  if (!state.pdf || state.busy) return;
  const x = t(), o = state.opts;
  state.busy = true;
  $("download").disabled = true;
  try {
    let blob, name;
    if (o.format === "md") {
      const md = await getMarkdown();
      if (md.files.length > 1) {
        blob = await zip(md.files.map(f => ({ name: f.name, data: f.md })));
        name = `${base()}_chapitres.zip`;
      } else {
        blob = new Blob([md.files[0].md], { type: "text/markdown;charset=utf-8" });
        name = md.files[0].name;
      }
    } else if (o.format === "img") {
      const type = o.imgFormat === "png" ? "image/png" : "image/jpeg";
      const ext = o.imgFormat === "png" ? "png" : "jpg";
      const files = [];
      await renderAll(+o.dpi, type, o.quality, ({ i, bytes }) => files.push({ name: `${base()}_p${pad(i + 1)}.${ext}`, data: bytes, store: true }));
      status(x.building, { busy: true });
      if (files.length === 1) { blob = new Blob([files[0].data], { type }); name = files[0].name; }
      else { blob = await zip(files); name = `${base()}_images.zip`; }
    } else if (o.format === "split") {
      const groups = splitGroups();
      if (!groups) { status(x.invalidRanges, { warn: true }); return; }
      const L = await pdfLib();
      const src = await L.PDFDocument.load(state.file.bytes, { ignoreEncryption: true, updateMetadata: false });
      const files = [];
      for (let k = 0; k < groups.length; k++) {
        status(x.rendering(k + 1, groups.length), { busy: true });
        progress(k, groups.length);
        const out = await L.PDFDocument.create();
        const pages = await out.copyPages(src, groups[k]);
        pages.forEach(p => out.addPage(p));
        files.push({ name: splitName(groups[k]), data: await out.save({ useObjectStreams: true }), store: true });
        await idle();
      }
      progress(0, 0);
      if (files.length === 1) { blob = new Blob([files[0].data], { type: "application/pdf" }); name = files[0].name; }
      else { status(x.building, { busy: true }); blob = await zip(files); name = `${base()}_pages.zip`; }
    } else if (o.format === "docx") {
      const first = await pageRatio(state.idx[0]);
      const meta = await state.pdf.getMetadata().catch(() => null);
      const title = meta?.info?.Title || base();
      if (o.docxMode === "images") {
        const images = [];
        await renderAll(150, "image/jpeg", 0.85, ({ bytes, w, h }) => images.push({ bytes, w, h, type: "jpeg" }));
        status(x.building, { busy: true });
        blob = await toDocx({ images }, { title, page: first, lang: x.locale });
      } else {
        const r = await getExtract();
        status(x.building, { busy: true });
        // Format de page : celui du PDF s'il est courant (lettre, A4), sinon lettre.
        const page = first.w < 700 && first.h < 1000 ? first : { w: 612, h: 792 };
        blob = await toDocx({ blocks: r.blocks }, { title, page, pageBreaks: o.pageBreaks, lang: x.locale });
      }
      name = `${base()}.docx`;
    } else if (o.format === "pptx") {
      const Pptx = await pptxgen();
      const pres = new Pptx();
      const first = await pageRatio(state.idx[0]);
      const W = first.w / 72, H = first.h / 72;
      pres.defineLayout({ name: "PDF", width: W, height: H });
      pres.layout = "PDF";
      const meta = await state.pdf.getMetadata().catch(() => null);
      pres.title = meta?.info?.Title || base();
      pres.company = "PDFo Converto";
      await renderAll(+o.pptDpi, "image/jpeg", 0.86, async ({ i, bytes, w, h }) => {
        const slide = pres.addSlide();
        const s = Math.min(W / (w / 72), H / (h / 72));
        const iw = (w / 72) * s, ih = (h / 72) * s;
        let bin = "";
        for (let k = 0; k < bytes.length; k += 8192) bin += String.fromCharCode(...bytes.subarray(k, k + 8192));
        slide.addImage({ data: `data:image/jpeg;base64,${btoa(bin)}`, x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih });
        if (o.notes) { const txt = await pageText(i); if (txt) slide.addNotes(txt); }
      });
      status(x.building, { busy: true });
      blob = await pres.write({ outputType: "blob" });
      name = `${base()}.pptx`;
    }
    if (blob) {
      download(blob, name);
      status(x.saved(name, fmtBytes(blob.size, x.locale)));
    }
  } catch (err) {
    console.error(err);
    status(x.failed, { warn: true });
  } finally {
    progress(0, 0);
    state.busy = false;
    $("download").disabled = false;
  }
});

$("copy").addEventListener("click", async () => {
  const md = await getMarkdown();
  try {
    await navigator.clipboard.writeText(md.files[state.chapter].md);
    status(t().copied);
  } catch {
    status(t().copyFail, { warn: true });
  }
});

// ---------------------------------------------------------------- Langue et démarrage
document.addEventListener("langchange", () => {
  renderOpts();
  if (state.pdf) {
    const x = t();
    $("file-meta").textContent = x.meta(state.n, fmtBytes(state.file.size, x.locale));
    state.md = null;
    updatePreview();
  }
});
renderOpts();
status("");
