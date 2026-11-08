# PDFo Comparo

Comparaison de deux versions d'un PDF, directement dans le navigateur : https://acheruel.github.io/outils/pdfo-comparo/

Pensé pour les plans techniques (révisions de dessins), les devis, les listes de prix et les documents de
référence. Inspiré de l'outil interne « Drawing Comparison » et des fonctions de comparaison de Foxit PDF,
ACC et Bluebeam Revu.

## Fonctions

- **Comparaison visuelle** (plans) : superposition en couleurs. Supprimé (ancienne seulement) en rouge,
  ajouté (nouvelle seulement) en bleu, commun en gris atténué. Couleurs, atténuation de l'inchangé et
  épaisseur des traits réglables.
- **Recalage automatique du décalage d'impression** : décalage et échelle entre deux impressions
  (autre traceur, autre imprimante PDF). Calculé à partir des mots présents sur les deux pages
  (consensus robuste, puis moindres carrés), sinon à partir du dessin. Un « décalage » qui ferait sortir
  la page de plus de 15 % est refusé : c'est du contenu qui a glissé, pas une impression différente.
  Réglage manuel possible (décalage en mm, échelle en %, flèches de 0,5 mm), page par page ou pour toutes.
- **Pages insérées ou supprimées** : appariement des pages par alignement de séquences (Needleman-Wunsch)
  sur une similarité texte + image ; le reste de la comparaison ne se décale pas. Une paire peut être
  changée à la main (comparer un feuillet précis de deux gros documents).
- **Pages à comparer** : « 1-10, 15, 18-20 » pour chaque document.
- **Tolérance de position** (stricte 0,15 mm, normale 0,4 mm, souple 1 mm) pour ignorer les petites
  différences de tracé.
- **Zones de changements** numérotées, avec le texte modifié de chaque zone (« 24 000 → 25 500 »),
  liste filtrable (ajouts, suppressions, modifications) et recherche.
- **Comparaison du texte seulement** (devis, rapports) : le texte est comparé sur tout le document, même
  s'il a glissé d'une page à l'autre ; en-têtes et pieds de page répétés ignorés, mots coupés en fin de
  ligne recomposés, majuscules ignorées au besoin. Affichage côte à côte avec surlignage.
- **Visionneuse** : superposition, côte à côte, rideau, ancienne, nouvelle ; zoom à la molette, au
  pincement ou au clavier. La partie visible est recalculée à la résolution de l'écran à tous les
  zooms (plus de texte crénelé en vue d'ensemble) et colorée comme le PDF comparé : l'encre garde
  ses niveaux lissés, l'inchangé en gris, l'ancien et le nouveau en couleur, un liseré pâle signale
  les traits modifiés sans empâter les lettres. Cliquer une zone ouvre sa **fiche** sur la
  visionneuse : le texte « ancien → nouveau » s'y lit en clair, même quand les deux versions se
  superposent sur le dessin (Échap pour fermer).
- **PDF comparé à télécharger** : page de synthèse (tableau des pages et chiffres clés), pages superposées
  **vectorielles** (nettes, légères, écrites en quelques secondes), zones encadrées et numérotées, liste
  des changements. Option « Images (comme à l'écran) ». Liste des changements en CSV (Excel).

## Exemples

`exemples/` contient des PDF fictifs générés par `exemples/generer_exemples.py` (PyMuPDF) :

- `plans-pont-rev-A.pdf` / `plans-pont-rev-B.pdf` : jeu de plans de pont. La révision B ajoute un
  feuillet, modifie une travée, des notes, la dalle et le cartouche, et elle est imprimée réduite à
  98,5 % et décalée.
- `devis-beton-v1.pdf` / `devis-beton-v2.pdf` : devis dont la version 2 ajoute un paragraphe (le texte
  glisse), change des valeurs, retire une phrase et ajoute une section.

## Fonctionnement

- `index.html` : page ; `app.js` : interface ; `engine.js` : rendu, appariement, recalage, masques,
  zones ; `algos.js` : différence de suites, Needleman-Wunsch, recalage robuste (sans DOM) ;
  `export.js` : PDF comparé et CSV ; `styles.css`.
- Export vectoriel : l'ancienne page est placée dans un groupe de transparence isolé, désaturée puis
  teintée (mode de fusion « Écran ») ; la nouvelle reçoit l'autre couleur ; les deux sont combinées en
  mode « Produit ». Le commun devient foncé, ce qui n'existe que d'un côté garde sa couleur.
- Bibliothèques (dans `../vendor/`) : [pdf.js](https://github.com/mozilla/pdf.js) 6.4.299 (Apache 2.0)
  et [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1 (MIT).

Tout reste sur l'appareil : aucun fichier n'est envoyé. Les réglages sont mémorisés dans `localStorage`.
