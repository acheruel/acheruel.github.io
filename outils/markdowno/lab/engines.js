// Reuse PDFo Converto's extraction and writers; no second extraction implementation.
import { openPdf, renderPage, dropCanvas } from "../../commun/pdf-outils.js";
import { extract } from "../../pdfo-converto/extract.js";
import { toMarkdown, blockAssets } from "../../pdfo-converto/writers.js";

export async function toBytes(canvas, type, quality) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("Impossible d’exporter l’image de la page.");
  return new Uint8Array(await blob.arrayBuffer());
}

export function metrics(md) {
  return {
    characters: [...md].length,
    headings: (md.match(/^#{1,6}\s/gm) || []).length,
    table_rows: (md.match(/^\|.*\|\s*$/gm) || []).length + (md.match(/<tr>/g) || []).length,
    image_links: (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
  };
}

export async function convertPDFo(bytes, onProgress = () => {}) {
  const start = performance.now();
  const pdf = await openPdf(bytes, undefined, { fontExtraProperties: true });
  try {
    const opts = { tables: true, margins: true, styles: true, figures: true, onProgress };
    const result = await extract(pdf, Array.from({ length: pdf.numPages }, (_, i) => i), opts);
    const mdOpts = { pageMarkers: true, figures: "images", tableFmt: "auto", tableImages: true };
    const markdown = toMarkdown(result.blocks, mdOpts);
    const assets = [];
    for (const item of blockAssets(result.blocks, mdOpts)) {
      const page = await pdf.getPage(item.page + 1);
      const vp = page.getViewport({ scale: 1 });
      const pad = item.kind === "scan" ? 0 : 6;
      const x0 = Math.max(0, item.box.x0 - pad), y0 = Math.max(0, item.box.y0 - pad);
      const w = Math.max(1, Math.min(vp.width, item.box.x1 + pad) - x0);
      const h = Math.max(1, Math.min(vp.height, item.box.y1 + pad) - y0);
      const scale = Math.min(4, 2000 / Math.max(w, h));
      const canvas = await renderPage(page, { scale, offsetX: -x0 * scale, offsetY: -y0 * scale, width: w * scale, height: h * scale });
      try {
        const type = ["vector", "table"].includes(item.kind) ? "image/png" : "image/jpeg";
        assets.push({ path: item.path, type, bytes: await toBytes(canvas, type, 0.86) });
      } finally { dropCanvas(canvas); }
    }
    return { markdown, assets, seconds: (performance.now() - start) / 1000, ...metrics(markdown), pages: pdf.numPages };
  } finally { await pdf.loadingTask.destroy(); }
}

// Independent worker per run: termination also aborts initialization and frees Python memory.
export function convertMarkItDown(bytes, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const worker = new Worker(new URL("../worker.js", import.meta.url));
    const timer = setTimeout(() => finish(new Error("MarkItDown : délai de 5 minutes dépassé.")), 300000);
    let convertStart;
    function finish(error, value) {
      clearTimeout(timer); worker.terminate();
      if (error) reject(error); else resolve(value);
    }
    worker.onerror = e => finish(new Error(e.message || "Chargement du moteur impossible."));
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress(data.step, 4);
      if (data.type === "ready") {
        convertStart = performance.now();
        const copy = bytes.slice();
        worker.postMessage({ type: "convert", id: 1, name: "document.pdf", bytes: copy }, [copy.buffer]);
      }
      if (["error", "fatal"].includes(data.type)) finish(new Error(data.error));
      if (data.type === "done") finish(null, { markdown: data.markdown, assets: [],
        seconds: (performance.now() - convertStart) / 1000,
        startup_s: (convertStart - start) / 1000, ...metrics(data.markdown) });
    };
    worker.postMessage({ type: "init" });
  });
}
