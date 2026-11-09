// MarkDownO : interface. Les PDF passent par le moteur PDF du site (structure de PDFo Converto et
// OCR local des zones en image, pdf.js) ; les autres formats par MarkItDown, dans un travailleur.
import { download, zip, safeName, fmtBytes, esc, openPdf } from "../commun/pdf-outils.js";
import { renderMarkdown } from "../commun/markdown.js";
import { reprendre } from "../commun/relais.js";
import { OCR_ENGINE } from "../commun/ocr.js";
import { convertPdf, renderCrop } from "./pdf.js";

const $ = id => document.getElementById(id);
const LS = "markdowno:view", LS_PDF = "markdowno:pdf";
const PDF_DEFAULTS = { pdfEngine: "pdfo", ocr: "auto", figures: "text", split: "one", pageMarkers: true };

// Formats pris en charge par MarkItDown dans le navigateur (sans audio, image avec ExifTool ni URL).
const FORMATS = [
  { exts: ["pdf"], fr: "PDF", en: "PDF" },
  { exts: ["docx"], fr: "Word", en: "Word" },
  { exts: ["pptx"], fr: "PowerPoint", en: "PowerPoint" },
  { exts: ["xlsx", "xls"], fr: "Excel", en: "Excel" },
  { exts: ["html", "htm"], fr: "Page web", en: "Web page" },
  { exts: ["csv", "tsv"], fr: "CSV", en: "CSV" },
  { exts: ["json", "jsonl"], fr: "JSON", en: "JSON" },
  { exts: ["xml", "rss", "atom"], fr: "XML, RSS", en: "XML, RSS" },
  { exts: ["epub"], fr: "Livre EPUB", en: "EPUB book" },
  { exts: ["msg"], fr: "Courriel Outlook", en: "Outlook e-mail" },
  { exts: ["ipynb"], fr: "Jupyter", en: "Jupyter" },
  { exts: ["txt", "md"], fr: "Texte", en: "Text" },
  { exts: ["zip"], fr: "Archive ZIP", en: "ZIP archive" }
];
const ACCEPTED = new Set(FORMATS.flatMap(f => f.exts));

