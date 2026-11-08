// Aperçu Markdown commun (PDFo Converto, MarkDownO) : marked, puis nettoyage du HTML produit.
// Le Markdown vient de fichiers de l'utilisateur : on ne garde que des balises de mise en forme,
// sans script, style ni attribut d'événement.
import { marked } from "./pdf-outils.js";

const ALLOWED = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
  "STRONG", "EM", "B", "I", "CODE", "PRE", "BLOCKQUOTE", "BR", "HR", "A", "DEL", "SUP", "SUB", "SPAN", "IMG", "INPUT"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "TEXTAREA", "SELECT", "BUTTON", "SVG", "MATH", "TEMPLATE", "NOSCRIPT"]);

function clean(node, images) {
  for (const el of [...node.children]) {
    if (DROP.has(el.tagName)) { el.remove(); continue; }
    clean(el, images);
    if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
    for (const at of [...el.attributes]) {
      const n = at.name.toLowerCase();
      const keep =
        (el.tagName === "A" && n === "href" && /^(https?:|mailto:|#)/i.test(at.value.trim())) ||
        ((el.tagName === "TH" || el.tagName === "TD") && n === "align") ||
        ((el.tagName === "TH" || el.tagName === "TD") && (n === "rowspan" || n === "colspan") && /^\d{1,3}$/.test(at.value.trim())) ||
        (el.tagName === "IMG" && (n === "alt" || n === "src")) ||
        (el.tagName === "INPUT" && (n === "type" || n === "checked" || n === "disabled"));
      if (!keep) el.removeAttribute(n);
    }
    if (el.tagName === "A") { el.target = "_blank"; el.rel = "noopener noreferrer"; }
    // Images : seules celles fournies par l'outil (images extraites, adresses blob:) s'affichent ;
    // les autres pointent vers des fichiers absents : on montre leur texte.
    if (el.tagName === "IMG") {
      let src = el.getAttribute("src") || "";
      try { src = decodeURI(src); } catch { /* adresse mal formée : gardée telle quelle */ }
      const url = images && images.get(src);
      if (url) { el.setAttribute("src", url); el.setAttribute("loading", "lazy"); }
      else el.replaceWith(document.createTextNode(`[${el.getAttribute("alt") || "image"}]`));
    }
    if (el.tagName === "INPUT" && el.getAttribute("type") !== "checkbox") el.remove();
  }
}

/**
 * Markdown → fragment HTML sûr, prêt à insérer dans un conteneur .md-preview.
 * images : Map facultative « chemin relatif → adresse blob: » des images à afficher.
 */
export async function renderMarkdown(md, { images } = {}) {
  const m = await marked();
  const html = m.parse(md, { gfm: true, breaks: false, async: false });
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  clean(root, images);
  const frag = document.createDocumentFragment();
  frag.append(...root.childNodes);
  return frag;
}
