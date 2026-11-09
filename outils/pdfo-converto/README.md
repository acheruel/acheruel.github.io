# PDFo Converto

Conversion d'un PDF, directement dans le navigateur : https://acheruel.github.io/outils/pdfo-converto/

Inspiré des fonctions d'[iLovePDF](https://www.ilovepdf.com/fr) et de
[jzillmann/pdf-to-markdown](https://github.com/jzillmann/pdf-to-markdown), sans envoi de fichier.

## Formats

- **Word (.docx)** : texte modifiable ou une image par page (mise en page exacte). Le texte modifiable
  reprend la structure du PDF : titres (taille et graisse des polices, signets) en styles Titre 1 à 4,
  paragraphes recomposés (mots coupés en fin de ligne résolus avec le vocabulaire du document :
  « exi-gences » → « exigences », mais « au-dessus » reste « au-dessus »), listes avec leur niveau,
  gras et italique, exposants (m²), **tableaux** retrouvés par leurs filets (cellules fusionnées, en-tête
  répété, tableau sur plusieurs pages réuni, libellés de ligne posés hors de la grille), en-têtes et pieds
  de page répétés retirés, deux colonnes, figures en images avec leur légende. Le fichier est écrit
  directement au format Office Open XML, sans bibliothèque.
- **Images (.jpg, .png)** : une image par page, 96, 150 ou 300 ppp, qualité JPG réglable, en .zip.
- **Diviser (.pdf)** : chaque page, toutes les N pages ou plages personnalisées (« 1-3, 4-10 »). Les pages
  sont copiées telles quelles (texte et vecteurs conservés).
- **PowerPoint (.pptx)** : une diapositive par page, au format de la page, avec le texte de la page dans
  les notes (cherchable).

Une plage de pages (« 1-10, 15 ») s'applique à tous les formats.

## Markdown : dans MarkDownO

Depuis la version 1.2, le Markdown n'est plus dans Converto : [MarkDownO](../markdowno/) utilise le même
moteur (titres, tableaux à cellules fusionnées, figures en fiches ou en images, un fichier par chapitre)
et lit en plus, par OCR local, les tableaux insérés comme images, le texte des figures et les pages
numérisées. Sur le banc d'essai du [comparateur](../markdowno/comparateur/), il lit 31 lignes de tableau
sur 33, contre 17 pour le Markdown de Converto 1.1. Le bouton « Ouvrir ce PDF dans MarkDownO » y envoie
le PDF et la plage de pages par le stockage local du navigateur, sans passer par le réseau. Pour
retrouver l'ancien Markdown sans OCR, choisir « OCR des images : Non » dans MarkDownO.

## Limites

- Pas de reconnaissance de caractères (OCR) : le texte *dessiné dans une image* (capture d'écran,
  page numérisée) n'est pas lu ; Word « texte modifiable » le garde en image.
- Les tableaux sans filets (simple alignement de colonnes) restent en paragraphes.
- La détection des figures est heuristique : un dessin très aéré peut être coupé en deux, un encadré
  très chargé en traits peut passer pour une figure.

## Fichiers

- `index.html` : page ; `app.js` : interface ; `styles.css`. Le moteur est partagé avec MarkDownO, dans
  `../commun/` : `pdf-extract.js` (structure du PDF : lignes, titres, listes, tableaux, figures) et
  `pdf-writers.js` (Markdown, chapitres et .docx ; l'aperçu Word passe par le Markdown).
- `exemples/rapport-inspection-exemple.pdf` : rapport fictif généré par `exemples/generer_exemple.py`.
- Bibliothèques (dans `../vendor/`) : [pdf.js](https://github.com/mozilla/pdf.js) 6.4.299 (Apache 2.0),
  [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1, [fflate](https://github.com/101arrowz/fflate)
  0.8.3, [marked](https://github.com/markedjs/marked) 18.1.1 et
  [PptxGenJS](https://github.com/gitbrent/PptxGenJS) 4.0.1 (MIT).

Tout reste sur l'appareil : aucun fichier n'est envoyé. Les réglages sont mémorisés dans `localStorage`.
