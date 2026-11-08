// MarkDownO : interface. Les fichiers sont convertis un à un par MarkItDown dans un travailleur.
import { download, zip, safeName, fmtBytes, esc } from "../commun/pdf-outils.js";
import { renderMarkdown } from "../commun/markdown.js";

const $ = id => document.getElementById(id);
const LS = "markdowno:view";

// Formats pris en charge par MarkItDown dans le navigateur (sans audio, image avec ExifTool ni URL).
const FORMATS = [
  { exts: ["docx"], fr: "Word", en: "Word" },
  { exts: ["pptx"], fr: "PowerPoint", en: "PowerPoint" },
  { exts: ["xlsx", "xls"], fr: "Excel", en: "Excel" },
  { exts: ["pdf"], fr: "PDF", en: "PDF" },
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
      idle: ["Moteur MarkItDown : pas encore chargé", "Il se charge au premier fichier (environ 30 Mo, une seule fois), ou dès maintenant."],
      loading: ["Chargement du moteur MarkItDown…", ["Python (Pyodide)", "Bibliothèques (pandas, lxml…)", "MarkItDown et convertisseurs", "Démarrage"]],
      ready: v => ["Moteur prêt", `MarkItDown ${v.version} · Python ${v.python} dans le navigateur`],
      error: e => ["Le moteur n'a pas pu se charger", `${e} · Vérifiez la connexion (jsDelivr, PyPI), puis réessayez.`],
      start: "Charger maintenant", retry: "Réessayer"
    },
    step: (i, n, label) => `Étape ${i} sur ${n} : ${label}`,
    waiting: "En attente", converting: "Conversion…", done: "Converti", failed: "Erreur",
    unsupported: ext => `Format .${ext} non pris en charge.`,
    chars: n => `${new Intl.NumberFormat("fr-CA").format(n)} caractères`,
    pdfTip: 'Pour un PDF, <a href="../pdfo-converto/" target="_blank" rel="noopener">PDFo Converto</a> donne en général un meilleur Markdown (titres, tableaux, chapitres).',
    emptyMd: "Le fichier a été lu, mais aucun texte n'en est sorti (image, document numérisé ou protégé ?).",
    select: "Choisissez un fichier dans la liste.",
    progress: (d, n) => `${d} fichier${d > 1 ? "s" : ""} converti${d > 1 ? "s" : ""} sur ${n}`,
    allDone: (n, errs) => `${n} fichier${n > 1 ? "s" : ""} converti${n > 1 ? "s" : ""}${errs ? `, ${errs} en erreur` : ""}.`,
    saveAll: n => (n > 1 ? `Tout télécharger (.zip, ${n})` : "Télécharger le .md"),
    saved: name => `Enregistré : ${name}.`,
    copied: "Markdown copié dans le presse-papiers.",
    copyFail: "Copie impossible : utilisez le téléchargement.",
    preview: "Aperçu"
  },
  en: {
    locale: "en-CA",
    engine: {
      idle: ["MarkItDown engine: not loaded yet", "It loads with the first file (about 30 MB, only once), or right now."],
      loading: ["Loading the MarkItDown engine…", ["Python (Pyodide)", "Libraries (pandas, lxml…)", "MarkItDown and converters", "Starting"]],
      ready: v => ["Engine ready", `MarkItDown ${v.version} · Python ${v.python} in the browser`],
      error: e => ["The engine could not load", `${e} · Check the connection (jsDelivr, PyPI), then try again.`],
      start: "Load now", retry: "Try again"
    },
    step: (i, n, label) => `Step ${i} of ${n}: ${label}`,
    waiting: "Waiting", converting: "Converting…", done: "Converted", failed: "Error",
    unsupported: ext => `.${ext} files are not supported.`,
    chars: n => `${new Intl.NumberFormat("en-CA").format(n)} characters`,
    pdfTip: 'For a PDF, <a href="../pdfo-converto/" target="_blank" rel="noopener">PDFo Converto</a> usually gives better Markdown (headings, tables, chapters).',
    emptyMd: "The file was read, but no text came out of it (image, scanned or protected document?).",
    select: "Choose a file in the list.",
    progress: (d, n) => `${d} of ${n} file${n > 1 ? "s" : ""} converted`,
    allDone: (n, errs) => `${n} file${n > 1 ? "s" : ""} converted${errs ? `, ${errs} with errors` : ""}.`,
    saveAll: n => (n > 1 ? `Download all (.zip, ${n})` : "Download the .md"),
    saved: name => `Saved: ${name}.`,
    copied: "Markdown copied to the clipboard.",
    copyFail: "Could not copy: use the download instead.",
    preview: "Preview"
  }
};
const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
const t = () => TXT[lang()];

