# Bibliothèques partagées des outils

Copies locales (versions épinglées) utilisées par les outils hébergés dans `outils/`, pour qu'ils
fonctionnent sans dépendre d'un CDN. Licences jointes.

| Bibliothèque | Version | Licence | Utilisée par |
| --- | --- | --- | --- |
| [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-6.4.299/`) | 6.4.299 | Apache 2.0 | PDFo Comparo, PDFo Converto |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | PDFo Comparo (export), PDFo Converto (diviser) |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT | archives .zip, fichiers .docx |
| [marked](https://github.com/markedjs/marked) | 18.1.1 | MIT | aperçu Markdown |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | 4.0.1 | MIT | PDFo Converto (PowerPoint) |

pdf.js : `pdf.min.mjs` et `pdf.worker.min.mjs` du paquet `pdfjs-dist` sont renommés en `.js` (même
contenu) pour être servis partout avec un type JavaScript. Les dossiers `cmaps/`, `standard_fonts/` et
`wasm/` (JPEG 2000, JBIG2, profils de couleur) viennent du même paquet.

MarkDownO charge Pyodide 0.29.5 depuis jsDelivr et ses paquets Python depuis PyPI (voir
`../markdowno/README.md`).

Le code commun des outils est dans `../commun/` : `pdf-outils.js` (pdf.js, mots positionnés, rendu,
fichiers), `markdown.js` (aperçu Markdown nettoyé) et `outil.css` (composants d'interface).
