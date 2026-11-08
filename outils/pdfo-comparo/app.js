// PDFo Comparo : interface. Chargement des deux versions, analyse progressive des paires de
// pages, visionneuse (superposition, côte à côte, rideau), listes, recalage manuel, exports.
import { Doc, pairPages, autoAlign, renderPair, renderRegion, diffMasks, findZones, compose, pairTextChanges, attachText, textCompare, MM } from "./engine.js";
import { renderPage, download, parseRange, safeName, fmtBytes, esc, dropCanvas, idle } from "../commun/pdf-outils.js";
import { exportPdf, exportCsv } from "./export.js";

const $ = id => document.getElementById(id);
const LS = "pdfo-comparo:opts";
const DEFAULTS = {
  mode: "visual", detect: true, align: true, ignoreCase: false, skipMargins: true, tol: "0.4", res: "2600",
  colDel: "#d6302a", colAdd: "#1d6fd1", fade: 0.3, thick: 1, zones: true,
  summary: true, includeSame: true, exportZones: true, vector: "1"
};
const EXAMPLES = {
  plans: ["exemples/plans-pont-rev-A.pdf", "exemples/plans-pont-rev-B.pdf"],
  devis: ["exemples/devis-beton-v1.pdf", "exemples/devis-beton-v2.pdf"]
};

// ---------------------------------------------------------------- Textes
const TXT = {
  fr: {
    locale: "fr-CA",
    dropOld: "Déposez l'ancien PDF ici", dropNew: "Déposez le nouveau PDF ici",
    metaOld: "ou choisissez un fichier · révision A, édition 2024…", metaNew: "ou choisissez un fichier · révision B, édition 2025…",
    fileMeta: (n, size) => `${n} page${n > 1 ? "s" : ""} · ${size}`,
    opening: "Ouverture…",
    notPdf: name => `« ${name} » n'est pas un PDF.`,
    openFail: name => `Impossible d'ouvrir « ${name} ».`,
    password: (name, again) => `${again ? "Mot de passe incorrect. " : ""}« ${name} » est protégé. Mot de passe :`,
    modeHint: {
      visual: "Superpose les deux versions : idéal pour les plans et dessins. Le texte modifié est aussi relevé dans chaque zone.",
      text: "Compare le texte seulement, même s'il a glissé d'une page à l'autre : idéal pour les devis, rapports et listes de prix."
    },
    needFiles: "Ajoutez l'ancienne et la nouvelle version, ou essayez un exemple.",
    ready: "Prêt : vérifiez les options puis cliquez sur Comparer.",
    stale: "Options modifiées : cliquez sur Comparer pour relancer l'analyse.",
    badRange: "Liste de pages invalide (ex. : 1-10, 15, 18-20).",
    loadingExample: "Chargement de l'exemple…",
    pairing: (i, n) => `Appariement des pages… ${i} / ${n}`,
    analyzing: (i, n) => `Analyse de la page ${i} sur ${n}…`,
    readingText: "Lecture et comparaison du texte…",
    done: (s, sec) => `Comparaison terminée en ${sec} s : ${s}.`,
    noDiff: "aucune différence trouvée",
    noText: "Aucun texte n'a été trouvé (plans numérisés ?) : utilisez plutôt la comparaison visuelle.",
    exporting: (i, n) => `Création du PDF comparé… page ${i} sur ${n}`,
    exported: (name, size) => `PDF comparé enregistré : ${name} (${size}).`,
    exportFail: "L'export a échoué. Essayez l'option « Images (comme à l'écran) ».",
    vectorFallback: "Un des PDF ne peut pas être incrusté tel quel (protégé ?) : pages exportées en images.",
    csvDone: name => `Liste enregistrée : ${name}.`,
    state: { same: "Identique", mod: "Modifiée", add: "Insérée", del: "Supprimée", pending: "En attente" },
    kind: { add: "Ajout", del: "Suppression", mod: "Modification" },
    oldShort: "Anc.", newShort: "Nouv.", old: "Ancienne", new: "Nouvelle", page: "p.",
    pairLabel: p => p.a !== null && p.b !== null ? `Anc. p. ${p.a + 1}  →  Nouv. p. ${p.b + 1}` : p.a !== null ? `Anc. p. ${p.a + 1} (supprimée)` : `Nouv. p. ${p.b + 1} (insérée)`,
    pairOf: (i, n) => `Paire ${i} sur ${n}`,
    zones: n => n ? `${n} zone${n > 1 ? "s" : ""}` : "aucun changement",
    textChanges: n => n ? `${n} changement${n > 1 ? "s" : ""}` : "aucun changement",
    graphic: "Changement graphique",
    close: "Fermer",
    moved: "déplacé :",
    none: "— aucune —",
    pageN: n => `Page ${n}`,
    alignAuto: "Recalage auto", alignManual: "Recalage manuel", alignNone: "Aucun décalage", alignOff: "Sans recalage",
    alignMethod: {
      text: n => `Calculé automatiquement à partir de ${n} mots présents sur les deux pages.`,
      image: () => "Calculé automatiquement à partir du dessin (peu de texte sur la page).",
      none: () => "Aucun décalage d'impression détecté entre les deux pages.",
      manual: () => "Réglé manuellement.",
      off: () => "Recalage automatique désactivé dans les options : vous pouvez régler le décalage ici."
    },
    legend: { del: "Supprimé (ancienne seulement)", add: "Ajouté (nouvelle seulement)", same: "Inchangé", zone: "Zone de changement", delText: "Texte supprimé", addText: "Texte ajouté" },
    legendHelp: "Molette : zoom · glisser : déplacer · double-clic : zoom avant · 0 : ajuster",
    curtainHelp: "Rideau : ancienne à gauche, nouvelle à droite",
    waiting: "Analyse de cette page en cours…",
    stats: { pairs: n => n > 1 ? "pages comparées" : "page comparée", same: n => n > 1 ? "identiques" : "identique", mod: n => n > 1 ? "modifiées" : "modifiée", add: n => n > 1 ? "insérées" : "insérée", del: n => n > 1 ? "supprimées" : "supprimée", zones: n => n > 1 ? "zones de changements" : "zone de changement", changes: n => n > 1 ? "changements de texte" : "changement de texte" },
    noChanges: "Aucun changement à afficher.",
    noMatch: "Aucun résultat pour cette recherche.",
    more: n => `… et ${n} autres`,
    allPages: "toutes",
    export: {
      docTitle: "Rapport de comparaison · PDFo Comparo",
      generated: d => `Généré le ${d} · acheruel.github.io/outils/pdfo-comparo`,
      oldTag: "ANCIENNE", newTag: "NOUVELLE",
      compared: "pages comparées",
      pagesTableTitle: "Pages comparées",
      colOld: "Ancienne", colNew: "Nouvelle", colState: "État", colZones: "Changements", colAlign: "Recalage", colChanges: "Changements de texte",
      changesTitle: "Liste des changements",
      colN: "N°", colType: "Type", colPages: "Pages", colOldText: "Ancien texte", colNewText: "Nouveau texte",
      modeVisual: "Comparaison visuelle", modeText: "Comparaison du texte",
      tol: v => `tolérance ${v} mm`, alignOn: "recalage automatique", alignOff: "sans recalage",
      detectOn: "détection des pages insérées ou supprimées", detectOff: "pages comparées une à une",
      ignoreCase: "majuscules ignorées",
      skipMargins: "en-têtes et pieds de page répétés ignorés",
      shown: "Pages identiques non incluses dans ce PDF."
    },
    csv: ["N°", "Type", "Page ancienne", "Page nouvelle", "Zone", "Ancien texte", "Nouveau texte", "X (mm)", "Y (mm)"],
    fileSuffix: "compare"
  },
  en: {
    locale: "en-CA",
    dropOld: "Drop the old PDF here", dropNew: "Drop the new PDF here",
    metaOld: "or choose a file · revision A, 2024 edition…", metaNew: "or choose a file · revision B, 2025 edition…",
    fileMeta: (n, size) => `${n} page${n > 1 ? "s" : ""} · ${size}`,
    opening: "Opening…",
    notPdf: name => `“${name}” is not a PDF.`,
    openFail: name => `Could not open “${name}”.`,
    password: (name, again) => `${again ? "Wrong password. " : ""}“${name}” is protected. Password:`,
    modeHint: {
      visual: "Overlays both versions: best for drawings. Changed text is also listed for each area.",
      text: "Compares the text only, even when it moved to another page: best for specifications, reports and price lists."
    },
    needFiles: "Add the old and the new version, or try an example.",
    ready: "Ready: check the options, then click Compare.",
    stale: "Options changed: click Compare to run the analysis again.",
    badRange: "Invalid page list (e.g. 1-10, 15, 18-20).",
    loadingExample: "Loading the example…",
    pairing: (i, n) => `Matching pages… ${i} / ${n}`,
    analyzing: (i, n) => `Analysing page ${i} of ${n}…`,
    readingText: "Reading and comparing the text…",
    done: (s, sec) => `Comparison finished in ${sec} s: ${s}.`,
    noDiff: "no differences found",
    noText: "No text was found (scanned drawings?): use the visual comparison instead.",
    exporting: (i, n) => `Building the compared PDF… page ${i} of ${n}`,
    exported: (name, size) => `Compared PDF saved: ${name} (${size}).`,
    exportFail: "The export failed. Try the “Images (as on screen)” option.",
    vectorFallback: "One of the PDFs cannot be embedded as is (protected?): pages exported as images.",
    csvDone: name => `List saved: ${name}.`,
    state: { same: "Identical", mod: "Changed", add: "Inserted", del: "Removed", pending: "Pending" },
    kind: { add: "Added", del: "Removed", mod: "Changed" },
    oldShort: "Old", newShort: "New", old: "Old", new: "New", page: "p.",
    pairLabel: p => p.a !== null && p.b !== null ? `Old p. ${p.a + 1}  →  New p. ${p.b + 1}` : p.a !== null ? `Old p. ${p.a + 1} (removed)` : `New p. ${p.b + 1} (inserted)`,
    pairOf: (i, n) => `Pair ${i} of ${n}`,
    zones: n => n ? `${n} area${n > 1 ? "s" : ""}` : "no changes",
    textChanges: n => n ? `${n} change${n > 1 ? "s" : ""}` : "no changes",
    graphic: "Graphic change",
    close: "Close",
    moved: "moved:",
    none: "— none —",
    pageN: n => `Page ${n}`,
    alignAuto: "Auto alignment", alignManual: "Manual alignment", alignNone: "No offset", alignOff: "No alignment",
    alignMethod: {
      text: n => `Computed automatically from ${n} words found on both pages.`,
      image: () => "Computed automatically from the drawing (little text on the page).",
      none: () => "No print offset detected between the two pages.",
      manual: () => "Set manually.",
      off: () => "Automatic alignment is off in the options: you can set the offset here."
    },
    legend: { del: "Removed (old only)", add: "Added (new only)", same: "Unchanged", zone: "Changed area", delText: "Removed text", addText: "Added text" },
    legendHelp: "Wheel: zoom · drag: pan · double-click: zoom in · 0: fit",
    curtainHelp: "Curtain: old on the left, new on the right",
    waiting: "Analysing this page…",
    stats: { pairs: n => n === 1 ? "page compared" : "pages compared", same: () => "identical", mod: () => "changed", add: () => "inserted", del: () => "removed", zones: n => n === 1 ? "changed area" : "changed areas", changes: n => n === 1 ? "text change" : "text changes" },
    noChanges: "No changes to show.",
    noMatch: "No results for this search.",
    more: n => `… and ${n} more`,
    allPages: "all",
    export: {
      docTitle: "Comparison report · PDFo Comparo",
      generated: d => `Generated on ${d} · acheruel.github.io/outils/pdfo-comparo`,
      oldTag: "OLD", newTag: "NEW",
      compared: "pages compared",
      pagesTableTitle: "Pages compared",
      colOld: "Old", colNew: "New", colState: "State", colZones: "Changes", colAlign: "Alignment", colChanges: "Text changes",
      changesTitle: "List of changes",
      colN: "No.", colType: "Type", colPages: "Pages", colOldText: "Old text", colNewText: "New text",
      modeVisual: "Visual comparison", modeText: "Text comparison",
      tol: v => `${v} mm tolerance`, alignOn: "automatic alignment", alignOff: "no alignment",
      detectOn: "inserted or removed pages detected", detectOff: "pages compared one to one",
      ignoreCase: "case ignored",
      skipMargins: "repeated headers and footers ignored",
      shown: "Identical pages are not included in this PDF."
    },
    csv: ["No.", "Type", "Old page", "New page", "Area", "Old text", "New text", "X (mm)", "Y (mm)"],
    fileSuffix: "compared"
  }
};
const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
const t = () => TXT[lang()];
const nf = (v, d = 1) => new Intl.NumberFormat(t().locale, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
const signed = (v, d = 1) => (v > 0.04 ? "+" : v < -0.04 ? "−" : "") + nf(Math.abs(v), d);
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- État
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
const state = {
  A: null, B: null,
  opts: { ...DEFAULTS, ...store.get() },
  pairs: [],
  cur: 0,
  view: "overlay",
  text: null,          // résultat du mode texte
  analyzed: null,      // options de la dernière analyse
  run: 0,
  sel: null,           // { type: "zone", pair, zone } | { type: "text", change }
  listTab: "pairs",
  kind: "all",
  query: "",
  busy: false
};
const heavy = new Map();     // paire → rendu et masques (mode visuel), 2 au plus en mémoire
const sheetCache = new Map(); // "A:3" → canevas rendu (mode texte)

// ---------------------------------------------------------------- Statut
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

// ---------------------------------------------------------------- Options
const page = document.querySelector(".pc-page");
function saveOpts() { store.set(state.opts); }
function applyColors() {
  page.style.setProperty("--del", state.opts.colDel);
  page.style.setProperty("--add", state.opts.colAdd);
}
function renderOpts() {
  const o = state.opts;
  page.dataset.mode = o.mode;
  document.querySelectorAll(".seg[data-opt]").forEach(seg => {
    seg.querySelectorAll("button").forEach(b => {
      const on = b.dataset.value === String(o[seg.dataset.opt]);
      b.classList.toggle("selected", on);
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  });
  document.querySelectorAll("input[type=checkbox][data-opt]").forEach(c => { c.checked = !!o[c.dataset.opt]; });
  document.querySelectorAll("input[type=color][data-opt]").forEach(c => { c.value = o[c.dataset.opt]; });
  document.querySelectorAll("input[type=range][data-opt]").forEach(c => { c.value = o[c.dataset.opt]; });
  document.querySelector('[data-out="fade"]').textContent = `${Math.round(o.fade * 100)} %`;
  document.querySelector('[data-out="thick"]').textContent = `${o.thick} px`;
  $("mode-hint").textContent = t().modeHint[o.mode];
  applyColors();
}
// Options qui demandent une nouvelle analyse.
const ANALYSIS_KEYS = ["mode", "detect", "align", "ignoreCase", "skipMargins", "tol", "res"];
function onOpt(key, value) {
  state.opts[key] = value;
  saveOpts();
  renderOpts();
  if (ANALYSIS_KEYS.includes(key)) {
    if (state.analyzed) status(t().stale, { warn: true });
    updateCompareBtn();
  } else if (["colDel", "colAdd", "fade", "thick", "zones"].includes(key)) {
    for (const h of heavy.values()) h.imgs = {};
    renderLegend();
    if (state.pairs.length) showPair(state.cur, { keepView: true });
  }
}
document.querySelectorAll(".seg[data-opt]").forEach(seg => {
  seg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b && !b.disabled) onOpt(seg.dataset.opt, b.dataset.value);
  });
  seg.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const bs = [...seg.querySelectorAll("button:not(:disabled)")];
    const i = bs.findIndex(b => b.classList.contains("selected"));
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
    onOpt(seg.dataset.opt, n.dataset.value);
    n.focus();
    e.preventDefault();
  });
});
document.querySelectorAll("input[type=checkbox][data-opt]").forEach(c => c.addEventListener("change", () => onOpt(c.dataset.opt, c.checked)));
document.querySelectorAll("input[type=color][data-opt]").forEach(c => c.addEventListener("input", () => onOpt(c.dataset.opt, c.value)));
document.querySelectorAll("input[type=range][data-opt]").forEach(c => c.addEventListener("input", () => onOpt(c.dataset.opt, +c.value)));

