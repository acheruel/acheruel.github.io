# MarkDownO Lab 0.3 — protocole

Le [lab](../lab/) affiche les sorties réellement produites par cinq moteurs, les pages PDF de
référence et leurs mesures. Il convertit aussi un PDF personnel avec PDFo ou MarkItDown dans
le navigateur. Les autres moteurs restent des programmes Python locaux ; importer leur `.md`
ne constitue pas un essai chronométré. Pas de serveur de conversion ou d’API payante.

## Rejouer

Python 3.12, Chromium, Tesseract 5 et les données `eng`/`osd` doivent être disponibles.
Les poids Docling et les dépendances sont téléchargés au premier lancement ; les documents
restent locaux. L’environnement mesuré utilise Torch CPU, pas les paquets CUDA.

```sh
python -m venv .venv-benchmark
.venv-benchmark/bin/pip install torch==2.10.0+cpu torchvision==0.25.0+cpu --index-url https://download.pytorch.org/whl/cpu
.venv-benchmark/bin/pip install -r outils/markdowno/benchmark/requirements.lock
git clone https://github.com/ibrahimqureshae/mdflux.git /tmp/mdflux
git -C /tmp/mdflux checkout 45bff8197c7a52fe2f1b0e2bc352833e8e4af6ba
```

Le lock inclut `pymupdf4llm==2.1` (shim vers PyMuPDF 2.1), `markitdown==0.1.9`,
`docling==2.149.0`, `rapidocr==3.10.0`. Pour reconstruire le corpus depuis les PDF complets :

```sh
.venv-benchmark/bin/python outils/markdowno/benchmark/prepare.py --originals /tmp/fhwa --output outils/markdowno/lab/data --fetch
```

Les PDF complets ne sont pas ajoutés au dépôt. Les extraits présents permettent de rejouer exactement
les entrées mesurées ; une régénération avec une autre version de ReportLab/PyMuPDF peut changer les
octets et les SHA. Ne mélangez pas un nouveau corpus avec les anciens résultats.

Depuis la racine du dépôt, lancer les moteurs **successivement** :

```sh
export OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=4
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine markitdown --data outils/markdowno/lab/data
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine pymupdf --data outils/markdowno/lab/data
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine mdflux --mdflux /tmp/mdflux --data outils/markdowno/lab/data
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine docling --data outils/markdowno/lab/data
python -m http.server 8765 --bind 127.0.0.1
```

Dans un second terminal, après les quatre moteurs Python :

```sh
.venv-benchmark/bin/python outils/markdowno/benchmark/browser.py --data outils/markdowno/lab/data
.venv-benchmark/bin/python outils/markdowno/benchmark/evaluate.py --data outils/markdowno/lab/data
python -m unittest discover -s outils/markdowno/benchmark -p 'test_*.py'
.venv-benchmark/bin/python outils/markdowno/benchmark/ui_test.py
```

Ouvrir `http://127.0.0.1:8765/outils/markdowno/lab/`. `browser.py --chromium` permet de choisir
l’exécutable Chromium. `run.py --only native scan mixed` limite les documents et `--repeats` les
répétitions (attention : cela remplace le fichier de résultats du moteur).

Pour votre propre PDF, choisir un dossier distinct du corpus fourni :

```sh
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine docling --file /chemin/manuel.pdf --data /tmp/mon-essai
.venv-benchmark/bin/python outils/markdowno/benchmark/run.py --engine pymupdf --file /chemin/manuel.pdf --data /tmp/mon-essai
```

Les Markdown sont dans `/tmp/mon-essai/<moteur>/custom/output.md`, les images à côté,
les temps dans `/tmp/mon-essai/<moteur>.json`. Importer les deux `.md` dans les panneaux du lab
avec le même PDF local (ou un extrait de 30 pages maximum). L’import `.md` seul ne transporte
pas les images : consulter aussi le dossier produit par le script.

## Ce qui est mesuré

- Cinq entrées : deux extraits de quatre pages FHWA, un tableau/dessin natif, la même page
  rasterisée à 144 dpi, et une page mixte texte + tableau rasterisé. Onze pages au total.
