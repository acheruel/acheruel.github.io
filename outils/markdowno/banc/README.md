# Banc d'essai PDF vers Markdown

Scripts qui ont produit les résultats du [comparateur](../comparateur/) : ils lancent chaque outil sur
les mêmes PDF, puis notent les sorties avec une vérité terrain relevée à la main.

## Documents

Deux manuels de la FHWA (domaine public) :

- [FHWA-HIF-18-046](https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf), *Manual for Refined Analysis in
  Bridge Design and Evaluation*, 709 pages : tableaux vectoriels, cellules fusionnées, équations en image.
- [FHWA-IF-12-027](https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf), *Manual for Design,
  Construction, and Maintenance of Orthotropic Steel Bridges*, 291 pages : **tableaux insérés comme images**.

`make_samples.py` en tire deux extraits (32 et 28 pages) choisis pour leurs tableaux, figures et
équations, en gardant les signets du PDF. Les extraits sont dans `../comparateur/donnees/`.

## Lancer

```sh
mkdir pdfs && curl -L -o pdfs/hif18046.pdf https://www.fhwa.dot.gov/bridge/pubs/hif18046.pdf
curl -L -o pdfs/if12027.pdf https://www.fhwa.dot.gov/bridge/pubs/if12027/if12027.pdf
python make_samples.py                     # pdfs/*-extrait.pdf

# un environnement Python par famille d'outils (les versions se contredisent)
pip install "markitdown[pdf]==0.1.9" pymupdf4llm opendataloader-pdf rapidocr onnxruntime tiktoken
python run_tool.py markitdown pdfs/hif18046-extrait.pdf out/markitdown
python run_tool.py pymupdf4llm pdfs/hif18046-extrait.pdf out/pymupdf4llm          # + Layout + OCR
python run_tool.py pymupdf4llm-classic pdfs/hif18046-extrait.pdf out/pymupdf4llm-classic
python run_tool.py opendataloader pdfs/hif18046-extrait.pdf out/opendataloader      # Java 11+
node run_converto.js pdfs/hif18046-extrait.pdf out/converto/hif18046-extrait.md     # Playwright

pip install docling      # autre environnement
python run_tool.py docling pdfs/hif18046-extrait.pdf out/docling
pip install marker-pdf   # autre environnement
python run_tool.py marker pdfs/hif18046-extrait.pdf out/marker

python score.py          # tableau des notes + resultats.json
python exporter.py ../comparateur/donnees   # met à jour le comparateur
```

Docling et Marker téléchargent leurs modèles depuis Hugging Face au premier lancement.

## Ce qui est noté (`score.py`)

| Mesure | Définition |
| --- | --- |
| Vitesse | secondes de conversion (chargement des modèles exclu), un seul processus |
| Texte | part des mots du PDF retrouvés dans la sortie ; ordre de lecture (plus longue sous-suite commune) |
| Titres | titres du sommaire (signets) retrouvés comme titres Markdown `#` |
| Tableaux | `verite.json` : 39 lignes de 11 tableaux. Une ligne compte si toutes ses valeurs sont dans une même ligne de tableau (Markdown ou HTML) ; « valeurs » si elles sont présentes n'importe où |
| Équations | 3 équations dessinées en image : leurs nombres sont-ils lus ? |
| Figures | images extraites et liées ; légendes « Figure N. » retrouvées |
| Questions RAG | la sortie est coupée en morceaux d'environ 1 200 caractères ; la réponse doit être dans un des 3 morceaux les mieux classés (BM25) |
| Jetons | taille pour une IA : vocabulaire o200k si tiktoken peut le charger, sinon caractères / 4 (cas des résultats publiés) |