// ---------------------------------------------------------------- Fichiers
const slots = { a: $("slot-a"), b: $("slot-b") };
function askPassword(name) {
  let again = false;
  return reason => {
    const pw = window.prompt(t().password(name, again || reason === "incorrect"));
    again = true;
    return pw;
  };
}
async function setDoc(side, file) {
  const slot = slots[side];
  const key = side === "a" ? "A" : "B";
  slot.querySelector(".pc-slot-name").textContent = file.name;
  slot.querySelector(".pc-slot-meta").textContent = t().opening;
  let error = null;
  try {
    const doc = await Doc.load(file, askPassword(file.name));
    state[key]?.destroy();
    state[key] = doc;
    invalidate();
  } catch (err) {
    console.error(err);
    state[key] = null;
    error = err && err.code === "not-pdf" ? t().notPdf(file.name) : t().openFail(file.name);
  }
  renderSlot(side);
  updateCompareBtn();
  if (error) status(error, { warn: true });
}
function renderSlot(side) {
  const slot = slots[side];
  const doc = state[side === "a" ? "A" : "B"];
  const x = t();
  slot.classList.toggle("is-loaded", !!doc);
  slot.querySelector(".pc-range").hidden = !doc;
  const name = slot.querySelector(".pc-slot-name"), meta = slot.querySelector(".pc-slot-meta");
  if (doc) {
    name.textContent = doc.name;
    name.removeAttribute("data-en"); delete name.dataset.frEn;
    meta.textContent = x.fileMeta(doc.n, fmtBytes(doc.size, x.locale));
  } else {
    name.textContent = side === "a" ? x.dropOld : x.dropNew;
    meta.textContent = side === "a" ? x.metaOld : x.metaNew;
  }
}
function updateCompareBtn() {
  const ok = state.A && state.B && !state.busy;
  $("compare").disabled = !ok;
  $("swap").disabled = state.busy || (!state.A && !state.B);
  if (!state.busy && !state.analyzed) status(state.A && state.B ? t().ready : t().needFiles);
}
function invalidate() {
  state.analyzed = null;
  state.run++;
  state.busy = false;
  for (const h of heavy.values()) freeHeavy(h);
  heavy.clear();
  for (const c of sheetCache.values()) dropCanvas(c);
  sheetCache.clear();
  state.pairs = [];
  state.text = null;
  state.sel = null;
  $("results").hidden = true;
  $("export-pdf").disabled = $("export-csv").disabled = true;
  progress(0, 0);
}

