# acheruel.github.io

Site personnel d'Anthony Chéruel : https://acheruel.github.io

Page statique (HTML, CSS, JS, sans étape de compilation) publiée par GitHub Pages depuis la branche `main`.

## Modifier le contenu

Tout le contenu est dans [`assets/js/content.js`](assets/js/content.js) :

- **Ajouter un outil** : une entrée dans `TOOLS` (nom du repo, logo dans `assets/logos/`, textes FR/EN). Le lien vers l'outil est `https://acheruel.github.io/<repo>/` et la date de mise à jour est lue en direct depuis GitHub.
- **Ouvrir une section** (Accueil, Curriculum Vitae, Ressources) : créer la page (`cv/index.html`, etc.) puis passer `ready: true` dans `SECTIONS`.
- **Textes de l'interface** : `I18N.fr` et `I18N.en`.

Style : voir `Design_Quicker.md` (famille Quicker).

## Aperçu local

```bash
python -m http.server 8791
```

puis ouvrir http://localhost:8791.
