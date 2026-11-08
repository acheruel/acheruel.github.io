// Comparateur PDF vers Markdown (prototype) : résultats du banc d'essai, puis sorties côte à côte
// avec la page du PDF. Les sorties des exemples sont précalculées (donnees/) ; pour un PDF déposé,
// MarkDownO (structure et OCR) et MarkItDown tournent dans le navigateur.
import { openPdf, readFile, looksLikePdf, renderPage, dropCanvas, esc } from "../../commun/pdf-outils.js";
import { renderMarkdown } from "../../commun/markdown.js";

const $ = id => document.getElementById(id);
const DATA = new URL("donnees/", import.meta.url);
const OWN = "own";

const TXT = {
  fr: {
    locale: "fr-CA",
    sub: d => `${d.docs.length} manuels de la FHWA, extraits de ${d.docs.map(x => x.pagesSample).join(" et ")} pages choisies pour leurs tableaux, figures et équations ; vitesse aussi mesurée sur les documents complets. Mesures du ${d.date}.`,
    both: "Les deux", pages: n => `${n} p.`,
    cols: ["Outil", "Où", "Vitesse", "Texte", "Titres", "Tableaux", "Équations", "Figures", "Questions RAG", "Jetons"],
    colHints: ["", "Navigateur ou Python sur un poste", "Secondes par page (extrait) ; document complet en dessous", "Mots du PDF retrouvés", "Titres du sommaire retrouvés comme titres Markdown", "Lignes de tableau retrouvées entières dans une ligne de tableau ; valeurs présentes n'importe où en dessous", "Équations dessinées en image, lues", "Images de figures extraites et liées ; légendes retrouvées en dessous", "Fait retrouvé dans les 3 meilleurs morceaux d'une recherche par mots-clés", "Taille pour une IA (jetons o200k, tiktoken)"],
    browser: "navigateur", python: "Python", java: "Java",
    full: (s, p) => `complet : ${fmtS(s)} (${p} p.)`,
    present: n => `valeurs : ${n}`,
    captions: n => `légendes : ${n}`,
    notRun: "non mesuré",
    perPage: s => `${s < 0.1 ? s.toFixed(3) : s.toFixed(2)} s/p.`,
    own: "Votre PDF…", ownLoaded: name => `Votre PDF : ${name}`,
    live: "en direct", loadingMd: "Chargement…",
    reading: (i, n) => `MarkDownO lit la page ${i} sur ${n}…`,
    ocring: (i, n) => `MarkDownO : OCR des zones en image, ${i + 1} sur ${n}…`,
    convertoDone: s => `MarkDownO : ${fmtS(s)}.`,
    engineLoad: "Chargement de MarkItDown (Python dans le navigateur, environ 30 Mo, une seule fois)…",
    engineRun: "MarkItDown convertit le PDF…",
    engineDone: s => `MarkItDown : ${fmtS(s)}.`,
    engineFail: e => `MarkItDown n'a pas pu convertir : ${e}`,
    pickMarkitdown: "MarkItDown (lancer)",
    notPdf: name => `« ${name} » n'est pas un PDF.`,
    openFail: name => `Impossible d'ouvrir « ${name} ».`,
    stats: s => [s.time != null ? fmtS(s.time) : null, `${fmtN(s.chars)} car.`, `≈ ${fmtN(s.tokens)} jetons`, `${s.headings} titres`, `${s.tables} tableaux`, `${s.images} images`].filter(Boolean).join(" · "),
    notFound: "Passage de cette page non retrouvé dans cette sortie.",
    noPage: "Aucun texte sur cette page (image ou page numérisée).",
    ready: "Choisissez une page ou déposez votre PDF.",
    method: [
      "<b>Documents</b> : <a href=\"https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf\" target=\"_blank\" rel=\"noopener\">FHWA-HIF-18-046</a> (analyse raffinée des ponts, 709 pages : tableaux vectoriels, cellules fusionnées, équations en image) et <a href=\"https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf\" target=\"_blank\" rel=\"noopener\">FHWA-IF-12-027</a> (dalles orthotropes, 291 pages : <b>tableaux insérés comme images</b>). Les extraits gardent les signets du PDF.",
      "<b>Vérité terrain</b> : 11 tableaux, 33 lignes de cellules relevées à l'œil sur les pages rendues ; 3 équations ; 15 questions de fait. Les titres attendus sont ceux du sommaire du PDF.",
      "<b>Tableaux</b> : une ligne compte si toutes ses valeurs sont dans <i>une même</i> ligne de tableau de la sortie (Markdown ou HTML). « Valeurs » : présentes n'importe où, même en vrac.",
      "<b>Questions RAG</b> : la sortie est coupée en morceaux d'environ 1 200 caractères, comme dans un assistant qui cherche dans un document ; la réponse doit être dans un des 3 morceaux les mieux classés (BM25) pour la question.",
      "<b>Vitesse</b> : sans carte graphique. MarkDownO, Converto 1.1 et Docling mesurés sur un portable (Intel i5-1335U, 16 Go), les autres sur une machine à 4 cœurs ; Converto prend le même temps sur les deux. Marker et Granite-Docling (Parsade) n'ont pas fini sur ce portable. Les scripts du banc d'essai sont dans <a href=\"https://github.com/acheruel/acheruel.github.io/tree/main/outils/markdowno/banc\" target=\"_blank\" rel=\"noopener\">outils/markdowno/banc</a>, pour rejouer les tests ou en ajouter un outil."
    ]
  },
  en: {
    locale: "en-CA",
    sub: d => `${d.docs.length} FHWA manuals, excerpts of ${d.docs.map(x => x.pagesSample).join(" and ")} pages picked for their tables, figures and equations; speed also measured on the full documents. Measured on ${d.date}.`,
    both: "Both", pages: n => `${n} p.`,
    cols: ["Tool", "Where", "Speed", "Text", "Headings", "Tables", "Equations", "Figures", "RAG questions", "Tokens"],
    colHints: ["", "Browser or Python on a computer", "Seconds per page (excerpt); full document below", "PDF words found", "Table of contents headings found as Markdown headings", "Table rows found whole in one table row; values present anywhere below", "Equations drawn as images, read", "Figure images extracted and linked; captions found below", "Fact found in the top 3 chunks of a keyword search", "Size for an AI (o200k tokens, tiktoken)"],
    browser: "browser", python: "Python", java: "Java",
    full: (s, p) => `full: ${fmtS(s)} (${p} p.)`,
    present: n => `values: ${n}`,
    captions: n => `captions: ${n}`,
    notRun: "not measured",
    perPage: s => `${s < 0.1 ? s.toFixed(3) : s.toFixed(2)} s/p.`,
    own: "Your PDF…", ownLoaded: name => `Your PDF: ${name}`,
    live: "live", loadingMd: "Loading…",
    reading: (i, n) => `MarkDownO is reading page ${i} of ${n}…`,
    ocring: (i, n) => `MarkDownO: OCR of image areas, ${i + 1} of ${n}…`,
    convertoDone: s => `MarkDownO: ${fmtS(s)}.`,
    engineLoad: "Loading MarkItDown (Python in the browser, about 30 MB, only once)…",
    engineRun: "MarkItDown is converting the PDF…",
    engineDone: s => `MarkItDown: ${fmtS(s)}.`,
    engineFail: e => `MarkItDown could not convert: ${e}`,
    pickMarkitdown: "MarkItDown (run)",
    notPdf: name => `"${name}" is not a PDF.`,
    openFail: name => `Could not open "${name}".`,
    stats: s => [s.time != null ? fmtS(s.time) : null, `${fmtN(s.chars)} chars`, `≈ ${fmtN(s.tokens)} tokens`, `${s.headings} headings`, `${s.tables} tables`, `${s.images} images`].filter(Boolean).join(" · "),
    notFound: "This page's passage was not found in this output.",
    noPage: "No text on this page (image or scanned page).",
    ready: "Pick a page or drop your PDF.",
    method: [
      "<b>Documents</b>: <a href=\"https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf\" target=\"_blank\" rel=\"noopener\">FHWA-HIF-18-046</a> (refined bridge analysis, 709 pages: vector tables, merged cells, equations as images) and <a href=\"https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf\" target=\"_blank\" rel=\"noopener\">FHWA-IF-12-027</a> (orthotropic decks, 291 pages: <b>tables inserted as images</b>). The excerpts keep the PDF bookmarks.",
      "<b>Ground truth</b>: 11 tables, 33 cell rows read by eye on the rendered pages; 3 equations; 15 fact questions. Expected headings are the PDF's table of contents.",
      "<b>Tables</b>: a row counts if all its values are in <i>one</i> table row of the output (Markdown or HTML). \"Values\": present anywhere, even jumbled.",
      "<b>RAG questions</b>: the output is cut into chunks of about 1,200 characters, as an assistant searching a document does; the answer must be in one of the 3 best-ranked chunks (BM25) for the question.",
      "<b>Speed</b>: no GPU. MarkDownO, Converto 1.1 and Docling measured on a laptop (Intel i5-1335U, 16 GB), the others on a 4-core machine; Converto takes the same time on both. Marker and Granite-Docling (Parsade) did not finish on this laptop. The test scripts are in <a href=\"https://github.com/acheruel/acheruel.github.io/tree/main/outils/markdowno/banc\" target=\"_blank\" rel=\"noopener\">outils/markdowno/banc</a>, to replay the tests or add a tool."
    ]
  }
};
const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
const t = () => TXT[lang()];
const L = v => (v && typeof v === "object" && !Array.isArray(v) ? v[lang()] ?? v.fr : v);
const fmtN = n => new Intl.NumberFormat(t().locale).format(Math.round(n));
const fmtS = s => (s < 60 ? `${s < 10 ? s.toFixed(1) : Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`);
const status = (msg, warn = false) => { $("status").textContent = msg; $("status").classList.toggle("is-warn", warn); };