for (const side of ["a", "b"]) {
  const slot = slots[side];
  const input = slot.querySelector("input[type=file]");
  slot.querySelector(".pc-pick").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files[0]) setDoc(side, input.files[0]); input.value = ""; });
  slot.addEventListener("dragover", e => { e.preventDefault(); slot.classList.add("is-over"); });
  slot.addEventListener("dragleave", () => slot.classList.remove("is-over"));
  slot.addEventListener("drop", e => {
    e.preventDefault();
    slot.classList.remove("is-over");
    const files = [...e.dataTransfer.files].filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (files.length >= 2) {
      // Deux fichiers d'un coup : le plus ancien devient l'ancienne version.
      files.sort((x, y) => x.lastModified - y.lastModified || x.name.localeCompare(y.name, undefined, { numeric: true }));
      setDoc("a", files[0]);
      setDoc("b", files[1]);
    } else if (files[0]) setDoc(side, files[0]);
  });
  slot.querySelector(".pc-range input").addEventListener("input", e => {
    const doc = state[side === "a" ? "A" : "B"];
    e.target.classList.toggle("is-invalid", !!doc && parseRange(e.target.value, doc.n) === null);
    if (state.analyzed) status(t().stale, { warn: true });
  });
}
$("swap").addEventListener("click", () => {
  [state.A, state.B] = [state.B, state.A];
  const ra = slots.a.querySelector(".pc-range input"), rb = slots.b.querySelector(".pc-range input");
  [ra.value, rb.value] = [rb.value, ra.value];
  invalidate();
  renderSlot("a"); renderSlot("b");
  updateCompareBtn();
});
document.querySelectorAll("[data-example]").forEach(btn => btn.addEventListener("click", async () => {
  const [ua, ub] = EXAMPLES[btn.dataset.example];
  status(t().loadingExample, { busy: true });
  try {
    const get = async u => ({ name: u.split("/").pop(), bytes: new Uint8Array(await (await fetch(u)).arrayBuffer()) });
    const [fa, fb] = await Promise.all([get(ua), get(ub)]);
    slots.a.querySelector(".pc-range input").value = "";
    slots.b.querySelector(".pc-range input").value = "";
    await Promise.all([setDoc("a", fa), setDoc("b", fb)]);
    onOpt("mode", btn.dataset.example === "devis" ? "text" : "visual");
    compare();
  } catch {
    status(t().openFail(ua), { warn: true });
  }
}));

// ---------------------------------------------------------------- Comparaison
function freeHeavy(h) {
  if (!h) return;
  dropCanvas(h.r?.cA); dropCanvas(h.r?.cB);
  for (const c of Object.values(h.imgs || {})) dropCanvas(c);
}
function keepHeavy(p, h) {
  heavy.delete(p.id);
  heavy.set(p.id, h);
  while (heavy.size > 2) {
    const [k, v] = heavy.entries().next().value;
    if (k === state.pairs[state.cur]?.id) { heavy.delete(k); heavy.set(k, v); continue; }
    freeHeavy(v);
    heavy.delete(k);
  }
}
const resOf = () => +state.opts.res;
const tolOf = () => +state.opts.tol;

async function analyzePair(p, run) {
  const { A, B } = state;
  if (p.a !== null && p.b !== null) {
    if (!p.manual) p.T = state.opts.align ? await autoAlign(A, p.a, B, p.b) : { s: 1, tx: 0, ty: 0, method: "off", support: 0 };
    if (run !== state.run) return null;
    const r = await renderPair(A, p.a, B, p.b, p.T, resOf());
    const m = diffMasks(r, tolOf());
    p.zones = findZones(r, m);
    attachText(p.zones, await pairTextChanges(A, p.a, B, p.b, p.T, state.opts.ignoreCase));
    p.status = p.zones.length ? "mod" : "same";
    p.stats = { del: m.nRem, add: m.nAdd, ink: m.nInk };
    return { r, m, imgs: {} };
  }
  const r = await renderPair(A, p.a, B, p.b, { s: 1, tx: 0, ty: 0 }, resOf());
  const m = diffMasks(r, tolOf());
  p.zones = [];
  p.status = p.a !== null ? "del" : "add";
  p.T = null;
  return { r, m, imgs: {} };
}