const state = {
  engine: "idle", engineInfo: null, engineError: "", step: 0,
  files: [], cur: -1, nextId: 1,
  view: (() => { try { return localStorage.getItem(LS) === "source" ? "source" : "render"; } catch { return "render"; } })()
};
const status = (msg, warn = false) => { $("status").textContent = msg; $("status").classList.toggle("is-warn", warn); };
const extOf = name => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

// ---------------------------------------------------------------- Moteur (travailleur)
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
    const f = { id: state.nextId++, name: file.name, size: file.size, ext, status: "wait", md: "", error: "", bytes: null, file };
    if (!ACCEPTED.has(ext)) { f.status = "err"; f.error = t().unsupported(ext || "?"); }
    state.files.push(f);
  }
  if (state.cur < 0) state.cur = state.files.length - list.length;
  $("work").hidden = false;
  renderFiles();
  showCurrent();
  if (state.files.some(f => f.status === "wait")) startEngine();
  processQueue();
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
      try {
        f.bytes = new Uint8Array(await f.file.arrayBuffer());
        const r = await convertInWorker(f);
        f.md = r.markdown.replace(/\r\n/g, "\n").trim() + "\n";
        f.title = r.title;
        f.status = "ok";
      } catch (err) {
        f.status = "err";
        f.error = String(err.message || err);
      }
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
  state.files = state.files.filter(f => f.status === "run" || f.status === "wait");
  state.cur = state.files.length ? 0 : -1;
  if (!state.files.length) $("work").hidden = true;
  renderFiles();
  showCurrent();
  status("");
});

async function showCurrent() {
  const x = t();
  const f = state.files[state.cur];
  const body = $("preview");
  $("tip").hidden = !(f && f.ext === "pdf");
  $("tip").innerHTML = x.pdfTip;
  $("preview-title").textContent = f ? f.name : x.preview;
  $("copy").disabled = $("save-one").disabled = !(f && f.status === "ok");
  if (!f) { body.innerHTML = `<p class="md-empty">${esc(x.select)}</p>`; return; }
  if (f.status === "err") { body.innerHTML = `<p class="md-error">${esc(f.error)}</p>`; return; }
  if (f.status !== "ok") { body.innerHTML = `<p class="md-empty">${esc(f.status === "run" ? x.converting : x.waiting)}</p>`; return; }
  if (!f.md.trim()) { body.innerHTML = `<p class="md-empty">${esc(x.emptyMd)}</p>`; return; }
  if (state.view === "source") {
    const pre = document.createElement("pre");
    pre.className = "md-source";
    pre.textContent = f.md;
    body.replaceChildren(pre);
  } else {
    const div = document.createElement("div");
    div.className = "md-preview";
    div.append(await renderMarkdown(f.md));
    if (state.files[state.cur] === f) body.replaceChildren(div);
  }
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
function renderSaveAll() {
  const ok = state.files.filter(f => f.status === "ok");
  $("save-all").disabled = !ok.length;
  $("save-all-label").textContent = t().saveAll(Math.max(ok.length, 1));
}
$("save-one").addEventListener("click", () => {
  const f = state.files[state.cur];
  if (!f || f.status !== "ok") return;
  download(new Blob([f.md], { type: "text/markdown;charset=utf-8" }), mdName(f));
  status(t().saved(mdName(f)));
});
$("save-all").addEventListener("click", async () => {
  const ok = state.files.filter(f => f.status === "ok");
  if (!ok.length) return;
  if (ok.length === 1) { download(new Blob([ok[0].md], { type: "text/markdown;charset=utf-8" }), mdName(ok[0])); status(t().saved(mdName(ok[0]))); return; }
  const used = new Set();
  const entries = ok.map(f => {
    let n = mdName(f), k = 2;
    while (used.has(n)) n = `${safeName(f.name)}-${k++}.md`;
    used.add(n);
    return { name: n, data: f.md };
  });
  const name = "markdown.zip";
  download(await zip(entries), name);
  status(t().saved(name));
});
$("copy").addEventListener("click", async () => {
  const f = state.files[state.cur];
  try { await navigator.clipboard.writeText(f.md); status(t().copied); } catch { status(t().copyFail, true); }
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
renderSaveAll();