const TXT = {
  fr: {
    locale: "fr-CA",
    engine: {
      idle: ["Moteur MarkItDown : pas encore chargé", "Pour Word, Excel, PowerPoint, HTML, EPUB… Il se charge au premier fichier de ce type (environ 30 Mo, une seule fois), ou dès maintenant. Les PDF n'en ont pas besoin."],
      loading: ["Chargement du moteur MarkItDown…", ["Python (Pyodide)", "Bibliothèques (pandas, lxml…)", "MarkItDown et convertisseurs", "Démarrage"]],
      ready: v => ["Moteur prêt", `MarkItDown ${v.version} · Python ${v.python} dans le navigateur`],
      error: e => ["Le moteur n'a pas pu se charger", `${e} · Vérifiez la connexion (jsDelivr, PyPI), puis réessayez.`],
      start: "Charger maintenant", retry: "Réessayer"
    },
    step: (i, n, label) => `Étape ${i} sur ${n} : ${label}`,
    waiting: "En attente", converting: "Conversion…", done: "Converti", failed: "Erreur",
    unsupported: ext => `Format .${ext} non pris en charge.`,
    chars: n => `${new Intl.NumberFormat("fr-CA").format(n)} caractères`,
    pdfSteps: {
      read: (i, n) => `Lecture de la structure… page ${i} sur ${n}`,
      ocr: (i, n) => `OCR des zones en image… ${i + 1} sur ${n}`,
      images: (i, n) => `Images des figures… ${i + 1} sur ${n}`
    },
    ocrLoad: p => `Chargement de l'OCR (${OCR_ENGINE}, environ 6 Mo, une seule fois)… ${p}`,
    pdfInfo: i => {
      const parts = [`${i.pages < i.of ? `${i.pages} p. sur ${i.of}` : `${i.pages} p.`}`, `${i.tables} tableau${i.tables > 1 ? "x" : ""}${i.ocrTables ? ` (dont ${i.ocrTables} lu${i.ocrTables > 1 ? "s" : ""} par OCR)` : ""}`, `${i.figures} figure${i.figures > 1 ? "s" : ""}`];
      if (i.chapters) parts.push(`${i.chapters} chapitres`);
      parts.push(`${i.seconds.toFixed(1).replace(".", ",")} s`);
      return parts.join(" · ");
    },
    pdfWarn: n => `${n} valeur${n > 1 ? "s" : ""} lue${n > 1 ? "s" : ""} par OCR à vérifier (signalée${n > 1 ? "s" : ""} sous le tableau).`,
    pdfMarkitdown: "PDF converti par MarkItDown : texte brut, sans titres, tableaux ni figures.",
    pdfNoOcr: "OCR désactivé : les tableaux en image et les pages numérisées ne sont pas lus.",
    emptyMd: "Le fichier a été lu, mais aucun texte n'en est sorti (image, document numérisé ou protégé ?).",
    select: "Choisissez un fichier dans la liste.",
    progress: (d, n) => `${d} fichier${d > 1 ? "s" : ""} converti${d > 1 ? "s" : ""} sur ${n}`,
    allDone: (n, errs) => `${n} fichier${n > 1 ? "s" : ""} converti${n > 1 ? "s" : ""}${errs ? `, ${errs} en erreur` : ""}.`,
    saveAll: n => (n > 1 ? `Tout télécharger (.zip, ${n})` : "Télécharger"),
    saved: name => `Enregistré : ${name}.`,
    copied: "Markdown copié dans le presse-papiers.",
    copyFail: "Copie impossible : utilisez le téléchargement.",
    preview: "Aperçu",
    fromConverto: name => `« ${name} » reçu de PDFo Converto.`,
    chapterAll: "Tout le document",
    chapterOpt: (c, k) => `${k + 1}. ${c.title} · ${c.from === c.to ? `p. ${c.from + 1}` : `p. ${c.from + 1}–${c.to + 1}`}`,
    figCount: n => `${n} figure${n > 1 ? "s" : ""}`,
    figNone: "Aucune figure détectée dans ce fichier.",
    figNoneChapter: "Aucune figure dans ce chapitre.",
    figNotPdf: "Les figures ne sont extraites que des PDF, avec le moteur « Structure + OCR ».",
    figZip: "Télécharger ces figures (.zip)",
    figRender: (i, n) => `Images des figures… ${i} sur ${n}`,
    figOpen: "Ouvrir l'image en grand",
    figLabels: {
      figure: "Figure", page: "p.", text: "Texte dans la figure", none: "texte de l'image non extractible du PDF : voir l'image",
      kind: { image: "image", vector: "dessin", scan: "page numérisée" }, tableImage: "image du tableau",
      ocrText: "Texte lu par OCR", ocrScan: "texte lu par OCR ci-dessous, à vérifier",
      ocrTable: "Tableau lu par OCR dans une image (p. {p}) : vérifier les valeurs avant de s'en servir.",
      ocrUncertain: "Lectures divergentes, à vérifier sur l'image", ocrRow: "ligne", ocrCol: "colonne", drawing: "[dessin]"
    },
    chapterLabels: { intro: "Début du document", toc: "Sommaire :", tocFile: "Sommaire", pages: (a, b) => a === b ? `p. ${a}` : `p. ${a}–${b}` }
  },
  en: {
    locale: "en-CA",
    engine: {
      idle: ["MarkItDown engine: not loaded yet", "For Word, Excel, PowerPoint, HTML, EPUB… It loads with the first file of that kind (about 30 MB, only once), or right now. PDFs don't need it."],
      loading: ["Loading the MarkItDown engine…", ["Python (Pyodide)", "Libraries (pandas, lxml…)", "MarkItDown and converters", "Starting"]],
      ready: v => ["Engine ready", `MarkItDown ${v.version} · Python ${v.python} in the browser`],
      error: e => ["The engine could not load", `${e} · Check the connection (jsDelivr, PyPI), then try again.`],
      start: "Load now", retry: "Try again"
    },
    step: (i, n, label) => `Step ${i} of ${n}: ${label}`,
    waiting: "Waiting", converting: "Converting…", done: "Converted", failed: "Error",
    unsupported: ext => `.${ext} files are not supported.`,
    chars: n => `${new Intl.NumberFormat("en-CA").format(n)} characters`,
    pdfSteps: {
      read: (i, n) => `Reading the structure… page ${i} of ${n}`,
      ocr: (i, n) => `OCR of image areas… ${i + 1} of ${n}`,
      images: (i, n) => `Figure images… ${i + 1} of ${n}`
    },
    ocrLoad: p => `Loading OCR (${OCR_ENGINE}, about 6 MB, only once)… ${p}`,
    pdfInfo: i => {
      const parts = [`${i.pages < i.of ? `${i.pages} of ${i.of} pp.` : `${i.pages} pp.`}`, `${i.tables} table${i.tables > 1 ? "s" : ""}${i.ocrTables ? ` (${i.ocrTables} read by OCR)` : ""}`, `${i.figures} figure${i.figures > 1 ? "s" : ""}`];
      if (i.chapters) parts.push(`${i.chapters} chapters`);
      parts.push(`${i.seconds.toFixed(1)} s`);
      return parts.join(" · ");
    },
    pdfWarn: n => `${n} OCR value${n > 1 ? "s" : ""} to check (flagged under the table).`,
    pdfMarkitdown: "PDF converted by MarkItDown: plain text, no headings, tables or figures.",
    pdfNoOcr: "OCR off: image tables and scanned pages are not read.",
    emptyMd: "The file was read, but no text came out of it (image, scanned or protected document?).",
    select: "Choose a file in the list.",
    progress: (d, n) => `${d} of ${n} file${n > 1 ? "s" : ""} converted`,
    allDone: (n, errs) => `${n} file${n > 1 ? "s" : ""} converted${errs ? `, ${errs} with errors` : ""}.`,
    saveAll: n => (n > 1 ? `Download all (.zip, ${n})` : "Download"),
    saved: name => `Saved: ${name}.`,
    copied: "Markdown copied to the clipboard.",
    copyFail: "Could not copy: use the download instead.",
    preview: "Preview",
    fromConverto: name => `“${name}” received from PDFo Converto.`,
    chapterAll: "Whole document",
    chapterOpt: (c, k) => `${k + 1}. ${c.title} · ${c.from === c.to ? `p. ${c.from + 1}` : `pp. ${c.from + 1}–${c.to + 1}`}`,
    figCount: n => `${n} figure${n > 1 ? "s" : ""}`,
    figNone: "No figure found in this file.",
    figNoneChapter: "No figure in this chapter.",
    figNotPdf: "Figures are only extracted from PDFs, with the “Structure + OCR” engine.",
    figZip: "Download these figures (.zip)",
    figRender: (i, n) => `Figure images… ${i} of ${n}`,
    figOpen: "Open the full-size image",
    figLabels: {
      figure: "Figure", page: "p.", text: "Text in the figure", none: "the image's text cannot be extracted from the PDF: see the image",
      kind: { image: "image", vector: "drawing", scan: "scanned page" }, tableImage: "table image",
      ocrText: "Text read by OCR", ocrScan: "text read by OCR below, to be checked",
      ocrTable: "Table read by OCR from an image (p. {p}): check the values before using them.",
      ocrUncertain: "Readings disagree, check against the image", ocrRow: "row", ocrCol: "column", drawing: "[drawing]"
    },
    chapterLabels: { intro: "Front matter", toc: "Contents:", tocFile: "Contents", pages: (a, b) => a === b ? `p. ${a}` : `pp. ${a}–${b}` }
  }
};
const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
const t = () => TXT[lang()];