async function compare() {
  if (!state.A || !state.B) return;
  const x = t();
  const ra = slots.a.querySelector(".pc-range input"), rb = slots.b.querySelector(".pc-range input");
  const idxA = parseRange(ra.value, state.A.n), idxB = parseRange(rb.value, state.B.n);
  if (!idxA || !idxB) { status(x.badRange, { warn: true }); return; }
  invalidate();
  const run = state.run;
  state.busy = true;
  updateCompareBtn();
  const t0 = performance.now();
  const opts = { ...state.opts };
  state.idxA = idxA; state.idxB = idxB;
  try {
    status(x.pairing(0, idxA.length + idxB.length), { busy: true });
    const pairs = await pairPages(state.A, idxA, state.B, idxB, {
      detect: opts.detect,
      onProgress: (i, n) => { if (run === state.run) { status(t().pairing(i, n), { busy: true }); progress(i, n); } }
    });
    if (run !== state.run) return;
    state.pairs = pairs.map((p, i) => ({ ...p, id: i, status: "pending", zones: [], T: null, manual: false }));
    state.cur = Math.max(0, state.pairs.findIndex(p => p.a !== null && p.b !== null));
    state.view = opts.mode === "text" ? "side" : "overlay";
    $("results").hidden = false;
    renderAll();
    $("results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

    if (opts.mode === "text") {
      status(x.readingText, { busy: true });
      progress(0, 0);
      state.text = await textCompare(state.A, idxA, state.B, idxB, { ignoreCase: opts.ignoreCase, skipMargins: opts.skipMargins });
      if (run !== state.run) return;
      buildTextPairs();
      state.analyzed = opts;
      if (!state.text.nA && !state.text.nB) status(x.noText, { warn: true });
      renderAll();
      await showPair(state.cur);
    } else {
      let first = true;
      for (let i = 0; i < state.pairs.length; i++) {
        if (run !== state.run) return;
        const p = state.pairs[i];
        status(t().analyzing(i + 1, state.pairs.length), { busy: true });
        progress(i, state.pairs.length);
        const h = await analyzePair(p, run);
        if (run !== state.run) { freeHeavy(h); return; }
        if (i === state.cur || first) keepHeavy(p, h); else freeHeavy(h);
        renderPairsList();
        renderChanges();
        renderSummary();
        if (i === state.cur) { await showPair(state.cur); first = false; }
        await idle();
      }
      state.analyzed = opts;
    }
    const sec = nf((performance.now() - t0) / 1000, 1);
    status(t().done(summaryText(), sec));
    progress(0, 0);
    $("export-pdf").disabled = $("export-csv").disabled = false;
  } catch (err) {
    console.error(err);
    status(t().openFail(state.A?.name || ""), { warn: true });
  } finally {
    if (run === state.run) { state.busy = false; updateCompareBtn(); }
  }
}
$("compare").addEventListener("click", compare);

// Mode texte : surlignage de chaque paire à partir des changements globaux.
function buildTextPairs() {
  const { wa, wb, changes } = state.text;
  const merge = (words, idxs) => {
    const out = [];
    for (const i of idxs) {
      const w = words[i];
      const last = out[out.length - 1];
      if (last && last.page === w.page && last.line === w.line && w.x0 - last.x1 < 3 * w.h) {
        last.x0 = Math.min(last.x0, w.x0); last.x1 = Math.max(last.x1, w.x1);
        last.y0 = Math.min(last.y0, w.y0); last.y1 = Math.max(last.y1, w.y1);
      } else out.push({ page: w.page, line: w.line, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 });
    }
    return out;
  };
  for (const c of changes) { c.boxesA = merge(wa, c.del); c.boxesB = merge(wb, c.add); }
  for (const p of state.pairs) {
    p.hlA = []; p.hlB = []; p.changeIds = new Set();
    changes.forEach((c, k) => {
      for (const b of c.boxesA) if (b.page === p.a) { p.hlA.push({ ...b, change: k }); p.changeIds.add(k); }
      for (const b of c.boxesB) if (b.page === p.b) { p.hlB.push({ ...b, change: k }); p.changeIds.add(k); }
    });
    p.status = p.a === null ? "add" : p.b === null ? "del" : p.changeIds.size ? "mod" : "same";
  }
  for (const c of changes) c.pair = pairForChange(c);
}
function pairForChange(c) {
  const P = state.pairs;
  let k = P.findIndex(p => p.a === c.pageA && p.b === c.pageB);
  if (k < 0 && c.add.length) k = P.findIndex(p => p.b === c.pageB);
  if (k < 0) k = P.findIndex(p => p.a === c.pageA);
  if (k < 0) k = P.findIndex(p => p.b === c.pageB);
  return Math.max(0, k);
}

// ---------------------------------------------------------------- Synthèse et listes
function counts() {
  const c = { pairs: state.pairs.length, same: 0, mod: 0, add: 0, del: 0, zones: 0 };
  for (const p of state.pairs) {
    if (c[p.status] !== undefined) c[p.status]++;
    c.zones += p.zones?.length || 0;
  }
  if (state.opts.mode === "text" && state.text) c.zones = state.text.changes.length;
  return c;
}
function summaryText() {
  const c = counts(), s = t().stats;
  const parts = [`${c.pairs} ${s.pairs(c.pairs)}`];
  for (const k of ["mod", "add", "del"]) if (c[k]) parts.push(`${c[k]} ${s[k](c[k])}`);
  parts.push(c.zones ? `${c.zones} ${(state.opts.mode === "text" ? s.changes : s.zones)(c.zones)}` : t().noDiff);
  return parts.join(", ");
}
function renderSummary() {
  const c = counts(), s = t().stats;
  const isText = state.opts.mode === "text";
  const items = [["", c.pairs, s.pairs], ["", c.same, s.same], ["is-mod", c.mod, s.mod]];
  if (c.add) items.push(["is-add", c.add, s.add]);
  if (c.del) items.push(["is-del", c.del, s.del]);
  items.push(["is-mod", c.zones, isText ? s.changes : s.zones]);
  $("summary").innerHTML = items.map(([cls, v, l]) => `<div class="pc-stat ${cls}"><b>${v}</b><span>${esc(l(v))}</span></div>`).join("");
}

function chip(stat) {
  const x = t().state;
  return `<span class="chip chip-${stat === "pending" ? "same" : stat}">${esc(x[stat])}</span>`;
}
function pairMeta(p) {
  if (p.status === "pending") return `<span class="pc-pending">${esc(t().state.pending)}…</span>`;
  const n = state.opts.mode === "text" ? p.changeIds?.size || 0 : p.zones.length;
  const what = state.opts.mode === "text" ? t().textChanges(n) : t().zones(n);
  return `${chip(p.status)}<span>${p.status === "mod" ? esc(what) : ""}</span>`;
}
function renderPairsList() {
  const ol = $("pairs");
  const x = t();
  ol.innerHTML = state.pairs.map((p, i) => {
    const pages = p.a !== null && p.b !== null
      ? `${x.oldShort} ${p.a + 1}<i>→</i>${x.newShort} ${p.b + 1}`
      : p.a !== null ? `${x.oldShort} ${p.a + 1}` : `${x.newShort} ${p.b + 1}`;
    return `<li><button type="button" data-pair="${i}" ${i === state.cur ? 'aria-current="true"' : ""}>
      <span class="pc-thumb" data-thumb="${i}"></span>
      <span class="pc-pair-pages">${pages}</span>
      <span class="pc-pair-meta">${pairMeta(p)}</span></button></li>`;
  }).join("");
  $("count-pairs").textContent = state.pairs.length;
  // Vignettes (de la nouvelle version, sinon de l'ancienne)
  state.pairs.forEach(async (p, i) => {
    const D = p.b !== null ? state.B : state.A;
    const idx = p.b !== null ? p.b : p.a;
    try {
      const { canvas } = await D.thumb(idx);
      const el = ol.querySelector(`[data-thumb="${i}"]`);
      if (el && canvas.width) el.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
    } catch { /* vignette facultative */ }
  });
}
$("pairs").addEventListener("click", e => {
  const b = e.target.closest("[data-pair]");
  if (b) { state.sel = null; showPair(+b.dataset.pair); }
});

function changeItems() {
  const items = [];
  if (state.opts.mode === "text" && state.text) {
    state.text.changes.forEach((c, k) => items.push({ type: "text", k, c, pair: c.pair }));
  } else {
    state.pairs.forEach((p, pi) => (p.zones || []).forEach((z, zi) => items.push({ type: "zone", pair: pi, zone: zi, z })));
  }
  return items;
}
function itemText(it) {
  if (it.type === "text") return [it.c.oldText, it.c.newText, ""];
  const tx = it.z.text;
  if (!tx.length) return ["", "", ""];
  const j = key => tx.map(c => c[key]).filter(Boolean).join(" · ");
  return [j("oldText"), j("newText"), j("moved")];
}
function changeHtml(it, n, current) {
  const x = t();
  const kind = it.type === "text" ? it.c.kind : it.z.kind;
  const [o, nw, mv] = itemText(it);
  const cut = s => (s.length > 140 ? s.slice(0, 137) + "…" : s);
  let body = "";
  if (o || nw) body = [o && `<del>${esc(cut(o))}</del>`, o && nw && `<span class="arrow">→</span>`, nw && `<ins>${esc(cut(nw))}</ins>`].filter(Boolean).join("");
  if (mv) body += `${body ? " " : ""}<span class="pc-ch-ctx">${esc(x.moved)} ${esc(cut(mv))}</span>`;
  if (!body) body = `<span class="pc-ch-ctx">${esc(x.graphic)}</span>`;
  let where = "";
  if (it.type === "text") {
    const parts = [];
    if (it.c.pageA !== null && it.c.pageA !== undefined) parts.push(`${x.oldShort} ${x.page} ${it.c.pageA + 1}`);
    if (it.c.pageB !== null && it.c.pageB !== undefined) parts.push(`${x.newShort} ${x.page} ${it.c.pageB + 1}`);
    where = parts.join(" · ");
  }
  return `<li><button type="button" data-item="${it.type}:${it.type === "text" ? it.k : it.pair + "/" + it.zone}" ${current ? 'aria-current="true"' : ""}>
    <span class="pc-num k-${kind}">${n}</span>
    <span class="pc-ch-head"><b>${esc(x.kind[kind])}</b>${where ? `<span>${esc(where)}</span>` : ""}</span>
    <span class="pc-ch-text">${body}</span></button></li>`;
}
function renderChanges() {
  const ol = $("changes");
  const q = state.query.trim().toLocaleLowerCase();
  const all = changeItems();
  $("count-changes").textContent = all.length;
  const list = all.filter(it => {
    const kind = it.type === "text" ? it.c.kind : it.z.kind;
    if (state.kind !== "all" && kind !== state.kind) return false;
    if (!q) return true;
    const [o, n, mv] = itemText(it);
    const pg = it.type === "text" ? `${(it.c.pageA ?? -9) + 1} ${(it.c.pageB ?? -9) + 1}` : `${(state.pairs[it.pair].a ?? -9) + 1} ${(state.pairs[it.pair].b ?? -9) + 1}`;
    return `${o} ${n} ${mv} ${t().kind[kind]} p${pg}`.toLocaleLowerCase().includes(q);
  });
  if (!all.length) { ol.innerHTML = `<li class="empty-note">${esc(t().noChanges)}</li>`; return; }
  if (!list.length) { ol.innerHTML = `<li class="empty-note">${esc(t().noMatch)}</li>`; return; }
  const max = 600;
  let html = "", lastPair = -1;
  list.slice(0, max).forEach(it => {
    if (it.type === "zone" && it.pair !== lastPair) {
      html += `<li class="pc-group">${esc(t().pairLabel(state.pairs[it.pair]))}</li>`;
      lastPair = it.pair;
    }
    const cur = state.sel && (it.type === "text" ? state.sel.type === "text" && state.sel.change === it.k : state.sel.type === "zone" && state.sel.pair === it.pair && state.sel.zone === it.zone);
    html += changeHtml(it, it.type === "text" ? it.k + 1 : it.zone + 1, cur);
  });
  if (list.length > max) html += `<li class="pc-more">${esc(t().more(list.length - max))}</li>`;
  ol.innerHTML = html;
}
$("changes").addEventListener("click", e => {
  const b = e.target.closest("[data-item]");
  if (!b) return;
  const [type, ref] = b.dataset.item.split(":");
  if (type === "text") selectText(+ref);
  else { const [pi, zi] = ref.split("/").map(Number); selectZone(pi, zi); }
});
$("search").addEventListener("input", e => { state.query = e.target.value; renderChanges(); });
$("kinds").addEventListener("click", e => {
  const b = e.target.closest("[data-kind]");
  if (!b) return;
  state.kind = b.dataset.kind;
  $("kinds").querySelectorAll("button").forEach(x => x.classList.toggle("selected", x === b));
  renderChanges();
});
function setListTab(tab) {
  state.listTab = tab;
  for (const [id, pane, key] of [["tab-pairs", "pane-pairs", "pairs"], ["tab-changes", "pane-changes", "changes"]]) {
    const on = key === tab;
    $(id).setAttribute("aria-selected", String(on));
    $(id).tabIndex = on ? 0 : -1;
    $(pane).hidden = !on;
  }
}
$("tab-pairs").addEventListener("click", () => setListTab("pairs"));
$("tab-changes").addEventListener("click", () => setListTab("changes"));

function renderLegend() {
  const x = t().legend;
  const isText = state.opts.mode === "text";
  const items = isText
    ? [["sw-del", x.delText], ["sw-add", x.addText]]
    : [["sw-del", x.del], ["sw-add", x.add], ["sw-same", x.same], ["sw-zone", x.zone]];
  const help = state.view === "curtain" ? t().curtainHelp : t().legendHelp;
  $("legend").innerHTML = items.map(([c, l]) => `<span><i class="sw ${c}"></i>${esc(l)}</span>`).join("") + `<span class="pc-legend-note">${esc(help)}</span>`;
}

function renderAll() {
  renderSummary();
  renderPairsList();
  renderChanges();
  renderLegend();
  renderToolbar();
}

// ---------------------------------------------------------------- Visionneuse
const vp = $("viewport"), stage = $("stage"), curtain = $("curtain");
const V = { z: 1, x: 0, y: 0, W: 1, H: 1, k: 1, sheets: [], curtain: 0.5 };
let rafPending = false;

function setTransform() {
  stage.style.transform = `translate(${V.x}px, ${V.y}px) scale(${V.z})`;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; afterTransform(); });
  }
}
function afterTransform() {
  // 100 % = taille réelle du papier à l'écran (96 px par pouce, soit 4/3 px par point).
  $("zoom-fit").textContent = `${Math.round(V.z * V.k * 75)} %`;
  // Libellés à taille constante à l'écran.
  const fs = 12 / V.z;
  stage.querySelectorAll(".pc-sheet-tag").forEach(el => { el.style.fontSize = `${13 / V.z}px`; });
  stage.querySelectorAll("svg").forEach(svg => {
    svg.querySelectorAll(".pc-zone-label").forEach(tx => tx.setAttribute("font-size", fs));
    svg.querySelectorAll(".pc-zone-tab").forEach(r => {
      const w = (+r.dataset.chars * 7 + 8) / V.z;
      r.setAttribute("width", w); r.setAttribute("height", 15 / V.z);
      r.setAttribute("y", +r.dataset.y - 15 / V.z);
      const label = r.nextElementSibling;
      label.setAttribute("x", +r.getAttribute("x") + 4 / V.z);
      label.setAttribute("y", +r.dataset.y - 3.5 / V.z);
    });
  });
  if (state.view === "curtain") placeCurtain();
  placeZoneCard();
  clearTimeout(detailTimer);
  detailTimer = setTimeout(renderDetail, 150);
}