const state = {
  data: null, resDoc: "all",
  doc: null, pdf: null, page: 1, view: "render",
  tools: ["markdowno", "docling"],
  md: new Map(),      // `${doc}|${tool}` → { md, time }
  own: null           // { name, bytes, pdf, outputs: Map(tool → { md, time }) }
};

// ---------------------------------------------------------------- Résultats
function sumDocs(tool) {
  const sc = state.data.scores[tool];
  if (!sc) return null;
  const docs = state.resDoc === "all" ? state.data.docs.map(d => d.id) : [state.resDoc];
  const rows = docs.map(d => sc[d]).filter(Boolean);
  if (!rows.length) return null;
  const add = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const pairs = k => [add(k + "_ok"), add(k + "_n")];
  return {
    perPage: add("seconds") / add("pages"),
    full: rows.every(r => r.full_seconds) ? [add("full_seconds"), add("full_pages")] : null,
    recall: rows.reduce((a, r) => a + r.text_recall * r.words, 0) / add("words"),
    headings: pairs("headings"), tables: pairs("tables"), present: pairs("present"),
    equations: pairs("equations"), images: add("images"), figures: add("figures_n"), captions: pairs("captions"),
    rag: pairs("rag"), tokens: add("tokens")
  };
}

function renderResults() {
  const d = state.data, x = t();
  $("res-sub").textContent = x.sub(d);
  const seg = $("res-doc");
  const opts = [["all", x.both], ...d.docs.map(doc => [doc.id, `${doc.short} · ${x.pages(doc.pagesFull)}`])];
  seg.innerHTML = opts.map(([v, label]) => `<button type="button" role="radio" data-value="${v}" aria-checked="${v === state.resDoc}" class="${v === state.resDoc ? "selected" : ""}">${esc(label)}</button>`).join("");

  const sums = new Map(d.tools.map(tl => [tl.id, sumDocs(tl.id)]));
  const best = (fn, hi = true) => {
    const vals = [...sums.values()].filter(Boolean).map(fn).filter(v => v != null && !Number.isNaN(v));
    return hi ? Math.max(...vals) : Math.min(...vals);
  };
  const ratio = p => (p && p[1] ? p[0] / p[1] : null);
  const B = {
    speed: best(s => s.perPage, false), recall: best(s => s.recall), headings: best(s => ratio(s.headings)),
    tables: best(s => ratio(s.tables)), equations: best(s => ratio(s.equations)), images: best(s => s.images),
    rag: best(s => ratio(s.rag))
  };
  const cell = (v, isBest, sub = "") => `<td class="${isBest ? "is-best" : ""}"><span class="cmp-v">${v}</span>${sub ? `<small>${sub}</small>` : ""}</td>`;
  const frac = p => (p && p[1] ? `${p[0]}/${p[1]}` : "–");
  const bar = p => (p && p[1] ? `<i class="cmp-bar" style="--w:${Math.round(100 * p[0] / p[1])}%"></i>` : "");

  let html = `<thead><tr>${x.cols.map((c, i) => `<th scope="col" title="${esc(x.colHints[i])}">${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
  for (const tl of d.tools) {
    const s = sums.get(tl.id);
    const where = tl.where === "browser" ? x.browser : tl.where === "java" ? x.java : x.python;
    const head = `<th scope="row"><span class="cmp-tname">${esc(tl.name)}</span><small>${esc(L(tl.engine))}${tl.license ? ` · ${esc(tl.license)}` : ""}</small>${tl.note ? `<span class="cmp-note">${esc(L(tl.note))}</span>` : ""}</th>`;
    const whereCell = `<td><span class="chip ${tl.where === "browser" ? "chip-same" : "chip-add"}">${esc(where)}</span></td>`;
    if (!s) {
      html += `<tr class="is-off">${head}${whereCell}<td colspan="8"><span class="cmp-off">${esc(x.notRun)}</span> ${esc(L(tl.why) || "")}</td></tr>`;
      continue;
    }
    html += `<tr>${head}${whereCell}`;
    html += cell(x.perPage(s.perPage), Math.abs(s.perPage - B.speed) < 1e-9, s.full ? x.full(s.full[0], s.full[1]) : "");
    html += cell(`${(100 * s.recall).toFixed(1)} %`, Math.abs(s.recall - B.recall) < 5e-4);
    html += cell(frac(s.headings) + bar(s.headings), ratio(s.headings) === B.headings);
    html += cell(frac(s.tables) + bar(s.tables), ratio(s.tables) === B.tables, x.present(frac(s.present)));
    html += cell(s.equations[1] ? frac(s.equations) : "–", s.equations[1] && ratio(s.equations) === B.equations);
    html += cell(fmtN(s.images), s.images === B.images && s.images > 0, x.captions(frac(s.captions)));
    html += cell(frac(s.rag) + bar(s.rag), ratio(s.rag) === B.rag);
    html += cell(fmtN(s.tokens), false);
    html += "</tr>";
  }
  $("res-table").innerHTML = html + "</tbody>";
  $("method").innerHTML = x.method.map(p => `<p>${p}</p>`).join("");
}
$("res-doc").addEventListener("click", e => {
  const b = e.target.closest("button[data-value]");
  if (!b) return;
  state.resDoc = b.dataset.value;
  renderResults();
});

// ---------------------------------------------------------------- Documents et outils
function docList() {
  const x = t();
  const list = state.data.docs.map(d => ({ id: d.id, label: `${d.short} · ${L(d.title)} (${x.pages(d.pagesSample)})` }));
  list.push({ id: OWN, label: state.own ? x.ownLoaded(state.own.name) : x.own });
  return list;
}
function toolsFor(doc) {
  const x = t();
  if (doc === OWN) {
    const out = [{ id: "markdowno", label: `MarkDownO (${x.live})` }];
    out.push({ id: "markitdown", label: state.own?.outputs.has("markitdown") ? `MarkItDown (${x.live})` : x.pickMarkitdown });
    return out;
  }
  return state.data.tools.filter(tl => state.data.scores[tl.id]?.[doc]).map(tl => ({ id: tl.id, label: tl.name }));
}
function renderControls() {
  $("doc").innerHTML = docList().map(o => `<option value="${o.id}"${o.id === state.doc ? " selected" : ""}>${esc(o.label)}</option>`).join("");
  const tools = toolsFor(state.doc);
  document.querySelectorAll(".cmp-pane[data-pane]").forEach((pane, k) => {
    if (!tools.some(o => o.id === state.tools[k])) state.tools[k] = tools[Math.min(k, tools.length - 1)].id;
    pane.querySelector(".cmp-tool").innerHTML = tools.map(o => `<option value="${o.id}"${o.id === state.tools[k] ? " selected" : ""}>${esc(o.label)}</option>`).join("");
  });
  const n = state.pdf ? state.pdf.numPages : 1;
  $("page").max = n;
  $("page").value = state.page;
  $("page-of").textContent = `/ ${n}`;
  $("prev").disabled = state.page <= 1;
  $("next").disabled = state.page >= n;
  document.querySelectorAll("#view button").forEach(b => {
    const on = b.dataset.value === state.view;
    b.classList.toggle("selected", on);
    b.setAttribute("aria-checked", on);
  });
}

async function loadDoc(id) {
  state.doc = id;
  state.page = 1;
  let pdf;
  if (id === OWN) pdf = state.own.pdf;
  else {
    const d = state.data.docs.find(x => x.id === id);
    const bytes = new Uint8Array(await (await fetch(new URL(d.pdf, DATA))).arrayBuffer());
    pdf = await openPdf(bytes);
  }
  if (state.pdf && state.pdf !== pdf && state.pdf !== state.own?.pdf) closePdf(state.pdf);
  state.pdf = pdf;
  pageText.clear();
  renderControls();
  await Promise.all([showPage(), ...[0, 1].map(k => showPane(k))]);
  syncPanes();
}

async function getOutput(doc, tool) {
  if (doc === OWN) return state.own.outputs.get(tool) || null;
  const key = `${doc}|${tool}`;
  if (!state.md.has(key)) {
    const r = await fetch(new URL(`sorties/${tool}/${doc}.md`, DATA));
    const md = r.ok ? await r.text() : "";
    state.md.set(key, { md, time: state.data.scores[tool]?.[doc]?.seconds ?? null });
  }
  return state.md.get(key);
}

function mdStats(md, time) {
  const heads = (md.match(/^#{1,6}\s/gm) || []).length;
  const mdTables = (md.match(/^\|.*\|\s*\n\|[\s:|-]+\|\s*$/gm) || []).length;
  const htmlTables = (md.match(/<table\b/gi) || []).length;
  const images = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length + (md.match(/<!-- image -->/g) || []).length;
  return { time, chars: md.length, tokens: md.length / 4, headings: heads, tables: mdTables + htmlTables, images };
}

const paneToken = [0, 0];
async function showPane(k) {
  const pane = document.querySelector(`.cmp-pane[data-pane="${k}"]`);
  const body = pane.querySelector(".md-preview");
  const token = ++paneToken[k];
  const tool = state.tools[k];
  if (state.doc === OWN && tool === "markitdown" && !state.own.outputs.has("markitdown")) {
    // Le moteur pèse environ 30 Mo : lancé seulement à la demande.
    pane.querySelector(".cmp-stats").textContent = "";
    body.innerHTML = `<div class="cmp-msg"><p>${esc(t().engineLoad.replace(/…$/, "."))}</p><button type="button" class="btn btn-primary">${esc(t().pickMarkitdown)}</button></div>`;
    body.querySelector("button").addEventListener("click", () => {
      body.innerHTML = `<p class="cmp-msg">${esc(t().engineLoad)}</p>`;
      runMarkitdown().then(() => { if (token === paneToken[k]) showPane(k).then(syncPanes); });
    });
    return;
  }
  body.innerHTML = `<p class="cmp-msg">${esc(t().loadingMd)}</p>`;
  const out = await getOutput(state.doc, tool);
  if (token !== paneToken[k]) return;
  const md = out?.md || "";
  pane.querySelector(".cmp-stats").textContent = t().stats(mdStats(md, out?.time ?? null));
  body.replaceChildren();
  body.classList.toggle("is-source", state.view === "source");
  if (state.view === "source") {
    // Un bloc par paragraphe : permet de se placer sur le passage d'une page.
    const frag = document.createDocumentFragment();
    for (const para of md.split(/\n{2,}/)) {
      const p = document.createElement("pre");
      p.className = "md-source";
      p.textContent = para;
      frag.append(p);
    }
    body.append(frag);
  } else {
    body.append(await renderMarkdown(md));
  }
  body._index = null;
}

// ---------------------------------------------------------------- Page du PDF et synchronisation
const closePdf = pdf => { try { (pdf.loadingTask || pdf).destroy?.(); } catch { /* déjà fermé */ } };
let renderToken = 0;
async function showPage() {
  if (!state.pdf) return;
  const token = ++renderToken;
  const page = await state.pdf.getPage(state.page);
  const box = $("pdf-body");
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, Math.max(0.5, (box.clientWidth - 2) / vp.width)) * (window.devicePixelRatio || 1);
  const c = await renderPage(page, { scale });
  if (token !== renderToken) { dropCanvas(c); return; }
  c.id = "pdf-canvas";
  dropCanvas($("pdf-canvas"));
  $("pdf-canvas").replaceWith(c);
  const d = state.data.docs.find(x => x.id === state.doc);
  const orig = d?.pageNumbers?.[state.page - 1];
  $("pdf-meta").textContent = orig ? `${d.short} p. ${orig}` : "";
}

const norm = s => (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || []).join(" ");
const pageText = new Map();
async function anchorsOf(n) {
  if (!pageText.has(n)) {
    const page = await state.pdf.getPage(n);
    const tc = await page.getTextContent();
    // Lignes du flux pdf.js ; on garde les lignes longues (corps du texte), hors en-tête et pied.
    const lines = [];
    let cur = "";
    for (const it of tc.items) {
      cur += it.str;
      if (it.hasEOL) { lines.push(cur); cur = ""; } else cur += " ";
    }
    if (cur) lines.push(cur);
    const words = lines.map(l => norm(l).split(" ").filter(Boolean));
    const anchors = [];
    words.forEach((w, i) => {
      if (w.length >= 5 && i > 0) anchors.push(w.slice(0, 6).join(" "));
    });
    if (!anchors.length) words.forEach(w => { if (w.length >= 3) anchors.push(w.slice(0, 4).join(" ")); });
    pageText.set(n, anchors.slice(0, 12));
  }
  return pageText.get(n);
}

function blockIndex(body) {
  if (!body._index) {
    const els = [...body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre")];
    body._index = els.map(el => ({ el, text: norm(el.textContent) }));
  }
  return body._index;
}

async function syncPanes() {
  if (!state.pdf) return;
  const anchors = await anchorsOf(state.page);
  for (const pane of document.querySelectorAll(".cmp-pane[data-pane]")) {
    const body = pane.querySelector(".md-preview");
    const scroller = pane.querySelector(".cmp-pane-body");
    pane.querySelector(".cmp-miss")?.remove();
    if (!body.firstElementChild || body.querySelector(".cmp-msg")) continue;
    const idx = blockIndex(body);
    let hit = null;
    // Plusieurs occurrences possibles (sommaire, renvois) : on prend celle la plus proche de la
    // position attendue dans le document, d'après le numéro de page.
    const expect = (state.page - 1) / Math.max(1, state.pdf.numPages - 1);
    for (const a of anchors) {
      const found = idx.map((b, i) => (b.text.includes(a) ? i : -1)).filter(i => i >= 0);
      if (found.length) {
        hit = idx[found.sort((p, q) => Math.abs(p / idx.length - expect) - Math.abs(q / idx.length - expect))[0]].el;
        break;
      }
    }
    if (!hit) {
      const m = document.createElement("p");
      m.className = "cmp-miss";
      m.textContent = anchors.length ? t().notFound : t().noPage;
      pane.querySelector(".cmp-pane-head").after(m);
      continue;
    }
    const target = hit.closest("table") && hit.tagName === "TR" ? hit.closest("table") : hit;
    scroller.scrollTo({ top: target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12, behavior: "smooth" });
    target.classList.remove("cmp-hit");
    void target.offsetWidth;
    target.classList.add("cmp-hit");
  }
}

async function goPage(n) {
  if (!state.pdf) return;
  state.page = Math.min(state.pdf.numPages, Math.max(1, n | 0 || 1));
  renderControls();
  await showPage();
  syncPanes();
}
$("prev").addEventListener("click", () => goPage(state.page - 1));
$("next").addEventListener("click", () => goPage(state.page + 1));
$("page").addEventListener("change", e => goPage(+e.target.value));
document.addEventListener("keydown", e => {
  if (e.target.closest("input, select, textarea")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown") goPage(state.page + 1);
  if (e.key === "ArrowLeft" || e.key === "PageUp") goPage(state.page - 1);
});
$("doc").addEventListener("change", e => {
  if (e.target.value === OWN && !state.own) { e.target.value = state.doc; $("file-input").click(); return; }
  loadDoc(e.target.value);
});
document.querySelectorAll(".cmp-tool").forEach((sel, k) => sel.addEventListener("change", async () => {
  state.tools[k] = sel.value;
  await showPane(k);
  syncPanes();
}));
$("view").addEventListener("click", async e => {
  const b = e.target.closest("button[data-value]");
  if (!b || b.dataset.value === state.view) return;
  state.view = b.dataset.value;
  renderControls();
  await Promise.all([0, 1].map(k => showPane(k)));
  syncPanes();
});

// ---------------------------------------------------------------- Votre PDF (moteurs du navigateur)
$("pick").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", e => { if (e.target.files[0]) loadOwn(e.target.files[0]); e.target.value = ""; });
document.body.addEventListener("dragover", e => e.preventDefault());
document.body.addEventListener("drop", e => {
  e.preventDefault();
  const f = [...e.dataTransfer.files].find(x => /\.pdf$/i.test(x.name)) || e.dataTransfer.files[0];
  if (f) loadOwn(f);
});

async function loadOwn(file) {
  const x = t();
  const bytes = await readFile(file);
  if (!looksLikePdf(bytes)) { status(x.notPdf(file.name), true); return; }
  let pdf;
  try { pdf = await openPdf(bytes, null, { fontExtraProperties: true }); } catch { status(x.openFail(file.name), true); return; }
  if (state.own?.pdf && state.own.pdf !== state.pdf) closePdf(state.own.pdf);
  state.own = { name: file.name, bytes, pdf, outputs: new Map() };
  state.tools = ["markdowno", "markitdown"];
  // MarkDownO : le moteur PDF du site (structure de PDFo Converto, OCR des zones en image), chargé à la demande.
  const { convertPdf } = await import("../pdf.js");
  const t0 = performance.now();
  const r = await convertPdf(bytes, file.name, { ocr: "auto", figures: "text", split: "one", pageMarkers: false },
    { onStep: (k, i, n) => status(k === "ocr" ? x.ocring(i, n) : x.reading(i, n)) });
  const md = r.md;
  const time = (performance.now() - t0) / 1000;
  state.own.outputs.set("markdowno", { md, time });
  status(x.convertoDone(time));
  await loadDoc(OWN);
}

let worker = null, engineRun = null;
function runMarkitdown() {
  if (engineRun) return engineRun;
  const x = t();
  const own = state.own;
  status(x.engineLoad);
  engineRun = new Promise((resolve, reject) => {
    worker = worker || new Worker(new URL("../worker.js", import.meta.url));
    const t0 = performance.now();
    let started = 0;
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === "ready" && !started) { started = performance.now(); status(x.engineRun); }
      else if (m.type === "done") {
        const time = (performance.now() - (started || t0)) / 1000;
        own.outputs.set("markitdown", { md: m.markdown.replace(/\r\n/g, "\n"), time });
        status(x.engineDone(time));
        renderControls();
        resolve();
      } else if (m.type === "error" || m.type === "fatal") {
        status(x.engineFail(m.error), true);
        own.outputs.set("markitdown", { md: "", time: null });
        reject(new Error(m.error));
      }
    };
    worker.postMessage({ type: "init" });
    const copy = own.bytes.slice();
    worker.postMessage({ type: "convert", id: 1, name: own.name, bytes: copy }, [copy.buffer]);
  }).finally(() => { engineRun = null; });
  return engineRun.catch(() => {});
}

// ---------------------------------------------------------------- Démarrage
async function init() {
  state.data = await (await fetch(new URL("resultats.json", DATA))).json();
  renderResults();
  status(t().ready);
  await loadDoc(state.data.docs[0].id);
}
document.addEventListener("langchange", () => {
  if (!state.data) return;
  renderResults();
  renderControls();
  status(t().ready);
});
let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(showPage, 200); });
init().catch(err => status(String(err.message || err), true));