const loadPdfOpts = () => { try { return { ...PDF_DEFAULTS, ...JSON.parse(localStorage.getItem(LS_PDF) || "{}") }; } catch { return { ...PDF_DEFAULTS }; } };
const state = {
  engine: "idle", engineInfo: null, engineError: "", step: 0,
  files: [], cur: -1, nextId: 1, pdf: { ...loadPdfOpts(), pages: "" },
  view: (() => { try { const v = localStorage.getItem(LS); return v === "source" || v === "figures" ? v : "render"; } catch { return "render"; } })()
};
const status = (msg, warn = false) => { $("status").textContent = msg; $("status").classList.toggle("is-warn", warn); };
const extOf = name => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
const viaPdfEngine = f => f.ext === "pdf" && state.pdf.pdfEngine === "pdfo";

// ---------------------------------------------------------------- Moteur MarkItDown (travailleur)
let worker = null;
const pending = new Map();
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("worker.js", import.meta.url));
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === "progress") { state.engine = "loading"; state.step = m.step; renderEngine(); }
    else if (m.type === "ready") { state.engine = "ready"; state.engineInfo = m; renderEngine(); }
    else if (m.type === "fatal") {
      state.engine = "error"; state.engineError = m.error; renderEngine();
      for (const [, p] of pending) p.reject(new Error(m.error));
      pending.clear();
      worker.terminate(); worker = null;
    } else if (m.type === "done" || m.type === "error") {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (p) m.type === "done" ? p.resolve(m) : p.reject(new Error(m.error));
    }
  };
  worker.onerror = e => {
    state.engine = "error"; state.engineError = e.message || "Worker"; renderEngine();
    for (const [, p] of pending) p.reject(new Error(state.engineError));
    pending.clear();
    worker = null;
  };
  return worker;
}
function startEngine() {
  if (state.engine === "ready" || state.engine === "loading") return;
  state.engine = "loading"; state.step = 0;
  renderEngine();
  ensureWorker().postMessage({ type: "init" });
}
function convertInWorker(f) {
  return new Promise((resolve, reject) => {
    pending.set(f.id, { resolve, reject });
    const copy = f.bytes.slice();
    ensureWorker().postMessage({ type: "convert", id: f.id, name: f.name, bytes: copy }, [copy.buffer]);
  });
}
function renderEngine() {
  const x = t().engine;
  const el = $("engine");
  el.dataset.state = state.engine;
  let title, detail;
  if (state.engine === "idle") [title, detail] = x.idle;
  else if (state.engine === "loading") {
    title = x.loading[0];
    const n = x.loading[1].length;
    const s = Math.max(1, state.step);
    detail = t().step(s, n, x.loading[1][s - 1]);
  } else if (state.engine === "ready") [title, detail] = x.ready(state.engineInfo);
  else [title, detail] = x.error(state.engineError);
  $("engine-title").textContent = title;
  $("engine-detail").textContent = detail;
  [...$("engine-steps").children].forEach((li, k) => {
    li.classList.toggle("is-done", k + 1 < state.step || state.engine === "ready");
    li.classList.toggle("is-active", k + 1 === state.step && state.engine === "loading");
  });
  const btn = $("engine-start");
  btn.hidden = state.engine === "ready" || state.engine === "loading";
  btn.textContent = state.engine === "error" ? x.retry : x.start;
}
$("engine-start").addEventListener("click", startEngine);