// Netteté à tous les zooms : la partie visible est recalculée à la résolution de l'écran
// (rendu vectoriel pdf.js, comparaison et couleurs), puis posée sur le feuillet. Le feuillet de
// base (résolution d'analyse, ≈ 2 600 px) n'est vu que pendant un geste : réduit 3 à 4 fois par
// le navigateur, il crénelait le texte ; agrandi, il devenait flou.
let detailTimer = 0, detailToken = 0;
async function renderDetail() {
  const token = ++detailToken;
  const p = state.pairs[state.cur];
  if (!p || !V.sheets.length) return;
  const dpr = window.devicePixelRatio || 1;
  const need = V.z * dpr; // pixels d'écran par pixel du feuillet
  const clear = sheet => sheet.querySelectorAll(".pc-detail").forEach(c => { dropCanvas(c); c.remove(); });
  const r = vp.getBoundingClientRect();
  const vx0 = -V.x / V.z, vy0 = -V.y / V.z, vx1 = (r.width - V.x) / V.z, vy1 = (r.height - V.y) / V.z;
  const isText = state.opts.mode === "text";
  for (const sheet of V.sheets) {
    const left = parseFloat(sheet.style.left), W = parseFloat(sheet.style.width), H = parseFloat(sheet.style.height);
    const x0 = Math.floor(Math.max(vx0 - left, 0)), x1 = Math.ceil(Math.min(vx1 - left, W));
    const y0 = Math.floor(Math.max(vy0, 0)), y1 = Math.ceil(Math.min(vy1, H));
    if (x1 <= x0 || y1 <= y0) { clear(sheet); continue; }
    const k = +sheet.dataset.k;
    const wpt = (x1 - x0) / k, hpt = (y1 - y0) / k;
    let kd = k * Math.min(need, 6);
    if (wpt * hpt * kd * kd > 9e6) kd = Math.sqrt(9e6 / (wpt * hpt));
    // Feuillet de base déjà à l'échelle 1:1 de l'écran : inutile de recalculer.
    if (Math.abs(kd / k - 1) < 0.08) { clear(sheet); continue; }
    const place = (canvas, cls = "") => {
      canvas.className = `pc-detail pc-layer ${cls}`.trim();
      Object.assign(canvas.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
      sheet.insertBefore(canvas, sheet.querySelector("svg"));
    };
    let canvases;
    try {
      if (isText) {
        const D = sheet.dataset.side === "A" ? state.A : state.B;
        canvases = [await renderPage(await D.page(+sheet.dataset.idx), {
          scale: kd, offsetX: -(x0 / k) * kd, offsetY: -(y0 / k) * kd, width: wpt * kd, height: hpt * kd
        })];
      } else {
        const rr = await renderRegion(state.A, p.a, state.B, p.b, p.T || { s: 1, tx: 0, ty: 0 }, kd, x0 / k, y0 / k, wpt, hpt);
        if (token !== detailToken) { dropCanvas(rr.cA); dropCanvas(rr.cB); return; }
        // Au moins 1 pixel de tolérance : deux rendus d'un même trait diffèrent sur leurs bords lissés.
        const m = diffMasks(rr, tolOf(), 48, 1);
        const opts = {
          colDel: hexToRgb(state.opts.colDel), colAdd: hexToRgb(state.opts.colAdd),
          fade: state.opts.fade, thick: Math.round(state.opts.thick * Math.max(1, dpr))
        };
        const views = sheet.dataset.view === "curtain" ? ["new", "old"] : [sheet.dataset.view];
        canvases = views.map(view => imgCanvas(compose(rr, m, { ...opts, view })));
        dropCanvas(rr.cA); dropCanvas(rr.cB);
      }
    } catch { return; }
    if (token !== detailToken || !sheet.isConnected) { canvases.forEach(dropCanvas); return; }
    clear(sheet);
    place(canvases[0]);
    if (canvases[1]) place(canvases[1], "pc-curtain-top");
  }
  if (state.view === "curtain") placeCurtain();
}
function fit() {
  const r = vp.getBoundingClientRect();
  const pad = 22, top = V.sheets.length > 1 ? 18 : 0;
  V.z = Math.min((r.width - 2 * pad) / V.W, (r.height - 2 * pad - top) / V.H);
  V.x = (r.width - V.W * V.z) / 2;
  V.y = (r.height - V.H * V.z + top) / 2;
  setTransform();
}
function zoomAt(f, sx, sy) {
  const r = vp.getBoundingClientRect();
  const fitZ = Math.min(r.width / V.W, r.height / V.H);
  const z2 = Math.min(Math.max(V.z * f, fitZ * 0.4), 8);
  V.x = sx - ((sx - V.x) * z2) / V.z;
  V.y = sy - ((sy - V.y) * z2) / V.z;
  V.z = z2;
  setTransform();
}
function zoomToBox(x0, y0, x1, y1) {
  const r = vp.getBoundingClientRect();
  const w = Math.max(x1 - x0, 20), h = Math.max(y1 - y0, 20);
  const fitZ = Math.min(r.width / V.W, r.height / V.H);
  V.z = Math.min(Math.max(Math.min((0.55 * r.width) / w, (0.55 * r.height) / h), fitZ), 6);
  V.x = r.width / 2 - ((x0 + x1) / 2) * V.z;
  V.y = r.height / 2 - ((y0 + y1) / 2) * V.z;
  setTransform();
}

// Déplacement, zoom à la molette, pincement.
const pointers = new Map();
let pan = null, pinch = null, moved = 0;
vp.addEventListener("pointerdown", e => {
  if (e.target.closest(".pc-curtain, .pc-zonecard")) return;
  vp.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (pointers.size === 1) { pan = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y }; vp.classList.add("is-panning"); }
  if (pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), z: V.z };
    pan = null;
  }
});
vp.addEventListener("pointermove", e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    const r = vp.getBoundingClientRect();
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    zoomAt((pinch.z * d) / pinch.d / V.z, (p.x + q.x) / 2 - r.left, (p.y + q.y) / 2 - r.top);
    moved = 99;
  } else if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    moved = Math.max(moved, Math.hypot(dx, dy));
    V.x = pan.vx + dx; V.y = pan.vy + dy;
    setTransform();
  }
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!pointers.size) { pan = null; vp.classList.remove("is-panning"); }
};
vp.addEventListener("pointerup", e => {
  if (moved < 4 && !e.target.closest(".pc-zonecard")) {
    const target = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.dataset && (el.dataset.zone || el.dataset.change));
    if (target?.dataset.zone) selectZone(state.cur, +target.dataset.zone, { zoom: false });
    else if (target?.dataset.change) selectText(+target.dataset.change, { zoom: false });
  }
  endPointer(e);
});
vp.addEventListener("pointercancel", endPointer);
vp.addEventListener("wheel", e => {
  e.preventDefault();
  const r = vp.getBoundingClientRect();
  const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
  zoomAt(Math.exp(-dy * 0.0016), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
vp.addEventListener("dblclick", e => {
  const r = vp.getBoundingClientRect();
  zoomAt(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
});
vp.addEventListener("keydown", e => {
  const r = vp.getBoundingClientRect();
  const k = e.key;
  if (k === "+" || k === "=") zoomAt(1.25, r.width / 2, r.height / 2);
  else if (k === "-" || k === "_") zoomAt(0.8, r.width / 2, r.height / 2);
  else if (k === "0") fit();
  else if (k.startsWith("Arrow")) {
    const d = e.shiftKey ? 200 : 60;
    V.x += k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0;
    V.y += k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0;
    setTransform();
  } else if (k === "PageDown") showPair(Math.min(state.cur + 1, state.pairs.length - 1));
  else if (k === "PageUp") showPair(Math.max(state.cur - 1, 0));
  else return;
  e.preventDefault();
});
$("zoom-in").addEventListener("click", () => { const r = vp.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); });
$("zoom-out").addEventListener("click", () => { const r = vp.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); });
$("zoom-fit").addEventListener("click", fit);
new ResizeObserver(() => { if (V.sheets.length && !V.userMoved) fit(); }).observe(vp);

// Rideau
function placeCurtain() {
  const r = vp.getBoundingClientRect();
  const sx = V.curtain * r.width;
  curtain.style.left = `${sx}px`;
  curtain.setAttribute("aria-valuenow", String(Math.round(V.curtain * 100)));
  const X = Math.min(Math.max((sx - V.x) / V.z, 0), V.W);
  // Feuillet entier et calque de détail (posé en x0) : la coupe se calcule dans le repère de chacun.
  stage.querySelectorAll(".pc-curtain-top").forEach(top => {
    const left = parseFloat(top.style.left) || 0, w = parseFloat(top.style.width) || V.W;
    top.style.clipPath = `inset(0 ${Math.max(0, left + w - X)}px 0 0)`;
  });
}
curtain.addEventListener("pointerdown", e => {
  curtain.setPointerCapture(e.pointerId);
  const move = ev => {
    const r = vp.getBoundingClientRect();
    V.curtain = Math.min(Math.max((ev.clientX - r.left) / r.width, 0.01), 0.99);
    placeCurtain();
  };
  const up = () => { curtain.removeEventListener("pointermove", move); curtain.removeEventListener("pointerup", up); };
  curtain.addEventListener("pointermove", move);
  curtain.addEventListener("pointerup", up);
  e.stopPropagation();
});
curtain.addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  V.curtain = Math.min(Math.max(V.curtain + (e.key === "ArrowRight" ? 0.03 : -0.03), 0.01), 0.99);
  placeCurtain();
  e.preventDefault();
});

// Vues
$("views").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (!b || b.disabled) return;
  state.view = b.dataset.view;
  renderToolbar();
  renderLegend();
  showPair(state.cur, { keepView: true });
});