- Trois conversions par entrée/moteur. Première passe séparée ; médiane des deux suivantes.
  Même instance du moteur réutilisée. Le premier document Docling inclut le chargement et le
  téléchargement des poids dans sa première passe. Les suivantes profitent du cache.
- Chronomètre Python : appel de conversion + export Markdown/images/JSON Docling. Imports et
  instanciation consignés séparément (`setup_s`). Installation et réseau initial non comparables
  aux performances récurrentes. Aucun temps « à chaud » extrapolé à 709 ou 291 pages.
- PDFo : ouverture pdf.js + extraction + rendu et encodage des recadrages. Téléchargement du PDF
  depuis le serveur local avant le chronomètre. Le moteur PDFo réel est importé sans modification.
- RSS : maximum cumulatif du processus Python, pas une allocation par document. Pas de chiffre
  mémoire Chromium directement comparable. Trois vCPU visibles, quota de deux CPU, RAM 8 Gio,
  AMD EPYC 9V74, Linux x86_64. Les bibliothèques configurables utilisent quatre threads.
- Les temps natifs MarkItDown ne représentent **pas** la vitesse de Pyodide. Dans le lab, un essai
  local MarkItDown sépare le chargement Python du temps de conversion et signale une seule passe.
- MDFlux : fonctions OCR/détection/nettoyage du sidecar au commit épinglé, toutes les règles
  déterministes activées, pas de réécriture LLM, pas de chronométrage de l’application Tauri.
- Docling : pipeline standard CPU, TableFormer par défaut, Tesseract CLI anglais, OCR par zones,
  images x2. Ce n’est pas Granite Docling ni le pipeline WebGPU de Parsade.
- PyMuPDF 2.1 : `pymupdf4llm.to_markdown`, layout/OCR automatiques par défaut, RapidOCR installé,
  images PNG 144 dpi. Ne pas généraliser aux anciennes versions 0.x de PyMuPDF4LLM.

## Qualité et traçabilité

`corpus.json` donne URLs, SHA-256, pages originales et correspondance des pages des extraits.
Chaque résultat contient ses temps bruts, version, métriques et sondes de qualité. Les `.md`, images
et JSON Docling sont conservés. Le ZIP du lab contient Markdown, images et manifeste de provenance.
Les pages FHWA conservent leurs mentions de source, notamment les illustrations créditées à des tiers.

Les sondes synthétiques vérifient les chiffres, deux associations ligne/valeurs, les colonnes et
les libellés de figure. Les six sondes FHWA vérifient quelques relations numériques lues dans les
images originales. Une absence ou une mise en forme différente peut faire échouer une sonde ;
un succès ne valide pas les autres cellules. Les compteurs de caractères, titres, lignes de tableaux
et images **ne sont pas des scores de précision**. Le rapport contient le contrôle visuel complémentaire.

## Limites du prototype

Corpus volontairement petit et difficile, anglais, sans annotation exhaustive, ni test statistique,
ni mesure des réponses d’un LLM, ni validation de toutes les équations. Pas de fusion de tableaux
sur pages consécutives testée. Sorties des moteurs conservées sans correction éditoriale ; seules
les adresses d’images sont rendues relatives. Parsade et Marker sont étudiés, non chronométrés.
Pas de GPU WebGPU disponible dans le Chromium de test. La conversion des manuels complets et
la précision des cotes/unités sur un corpus plus large restent à qualifier.

Les fichiers locaux sont limités à 20 Mo et 30 pages dans le navigateur pour ce prototype.
Les imports Markdown sont limités à 5 Mo et nettoyés par l’aperçu partagé du site ; ils ne chargent
pas d’images externes. Le lab est en français ; les liens ajoutés aux outils existants sont FR/EN.

## Licences des moteurs

MarkItDown, MDFlux et le code Docling : MIT ; poids à vérifier séparément. PDF.js : Apache-2.0.
PyMuPDF : AGPL-3.0 ou licence commerciale Artifex, avec dépendances à vérifier avant intégration.
Les moteurs Python ne sont pas redistribués dans le site. Leurs sorties d’essai sont présentes.
Marker : le README consulté annonce Apache-2.0 pour le code et des conditions distinctes pour
les poids. Les licences et modèles évoluent : consulter les sources liées au rapport.