// ---------------------------------------------------------------- Options PDF
function renderPdfOpts() {
  document.querySelectorAll("#pdf-opts .seg[data-opt]").forEach(seg => seg.querySelectorAll("button").forEach(b => {
    const on = b.dataset.value === String(state.pdf[seg.dataset.opt]);
    b.classList.toggle("selected", on);
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
    b.disabled = seg.dataset.opt !== "pdfEngine" && state.pdf.pdfEngine !== "pdfo";
  }));
  $("pdf-markers").checked = !!state.pdf.pageMarkers;
  $("pdf-markers").disabled = state.pdf.pdfEngine !== "pdfo";
  if (document.activeElement !== $("pdf-pages")) $("pdf-pages").value = state.pdf.pages;
}
function setPdfOpt(key, value) {
  if (state.pdf[key] === value) return;
  state.pdf[key] = value;
  try { const { pages, ...keep } = state.pdf; void pages; localStorage.setItem(LS_PDF, JSON.stringify(keep)); } catch { /* stockage indisponible */ }
  renderPdfOpts();
  // Les PDF déjà convertis le sont à nouveau avec les nouvelles options.
  let again = false;
  for (const f of state.files) if (f.ext === "pdf" && (f.status === "ok" || f.status === "err") && f.file) { dropResult(f); f.status = "wait"; again = true; }
  if (again) { renderFiles(); showCurrent(); if (state.files.some(f => f.status === "wait" && !viaPdfEngine(f))) startEngine(); processQueue(); }
}
document.querySelectorAll("#pdf-opts .seg[data-opt]").forEach(seg => {
  seg.addEventListener("click", e => { const b = e.target.closest("button"); if (b && !b.disabled) setPdfOpt(seg.dataset.opt, b.dataset.value); });
  seg.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = [...seg.querySelectorAll("button")];
    const i = bs.findIndex(b => b.classList.contains("selected"));
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
    if (n.disabled) return;
    setPdfOpt(seg.dataset.opt, n.dataset.value);
    n.focus();
    e.preventDefault();
  });
});
$("pdf-markers").addEventListener("change", e => setPdfOpt("pageMarkers", e.target.checked));
let pagesTimer = 0;
$("pdf-pages").addEventListener("input", e => { clearTimeout(pagesTimer); pagesTimer = setTimeout(() => setPdfOpt("pages", e.target.value.trim()), 600); });

