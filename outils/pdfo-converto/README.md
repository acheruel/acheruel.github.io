# PDFo Converto

Conversion d'un PDF, directement dans le navigateur : https://acheruel.github.io/outils/pdfo-converto/

Inspiré des fonctions d'[iLovePDF](https://www.ilovepdf.com/fr) et de
[jzillmann/pdf-to-markdown](https://github.com/jzillmann/pdf-to-markdown), sans envoi de fichier.

## Formats

- **Markdown (.md)** : titres (taille et graisse des polices, signets du PDF), paragraphes recomposés
  (mots coupés en fin de ligne résolus avec le vocabulaire du document : « exi-gences » → « exigences »,
  mais « au-dessus » reste « au-dessus »), listes à puces et numérotées avec leur niveau, gras et italique,
  exposants (m²), **tableaux** détectés grâce aux filets du PDF (cellules fusionnées, cellules sur plusieurs
  lignes, tableau qui continue sur plusieurs pages réuni en un seul), en-têtes et pieds de page répétés
  retirés, lecture en deux colonnes. Sortie en **un fichier** ou **un fichier par chapitre** (signets du
  PDF, sinon titres de niveau 1) avec un sommaire, dans un .zip. Mode automatique : découpage à partir de
  25 pages. Aperçu rendu ou source, copie en un clic.
  - **Figures** : images du PDF (photos, captures), dessins vectoriels (plans, graphiques, schémas) et
    pages numérisées sont repérés. Les parties proches d'un même dessin sont réunies, les logos répétés
    écartés. La légende (« Figure 3 – … », « Photo 2 : … ») et le texte lu dans la figure (cotes,
    libellés, axes) quittent les paragraphes et forment une **fiche** à la place de la figure.
    Trois choix : *Ignorer*, *Description* (fiche seule, légère, pour une IA qui ne lit que du texte)
    ou *Images (.zip)* : la fiche plus l'image découpée (PNG pour les dessins, JPEG pour les photos,
    2 000 px au plus) dans un dossier `images/`, liée par `![légende](images/p004-figure1.png)`.
  - **Tableaux écrits en** *Automatique* (Markdown, ou HTML dès qu'une cellule est fusionnée),
    *Markdown* ou *HTML*. Le HTML garde `rowspan` et `colspan` : dans une liste de prix, les lignes
    « type 1 » à « type 4 » restent rattachées à leur code d'ouvrage, ce qu'un tableau Markdown perd.
    Option : joindre l'image de chaque tableau (contrôle des chiffres, IA qui lit les images).
- **Images (.jpg, .png)** : une image par page, 96, 150 ou 300 ppp, qualité JPG réglable, en .zip.
- **Diviser (.pdf)** : chaque page, toutes les N pages ou plages personnalisées (« 1-3, 4-10 »). Les pages
  sont copiées telles quelles (texte et vecteurs conservés).
- **Word (.docx)** : texte modifiable (styles Titre 1 à 4 de Word, listes, tableaux avec en-tête répété,
  lignes de section fusionnées, figures en images avec leur légende) ou une image par page (mise en page exacte). Le fichier est écrit
  directement au format Office Open XML, sans bibliothèque.
- **PowerPoint (.pptx)** : une diapositive par page, au format de la page, avec le texte de la page dans
  les notes (cherchable).

Une plage de pages (« 1-10, 15 ») s'applique à tous les formats.

## Markdown pour une IA : MarkDownO

[MarkDownO](../markdowno/) utilise le même moteur et lit en plus, par OCR local, les tableaux insérés
comme images, le texte des figures et les pages numérisées. Le bouton « Ouvrir ce PDF dans MarkDownO »
(onglet Markdown) y envoie le PDF et la plage de pages, sans passer par le réseau.

## Limites

- Pas de reconnaissance de caractères (OCR) : le texte *dessiné dans une image* (capture d'écran,
  page numérisée) n'est pas lu. Une page numérisée devient une figure « page numérisée » ; avec
  *Images (.zip)*, une IA qui lit les images en tire le texte (souvent mieux qu'un OCR).
- Les tableaux sans filets (simple alignement de colonnes) restent en paragraphes. Les libellés de
  ligne posés à gauche d'une grille, sans filets (« DC1 », « LL »), en deviennent la première colonne.
- La détection des figures est heuristique : un dessin très aéré peut être coupé en deux, un encadré
  très chargé en traits peut passer pour une figure. *Ignorer* revient au comportement d'avant.

## Fichiers

- `index.html` : page ; `app.js` : interface ; `styles.css`. Le moteur est partagé avec MarkDownO, dans
  `../commun/` : `pdf-extract.js` (structure du PDF : lignes, titres, listes, tableaux, figures) et
  `pdf-writers.js` (Markdown, chapitres et .docx).
- `exemples/rapport-inspection-exemple.pdf` : rapport fictif généré par `exemples/generer_exemple.py`.
- Bibliothèques (dans `../vendor/`) : [pdf.js](https://github.com/mozilla/pdf.js) 6.4.299 (Apache 2.0),
  [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1, [fflate](https://github.com/101arrowz/fflate)
  0.8.3, [marked](https://github.com/markedjs/marked) 18.1.1 et
  [PptxGenJS](https://github.com/gitbrent/PptxGenJS) 4.0.1 (MIT).

Tout reste sur l'appareil : aucun fichier n'est envoyé. Les réglages sont mémorisés dans `localStorage`.
