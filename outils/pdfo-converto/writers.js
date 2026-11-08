// PDFo Converto : écriture des fichiers de sortie à partir des blocs extraits.
// Markdown (un fichier ou un par chapitre) et Word .docx (Office Open XML écrit directement,
// sans bibliothèque : texte modifiable ou images des pages).
import { fflate } from "../commun/pdf-outils.js";

// ---------------------------------------------------------------- Markdown
const mdEsc = s => s.replace(/([\\`*_<])/g, "\\$1");
const mdLineStart = s => s.replace(/^(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, "\\$1");

/** Fragments (gras, italique) en Markdown ; les espaces restent hors des marqueurs. */
function mdRuns(runs) {
  let out = "";
  for (const r of runs) {
    const m = r.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const [, lead, core, trail] = m;
    if (!core) { out += r.t; continue; }
    const mark = r.b && r.i ? "***" : r.b ? "**" : r.i ? "*" : "";
    out += lead + mark + mdEsc(core) + mark + trail;
  }
  return mdLineStart(out.replace(/\*\*\*\*/g, "").replace(/\s+/g, " ").trim());
}

const cell = s => mdEsc(s).replace(/\|/g, "\\|").replace(/\n/g, "<br>");

/** Blocs → Markdown. opts : { pageMarkers } */
export function toMarkdown(blocks, opts = {}) {
  const parts = [];
  let prevType = null, lastPage = null;
  for (const b of blocks) {
    if (b.type === "pagebreak") continue;
    if (opts.pageMarkers && b.page !== lastPage) {
      parts.push({ t: `<!-- page ${b.page + 1} -->`, type: "marker" });
      lastPage = b.page;
    }
    if (b.type === "h") parts.push({ t: `${"#".repeat(b.level)} ${mdEsc(b.text)}`, type: "h" });
    else if (b.type === "p") parts.push({ t: mdRuns(b.runs), type: "p" });
    else if (b.type === "li") {
      const ind = "  ".repeat(b.level || 0);
      const num = b.ordered && /^\d+[.)]$/.test(b.marker) ? `${parseInt(b.marker, 10)}. ` : b.ordered ? `- ${b.marker} ` : "- ";
      parts.push({ t: ind + num + mdRuns(b.runs).replace(/^\\/, ""), type: "li" });
    } else if (b.type === "table") {
      const cols = Math.max(...b.rows.map(r => r.length));
      const rows = b.rows.map(r => [...r, ...Array(cols - r.length).fill("")]);
      const lines = [
        `| ${rows[0].map(cell).join(" | ")} |`,
        `| ${rows[0].map(() => "---").join(" | ")} |`,
        ...rows.slice(1).map(r => `| ${r.map(cell).join(" | ")} |`)
      ];
      parts.push({ t: lines.join("\n"), type: "table" });
    }
    prevType = b.type;
  }
  void prevType;
  let md = "";
  parts.forEach((p, k) => {
    const prev = parts[k - 1];
    if (k) md += prev.type === "li" && p.type === "li" ? "\n" : "\n\n";
    md += p.t;
  });
  return md.trim() + "\n";
}

const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "chapitre";
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Découpe en chapitres : signets de premier niveau, sinon titres de niveau 1.
 * Retourne [{ title, blocks, from, to }] (pages de début et de fin, base 0) ou null.
 */
export function splitChapters(blocks, outline) {
  const starts = [];
  // Niveau de signets le plus haut qui compte au moins deux entrées (une seule racine = titre).
  let depth = 0;
  while (depth < 3 && outline.filter(o => o.depth === depth && o.page !== null).length < 2) depth++;
  const top = outline.filter(o => o.depth === depth && o.page !== null);
  if (top.length >= 2) {
    for (const o of top) {
      let k = blocks.findIndex(b => b.type === "h" && Math.abs(b.page - o.page) <= 1 && norm(b.text) === norm(o.title));
      if (k < 0) k = blocks.findIndex(b => b.type !== "pagebreak" && b.page >= o.page);
      if (k >= 0) starts.push({ k, title: o.title });
    }
  } else {
    blocks.forEach((b, k) => { if (b.type === "h" && b.level === 1) starts.push({ k, title: b.text }); });
  }
  const uniq = [];
  for (const s of starts.sort((a, b) => a.k - b.k)) if (!uniq.length || uniq[uniq.length - 1].k !== s.k) uniq.push(s);
  if (uniq.length < 2) return null;
  const out = [];
  const pageRange = bs => {
    const ps = bs.filter(b => b.type !== "pagebreak").map(b => b.page);
    return ps.length ? [Math.min(...ps), Math.max(...ps)] : [0, 0];
  };
  if (uniq[0].k > 0) {
    const pre = blocks.slice(0, uniq[0].k);
    if (pre.some(b => b.type !== "pagebreak")) out.push({ title: null, blocks: pre });
  }
  uniq.forEach((s, n) => out.push({ title: s.title, blocks: blocks.slice(s.k, n + 1 < uniq.length ? uniq[n + 1].k : blocks.length) }));
  return out.map(c => { const [from, to] = pageRange(c.blocks); return { ...c, from, to }; });
}

/** Fichiers Markdown d'un découpage en chapitres, avec un sommaire. */
export function chapterFiles(chapters, docTitle, labels) {
  const files = chapters.map((c, n) => ({
    name: `${String(n + 1).padStart(2, "0")}-${slug(c.title || labels.intro)}.md`,
    title: c.title || labels.intro,
    md: toMarkdown(c.blocks, labels.mdOpts),
    from: c.from, to: c.to
  }));
  const index = `# ${docTitle}\n\n${labels.toc}\n\n` + files.map(f => `- [${f.title.replace(/[[\]]/g, "")}](${f.name}) · ${labels.pages(f.from + 1, f.to + 1)}`).join("\n") + "\n";
  return [{ name: "00-sommaire.md", title: labels.tocFile, md: index }, ...files];
}

// ---------------------------------------------------------------- Word (.docx)
const xmlEsc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const run = r => {
  const pr = (r.b ? "<w:b/>" : "") + (r.i ? "<w:i/>" : "");
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEsc(r.t)}</w:t></w:r>`;
};
const para = (inner, pPr = "") => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${inner}</w:p>`;

function tableXml(rows) {
  const cols = Math.max(...rows.map(r => r.length));
  const grid = `<w:tblGrid>${"<w:gridCol/>".repeat(cols)}</w:tblGrid>`;
  const trs = rows.map((r, ri) => {
    const full = [...r, ...Array(cols - r.length).fill("")];
    // Ligne de section (seule la première cellule est remplie) : une cellule sur toute la largeur.
    const section = ri > 0 && cols > 2 && full[0] && full.slice(1).every(c => !c);
    const cellXml = (c, span) => {
      const ps = String(c).split("\n").map(line => para(line ? run({ t: line, b: ri === 0 || span > 1 }) : "", '<w:spacing w:before="0" w:after="0"/>')).join("");
      return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr>${ps || para("")}</w:tc>`;
    };
    const cells = section ? cellXml(full[0], cols) : full.map(c => cellXml(c, 1)).join("");
    return `<w:tr>${ri === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${cells}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>${grid}${trs}</w:tbl>${para("")}`;
}

function bodyXml(blocks, { pageBreaks }) {
  let x = "";
  for (const b of blocks) {
    if (b.type === "pagebreak") { if (pageBreaks) x += para('<w:r><w:br w:type="page"/></w:r>'); continue; }
    if (b.type === "h") x += para(run({ t: b.text }), `<w:pStyle w:val="Heading${b.level}"/>`);
    else if (b.type === "p") x += para(b.runs.map(run).join(""));
    else if (b.type === "li") {
      const ordered = b.ordered && /^\d+[.)]$/.test(b.marker);
      const prefix = b.ordered && !ordered ? [{ t: b.marker + " ", b: false, i: false }] : [];
      x += para([...prefix, ...b.runs].map(run).join(""), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${b.level || 0}"/><w:numId w:val="${ordered ? 2 : 1}"/></w:numPr>`);
    } else if (b.type === "table") x += tableXml(b.rows);
  }
  return x;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="fr-CA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="102D41"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="102D41"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="17374B"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/><w:color w:val="17374B"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/><w:left w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/><w:right w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="8FA4B0"/></w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

const lvl = (i, fmt, text, ind) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${ind}" w:hanging="360"/></w:pPr>${fmt === "bullet" ? '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>' : ""}</w:lvl>`;
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${lvl(0, "bullet", "•", 720)}${lvl(1, "bullet", "◦", 1440)}${lvl(2, "bullet", "▪", 2160)}${lvl(3, "bullet", "•", 2880)}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${lvl(0, "decimal", "%1.", 720)}${lvl(1, "lowerLetter", "%2)", 1440)}${lvl(2, "lowerRoman", "%3.", 2160)}${lvl(3, "decimal", "%4.", 2880)}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

/**
 * Document Word. src : { blocks } (texte modifiable) ou { images: [{ bytes, w, h, type }] }
 * (une image par page). page : { w, h } en points pour le format du document.
 */
export async function toDocx(src, { title = "", page = { w: 612, h: 792 }, pageBreaks = false, lang = "fr-CA" } = {}) {
  const ff = await fflate();
  const enc = new TextEncoder();
  const twip = pt => Math.round(pt * 20);
  const images = src.images || [];
  const margin = images.length ? 36 : 72; // 0,5 po pour les images, 1 po pour le texte
  let body;
  const rels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
  ];
  const media = {};
  if (images.length) {
    const maxW = page.w - 2 * margin, maxH = page.h - 2 * margin;
    body = images.map((im, n) => {
      const s = Math.min(maxW / im.w, maxH / im.h);
      const cx = Math.round(im.w * s * 12700), cy = Math.round(im.h * s * 12700);
      const ext = im.type === "png" ? "png" : "jpeg";
      const rid = `rIdImg${n + 1}`;
      media[`word/media/page${n + 1}.${ext}`] = [im.bytes, { level: 0 }];
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${n + 1}.${ext}"/>`);
      const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n + 1}" name="Page ${n + 1}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${n + 1}" name="page${n + 1}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      return para(drawing, '<w:jc w:val="center"/><w:spacing w:after="0"/>') + (n < images.length - 1 ? para('<w:r><w:br w:type="page"/></w:r>', '<w:spacing w:after="0"/>') : "");
    }).join("");
  } else {
    body = bodyXml(src.blocks, { pageBreaks });
  }
  const landscape = page.w > page.h;
  const sect = `<w:sectPr><w:pgSz w:w="${twip(page.w)}" w:h="${twip(page.h)}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${twip(margin)}" w:right="${twip(margin)}" w:bottom="${twip(margin)}" w:left="${twip(margin)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body || para("")}${sect}</w:body></w:document>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = {
    "[Content_Types].xml": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title)}</dc:title><dc:creator>PDFo Converto</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PDFo Converto (acheruel.github.io)</Application></Properties>`),
    "word/_rels/document.xml.rels": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`),
    "word/document.xml": enc.encode(doc),
    "word/styles.xml": enc.encode(STYLES.replace('w:val="fr-CA"', `w:val="${lang}"`)),
    "word/numbering.xml": enc.encode(NUMBERING),
    "word/settings.xml": enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`),
    ...media
  };
  const zipped = ff.zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Array.isArray(v) ? v : [v, { level: 6 }]])));
  return new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
