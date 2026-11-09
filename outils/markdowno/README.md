# MarkDownO

Conversion de fichiers en Markdown pour une IA, directement dans le navigateur :
https://acheruel.github.io/outils/markdowno/

## PDF (normes, guides de conception, manuels)

Les PDF passent par le moteur PDF du site, choisi après un banc d'essai contre MarkItDown, Docling,
Marker, pymupdf4llm et OpenDataLoader (voir `banc/`) :

1. **Structure** (moteur de PDFo Converto, `../commun/pdf-extract.js`) : titres d'après les polices et
   les signets, paragraphes recomposés, listes, **tableaux vectoriels** retrouvés par leurs filets, avec
   les cellules fusionnées en HTML (`rowspan`, `colspan`) et les libellés de ligne posés hors de la grille,
   en-têtes et pieds de page répétés retirés, deux colonnes, figures avec leur légende.
2. **OCR local des zones en image** (`../commun/ocr.js`, [Tesseract.js](https://github.com/naptha/tesseract.js)
   7.0.0, Apache 2.0, anglais et français) :
   - **tableau inséré comme image** : la grille est retrouvée dans l'image (`../commun/grille.js` : filets
     horizontaux et verticaux, cellules fusionnées), puis chaque cellule est lue seule, agrandie deux
     fois. Une cellule numérique est relue à une autre échelle, en chiffres seulement : si les deux
     lectures diffèrent, la valeur est **signalée sous le tableau** (« 47.7 » ou « a7.7 »). Chaque tableau
     lu par OCR porte la mention « vérifier les valeurs » : un chiffre faux bien formaté est pire qu'un
     chiffre absent pour une IA qui conçoit ;
   - **figure en image** : le texte lu (cotes, libellés, équations dessinées) va dans la fiche de la
     figure, marqué « Texte lu par OCR » ; un croquis dans une cellule devient « [dessin] » ;
   - **page numérisée** : texte en paragraphes, marqué « à vérifier ».
3. **Sortie** : un fichier, ou un fichier par chapitre (signets) avec un sommaire ; figures en fiches, ou
   fiches + images dans un .zip ; **repères de page** (`<!-- page 12 -->`) pour qu'une IA cite sa source ;
   plage de pages (« 1-10, 15 »).

Le moteur MarkItDown reste disponible pour un PDF (option « MarkItDown (texte brut) ») : texte fidèle,
mais sans titres, tableaux ni figures.

## Autres formats

Word (.docx), PowerPoint (.pptx), Excel (.xlsx, .xls), pages web (.html), CSV (le séparateur « ; »
d'Excel en français est reconnu), JSON, XML et flux RSS, livres EPUB, courriels Outlook (.msg), carnets
Jupyter (.ipynb), texte et archives ZIP : [MarkItDown](https://github.com/microsoft/markitdown)
(Microsoft, MIT), qui tourne tel quel dans le navigateur grâce à [Pyodide](https://pyodide.org) (Python
en WebAssembly), dans un travailleur (Web Worker).

- Le moteur (environ 30 Mo) est téléchargé une seule fois, au premier fichier de ce type ou sur demande :
  Pyodide 0.29.5 depuis jsDelivr, puis les paquets Python purs depuis PyPI, à des versions épinglées
  (`markitdown==0.1.9`, `mammoth`, `python-pptx`, `openpyxl`, `pdfminer.six`, `pdfplumber`…).
- `magika` et `pypdfium2` n'existent pas en WebAssembly : ils sont remplacés par des modules factices.
  MarkItDown ne s'en sert que pour deviner le type d'un fichier sans extension.
- Non pris en charge dans le navigateur : audio, description d'images, pages YouTube ou Wikipédia.

## Depuis PDFo Converto

Le bouton « Ouvrir ce PDF dans MarkDownO » de Converto dépose le PDF et la plage de pages dans le
stockage local du navigateur (`../commun/relais.js`, IndexedDB), puis ouvre MarkDownO, qui le reprend
une seule fois et l'efface. Rien ne passe par le réseau.

## Aperçu

- **Rendu**, **Markdown** (source) ou **Figures** : la galerie de toutes les figures repérées dans le PDF,
  avec leur page, leur nature (image, dessin, page numérisée) et leur légende. Les images sont rendues
  à la demande depuis le PDF (gardé en mémoire tant que le fichier est dans la liste) ; un clic ouvre
  l'image en grand, et « Télécharger ces figures (.zip) » les enregistre.
- **Chapitre** : pour un PDF à signets ou à titres de niveau 1, une liste permet de n'afficher qu'un
  chapitre, en Rendu, en Markdown ou en Figures, que la sortie soit en un fichier ou par chapitre.
  « Copier » copie ce qui est affiché.

## Banc d'essai

`banc/` : lancement de chaque outil (MarkDownO, PDFo Converto, MarkItDown, Docling, Marker, pymupdf4llm,
OpenDataLoader PDF) sur deux manuels de ponts de la FHWA, notation (vérité terrain relevée à la main :
33 lignes de 11 tableaux, 3 équations, 15 questions), exportation des résultats. Voir `banc/README.md`.
Le comparateur qui les affiche (résultats, puis sorties côte à côte avec la page du PDF) n'est plus
publié sur le site : c'est un fichier HTML local, hors du dépôt.

## Fichiers

`index.html` : page ; `app.js` : interface ; `pdf.js` : moteur PDF (structure, OCR, chapitres, images) ;
`worker.js` : Pyodide et MarkItDown ; `styles.css`. Code commun dans `../commun/` : `pdf-extract.js`,
`pdf-writers.js`, `ocr.js`, `grille.js`, `relais.js`, `markdown.js` (aperçu,
[marked](https://github.com/markedjs/marked), HTML nettoyé).

Vos fichiers ne quittent pas l'appareil : seuls les moteurs (OCR environ 6 Mo, MarkItDown environ 30 Mo)
sont téléchargés, une fois, puis gardés en cache.
