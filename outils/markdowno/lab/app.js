import { download, zip, openPdf, renderPage, dropCanvas } from "../../commun/pdf-outils.js";
import { renderMarkdown } from "../../commun/markdown.js";
import { convertPDFo, convertMarkItDown, metrics, toBytes } from "./engines.js";

const $ = id => document.getElementById(id);
const NAMES = { pdfo: "PDFo · navigateur", markitdown: "MarkItDown 0.1.9 · Python", mdflux: "MDFlux · OCR + règles", pymupdf: "PyMuPDF 2.1 / 4LLM", docling: "Docling · OCR + tables" };
const reports = new Map(), panes = { a: null, b: null };
const tickets = { a: 0, b: 0 };
let corpus = [], selected, local = null, busy = false, revision = 0;
const objectUrls = new Set();
const blobUrl = blob => { const url = URL.createObjectURL(blob); objectUrls.add(url); return url; };
const status = (s, error = false) => { $("status").textContent = s; $("status").classList.toggle("error", error); };
const seconds = n => Number.isFinite(n) ? n.toFixed(3) + " s" : "—";
const safeAsset = path => !/^(?:[a-z]+:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(path);

function release() { for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); }
function lock(value) {
  busy = value;
  for (const id of ["corpus", "pdf", "engine-a", "engine-b", "run-a", "run-b", "import-a", "import-b"]) $(id).disabled = value;
}
function clearPane(side, message = "Choisissez un moteur.") {
  tickets[side]++;
  panes[side] = null; $("save-" + side).disabled = true;
  $("output-" + side).textContent = message; $("meta-" + side).textContent = "";
}
async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} : HTTP ${response.status}`);
  return response.json();
}
function engineOptions(localMode) {
  for (const side of ["a", "b"]) {
    const select = $("engine-" + side);
    select.replaceChildren();
    for (const [id, name] of Object.entries(NAMES)) {
      if (localMode && !["pdfo", "markitdown"].includes(id)) continue;
      select.add(new Option(localMode && id === "markitdown" ? "MarkItDown · navigateur (Pyodide)" : name, id));
    }
    select.value = side === "a" ? "pdfo" : localMode ? "markitdown" : "docling";
    $("run-" + side).hidden = !localMode;
  }
}
function renderMetrics() {
  $("metrics").replaceChildren();
  for (const [engine, name] of Object.entries(NAMES)) {
    const run = local ? null : reports.get(engine)?.runs.find(r => r.document === selected.id);
    const tr = document.createElement("tr");
    const values = [name, run?.status === "ok" ? seconds(run.seconds[0]) : run ? "Échec" : "Non mesuré", seconds(run?.warm_median_s), run?.characters ?? "—", run?.table_rows ?? "—", run?.image_links ?? "—"];
    for (const value of values) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
    $("metrics").append(tr);
  }
}
async function display(side, result, token) {
  if (token !== revision) return;
  panes[side] = result;
  $("meta-" + side).textContent = result.note;
  await renderPane(side, token);
  if (token === revision) $("save-" + side).disabled = false;
}
async function renderPane(side, token = revision) {
  const result = panes[side];
  if (!result) return;
  const output = $("output-" + side);
  const view = $("view").value;
  let content;
  if (view === "source") { content = document.createElement("pre"); content.textContent = result.markdown; }
  else content = await renderMarkdown(result.markdown, { images: result.images });
  if (token === revision && result === panes[side] && view === $("view").value) output.replaceChildren(content);
}
async function measured(side) {
  const token = revision, engine = $("engine-" + side).value;
  clearPane(side, "Chargement de la sortie…");
  const ticket = tickets[side];
  const run = reports.get(engine)?.runs.find(r => r.document === selected.id);
  if (!run || run.status !== "ok") { clearPane(side, run?.error || "Essai non disponible. Aucun résultat n’est simulé."); return; }
  try {
    const response = await fetch("data/" + run.output);
    if (!response.ok) throw new Error("Sortie introuvable");
    const markdown = await response.text();
    const base = new URL("data/" + run.output, location.href);
    const assets = [], images = new Map();
    for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const path = match[1];
      if (!safeAsset(path) || images.has(path)) continue;
      const r = await fetch(new URL(path, base));
      if (!r.ok) continue;
      const blob = await r.blob();
      if (token !== revision || ticket !== tickets[side]) return;
      assets.push({ path, bytes: new Uint8Array(await blob.arrayBuffer()) });
      images.set(path, blobUrl(blob));
    }
    if (token !== revision || ticket !== tickets[side]) return;
    await display(side, { markdown, assets, images, engine, run,
      note: `${run.characters.toLocaleString("fr")} caractères · médiane ${seconds(run.warm_median_s)} · ${run.image_links} images liées · extrait complet` }, token);
  } catch (e) { if (token === revision && ticket === tickets[side]) clearPane(side, e.message); }
}
async function selectCorpus() {
  revision++; release(); local = null; $("pdf").value = "";
  selected = corpus.find(c => c.id === $("corpus").value);
  engineOptions(false); renderMetrics();
  $("provenance").textContent = selected.url ? `${selected.title} · ${selected.pages.length} pages sélectionnées sur ${selected.original_pages} : ${selected.pages.join(", ")} (numéros physiques du PDF).` : selected.title + " · cas contrôlé généré pour cet essai.";
  $("source-pdf").href = "data/" + selected.id + ".pdf";
  $("page").replaceChildren(...selected.pages.map((n, i) => new Option("Page " + n, i)));
  showReference();
  status("Résultats enregistrés. Comparez les sorties à la page source.");
  await Promise.all([measured("a"), measured("b")]);
}
function showReference() {
  $("reference").hidden = false;
  $("reference").src = local ? local.previews[Number($("page").value)] : `data/${selected.id}-${Number($("page").value) + 1}.png`;
}
async function loadLocal(file) {
  if (!file) return;
  lock(true); status("Lecture du PDF local…");
  let pdf;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("Choisissez un extrait de 20 Mo au maximum.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdf = await openPdf(bytes);
    if (pdf.numPages > 30) throw new Error("Choisissez un extrait de 30 pages au maximum.");
    const previews = [];
    // Render before replacing the existing state, so a failed upload preserves it.
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await renderPage(await pdf.getPage(i), { scale: 1 });
      previews.push(new Blob([await toBytes(canvas, "image/png")], { type: "image/png" }));
      dropCanvas(canvas);
    }
    revision++; release();
    local = { bytes, name: file.name, previews: previews.map(blobUrl) };
    selected = { id: "local", title: file.name, pages: Array.from({ length: pdf.numPages }, (_, i) => i + 1) };
    engineOptions(true); renderMetrics();
    $("source-pdf").href = blobUrl(file);
    $("provenance").textContent = `${file.name} · ${pdf.numPages} pages · conversion locale. Pour Docling / PyMuPDF / MDFlux : utilisez le script du protocole puis importez le Markdown.`;
    $("page").replaceChildren(...selected.pages.map((n, i) => new Option("Page " + n, i)));
    showReference();
    for (const side of ["a", "b"]) clearPane(side, "Cliquez sur Convertir. Les deux moteurs s’exécutent séparément.");
    status("PDF prêt. MarkItDown télécharge Python et ses paquets au premier lancement ; votre PDF reste local.");
  } catch (e) { status(e.message, true); $("pdf").value = ""; }
  finally { if (pdf) await pdf.loadingTask.destroy(); lock(false); }
}
async function runLocal(side) {
  if (!local || busy) return;
  const token = revision, engine = $("engine-" + side).value;
  lock(true); clearPane(side, "Conversion en cours…");
  try {
    const progress = (i, n) => status(`${engine === "pdfo" ? "Pages" : "Chargement Python"} : ${i}/${n}`);
    const result = await (engine === "pdfo" ? convertPDFo : convertMarkItDown)(local.bytes, progress);
    const images = new Map(result.assets.map(a => [a.path, blobUrl(new Blob([a.bytes], { type: a.type }))]));
    await display(side, { ...result, images, engine,
      note: `${seconds(result.seconds)} · ${result.characters.toLocaleString("fr")} caractères · ${result.image_links} images liées${result.startup_s ? ` · démarrage ${seconds(result.startup_s)} en plus` : ""} · une seule passe` }, token);
    status("Conversion terminée. Contrôlez les tableaux et les images avant l’export.");
  } catch (e) { clearPane(side, e.message); status(e.message, true); }
  finally { lock(false); }
}
async function save(side) {
  const result = panes[side];
  if (!result) return;
  try {
    const manifest = { source: selected, engine: result.engine, measurement: result.run || null, note: result.note,
      warning: "Les numéros de page de la sortie renvoient à l’extrait ; source.pages donne les pages physiques originales. Une image exportée n’est pas une description." };
    const entries = [{ name: "document.md", data: result.markdown }, { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
      ...result.assets.map(a => ({ name: a.path, data: a.bytes }))];
    download(await zip(entries), `${selected.id}-${result.engine}.zip`);
  } catch (e) { status("Export impossible : " + e.message, true); }
}
for (const side of ["a", "b"]) {
  $("engine-" + side).addEventListener("change", () => local ? clearPane(side, "Cliquez sur Convertir pour ce moteur.") : measured(side));
  $("run-" + side).addEventListener("click", () => runLocal(side));
  $("save-" + side).addEventListener("click", () => save(side));
  $("import-" + side).addEventListener("change", async e => {
    const file = e.target.files[0], token = revision;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { status("Markdown limité à 5 Mo.", true); return; }
    clearPane(side, "Import en cours…");
    const ticket = tickets[side];
    const markdown = await file.text();
    if (token !== revision || ticket !== tickets[side]) return;
    await display(side, { markdown, assets: [], images: new Map(), engine: "import", ...metrics(markdown),
      note: `Import : ${file.name} · non chronométré · images non fournies · vérifiez qu’il correspond au PDF affiché` }, token);
  });
}
$("corpus").addEventListener("change", selectCorpus);
$("page").addEventListener("change", showReference);
$("pdf").addEventListener("change", e => loadLocal(e.target.files[0]));
$("view").addEventListener("change", () => Promise.all([renderPane("a"), renderPane("b")]));
window.addEventListener("pagehide", release);
try {
  corpus = await json("data/corpus.json");
  await Promise.all(Object.keys(NAMES).map(async engine => { try { reports.set(engine, await json(`data/${engine}.json`)); } catch { /* Explicitly shown as unmeasured. */ } }));
  $("corpus").replaceChildren(...corpus.map(c => new Option(c.title, c.id)));
  await selectCorpus(); lock(false);
} catch (e) { status("Chargement impossible : " + e.message + ". Rechargez la page pour réessayer.", true); }