// ---------------------------------------------------------------- Fichiers
$("pick").addEventListener("click", () => $("file-input").click());
$("file-input").setAttribute("accept", [...ACCEPTED].map(e => "." + e).join(","));
$("file-input").addEventListener("change", e => { addFiles([...e.target.files]); e.target.value = ""; });
const drop = $("drop");
for (const el of [drop, document.body]) {
  el.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
  el.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  el.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("is-over"); addFiles([...e.dataTransfer.files]); });
}

async function addFiles(list) {
  if (!list.length) return;
  for (const file of list) {
    const ext = extOf(file.name);
    const f = { id: state.nextId++, name: file.name, size: file.size, ext, status: "wait", md: "", error: "", bytes: null, file, chapter: -1 };
    if (!ACCEPTED.has(ext)) { f.status = "err"; f.error = t().unsupported(ext || "?"); }
    state.files.push(f);
  }
  if (state.cur < 0) state.cur = state.files.length - list.length;
  $("work").hidden = false;
  renderFiles();
  showCurrent();
  if (state.files.some(f => f.status === "wait" && !viaPdfEngine(f))) startEngine();
  processQueue();
}

function dropResult(f) {
  if (f.urls) for (const u of f.urls.values()) URL.revokeObjectURL(u);
  if (f.figUrls) for (const u of f.figUrls.values()) u.then(x => URL.revokeObjectURL(x)).catch(() => {});
  if (f.pdfDoc) f.pdfDoc.then(d => d.loadingTask?.destroy()).catch(() => {});
  Object.assign(f, { md: "", files: null, assets: null, urls: null, info: null, note: "", error: "", chapters: null, figures: null, figUrls: null, pdfDoc: null, keep: null, chapter: -1 });
}

let running = false;
async function processQueue() {
  if (running) return;
  running = true;
  try {
    let f;
    while ((f = state.files.find(x => x.status === "wait"))) {
      f.status = "run";
      renderFiles();
      if (state.files.indexOf(f) === state.cur) showCurrent();
      try {
        f.bytes = new Uint8Array(await f.file.arrayBuffer());
        if (viaPdfEngine(f)) await convertPdfFile(f);
        else {
          const r = await convertInWorker(f);
          f.md = r.markdown.replace(/\r\n/g, "\n").trim() + "\n";
          f.title = r.title;
          if (f.ext === "pdf") f.note = t().pdfMarkitdown;
        }
        f.status = "ok";
      } catch (err) {
        console.error(err);
        f.status = "err";
        f.error = String(err.message || err);
      }
      // Un PDF à figures garde ses octets : leurs images sont rendues à la demande (vue Figures).
      f.keep = f.status === "ok" && f.figures?.length ? f.bytes : null;
      f.bytes = null;
      renderFiles();
      if (state.files.indexOf(f) === state.cur) showCurrent();
      const done = state.files.filter(x => x.status === "ok" || x.status === "err").length;
      status(t().progress(done, state.files.length));
    }
    const ok = state.files.filter(x => x.status === "ok").length, errs = state.files.filter(x => x.status === "err").length;
    if (state.files.length) status(t().allDone(ok, errs), errs > 0 && !ok);
  } finally {
    running = false;
    renderSaveAll();
  }
}