function renderToolbar() {
  const p = state.pairs[state.cur];
  const x = t();
  const isText = state.opts.mode === "text";
  const both = p && p.a !== null && p.b !== null;
  $("views").querySelectorAll("button").forEach(b => {
    const v = b.dataset.view;
    const allowed = isText ? (both ? ["side", "old", "new"] : []) : both ? ["overlay", "side", "curtain", "old", "new"] : [];
    b.disabled = !allowed.includes(v);
    const on = v === state.view && !b.disabled;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-checked", String(on));
  });
  if (!p) return;
  $("pair-label").textContent = x.pairLabel(p);
  $("pair-label").title = x.pairOf(state.cur + 1, state.pairs.length);
  $("prev").disabled = state.cur <= 0;
  $("next").disabled = state.cur >= state.pairs.length - 1;
  $("align-btn").hidden = isText || !both;
  $("align-label").textContent = alignText(p);
}
function alignText(p) {
  const x = t();
  if (!p || !p.T) return "";
  const T = p.T;
  if (T.s === 1 && !T.tx && !T.ty) return T.method === "off" ? x.alignOff : x.alignNone;
  const fr = lang() === "fr";
  const s = T.s !== 1 ? ` · ${nf(T.s * 100, 2)}${fr ? "\u202f%" : "%"}` : "";
  return `${p.manual ? x.alignManual : x.alignAuto}${fr ? " : " : ": "}${signed(T.tx / MM)} / ${signed(T.ty / MM)} mm${s}`;
}
$("prev").addEventListener("click", () => { state.sel = null; showPair(state.cur - 1); });
$("next").addEventListener("click", () => { state.sel = null; showPair(state.cur + 1); });

// Construction de la scène
function sheetEl(canvas, x, w, h, tag) {
  const d = document.createElement("div");
  d.className = "pc-sheet";
  d.style.left = `${x}px`;
  d.style.width = `${w}px`;
  d.style.height = `${h}px`;
  if (canvas) { canvas.classList.add("pc-layer"); d.append(canvas); }
  if (tag) {
    const s = document.createElement("span");
    s.className = "pc-sheet-tag";
    s.textContent = tag;
    d.append(s);
  }
  return d;
}
const SVGNS = "http://www.w3.org/2000/svg";
function zonesSvg(zones, k, w, h) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", w); svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  zones.forEach((z, i) => {
    const r = document.createElementNS(SVGNS, "rect");
    r.setAttribute("class", "pc-zone" + (state.sel?.type === "zone" && state.sel.pair === state.cur && state.sel.zone === i ? " is-active" : ""));
    r.setAttribute("x", z.x0 * k); r.setAttribute("y", z.y0 * k);
    r.setAttribute("width", (z.x1 - z.x0) * k); r.setAttribute("height", (z.y1 - z.y0) * k);
    r.setAttribute("rx", 2);
    r.dataset.zone = i;
    const tab = document.createElementNS(SVGNS, "rect");
    tab.setAttribute("class", "pc-zone-tab");
    tab.setAttribute("x", z.x0 * k);
    tab.dataset.y = z.y0 * k;
    tab.dataset.chars = String(i + 1).length;
    const label = document.createElementNS(SVGNS, "text");
    label.setAttribute("class", "pc-zone-label");
    label.textContent = i + 1;
    svg.append(r, tab, label);
  });
  return svg;
}
function hlSvg(boxes, k, w, h, cls) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", w); svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  for (const b of boxes) {
    const r = document.createElementNS(SVGNS, "rect");
    const active = state.sel?.type === "text" && state.sel.change === b.change;
    r.setAttribute("class", `pc-hl ${cls}` + (active ? " is-active" : ""));
    r.setAttribute("x", (b.x0 - 1) * k); r.setAttribute("y", (b.y0 - 1) * k);
    r.setAttribute("width", (b.x1 - b.x0 + 2) * k); r.setAttribute("height", (b.y1 - b.y0 + 2) * k);
    r.setAttribute("fill", cls === "hl-del" ? state.opts.colDel : state.opts.colAdd);
    r.setAttribute("fill-opacity", active ? 0.5 : 0.32);
    r.dataset.change = b.change;
    svg.append(r);
  }
  return svg;
}
function imgCanvas(img) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
function composed(h, view) {
  if (!h.imgs[view]) {
    h.imgs[view] = imgCanvas(compose(h.r, h.m, {
      colDel: hexToRgb(state.opts.colDel), colAdd: hexToRgb(state.opts.colAdd),
      fade: state.opts.fade, thick: state.opts.thick, view
    }));
  }
  // Un canevas ne peut être qu'à un seul endroit du DOM : copie si déjà affiché.
  const src = h.imgs[view];
  if (!src.isConnected) return src;
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  return c;
}

let showToken = 0;
async function showPair(i, { keepView = false } = {}) {
  if (i < 0 || i >= state.pairs.length) return;
  const changed = i !== state.cur;
  state.cur = i;
  const p = state.pairs[i];
  const token = ++showToken;
  renderToolbar();
  $("pairs").querySelectorAll("[data-pair]").forEach(b => {
    const on = +b.dataset.pair === i;
    if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    if (on && changed) b.scrollIntoView({ block: "nearest" });
  });
  closePops();
  const isText = state.opts.mode === "text";
  if (!isText && p.status === "pending") {
    $("viewer-busy").hidden = false;
    return;
  }
  $("viewer-busy").hidden = false;
  try {
    const sheets = isText ? await textSheets(p) : await visualSheets(p);
    if (token !== showToken) return;
    stage.replaceChildren(...sheets.els);
    V.W = sheets.W; V.H = sheets.H; V.k = sheets.k; V.sheets = sheets.els;
    curtain.hidden = state.view !== "curtain" || isText || p.a === null || p.b === null;
    if (!keepView || changed) { V.userMoved = false; fit(); } else setTransform();
    if (!curtain.hidden) placeCurtain();
    renderZoneCard();
  } finally {
    if (token === showToken) $("viewer-busy").hidden = true;
  }
}

// Fiche de la zone sélectionnée : texte ancien → nouveau lisible en clair, posée sous la zone
// (ou au-dessus faute de place) et suivie pendant le zoom et le déplacement.
const zonecard = $("zonecard");
function selectedZone() {
  const s = state.sel;
  if (state.opts.mode === "text" || s?.type !== "zone" || s.pair !== state.cur) return null;
  return state.pairs[state.cur]?.zones?.[s.zone] || null;
}
function renderZoneCard() {
  const z = selectedZone();
  if (!z) { zonecard.hidden = true; zonecard.replaceChildren(); return; }
  const x = t();
  const rows = (z.text || []).filter(c => c.oldText || c.newText).map(c => {
    const o = c.oldText ? `<del>${esc(c.oldText)}</del>` : "";
    const n = c.newText ? `<ins>${esc(c.newText)}</ins>` : "";
    return `<li>${o}${o && n ? '<span class="arrow">→</span>' : ""}${n}</li>`;
  });
  if (!rows.length) rows.push(`<li class="pc-ch-ctx">${esc(x.graphic)}</li>`);
  zonecard.innerHTML = `<div class="pc-zc-head"><span class="pc-num k-${z.kind}">${state.sel.zone + 1}</span>
    <b>${esc(x.kind[z.kind])}</b><button type="button" class="pc-zc-close" aria-label="${esc(x.close)}" title="${esc(x.close)}">×</button></div>
    <ul class="pc-ch-text">${rows.join("")}</ul>`;
  zonecard.hidden = false;
  placeZoneCard();
}
function placeZoneCard() {
  const z = selectedZone();
  if (!z || zonecard.hidden) return;
  // Côte à côte : la fiche suit la zone du feuillet de droite (nouvelle version).
  const sheet = V.sheets[V.sheets.length - 1];
  const left = sheet ? parseFloat(sheet.style.left) || 0 : 0;
  const k = V.k;
  const sx0 = V.x + (left + z.x0 * k) * V.z, sx1 = V.x + (left + z.x1 * k) * V.z;
  const sy0 = V.y + z.y0 * k * V.z, sy1 = V.y + z.y1 * k * V.z;
  const r = vp.getBoundingClientRect();
  const w = zonecard.offsetWidth, h = zonecard.offsetHeight, m = 8;
  let top = sy1 + m;
  if (top + h > r.height - m && sy0 - m - h >= m) top = sy0 - m - h;
  top = Math.min(Math.max(top, m), Math.max(m, r.height - h - m));
  const lft = Math.min(Math.max(sx0, m), Math.max(m, r.width - w - m));
  // Zone entièrement hors champ : la fiche s'efface plutôt que de flotter sans repère.
  const off = sx1 < 0 || sx0 > r.width || sy1 < 0 || sy0 > r.height;
  zonecard.style.visibility = off ? "hidden" : "";
  zonecard.style.left = `${lft}px`;
  zonecard.style.top = `${top}px`;
}
zonecard.addEventListener("click", e => {
  if (!e.target.closest(".pc-zc-close")) return;
  state.sel = null;
  stage.querySelectorAll(".pc-zone.is-active").forEach(r => r.classList.remove("is-active"));
  renderZoneCard();
  renderChanges();
  vp.focus();
});

async function visualSheets(p) {
  let h = heavy.get(p.id);
  if (!h) {
    const { A, B } = state;
    const r = await renderPair(A, p.a, B, p.b, p.T || { s: 1, tx: 0, ty: 0 }, resOf());
    h = { r, m: diffMasks(r, tolOf()), imgs: {} };
    keepHeavy(p, h);
  }
  const { W, H, k } = h.r;
  const zones = state.opts.zones ? p.zones : [];
  const x = t();
  const both = p.a !== null && p.b !== null;
  let view = state.view;
  if (!both) view = p.a !== null ? "old" : "new";
  if (view === "side") {
    const gap = Math.round(W * 0.04);
    const sa = sheetEl(composed(h, "old"), 0, W, H, `${x.old} · ${x.page} ${p.a + 1}`);
    const sb = sheetEl(composed(h, "new"), W + gap, W, H, `${x.new} · ${x.page} ${p.b + 1}`);
    Object.assign(sa.dataset, { k, view: "old" });
    Object.assign(sb.dataset, { k, view: "new" });
    sa.append(zonesSvg(zones, k, W, H));
    sb.append(zonesSvg(zones, k, W, H));
    return { els: [sa, sb], W: 2 * W + gap, H, k };
  }
  if (view === "curtain") {
    const s = sheetEl(composed(h, "new"), 0, W, H);
    const top = composed(h, "old");
    top.classList.add("pc-layer", "pc-curtain-top");
    Object.assign(s.dataset, { k, view: "curtain" });
    s.append(top, zonesSvg(zones, k, W, H));
    return { els: [s], W, H, k };
  }
  const s = sheetEl(composed(h, view), 0, W, H);
  Object.assign(s.dataset, { k, view });
  s.append(zonesSvg(zones, k, W, H));
  return { els: [s], W, H, k };
}

