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
- **Images (.jpg, .png)** : une image par page, 96, 150 ou 300 ppp, qualité JPG réglable, en .zip.
- **Diviser (.pdf)** : chaque page, toutes les N pages ou plages personnalisées (« 1-3, 4-10 »). Les pages
  sont copiées telles quelles (texte et vecteurs conservés).
- **Word (.docx)** : texte modifiable (styles Titre 1 à 4 de Word, listes, tableaux avec en-tête répété,
  lignes de section fusionnées) ou une image par page (mise en page exacte). Le fichier est écrit
  directement au format Office Open XML, sans bibliothèque.
- **PowerPoint (.pptx)** : une diapositive par page, au format de la page, avec le texte de la page dans
  les notes (cherchable).

Une plage de pages (« 1-10, 15 ») s'applique à tous les formats.

## Limites

- Un PDF numérisé (image sans texte) ne donne pas de Markdown ni de Word modifiable : il faudrait une
  reconnaissance de caractères (OCR). Les formats Images, Word (images) et PowerPoint fonctionnent.
- Les tableaux sans filets (simple alignement de colonnes) restent en paragraphes.
- Les images contenues dans le PDF ne sont pas extraites dans le Markdown.

## Fichiers

- `index.html` : page ; `app.js` : interface ; `extract.js` : structure du PDF (lignes, titres,
  listes, tableaux) ; `writers.js` : Markdown, chapitres et .docx ; `styles.css`.
- `exemples/rapport-inspection-exemple.pdf` : rapport fictif généré par `exemples/generer_exemple.py`.
- Bibliothèques (dans `../vendor/`) : [pdf.js](https://github.com/mozilla/pdf.js) 6.4.299 (Apache 2.0),
  [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1, [fflate](https://github.com/101arrowz/fflate)
  0.8.3, [marked](https://github.com/markedjs/marked) 18.1.1 et
  [PptxGenJS](https://github.com/gitbrent/PptxGenJS) 4.0.1 (MIT).

Tout reste sur l'appareil : aucun fichier n'est envoyé. Les réglages sont mémorisés dans `localStorage`.