async function convertPdfFile(f) {
  const x = t();
  const r = await convertPdf(f.bytes, f.name, {
    ocr: state.pdf.ocr, figures: state.pdf.figures, split: state.pdf.split, pages: state.pdf.pages,
    pageMarkers: state.pdf.pageMarkers, labels: x.figLabels, chapterLabels: x.chapterLabels
  }, {
    onStep: (key, i, n) => status(t().pdfSteps[key](i, n)),
    onOcrStatus: m => { if (m.status && m.status !== "recognizing text") status(t().ocrLoad(m.progress ? `${Math.round(m.progress * 100)} %` : "")); }
  });
  f.md = r.md;
  f.files = r.files;
  f.assets = r.assets;
  f.info = r.info;
  f.chapters = r.chapters;
  f.figures = r.figures;
  f.urls = new Map(r.assets.map(a => [a.path, URL.createObjectURL(new Blob([a.bytes], { type: a.type }))]));
  f.note = state.pdf.ocr === "off" ? x.pdfNoOcr : "";
}

function renderFiles() {
  const x = t();
  $("files").innerHTML = state.files.map((f, k) => {
    const st = f.status === "ok" ? `<span class="chip chip-add">${esc(x.done)}</span>`
      : f.status === "err" ? `<span class="chip chip-del">${esc(x.failed)}</span>`
      : f.status === "run" ? `<span class="spin" role="img" aria-label="${esc(x.converting)}"></span>`
      : `<span class="chip chip-same">${esc(x.waiting)}</span>`;
    const meta = f.status === "ok" ? `${fmtBytes(f.size, x.locale)} → ${x.chars(f.md.length)}` : f.status === "err" ? f.error : fmtBytes(f.size, x.locale);
    return `<li><button type="button" data-k="${k}" ${k === state.cur ? 'aria-current="true"' : ""}>
      <span class="md-ext">${esc(f.ext || "?")}</span><span class="md-fname">${esc(f.name)}</span>
      <span class="md-fmeta">${esc(meta)}</span><span class="md-fstate">${st}</span></button></li>`;
  }).join("");
  renderSaveAll();
}
$("files").addEventListener("click", e => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  state.cur = +b.dataset.k;
  renderFiles();
  showCurrent();
});
$("clear").addEventListener("click", () => {
  for (const f of state.files) if (f.status !== "run" && f.status !== "wait") dropResult(f);
  state.files = state.files.filter(f => f.status === "run" || f.status === "wait");
  state.cur = state.files.length ? 0 : -1;
  if (!state.files.length) $("work").hidden = true;
  renderFiles();
  showCurrent();
  status("");
});

/** Markdown affiché : tout le document, ou le chapitre choisi. */
const shownMd = f => (f.chapter >= 0 && f.chapters?.[f.chapter] ? f.chapters[f.chapter].md : f.md);

function renderChapters(f) {
  const sel = $("chapter");
  const list = f?.status === "ok" ? f.chapters || [] : [];
  sel.hidden = list.length < 2;
  if (sel.hidden) return;
  const x = t();
  sel.innerHTML = `<option value="-1">${esc(x.chapterAll)}</option>` + list.map((c, k) => `<option value="${k}">${esc(x.chapterOpt(c, k))}</option>`).join("");
  sel.value = String(f.chapter);
}
$("chapter").addEventListener("change", e => {
  const f = state.files[state.cur];
  if (!f) return;
  f.chapter = +e.target.value;
  showCurrent();
  $("preview").scrollTop = 0;
});

