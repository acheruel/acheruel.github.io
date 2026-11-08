# MarkDownO

Conversion de fichiers en Markdown avec [MarkItDown](https://github.com/microsoft/markitdown) (Microsoft,
licence MIT), directement dans le navigateur : https://acheruel.github.io/outils/markdowno/

MarkItDown est une bibliothèque Python. Plutôt que de la réécrire, MarkDownO la fait tourner telle quelle
dans le navigateur grâce à [Pyodide](https://pyodide.org) (Python compilé en WebAssembly), dans un
travailleur (Web Worker) pour ne pas figer la page.

## Formats

Word (.docx), PowerPoint (.pptx), Excel (.xlsx, .xls), PDF, pages web (.html), CSV (le séparateur « ; »
d'Excel en français est reconnu), JSON, XML et flux RSS, livres EPUB, courriels Outlook (.msg), carnets
Jupyter (.ipynb), texte et archives ZIP (chaque fichier de l'archive est converti).

Non pris en charge dans le navigateur : audio (transcription), description d'images (ExifTool ou IA),
pages YouTube ou Wikipédia par adresse.

Pour un PDF, [PDFo Converto](../pdfo-converto/) donne en général un meilleur Markdown (titres, tableaux,
découpage par chapitres) ; MarkDownO le signale.

## Fonctionnement

- Le moteur (environ 30 Mo) est téléchargé une seule fois, au premier fichier ou sur demande :
  Pyodide 0.29.5 depuis jsDelivr, puis les paquets Python purs depuis PyPI, à des versions épinglées
  (`markitdown==0.1.9`, `mammoth`, `python-pptx`, `openpyxl`, `pdfminer.six`, `pdfplumber`…). Le
  navigateur le garde ensuite en cache.
- `magika` (détection du type de fichier par réseau de neurones) et `pypdfium2` (rendu de pages) n'existent
  pas en WebAssembly : ils sont remplacés par des modules factices. MarkItDown ne s'en sert que pour deviner
  le type d'un fichier sans extension ; ici, l'extension est toujours connue.
- Les fichiers sont lus et convertis localement, un à un : aperçu rendu ou source, copie, téléchargement
  d'un .md ou de tous dans un .zip.

## Comparateur PDF vers Markdown (prototype)

`comparateur/` : https://acheruel.github.io/outils/markdowno/comparateur/ . Résultats d'un banc d'essai de
plusieurs outils (MarkItDown, PDFo Converto, pymupdf4llm, OpenDataLoader PDF ; Docling et Marker à
mesurer) sur deux manuels de ponts de la FHWA, puis les sorties côte à côte avec la page du PDF, placées
sur le même passage. Un PDF déposé est converti en direct par PDFo Converto et, sur demande, MarkItDown.
Les sorties précalculées et les extraits des PDF sont dans `comparateur/donnees/` ; les scripts du banc
d'essai (lancement, notation, vérité terrain) dans `banc/`.

## Fichiers

`index.html` : page ; `app.js` : interface ; `worker.js` : Pyodide et MarkItDown ; `styles.css`.
L'aperçu Markdown commun est dans `../commun/markdown.js` ([marked](https://github.com/markedjs/marked),
HTML nettoyé).