async function sheetCanvas(D, side, idx) {
  const key = `${side}:${idx}`;
  if (sheetCache.has(key)) {
    const c = sheetCache.get(key);
    sheetCache.delete(key); sheetCache.set(key, c);
    return c;
  }
  const inf = await D.info(idx);
  const k = Math.min(resOf(), 2600) / Math.max(inf.w, inf.h);
  const c = await renderPage(await D.page(idx), { scale: k });
  c.dataset.k = k;
  sheetCache.set(key, c);
  while (sheetCache.size > 6) {
    const [k0, c0] = sheetCache.entries().next().value;
    if (c0.isConnected) { sheetCache.delete(k0); sheetCache.set(k0, c0); break; }
    dropCanvas(c0); sheetCache.delete(k0);
  }
  return c;
}
async function textSheets(p) {
  const x = t();
  const out = [];
  let X = 0, W = 1, H = 1, kRef = 1;
  const add = async (D, side, idx, boxes, cls, tag) => {
    const src = await sheetCanvas(D, side, idx);
    const k = +src.dataset.k;
    let c = src;
    if (src.isConnected) { // déjà affiché ailleurs : copie
      c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      c.getContext("2d").drawImage(src, 0, 0);
    }
    const s = sheetEl(c, X, c.width, c.height, tag);
    Object.assign(s.dataset, { k, side, idx });
    s.append(hlSvg(boxes, k, c.width, c.height, cls));
    out.push(s);
    W = X + c.width;
    X = W + Math.round(c.width * 0.04);
    H = Math.max(H, c.height);
    kRef = k;
  };
  const showA = p.a !== null && state.view !== "new";
  const showB = p.b !== null && state.view !== "old";
  if (showA) await add(state.A, "A", p.a, p.hlA || [], "hl-del", `${x.old} · ${x.page} ${p.a + 1}`);
  if (showB) await add(state.B, "B", p.b, p.hlB || [], "hl-add", `${x.new} · ${x.page} ${p.b + 1}`);
  return { els: out, W, H, k: kRef };
}

// Sélection d'une zone ou d'un changement de texte
async function selectZone(pi, zi, { zoom = true } = {}) {
  state.sel = { type: "zone", pair: pi, zone: zi };
  if (pi !== state.cur) await showPair(pi);
  else if (state.opts.zones) stage.querySelectorAll(".pc-zone").forEach(r => r.classList.toggle("is-active", +r.dataset.zone === zi));
  renderChanges();
  markCurrentChange();
  renderZoneCard();
  const z = state.pairs[pi].zones[zi];
  if (zoom && z) {
    const k = V.k;
    if (state.view === "side" && V.sheets.length > 1) {
      // Côte à côte : la zone est cadrée sur les deux feuillets à la fois.
      const off = parseFloat(V.sheets[1].style.left);
      zoomToBox(z.x0 * k, z.y0 * k, off + z.x1 * k, z.y1 * k);
    } else {
      zoomToBox(z.x0 * k, z.y0 * k, z.x1 * k, z.y1 * k);
    }
    V.userMoved = true;
  }
}
async function selectText(ci, { zoom = true } = {}) {
  const c = state.text?.changes[ci];
  if (!c) return;
  state.sel = { type: "text", change: ci };
  if (c.pair !== state.cur) await showPair(c.pair);
  else stage.querySelectorAll(".pc-hl").forEach(r => {
    const on = +r.dataset.change === ci;
    r.classList.toggle("is-active", on);
    r.setAttribute("fill-opacity", on ? 0.5 : 0.32);
  });
  renderChanges();
  markCurrentChange();
  if (!zoom) return;
  // Cadre les boîtes du changement sur les feuillets affichés.
  const boxes = [];
  const p = state.pairs[state.cur];
  V.sheets.forEach(s => {
    const svg = s.querySelector("svg");
    if (!svg) return;
    const left = parseFloat(s.style.left);
    svg.querySelectorAll(`[data-change="${ci}"]`).forEach(r => {
      const x = +r.getAttribute("x") + left, y = +r.getAttribute("y");
      boxes.push([x, y, x + +r.getAttribute("width"), y + +r.getAttribute("height")]);
    });
  });
  void p;
  if (boxes.length) {
    const x0 = Math.min(...boxes.map(b => b[0])), y0 = Math.min(...boxes.map(b => b[1]));
    const x1 = Math.max(...boxes.map(b => b[2])), y1 = Math.max(...boxes.map(b => b[3]));
    zoomToBox(x0 - 40, y0 - 60, x1 + 40, y1 + 60);
    V.userMoved = true;
  }
}
function markCurrentChange() {
  const cur = $("changes").querySelector('[aria-current="true"]');
  if (cur) cur.scrollIntoView({ block: "nearest" });
}
document.addEventListener("keydown", e => {
  if (e.target.matches("input, textarea, select") || $("results").hidden) return;
  if (e.key !== "n" && e.key !== "p") return;
  // n / p : changement suivant / précédent
  const items = changeItems();
  if (!items.length) return;
  let i = items.findIndex(it => state.sel && (it.type === "text" ? state.sel.change === it.k : state.sel.pair === it.pair && state.sel.zone === it.zone));
  i = e.key === "n" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0);
  const it = items[i];
  if (it.type === "text") selectText(it.k); else selectZone(it.pair, it.zone);
});

// ---------------------------------------------------------------- Fenêtres contextuelles
function closePops() {
  for (const [pop, btn] of [["pop-pair", "pair-label"], ["pop-align", "align-btn"]]) {
    $(pop).hidden = true;
    $(btn).setAttribute("aria-expanded", "false");
  }
}
function togglePop(pop, btn, fill) {
  const open = $(pop).hidden;
  closePops();
  if (!open) return;
  fill();
  $(pop).hidden = false;
  $(btn).setAttribute("aria-expanded", "true");
  $(pop).querySelector("select, input, button")?.focus();
}
document.querySelectorAll(".pc-pop [data-close]").forEach(b => b.addEventListener("click", closePops));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const open = !$("pop-pair").hidden || !$("pop-align").hidden;
  closePops();
  if (!open && !zonecard.hidden) zonecard.querySelector(".pc-zc-close").click();
});

