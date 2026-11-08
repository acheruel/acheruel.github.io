# MarkDownO update 0.3 — comparaison mesurée

8 novembre 2026. Demande : [MarkDowno update 0.3 dans Notion](https://app.notion.com/p/412e798a151f80e1b37cd0eba78bcd97).

## Recommandation

**Ne pas remplacer MarkDownO par un moteur unique présenté comme fiable pour les normes.**
PyMuPDF 2.1 est le meilleur candidat de cet essai pour un mode PDF rapide avec OCR ; Docling
est un candidat complémentaire pour la structure et la provenance. Tous deux commettent des
erreurs numériques sur un vrai tableau. Pour les manuels de conception, la bonne unité de sortie
est un **paquet Markdown + images + tables structurées + provenance**, pas seulement un `.md`.

Conserver MarkItDown pour Office et les formats multiples. Garder le moteur PDFo pour une voie
navigateur légère et pour ses tableaux HTML à cellules fusionnées. Mettre à l’essai un pipeline
hybride avant d’en faire le convertisseur PDF par défaut. Le prototype livré permet précisément
de voir ces différences et de rejouer la comparaison.

## Corpus et méthode

Les deux PDF demandés ont été téléchargés et inspectés :

| Document | Taille complète | Pages physiques retenues | Pourquoi |
|---|---:|---|---|
| [FHWA-HIF-18-046](https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf), Manual for Refined Analysis in Bridge Design and Evaluation | 709 pages | 54, 85, 598, 660 | Dessins/cotes, tableau numérique, en-têtes fusionnés, tableau dense |
| [FHWA-IF-12-027](https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf), Manual for Design, Construction, and Maintenance of Orthotropic Steel Bridges | 291 pages | 34, 60, 128, 241 | Figures, tableaux en image, texte mixte et valeurs de fatigue |

Trois fixtures contrôlées ajoutent : tableau natif et dessin ; même page entièrement numérisée ;
paragraphe sélectionnable avec tableau incorporé comme image. **11 pages distinctes, 5 moteurs,
3 passages = 75 conversions de fichiers et 25 sorties finales conservées.** C’est un échantillon
ciblé, pas la conversion intégrale des 1 000 pages, ni une estimation de précision globale.

Même machine CPU, moteurs exécutés successivement : AMD EPYC 9V74, 3 vCPU visibles/quota 2 CPU,
8 Gio RAM, Python 3.12.14, Chromium 156.0.8078.79. Quatre threads lorsque configurable.
Versions, SHA-256 et temps bruts dans [les données](../lab/data/). [Protocole et commandes](README.md).

La médiane ci-dessous porte sur les passages 2 et 3. Les imports/init Python sont exclus et
consignés séparément. PDFo inclut le rendu des recadrages ; Docling inclut aussi son export JSON.
**MarkItDown natif n’est pas un chronométrage de Pyodide.** Aucun service LLM payant ou nettoyage
génératif n’a été utilisé.

## Vitesse observée

| Moteur / configuration | HIF, 4 pages | IF, 4 pages | Fixture scan, 1 page | Fixture mixte, 1 page |
|---|---:|---:|---:|---:|
| MarkItDown 0.1.9, Python | 0,324 s | 0,293 s | 0,012 s, sortie vide | 0,013 s, tableau absent |
| PDFo / pdf.js 6.4.299, navigateur + images | 0,520 s | 0,610 s | 0,171 s, image sans OCR | 0,127 s, image sans OCR |
| MDFlux sidecar + RapidOCR 3.10 + règles | 0,319 s | 0,303 s | 2,585 s | 0,012 s, tableau absent |
| PyMuPDF 2.1 / 4LLM, layout + OCR auto | 3,185 s | 8,902 s | 1,825 s | 1,280 s |
| Docling 2.149, TableFormer + Tesseract anglais | 24,754 s | 19,510 s | 4,259 s | 2,596 s |

La première conversion HIF de Docling a pris 61,649 s, chargement/téléchargement des poids compris,
contre 25,699 et 23,810 s ensuite. Ce premier coût n’est pas une mesure pure du moteur. RSS maximal
cumulatif Python : ~158 Mio MarkItDown, 729 Mio MDFlux après OCR, 840 Mio PyMuPDF, 2 122 Mio Docling.
Ces maximums ne sont pas la consommation supplémentaire d’un document ; Chromium n’est pas comparé
sur cette métrique. Deux passages chauds ne suffisent pas à établir une distribution robuste.
Tesseract a signalé « Too few characters » lors de la détection d’orientation de petites zones
sur les deux extraits FHWA. Docling a terminé les conversions ; cela ne signifie pas que toutes
les zones ont été reconnues correctement.

## Qualité : ce qui change réellement le sens

### 1. Un PDF contenant du texte peut cacher un tableau entièrement rasterisé

IF, page physique **128** (page imprimée 99), tableau 5-1 : seul le titre est sélectionnable.
MarkItDown et MDFlux n’en produisent pas les cellules. Le détecteur MDFlux considère l’extrait
comme un PDF textuel et n’active pas l’OCR de ce tableau. PDFo en conserve une image lisible.
PyMuPDF récupère du texte dans l’image, mais traite cette page surtout comme une figure avec texte
OCR aplati. Docling produit un tableau, mais perd des catégories de fatigue et lit `Cc` au lieu
de `C`. Une structure visible ne garantit pas la fidélité.

### 2. Les décimales sont un critère bloquant

IF, page physique **241** (imprimée 212), tableau 11-3. Contrôle visuel du PDF :

| Cellule source | PyMuPDF | Docling |
|---|---|---|
| Rib Spice (Max) : **34.3 / 48.0** MPa | **343 / 480** | 34.3 / 48.0 |
| Deck Plate Splice : **40.0** MPa | 40.0 | **490** |
| RF (FB.) : **28.3** MPa | 28.3 | **283** |

Ces erreurs sont présentes dans les sorties brutes conservées. Aucun correctif silencieux n’a
été appliqué. PDFo préserve l’image du tableau, mais ne transcrit pas ces valeurs ; MarkItDown et
MDFlux les omettent. Pour un LLM de conception, une valeur erronée bien formatée peut être plus
trompeuse qu’une absence explicite.

### 3. Le moteur existant a un avantage à conserver

HIF, page physique **598** (imprimée 558), tableaux 94 et 95 : PDFo conserve les en-têtes fusionnés
avec `rowspan`/`colspan` en HTML et joint l’image du tableau. PyMuPDF coupe par exemple
« Span 1 Tendon T1 » en fragments sur deux colonnes ; les chiffres restent là mais l’en-tête
perd sa relation. Le mode « tout en Markdown » est une régression pour ce type de tableau.

### 4. OCR, figures et ordre de lecture sont des problèmes distincts

Sur la fixture scannée, MDFlux récupère les chiffres mais pas la structure de tableau ; PyMuPDF
et Docling conservent les deux lignes/valeurs testées. Sur la fixture mixte, seuls ces deux moteurs
retrouvent ces relations. Le test de deux colonnes réussit avec PyMuPDF natif et scanné, et Docling
natif ; il échoue pour le scan Docling, dont une zone est retournée/mal lue. Le dessin vectoriel
très simple de la fixture n’est pas toujours exporté comme image (notamment PDFo), même si ses
libellés restent dans le texte. Aucun moteur n’a été testé ici comme interprète fiable du sens
d’un diagramme.

Les sondes FHWA vérifient **six associations numériques précises** : PDFo 2/6, MarkItDown 1/6,
MDFlux 1/6, PyMuPDF 5/6, Docling 4/6. Ces petits comptes ne sont **pas un score global** et ne
comptent pas la lisibilité des images préservées. Les treize sondes synthétiques servent de
contrôles supplémentaires. Elles sont définies dans `run.py` / `evaluate.py`, avec contre-tests
pour les décimales perdues et le texte aplati.

## Comparaison des solutions

| Solution | Ce qu’on retient | Limites pour ce projet |
|---|---|---|
| [MarkItDown](https://github.com/microsoft/markitdown) | Excellent socle multiformat ; déjà intégré en Pyodide ; MIT | PDF natif testé sans OCR ni images ; ne suffit pas aux tableaux rasterisés |
| [PDFo Converto](../../pdfo-converto/) | Gratuit en navigateur, images/cotes/légendes, HTML fusionné, ZIP ; code réutilisé directement | Heuristiques, pas d’OCR, figure simple parfois manquée, ordre des colonnes à améliorer |
| [MDFlux](https://github.com/ibrahimqureshae/mdflux/tree/45bff8197c7a52fe2f1b0e2bc352833e8e4af6ba) | Bonne UX de lot, progression/annulation, diagnostics, OCR local, comparaison avant/après nettoyage | Wrapper MarkItDown, pas une nouvelle reconnaissance de tableaux ; OCR déclenché au niveau document ; application Tauri non chronométrée |
| [Docling](https://github.com/docling-project/docling) | Document structuré, provenance par blocs, OCR, tableaux, images, JSON ; code MIT | Plus lent et lourd en CPU ; OCR numérique imparfait ; poids/licences à vérifier ; standard ≠ Granite VLM |
| [Parsade](https://parsade.com/) | Architecture intéressante sans serveur : pdf.js → Granite Docling 258M WebGPU → docling-core Pyodide | **Non chronométré** : `navigator.gpu` existe mais `requestAdapter()` retourne null dans ce Chromium. Le site annonce ~1,15 Go de poids par défaut (~262 Mo en version réduite) + ~25 Mo Python. Ce sont ses chiffres, pas nos mesures |
| [PyMuPDF / 4LLM](https://github.com/pymupdf/PyMuPDF) | Meilleur compromis vitesse/OCR sur cet échantillon ; images et layout automatiques en 2.1 | Décimales et en-têtes fusionnés encore fragiles ; AGPL-3.0 ou licence commerciale ; paquet 4LLM 2.1 devenu un shim vers PyMuPDF, contrairement aux versions historiques |
| [Marker](https://github.com/datalab-to/marker) | Candidat ultérieur pour formules et récupération visuelle ; modes CPU/GPU | **Étude documentaire uniquement**, pas de temps ni résultat inventé. Serveur d’inférence/modèles supplémentaires. README actuel : code Apache-2.0, poids avec conditions OpenRAIL-M modifiées |

Les sources en ligne ont été consultées le 8 novembre 2026. Les fonctions annoncées par leurs
README ne sont pas toutes celles des versions épinglées testées. Les affirmations de performance
commerciales de MDFlux, Parsade et Marker n’ont pas été reprises comme résultats du banc.

## Suite proposée

1. **Unifier l’entrée PDF → Markdown dans MarkDownO**, avec un mode navigateur léger et un mode
   avancé local. Conserver Office et autres formats sur MarkItDown. Pas de clé API dans le site statique.
2. **Prototype avancé PyMuPDF + contrôle Docling**, sans moyenne ni vote aveugle sur les chiffres.
   Identifier les désaccords, signaler les cellules à vérifier, garder les pixels source. Choisir
   l’intégration seulement après validation des licences et des coûts de calcul.
3. **Contrat d’export commun** : Markdown, tables HTML/JSON avec unités et cellules fusionnées,
   images de chaque tableau/figure, index source (SHA, page physique et imprimée si disponible,
   rectangle, légende), moteur/version/options et avertissements d’OCR. Les sorties natives du lab
   restent distinctes pour rendre leurs défauts observables ; elles ne réalisent pas encore ce contrat complet.
4. **OCR par zone**, même en présence de texte sélectionnable sur la page ; description visuelle
   optionnelle et explicitement étiquetée pour les figures. Un LLM textuel ne comprend pas un schéma
   parce qu’un lien PNG existe. Interdire la réécriture automatique non contrôlée des valeurs de normes.
5. **Validation avant bascule** : corpus annoté plus large (FR/EN, tables multipages, unités,
   cellules fusionnées, formules, légendes), exactitude cellule/unité/association, rappel des figures,
   ordre de lecture et réponses LLM avec citation de page ; tests sur les manuels complets, laptop CPU
   et machine WebGPU réelle pour Parsade. Exiger zéro erreur sur les cellules critiques annotées,
   sinon conserver l’avertissement et la vérification manuelle.

### PDFo Converto : lien maintenant, migration ensuite

**Oui à un seul produit spécialisé ; non à une suppression avant validation du remplaçant.**
Le changement livré ajoute un lien vers le lab dans PDFo Converto et MarkDownO, et corrige le
message trop général disant que PDFo donne toujours un meilleur résultat. Les fonctions actuelles
restent accessibles pendant le comparatif. Après validation, déplacer l’interface Markdown dans
MarkDownO, garder un lien/redirection depuis PDFo, et partager l’extracteur nécessaire à Word.
Il ne faut pas supprimer `extract.js`/`writers.js` qui servent également à DOCX.

## Livrable et limites

[Prototype statique](../lab/) : cinq moteurs sur les mêmes extraits, vue brute/rendue, source
visuelle, téléchargement ZIP avec images et provenance, import Markdown externe signalé comme
non chronométré, conversion locale PDFo/MarkItDown. Exécuter les autres moteurs avec le CLI fourni.
Scripts, lock de dépendances, résultats bruts et tests sont dans le dépôt.

Pas de conversion intégrale, de benchmark GPU/Parsade/Marker, de test sur documents français,
de jugement exhaustif des équations, ni de score de réponses LLM dans ce lot. Le lab est en français.
Ces limites empêchent de désigner un « meilleur outil ultime » général ; elles n’empêchent pas
de choisir les prochaines intégrations à tester sur des preuves concrètes.
