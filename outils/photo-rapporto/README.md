# Photo Rapporto

Rapport photo PDF en quelques minutes, directement dans le navigateur : https://acheruel.github.io/outils/photo-rapporto/

1. **Photos** : ajout par glisser-déposer, sélection ou appareil photo (mobile), aperçu en grille,
   agrandissement, réorganisation (poignée ou flèches), rotation, suppression, tri par date de prise
   (EXIF) ou par nom.
2. **Informations** : titre, projet, n° de projet, n° de contrat, client, lieu, auteur, dates, météo,
   introduction et champs libres. Mémorisés dans le navigateur, avec des **modèles** enregistrables
   (logo compris).
3. **Aperçu et export** : aperçu fidèle des pages, puis PDF Lettre ou A4, portrait ou paysage,
   1, 2, 4 ou 6 photos par page, page de garde facultative, légendes, date et numéro de chaque
   photo, en-tête et pied de page (« Page x / N ») sur chaque page.

Inspiré de la mise en page des rapports photo de CompanyCam et de Fieldwire (page de garde avec
les informations du projet, grille de photos numérotées et légendées).

Tout reste sur l'appareil : informations dans `localStorage`, photos et légendes dans IndexedDB
pour reprendre un rapport après un rechargement.

- `index.html` : page ; `app.js` : interface ; `pdf.js` : mise en page partagée par l'aperçu
  (canevas) et l'export ; `styles.css`.
- `vendor/` : [jsPDF](https://github.com/parallax/jsPDF) 4.2.1 et
  [SortableJS](https://github.com/SortableJS/Sortable) 1.15.7, licence MIT (fichiers de licence joints).