async function showCurrent() {
  const x = t();
  const f = state.files[state.cur];
  const body = $("preview");
  const tip = [];
  if (f?.status === "ok" && f.info) {
    tip.push(esc(x.pdfInfo(f.info)));
    if (f.info.uncertain) tip.push(`<b>${esc(x.pdfWarn(f.info.uncertain))}</b>`);
  }
  if (f?.status === "ok" && f.note) tip.push(esc(f.note));
  $("tip").hidden = !tip.length;
  $("tip").innerHTML = tip.join("<br>");
  $("preview-title").textContent = f ? f.name : x.preview;
  $("copy").disabled = $("save-one").disabled = !(f && f.status === "ok");
  $("save-one-label").textContent = f && isBundle(f) ? ".zip" : ".md";
  renderChapters(f);
  if (!f) { body.innerHTML = `<p class="md-empty">${esc(x.select)}</p>`; return; }
  if (f.status === "err") { body.innerHTML = `<p class="md-error">${esc(f.error)}</p>`; return; }
  if (f.status !== "ok") { body.innerHTML = `<p class="md-empty">${esc(f.status === "run" ? x.converting : x.waiting)}</p>`; return; }
  if (state.view === "figures") { showFigures(f); return; }
  const md = shownMd(f);
  if (!md.trim()) { body.innerHTML = `<p class="md-empty">${esc(x.emptyMd)}</p>`; return; }
  if (state.view === "source") {
    const pre = document.createElement("pre");
    pre.className = "md-source";
    pre.textContent = md;
    body.replaceChildren(pre);
  } else {
    const div = document.createElement("div");
    div.className = "md-preview";
    div.append(await renderMarkdown(md, { images: f.urls || undefined }));
    if (state.files[state.cur] === f) body.replaceChildren(div);
  }
}

// ---------------------------------------------------------------- Figures (galerie)
const shownFigures = f => (f.figures || []).filter(g => f.chapter < 0 || g.chapter === f.chapter);

/** Image d'une figure : celle déjà rendue (option « Fiches + images »), sinon rendue à la demande. */
function figureUrl(f, g) {
  if (f.urls?.has(g.path)) return Promise.resolve(f.urls.get(g.path));
  f.figUrls = f.figUrls || new Map();
  if (!f.figUrls.has(g.path)) {
    if (!f.pdfDoc) f.pdfDoc = openPdf(f.keep, null, { fontExtraProperties: true });
    f.figUrls.set(g.path, f.pdfDoc.then(async pdf => {
      const r = await renderCrop(pdf, g.page, g.box, g.kind);
      return URL.createObjectURL(new Blob([r.bytes], { type: r.type }));
    }));
  }
  return f.figUrls.get(g.path);
}

const figObserver = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const img = en.target;
    figObserver.unobserve(img);
    const f = state.files.find(x => x.id === +img.dataset.file);
    const g = f?.figures?.[+img.dataset.fig];
    if (!g || !(f.keep || f.urls?.has(g.path))) continue;
    figureUrl(f, g)
      .then(url => { img.src = url; img.closest("a").href = url; })
      .catch(err => { console.warn(err); img.closest("figure").classList.add("is-failed"); });
  }
}, { root: $("preview"), rootMargin: "400px" });

function showFigures(f) {
  const x = t(), L = x.figLabels;
  const body = $("preview");
  if (!f.figures) { body.innerHTML = `<p class="md-empty">${esc(x.figNotPdf)}</p>`; return; }
  const list = shownFigures(f);
  if (!list.length) { body.innerHTML = `<p class="md-empty">${esc(f.figures.length ? x.figNoneChapter : x.figNone)}</p>`; return; }
  const head = document.createElement("div");
  head.className = "md-figs-head";
  head.innerHTML = `<span>${esc(x.figCount(list.length))}</span><button type="button" class="btn btn-quiet" id="figs-zip">${esc(x.figZip)}</button>`;
  const ul = document.createElement("ul");
  ul.className = "md-figs";
  ul.innerHTML = list.map(g => {
    const k = f.figures.indexOf(g);
    // La légende porte déjà le numéro du document (« Figure 3. … ») ; sans légende, numéro d'ordre.
    const meta = [g.caption ? null : `${L.figure} ${g.n}`, `${L.page} ${g.page + 1}`, L.kind[g.kind] || g.kind].filter(Boolean).join(" · ");
    return `<li><figure><a class="md-fig-img" target="_blank" rel="noopener" title="${esc(x.figOpen)}"><img alt="${esc(g.caption || `${L.figure} ${g.n}`)}" data-file="${f.id}" data-fig="${k}"></a>
      <figcaption><b>${esc(meta)}</b>${g.caption ? `<span>${esc(g.caption)}</span>` : ""}</figcaption></figure></li>`;
  }).join("");
  body.replaceChildren(head, ul);
  ul.querySelectorAll("img[data-fig]").forEach(img => figObserver.observe(img));
  head.querySelector("#figs-zip").addEventListener("click", () => saveFigures(f, list));
}