$("pair-label").addEventListener("click", () => togglePop("pop-pair", "pair-label", () => {
  const p = state.pairs[state.cur];
  const x = t();
  const opts = (D, sel) => `<option value="">${esc(x.none)}</option>` + Array.from({ length: D.n }, (_, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${esc(x.pageN(i + 1))}</option>`).join("");
  $("pick-a").innerHTML = opts(state.A, p.a);
  $("pick-b").innerHTML = opts(state.B, p.b);
}));
$("pick-apply").addEventListener("click", async () => {
  const a = $("pick-a").value === "" ? null : +$("pick-a").value;
  const b = $("pick-b").value === "" ? null : +$("pick-b").value;
  if (a === null && b === null) return;
  closePops();
  const p = state.pairs[state.cur];
  p.a = a; p.b = b; p.manual = false; p.status = "pending";
  freeHeavy(heavy.get(p.id)); heavy.delete(p.id);
  await reanalyze(p);
});
async function reanalyze(p) {
  if (state.opts.mode === "text") {
    buildTextPairs();
  } else {
    $("viewer-busy").hidden = false;
    const h = await analyzePair(p, state.run);
    if (h) keepHeavy(p, h);
  }
  renderAll();
  await showPair(state.cur, { keepView: true });
}

// Recalage manuel
$("align-btn").addEventListener("click", () => togglePop("pop-align", "align-btn", fillAlign));
function fillAlign() {
  const p = state.pairs[state.cur];
  const T = p.T || { s: 1, tx: 0, ty: 0, method: "none" };
  const m = t().alignMethod[p.manual ? "manual" : T.method] || t().alignMethod.none;
  $("align-method").textContent = m(T.support || 0);
  $("al-dx").value = (T.tx / MM).toFixed(2);
  $("al-dy").value = (T.ty / MM).toFixed(2);
  $("al-s").value = (T.s * 100).toFixed(2);
}
const readAlign = () => {
  const dx = parseFloat(String($("al-dx").value).replace(",", ".")) || 0;
  const dy = parseFloat(String($("al-dy").value).replace(",", ".")) || 0;
  const s = (parseFloat(String($("al-s").value).replace(",", ".")) || 100) / 100;
  return { s: Math.min(Math.max(s, 0.2), 5), tx: dx * MM, ty: dy * MM, method: "manual", support: 0 };
};
async function applyAlign(T, all = false) {
  const targets = all ? state.pairs.filter(p => p.a !== null && p.b !== null) : [state.pairs[state.cur]];
  for (const p of targets) {
    p.T = { ...T }; p.manual = T.method === "manual";
    freeHeavy(heavy.get(p.id)); heavy.delete(p.id);
    if (all && p !== state.pairs[state.cur]) p.status = "pending";
  }
  await reanalyze(state.pairs[state.cur]);
  if (all) {
    const run = state.run;
    for (const p of targets) {
      if (p === state.pairs[state.cur]) continue;
      const h = await analyzePair(p, run);
      freeHeavy(h);
      renderPairsList(); renderChanges(); renderSummary();
    }
  }
  if ($("pop-align").hidden === false) fillAlign();
}
document.querySelectorAll("[data-nudge]").forEach(b => b.addEventListener("click", e => {
  const [dx, dy] = b.dataset.nudge.split(",").map(Number);
  const step = e.shiftKey ? 2 : 0.5;
  const T = readAlign();
  T.tx += dx * step * MM; T.ty += dy * step * MM;
  $("al-dx").value = (T.tx / MM).toFixed(2);
  $("al-dy").value = (T.ty / MM).toFixed(2);
  applyAlign(T);
}));
$("al-apply").addEventListener("click", () => applyAlign(readAlign()));
$("al-all").addEventListener("click", () => applyAlign(readAlign(), true));
$("al-none").addEventListener("click", () => { const T = { s: 1, tx: 0, ty: 0, method: "manual", support: 0 }; applyAlign(T).then(fillAlign); });
$("al-auto").addEventListener("click", async () => {
  const p = state.pairs[state.cur];
  p.manual = false;
  p.T = await autoAlign(state.A, p.a, state.B, p.b);
  freeHeavy(heavy.get(p.id)); heavy.delete(p.id);
  await reanalyze(p);
  fillAlign();
});
["al-dx", "al-dy", "al-s"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") applyAlign(readAlign()); }));

// ---------------------------------------------------------------- Exports
function exportLabels() {
  const x = t(), e = x.export;
  const isText = state.opts.mode === "text";
  const pages = (D, idx) => idx.length === D.n ? x.allPages : idx.length > 12 ? `${idx.length}` : idx.map(i => i + 1).join(", ");
  const now = new Intl.DateTimeFormat(x.locale, { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const nChanges = p => isText ? p.changeIds?.size || 0 : p.zones.length;
  const stateColor = p => ({ same: [0.34, 0.43, 0.49], mod: [0.6, 0.36, 0], add: hexToRgb(state.opts.colAdd).map(v => v / 320), del: hexToRgb(state.opts.colDel).map(v => v / 320) })[p.status] || [0.34, 0.43, 0.49];
  return {
    docTitle: e.docTitle,
    generated: e.generated(now),
    oldTag: e.oldTag, newTag: e.newTag,
    fileExtra: (D, idx) => `${x.fileMeta(D.n, fmtBytes(D.size, x.locale))} · ${e.compared} : ${pages(D, idx)}`,
    stats: () => {
      const c = counts();
      return [
        { value: c.pairs, label: x.stats.pairs(c.pairs) },
        { value: c.mod, label: x.stats.mod(c.mod), color: [167, 98, 0] },
        { value: `${c.add} / ${c.del}`, label: `${x.stats.add(c.add)} / ${x.stats.del(c.del)}` },
        { value: c.zones, label: (isText ? x.stats.changes : x.stats.zones)(c.zones), color: [220, 133, 5] }
      ];
    },
    settings: () => {
      const o = state.analyzed || state.opts;
      const parts = [isText ? e.modeText : e.modeVisual];
      if (!isText) parts.push(e.tol(nf(+o.tol, 2)), o.align ? e.alignOn : e.alignOff);
      parts.push(o.detect ? e.detectOn : e.detectOff);
      if (isText && o.ignoreCase) parts.push(e.ignoreCase);
      if (isText && o.skipMargins) parts.push(e.skipMargins);
      const lines = [parts.join(" · ")];
      if (!state.opts.includeSame && counts().same) lines.push(e.shown);
      return lines;
    },
    pagesTableTitle: e.pagesTableTitle,
    colOld: e.colOld, colNew: e.colNew, colState: e.colState, colZones: e.colZones, colAlign: e.colAlign, colChanges: e.colChanges,
    pairCells: p => {
      const cells = [p.a !== null ? String(p.a + 1) : "—", p.b !== null ? String(p.b + 1) : "—", x.state[p.status]];
      const n = nChanges(p);
      cells.push(p.status === "mod" ? (isText ? x.textChanges(n) : x.zones(n)) : "");
      if (!isText) cells.push(p.T ? alignText(p) : "");
      return cells;
    },
    stateColor,
    pairTitle: p => `${x.pairLabel(p)} · ${x.state[p.status]}`,
    pairSub: p => {
      const n = nChanges(p);
      const parts = [isText ? x.textChanges(n) : x.zones(n)];
      if (!isText && p.T && p.a !== null && p.b !== null) parts.push(alignText(p));
      return parts.join(" · ");
    },
    legendDel: x.legend.del, legendAdd: x.legend.add, legendSame: x.legend.same,
    legendDelText: x.legend.delText, legendAddText: x.legend.addText,
    changesTitle: e.changesTitle,
    colN: e.colN, colType: e.colType, colPages: e.colPages, colOldText: e.colOldText, colNewText: e.colNewText,
    changeRows: () => changeRows()
  };
}
function changeRows() {
  const x = t();
  const rows = [];
  if (state.opts.mode === "text" && state.text) {
    for (const c of state.text.changes) {
      rows.push({
        n: c.n, type: x.kind[c.kind],
        pages: [c.pageA !== null && c.pageA !== undefined ? `${x.oldShort} ${c.pageA + 1}` : "", c.pageB !== null && c.pageB !== undefined ? `${x.newShort} ${c.pageB + 1}` : ""].filter(Boolean).join(" / "),
        pageA: c.pageA, pageB: c.pageB, zone: "", oldText: c.oldText, newText: c.newText, x: "", y: ""
      });
    }
  } else {
    let n = 0;
    state.pairs.forEach(p => p.zones.forEach((z, zi) => {
      const [o, nw, mv] = itemText({ type: "zone", z });
      rows.push({
        n: ++n, type: x.kind[z.kind],
        pages: [p.a !== null ? `${x.oldShort} ${p.a + 1}` : "", p.b !== null ? `${x.newShort} ${p.b + 1}` : ""].filter(Boolean).join(" / ") + ` · #${zi + 1}`,
        pageA: p.a, pageB: p.b, zone: zi + 1,
        oldText: o || (z.text.length ? "" : x.graphic), newText: [nw, mv && `(${x.moved} ${mv})`].filter(Boolean).join(" "),
        x: nf((z.x0 + z.x1) / 2 / MM, 0), y: nf((z.y0 + z.y1) / 2 / MM, 0)
      });
    }));
  }
  return rows;
}
const baseName = () => `${safeName(state.B?.name || "document")}_${t().fileSuffix}`;

async function rasterPair(p) {
  const r = await renderPair(state.A, p.a, state.B, p.b, p.T || { s: 1, tx: 0, ty: 0 }, Math.min(resOf(), 2600));
  const m = diffMasks(r, tolOf());
  const view = p.a !== null && p.b !== null ? "overlay" : p.a !== null ? "old" : "new";
  const c = imgCanvas(compose(r, m, { colDel: hexToRgb(state.opts.colDel), colAdd: hexToRgb(state.opts.colAdd), fade: state.opts.fade, thick: state.opts.thick, view }));
  const bytes = await canvasJpeg(c);
  dropCanvas(c); dropCanvas(r.cA); dropCanvas(r.cB);
  return { bytes };
}
async function rasterPage(D, idx) {
  const inf = await D.info(idx);
  const c = await renderPage(await D.page(idx), { scale: 2000 / Math.max(inf.w, inf.h) });
  const bytes = await canvasJpeg(c);
  dropCanvas(c);
  return { bytes };
}
const canvasJpeg = c => new Promise(res => c.toBlob(async b => res(new Uint8Array(await b.arrayBuffer())), "image/jpeg", 0.86));

$("export-pdf").addEventListener("click", async () => {
  if (!state.pairs.length || state.busy) return;
  const btn = $("export-pdf");
  btn.disabled = true;
  const x = t();
  const o = state.opts;
  try {
    const job = {
      mode: o.mode, A: state.A, B: state.B, idxA: state.idxA, idxB: state.idxB,
      pairs: state.pairs,
      opts: {
        summary: o.summary, includeSame: o.includeSame, zones: o.exportZones, vector: o.vector === "1",
        colDel: hexToRgb(o.colDel), colAdd: hexToRgb(o.colAdd)
      },
      labels: exportLabels(),
      rasterPair, rasterPage
    };
    status(x.exporting(0, state.pairs.length), { busy: true });
    const blob = await exportPdf(job, (i, n) => { status(t().exporting(i, n), { busy: true }); progress(i, n); });
    const name = `${baseName()}.pdf`;
    download(blob, name);
    status(x.exported(name, fmtBytes(blob.size, x.locale)));
  } catch (err) {
    console.error(err);
    status(x.exportFail, { warn: true });
  } finally {
    progress(0, 0);
    btn.disabled = false;
  }
});
$("export-csv").addEventListener("click", () => {
  const x = t();
  const rows = changeRows().map(r => [r.n, r.type, r.pageA !== null && r.pageA !== undefined ? r.pageA + 1 : "", r.pageB !== null && r.pageB !== undefined ? r.pageB + 1 : "", r.zone, r.oldText, r.newText, r.x, r.y]);
  const name = `${baseName()}.csv`;
  download(exportCsv(rows, x.csv), name);
  status(x.csvDone(name));
});
document.addEventListener("click", e => {
  const d = $("export-opts");
  if (d.open && !d.contains(e.target)) d.open = false;
  const insidePop = e.target.closest(".pc-pop, #pair-label, #align-btn");
  if (!insidePop && (!$("pop-pair").hidden || !$("pop-align").hidden)) closePops();
});

// ---------------------------------------------------------------- Langue
document.addEventListener("langchange", () => {
  renderOpts();
  renderSlot("a"); renderSlot("b");
  if (!state.analyzed && !state.busy) updateCompareBtn();
  if (state.pairs.length) {
    renderAll();
    showPair(state.cur, { keepView: true });
  }
});

// ---------------------------------------------------------------- Démarrage
renderOpts();
renderSlot("a"); renderSlot("b");
updateCompareBtn();
renderLegend();
