"""Génère le PDF d'exemple de PDFo Converto (données fictives) : un rapport d'inspection de
pont de quelques pages, avec signets (chapitres), titres, listes, tableaux et un schéma.

Utilisation : python generer_exemple.py  (nécessite PyMuPDF : pip install pymupdf)
"""
import io
import pathlib

import pymupdf as fitz

ICI = pathlib.Path(__file__).parent

CSS = """
* { font-family: sans-serif; }
body { font-size: 10pt; line-height: 1.4; }
h1 { font-size: 18pt; margin: 0 0 6pt; color: #102d41; }
h2 { font-size: 13.5pt; margin: 14pt 0 5pt; color: #102d41; }
h3 { font-size: 11pt; margin: 10pt 0 4pt; }
p { margin: 0 0 6pt; text-align: justify; }
ul, ol { margin: 0 0 6pt 0; }
li { margin: 0 0 2pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; }
td, th { border: 0.6pt solid #445; padding: 3pt 5pt; font-size: 9pt; }
th { background: #dfe8ee; text-align: left; }
.meta { color: #566e7c; font-size: 9pt; }
"""

HTML = """
<h1>Rapport d'inspection générale — Pont P-00000</h1>
<p class="meta">Exemple fictif pour PDFo Converto · Inspection du 2026-10-14 · Rédigé par A.C.</p>

<h2>1. Introduction</h2>
<p>Le présent rapport décrit l'état du pont P-00000, un ouvrage à deux travées continues en poutres d'acier et dalle de béton, construit en 1978. L'inspection a été réalisée à pied et à l'aide d'une nacelle, conformément au manuel d'inspection des structures.</p>
<p>Les constats sont regroupés par élément. Chaque élément reçoit une cote d'état de 1 (très mauvais) à 6 (excellent), selon la gravité et l'étendue des défauts observés.</p>

<h2>2. Description de l'ouvrage</h2>
<table>
<tr><th>Caractéristique</th><th>Valeur</th></tr>
<tr><td>Longueur totale</td><td>49,5 m</td></tr>
<tr><td>Travées</td><td>24,0 m + 25,5 m</td></tr>
<tr><td>Largeur hors tout</td><td>12,0 m</td></tr>
<tr><td>Type de poutres</td><td>Acier, 4 lignes de poutres</td></tr>
<tr><td>Année de construction</td><td>1978</td></tr>
</table>
<p>L'ouvrage franchit la rivière Exemple. Le débit de crue de récurrence 100 ans est estimé à 310 m³/s.</p>

<h2>3. Constats par élément</h2>
<h3>3.1 Dalle et revêtement</h3>
<ul>
<li>Fissures transversales espacées d'environ 1,5 m sur toute la longueur.</li>
<li>Désenrobage local près du joint de dilatation sud, sur une surface de 0,8 m².</li>
<li>Revêtement bitumineux orniéré dans la voie en direction nord.</li>
</ul>
<h3>3.2 Poutres et entretoises</h3>
<p>La corrosion est généralisée sur les semelles inférieures près des appuis. Une perte de section estimée à 15 % est observée sur la poutre G3, à l'appui de la culée nord.</p>
<ol>
<li>Nettoyer et repeindre les extrémités des poutres sur 3 m.</li>
<li>Mesurer l'épaisseur résiduelle de la semelle de G3 par ultrasons.</li>
<li>Réévaluer la capacité portante si la perte dépasse 20 %.</li>
</ol>
<h3>3.3 Appareils d'appui</h3>
<p>Les appareils d'appui en élastomère de la pile présentent un léger bombement. Aucun déplacement anormal n'a été mesuré.</p>

<h2>4. Cotes d'état</h2>
<table>
<tr><th>Élément</th><th>Cote</th><th>Défaut principal</th><th>Urgence</th></tr>
<tr><td>Dalle</td><td>4</td><td>Fissuration, désenrobage local</td><td>Moyen terme</td></tr>
<tr><td>Poutres</td><td>3</td><td>Corrosion aux appuis</td><td>Court terme</td></tr>
<tr><td>Appareils d'appui</td><td>4</td><td>Bombement léger</td><td>Surveillance</td></tr>
<tr><td>Culées</td><td>5</td><td>Efflorescence</td><td>Aucune</td></tr>
<tr><td>Pile</td><td>4</td><td>Affouillement mineur</td><td>Moyen terme</td></tr>
</table>

<h2>5. Recommandations</h2>
<p>Les interventions suivantes sont recommandées, par ordre de priorité :</p>
<ol>
<li>Réparer les extrémités des poutres et la semelle de G3 d'ici deux ans.</li>
<li>Réparer la dalle près du joint sud et remplacer le joint.</li>
<li>Installer un enrochement de protection autour de la pile.</li>
<li>Planifier la réfection du revêtement lors des travaux sur la dalle.</li>
</ol>
<p>Une inspection approfondie des poutres est recommandée dans les douze mois, avec relevé d'épaisseurs et inspection rapprochée des assemblages boulonnés.</p>

<h2>6. Conclusion</h2>
<p>Le pont est en état passable. Sa capacité n'est pas compromise à court terme, mais la corrosion des poutres aux appuis doit être traitée rapidement pour éviter une restriction de charge.</p>
"""


def main():
    buf = io.BytesIO()
    writer = fitz.DocumentWriter(buf)
    story = fitz.Story(html=HTML, user_css=CSS)
    page_rect = fitz.paper_rect("letter")
    where = page_rect + (72, 72, -72, -72)
    more = True
    while more:
        dev = writer.begin_page(page_rect)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
    writer.close()
    doc = fitz.open("pdf", buf.getvalue())
    # Pied de page, petit schéma en page 2 et signets (un par chapitre).
    toc = []
    for i, page in enumerate(doc):
        page.insert_text((72, 760), f"Rapport d'inspection P-00000 · page {i + 1} de {len(doc)}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                txt = "".join(s["text"] for s in line["spans"]).strip()
                size = max(s["size"] for s in line["spans"])
                if size >= 13 and txt[:2] in {f"{n}." for n in range(1, 10)}:
                    toc.append([1, txt, i + 1])
    doc.set_toc([[1, "Rapport d'inspection générale", 1]] + [[2, t, p] for _, t, p in toc])
    doc.set_metadata({"title": "Rapport d'inspection générale — Pont P-00000 (exemple)", "author": "Exemple PDFo Converto"})
    doc.save(ICI / "rapport-inspection-exemple.pdf", garbage=3, deflate=True)
    print("rapport-inspection-exemple.pdf", len(doc), "pages,", len(toc), "chapitres")


if __name__ == "__main__":
    main()