async function saveFigures(f, list) {
  const x = t();
  const entries = [];
  for (let k = 0; k < list.length; k++) {
    status(x.figRender(k + 1, list.length));
    const url = await figureUrl(f, list[k]);
    entries.push({ name: list[k].path, data: new Uint8Array(await (await fetch(url)).arrayBuffer()), store: true });
  }
  const stem = safeName(f.name.replace(/\.pdf$/i, ""));
  const name = `${stem}_figures${f.chapter >= 0 ? `_chapitre${String(f.chapter + 1).padStart(2, "0")}` : ""}.zip`;
  download(await zip(entries), name);
  status(x.saved(name));
}
$("view").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.view = b.dataset.value;
  try { localStorage.setItem(LS, state.view); } catch { /* stockage indisponible */ }
  renderView();
  showCurrent();
});
function renderView() {
  $("view").querySelectorAll("button").forEach(b => { const on = b.dataset.value === state.view; b.classList.toggle("selected", on); b.setAttribute("aria-checked", String(on)); });
}

// ---------------------------------------------------------------- Téléchargements
const mdName = f => `${safeName(f.name)}.md`;
// Un PDF converti en plusieurs fichiers (chapitres) ou avec des images : un .zip.
const isBundle = f => !!(f.files && (f.files.length > 1 || f.assets?.length));
const bundleEntries = (f, dir = "") => [
  ...f.files.map(x => ({ name: dir + x.name, data: x.md })),
  ...(f.assets || []).map(a => ({ name: dir + a.path, data: a.bytes }))
];
function renderSaveAll() {
  const ok = state.files.filter(f => f.status === "ok");
  $("save-all").disabled = !ok.length;
  $("save-all-label").textContent = t().saveAll(Math.max(ok.length, 1));
}
async function saveFile(f) {
  if (isBundle(f)) {
    const name = `${safeName(f.name.replace(/\.pdf$/i, ""))}.zip`;
    download(await zip(bundleEntries(f)), name);
    return name;
  }
  download(new Blob([f.md], { type: "text/markdown;charset=utf-8" }), mdName(f));
  return mdName(f);
}
$("save-one").addEventListener("click", async () => {
  const f = state.files[state.cur];
  if (!f || f.status !== "ok") return;
  status(t().saved(await saveFile(f)));
});
$("save-all").addEventListener("click", async () => {
  const ok = state.files.filter(f => f.status === "ok");
  if (!ok.length) return;
  if (ok.length === 1) { status(t().saved(await saveFile(ok[0]))); return; }
  const used = new Set();
  const unique = (stem, ext) => { let n = stem + ext, k = 2; while (used.has(n)) n = `${stem}-${k++}${ext}`; used.add(n); return n; };
  const entries = [];
  for (const f of ok) {
    if (isBundle(f)) entries.push(...bundleEntries(f, unique(safeName(f.name.replace(/\.pdf$/i, "")), "") + "/"));
    else entries.push({ name: unique(safeName(f.name), ".md"), data: f.md });
  }
  const name = "markdown.zip";
  download(await zip(entries), name);
  status(t().saved(name));
});
$("copy").addEventListener("click", async () => {
  const f = state.files[state.cur];
  try { await navigator.clipboard.writeText(shownMd(f)); status(t().copied); } catch { status(t().copyFail, true); }
});

// ---------------------------------------------------------------- Langue et démarrage
function renderFormats() {
  const l = lang();
  $("formats").innerHTML = FORMATS.map(f => `<li>${esc(f[l])}<small>${f.exts.map(e => "." + e).join(" ")}</small></li>`).join("");
}
document.addEventListener("langchange", () => { renderFormats(); renderEngine(); renderFiles(); showCurrent(); });
renderFormats();
renderEngine();
renderView();
renderPdfOpts();
renderSaveAll();

// PDF envoyé par PDFo Converto (même appareil, stockage local du navigateur).
if (location.hash === "#converto") {
  history.replaceState(null, "", location.pathname + location.search);
  reprendre().then(r => {
    if (!r) return;
    if (r.pages) { state.pdf.pages = r.pages; renderPdfOpts(); }
    addFiles([r.file]);
    status(t().fromConverto(r.file.name));
  }).catch(err => console.warn(err));
}
