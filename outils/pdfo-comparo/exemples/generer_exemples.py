"""Génère les PDF d'exemple de PDFo Comparo (données fictives).

1. Plans : un jeu de plans de pont en révision A (3 feuillets) et B (4 feuillets).
   La révision B ajoute un feuillet (plan des fondations), modifie une travée, des notes,
   la dalle et le cartouche, et elle est « imprimée » avec une autre configuration :
   tout le contenu est réduit à 98,5 % et décalé, comme avec un autre traceur.
2. Devis : un devis technique de 3 pages (v1) et sa version 2 de 4 pages : un paragraphe
   ajouté qui fait glisser le texte, des valeurs changées, une phrase retirée, une section
   ajoutée et des marges différentes.

Utilisation : python generer_exemples.py  (nécessite PyMuPDF : pip install pymupdf)
"""
import pathlib

import pymupdf as fitz

ICI = pathlib.Path(__file__).parent
W, H = 1224, 792  # Tabloïd 11 × 17 po, paysage
NOIR = (0.08, 0.1, 0.12)
GRIS = (0.45, 0.48, 0.5)


# ---------------------------------------------------------------- Plans
class Dessin:
    """Petites primitives de dessin technique sur une page PyMuPDF."""

    def __init__(self, page):
        self.page = page

    def ligne(self, x1, y1, x2, y2, w=0.8, c=NOIR, dashes=None):
        self.page.draw_line((x1, y1), (x2, y2), color=c, width=w, dashes=dashes)

    def rect(self, x, y, w, h, lw=0.8, c=NOIR, fill=None):
        self.page.draw_rect(fitz.Rect(x, y, x + w, y + h), color=c, width=lw, fill=fill)

    def poly(self, pts, lw=0.8, c=NOIR, fill=None, fermer=True):
        self.page.draw_polyline(pts + ([pts[0]] if fermer else []), color=c, width=lw, fill=fill)

    def texte(self, x, y, s, size=8, bold=False, c=NOIR, rot=0):
        self.page.insert_text((x, y), s, fontsize=size, fontname="hebo" if bold else "helv", color=c, rotate=rot)

    def texte_centre(self, x, y, s, size=8, bold=False):
        f = fitz.Font("hebo" if bold else "helv")
        self.texte(x - f.text_length(s, fontsize=size) / 2, y, s, size, bold)

    def cote_h(self, x1, x2, y, valeur, size=7.5):
        """Cote horizontale avec traits de rappel et obliques."""
        self.ligne(x1, y, x2, y, 0.5)
        for x in (x1, x2):
            self.ligne(x, y - 6, x, y + 6, 0.5)
            self.ligne(x - 3, y + 3, x + 3, y - 3, 0.9)
        self.texte_centre((x1 + x2) / 2, y - 3, valeur, size)

    def cote_v(self, x, y1, y2, valeur, size=7.5):
        self.ligne(x, y1, x, y2, 0.5)
        for y in (y1, y2):
            self.ligne(x - 6, y, x + 6, y, 0.5)
            self.ligne(x - 3, y + 3, x + 3, y - 3, 0.9)
        f = fitz.Font("helv")
        self.texte(x - 3, (y1 + y2) / 2 + f.text_length(valeur, fontsize=size) / 2, valeur, size, rot=90)

    def hachures(self, x, y, w, h, pas=7):
        for i in range(int((w + h) / pas) + 1):
            d = i * pas
            xa, ya = x + min(d, w), y + max(0, d - w)
            xb, yb = x + max(0, d - h), y + min(d, h)
            self.ligne(xa, ya, xb, yb, 0.35, GRIS)


def cadre_et_cartouche(d, feuillet, titre, rev, revisions):
    d.rect(18, 18, W - 36, H - 36, 1.6)
    d.rect(24, 24, W - 48, H - 48, 0.5)
    x0, y0 = W - 344, H - 168
    d.rect(x0, y0, 320, 144, 1.2)
    d.ligne(x0, y0 + 56, x0 + 320, y0 + 56, 0.6)
    d.ligne(x0, y0 + 100, x0 + 320, y0 + 100, 0.6)
    d.ligne(x0 + 220, y0 + 100, x0 + 220, y0 + 144, 0.6)
    d.texte(x0 + 8, y0 + 14, "PROJET FICTIF — PONT P-00000", 7, True)
    d.texte(x0 + 8, y0 + 26, "Reconstruction du pont sur la rivière Exemple", 7.5)
    d.texte(x0 + 8, y0 + 38, "Exemple synthétique pour PDFo Comparo", 6.5, c=GRIS)
    d.texte(x0 + 8, y0 + 50, "Dessiné : A.C.   Vérifié : —   Échelle : 1:200", 6.5)
    d.texte(x0 + 8, y0 + 74, titre, 11, True)
    d.texte(x0 + 8, y0 + 90, "Ouvrage d'art · Structure", 7.5)
    d.texte(x0 + 8, y0 + 116, "FEUILLET", 6, c=GRIS)
    d.texte(x0 + 8, y0 + 134, feuillet, 14, True)
    d.texte(x0 + 228, y0 + 116, "RÉVISION", 6, c=GRIS)
    d.texte(x0 + 228, y0 + 134, rev, 14, True)
    # Tableau des révisions, au-dessus du cartouche
    ty = y0 - 14 - 14 * len(revisions)
    d.rect(x0, ty, 320, 14 * len(revisions) + 14, 0.6)
    d.texte(x0 + 6, ty + 10, "RÉV.   DATE            DESCRIPTION", 6, True)
    for i, (r, date, desc) in enumerate(revisions):
        yy = ty + 14 * (i + 1)
        d.ligne(x0, yy, x0 + 320, yy, 0.4)
        d.texte(x0 + 8, yy + 10, f"{r}       {date}     {desc}", 6.5)


def feuillet_elevation(d, rev_b):
    travee2 = 25500 if rev_b else 24000
    echelle = 0.0115  # pt par mm
    x0, yt = 90, 250
    l1, l2 = 24000 * echelle, travee2 * echelle
    xp, xf = x0 + l1, x0 + l1 + l2
    # Tablier et poutres
    d.rect(x0 - 10, yt, l1 + l2 + 20, 12, 0.9)
    d.rect(x0 - 10, yt + 12, l1 + l2 + 20, 30, 0.7)
    d.ligne(x0 - 10, yt - 18, xf + 10, yt - 18, 0.5, dashes="[4 3] 0")  # glissière
    for x in range(int(x0), int(xf), 26):
        d.ligne(x, yt - 18, x, yt, 0.4)
    # Culées
    for xc, sens in ((x0, -1), (xf, 1)):
        pts = [(xc - 40 * (sens < 0) + 0, yt + 42), (xc + 40 * (sens > 0), yt + 42),
               (xc + 40 * (sens > 0) + 14 * sens, yt + 150), (xc - 40 * (sens < 0) + 14 * sens, yt + 150)]
        d.poly(pts, 1.1)
        d.rect(min(p[0] for p in pts) - 16, yt + 150, 76, 22, 1.0)
        d.hachures(min(p[0] for p in pts) - 16, yt + 172, 76, 26)
    # Pile
    d.rect(xp - 9, yt + 42, 18, 118, 1.1)
    d.rect(xp - 34, yt + 160, 68, 24, 1.0)
    d.hachures(xp - 34, yt + 184, 68, 24)
    if rev_b:  # pieux ajoutés sous la pile en révision B
        for dx in (-24, 0, 24):
            d.ligne(xp + dx, yt + 184, xp + dx, yt + 250, 1.0, dashes="[6 3] 0")
    # Terrain naturel
    pts = [(40, yt + 120), (x0 + 40, yt + 150), (xp - 60, yt + 205), (xp + 60, yt + 200), (xf - 40, yt + 150), (xf + 120, yt + 115)]
    d.poly(pts, 0.6, GRIS, fermer=False)
    d.texte(xp + 70, yt + 222, "Lit de la rivière", 7, c=GRIS)
    # Cotes
    d.cote_h(x0, xp, yt - 46, "24 000")
    d.cote_h(xp, xf, yt - 46, f"{travee2:,}".replace(",", " "))
    d.cote_h(x0, xf, yt - 74, f"{24000 + travee2:,}".replace(",", " "))
    d.cote_v(x0 - 52, yt, yt + 42, "1 050")
    if not rev_b:  # cote retirée en révision B
        d.cote_v(xp + 46, yt + 42, yt + 160, "4 300")
    d.texte(x0 + l1 / 2 - 30, yt + 64, "TRAVÉE 1", 9, True)
    d.texte(xp + l2 / 2 - 30, yt + 64, "TRAVÉE 2", 9, True)
    d.texte(x0 - 20, yt + 214, "CULÉE NORD", 7.5, True)
    d.texte(xf - 30, yt + 214, "CULÉE SUD", 7.5, True)
    d.texte(xp - 14, yt + 236 if not rev_b else yt + 268, "PILE 1", 7.5, True)
    d.texte_centre((x0 + xf) / 2, 120, "ÉLÉVATION", 13, True)
    d.texte_centre((x0 + xf) / 2, 134, "ÉCHELLE 1:200", 7.5)
    # Notes
    notes = ["NOTES :",
             "1. Béton de la superstructure : 35 MPa, classe d'exposition C-1.",
             "2. Armature : barres crénelées de nuance 400W.",
             "3. Enrobage des armatures du tablier : 60 mm." if not rev_b else "3. Enrobage des armatures du tablier : 75 mm.",
             ]
    if rev_b:
        notes.append("4. Appareils d'appui en élastomère fretté, voir feuillet S-04.")
    for i, n in enumerate(notes):
        d.texte(70, 560 + 15 * i, n, 8.5 if i else 9.5, bold=(i == 0))


def feuillet_fondations(d):
    d.texte_centre(470, 120, "PLAN DES FONDATIONS", 13, True)
    d.texte_centre(470, 134, "ÉCHELLE 1:100", 7.5)
    for xc, nom in ((180, "CULÉE NORD"), (470, "PILE 1"), (760, "CULÉE SUD")):
        d.rect(xc - 70, 200, 140, 260, 1.1)
        d.texte_centre(xc, 480, nom, 8, True)
        for i in range(3):
            for j in range(5):
                cx, cy = xc - 40 + 40 * i, 230 + 50 * j
                d.page.draw_circle((cx, cy), 9, color=NOIR, width=0.9)
                d.ligne(cx - 13, cy, cx + 13, cy, 0.35, GRIS)
                d.ligne(cx, cy - 13, cx, cy + 13, 0.35, GRIS)
        d.cote_h(xc - 70, xc + 70, 186, "3 600")
    d.texte(70, 560, "NOTES :", 9.5, True)
    d.texte(70, 575, "1. Pieux en acier HP 310x110, capacité pondérée 1 400 kN.", 8.5)
    d.texte(70, 590, "2. Refus à confirmer par essais de battage (PDA).", 8.5)


def feuillet_coupe(d, rev_b):
    ep = 250 if rev_b else 225
    d.texte_centre(470, 120, "COUPE TYPE DU TABLIER", 13, True)
    d.texte_centre(470, 134, "ÉCHELLE 1:50", 7.5)
    x0, y0, larg = 170, 240, 600
    h_dalle = ep * 0.12
    d.rect(x0, y0, larg, h_dalle, 1.2)
    d.hachures(x0, y0, larg, h_dalle, 9)
    # Glissières
    for xb in (x0, x0 + larg - 34):
        d.poly([(xb, y0), (xb + 34, y0), (xb + 30, y0 - 70), (xb + 4, y0 - 70)], 1.1)
    # Poutres
    for i in range(4):
        xg = x0 + 75 + i * 150
        d.rect(xg - 30, y0 + h_dalle, 60, 8, 0.9)
        d.rect(xg - 5, y0 + h_dalle + 8, 10, 120, 0.9)
        d.rect(xg - 40, y0 + h_dalle + 128, 80, 10, 0.9)
    for i in range(3):
        d.cote_h(x0 + 75 + i * 150, x0 + 225 + i * 150, y0 + h_dalle + 170, "3 000")
    d.cote_v(x0 - 30, y0, y0 + h_dalle, str(ep))
    if not rev_b:
        d.cote_h(x0, x0 + larg, y0 - 100, "12 000")  # retirée en B
    else:
        d.page.draw_circle((x0 + larg / 2, y0 + h_dalle + 60), 10, color=NOIR, width=1)  # drain ajouté
        d.texte(x0 + larg / 2 + 16, y0 + h_dalle + 63, "Drain Ø 150", 7.5)
    d.texte(70, 560, "NOTES :", 9.5, True)
    d.texte(70, 575, f"1. Épaisseur de la dalle : {ep} mm.", 8.5)
    d.texte(70, 590, "2. Pente transversale : 2 %.", 8.5)


def feuillet_details(d):
    d.texte_centre(470, 120, "DÉTAILS DES APPAREILS D'APPUI", 13, True)
    d.texte_centre(470, 134, "ÉCHELLE 1:10", 7.5)
    for k, xc in enumerate((260, 680)):
        d.rect(xc - 120, 220, 240, 40, 1.1)
        for i in range(5):
            d.ligne(xc - 120, 228 + 6 * i, xc + 120, 228 + 6 * i, 0.4, GRIS)
        d.rect(xc - 150, 260, 300, 24, 1.0)
        d.cote_h(xc - 120, xc + 120, 205, "450")
        d.texte_centre(xc, 320, "APPUI FIXE" if k == 0 else "APPUI MOBILE", 9, True)


def plans(rev_b):
    """Feuillets dessinés à l'échelle 1, puis placés (réduits et décalés en révision B)."""
    brouillon = fitz.open()
    revs = [("A", "2026-09-15", "Émis pour commentaires")]
    if rev_b:
        revs.append(("B", "2026-11-07", "Émis pour soumission"))
    rev = "B" if rev_b else "A"
    feuillets = [("S-01", "ÉLÉVATION", lambda d: feuillet_elevation(d, rev_b))]
    if rev_b:
        feuillets.append(("S-02", "FONDATIONS", feuillet_fondations))
    feuillets += [("S-02" if not rev_b else "S-03", "COUPE TYPE", lambda d: feuillet_coupe(d, rev_b)),
                  ("S-03" if not rev_b else "S-04", "DÉTAILS", feuillet_details)]
    for num, titre, dessin in feuillets:
        page = brouillon.new_page(width=W, height=H)
        d = Dessin(page)
        cadre_et_cartouche(d, num, titre, rev, revs)
        dessin(d)
    if not rev_b:
        return brouillon
    # Révision B : autre configuration d'impression (réduction 98,5 % et décalage).
    final = fitz.open()
    s, dx, dy = 0.985, 14, -6
    for i in range(len(brouillon)):
        p = final.new_page(width=W, height=H)
        r = fitz.Rect(dx + W * (1 - s) / 2, dy + H * (1 - s) / 2, dx + W * (1 + s) / 2, dy + H * (1 + s) / 2)
        p.show_pdf_page(r, brouillon, i)
    return final


# ---------------------------------------------------------------- Devis
CSS = """
* { font-family: sans-serif; }
body { font-size: 10pt; line-height: 1.35; }
h1 { font-size: 15pt; margin: 0 0 4pt; }
h2 { font-size: 11.5pt; margin: 12pt 0 4pt; }
p { margin: 0 0 6pt; text-align: justify; }
.meta { font-size: 8.5pt; color: #555; margin-bottom: 10pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; }
td, th { border: 0.6pt solid #333; padding: 3pt 5pt; font-size: 9pt; }
th { background: #e6e6e6; text-align: left; }
"""


def devis_html(v2):
    fc = "40 MPa" if v2 else "35 MPa"
    cure = "10 jours" if v2 else "7 jours"
    prix_hp = "1 925,00" if v2 else "1 850,00"
    p = []
    p.append(f"<h1>Devis technique — Section 15 : Béton de structure</h1>")
    p.append(f"<p class='meta'>Projet fictif P-00000 · Version {'2 — 2026-11-07' if v2 else '1 — 2026-09-15'} · Exemple synthétique pour PDFo Comparo</p>")
    p.append("<h2>15.1 Objet</h2>")
    p.append("<p>La présente section décrit les exigences relatives à la fourniture, à la mise en place, à la finition et au mûrissement du béton de structure, y compris les coffrages, les joints et les essais de contrôle de la qualité exigés par le surveillant.</p>")
    if v2:
        p.append("<p>Les exigences de la présente section s'appliquent également aux éléments préfabriqués coulés en usine, sauf indication contraire aux plans. Le fabricant doit transmettre son programme qualité au surveillant au moins quinze jours avant le début de la fabrication.</p>")
    p.append("<h2>15.2 Normes de référence</h2>")
    p.append("<p>Les travaux doivent être conformes à la norme CSA A23.1, à la norme CSA A23.2 pour les essais et au cahier des charges applicable. En cas de divergence, l'exigence la plus sévère s'applique.</p>")
    p.append("<h2>15.3 Résistance du béton</h2>")
    p.append(f"<p>Sauf indication contraire, la résistance à la compression spécifiée à 28 jours est de {fc} pour la superstructure et de 30 MPa pour les fondations. Le rapport eau/liants ne doit pas dépasser 0,40 pour les éléments exposés aux sels de déglaçage.</p>")
    p.append("<h2>15.4 Mise en place</h2>")
    s = "Le béton doit être mis en place dans les 90 minutes suivant le malaxage. La hauteur de chute libre ne doit pas dépasser 1,5 m. "
    if not v2:
        s += "L'ajout d'eau au chantier est interdit sans l'autorisation écrite du surveillant. "
    s += "La vibration doit être continue et uniforme, sans provoquer de ségrégation."
    p.append(f"<p>{s}</p>")
    p.append("<h2>15.5 Mûrissement</h2>")
    p.append(f"<p>Le mûrissement humide doit être maintenu pendant au moins {cure} consécutifs au moyen de toiles humides ou d'un produit de cure approuvé. La température du béton doit être maintenue au-dessus de 10 °C pendant toute cette période.</p>")
    p.append("<h2>15.6 Essais de contrôle</h2>")
    p.append("<p>Un essai d'affaissement, une mesure de la teneur en air et un ensemble de trois cylindres sont exigés pour chaque tranche de 50 m³ ou pour chaque journée de bétonnage, selon la fréquence la plus élevée.</p>")
    p.append("<h2>15.7 Bordereau</h2>")
    rows = [("150101", "m³", "Béton de fondation 30 MPa", "1 150,00"),
            ("150201", "m³", "Béton de superstructure", "1 480,00"),
            ("150301", "m³", "Béton haute performance", prix_hp),
            ("150401", "m²", "Membrane d'étanchéité", "95,00")]
    if v2:
        rows.insert(3, ("150350", "m³", "Béton autoplaçant", "1 620,00"))
    p.append("<table><tr><th>Code</th><th>Unité</th><th>Description</th><th>Prix ($)</th></tr>" +
             "".join(f"<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in rows) + "</table>")
    p.append("<h2>15.8 Mesurage et paiement</h2>")
    p.append("<p>Le béton est mesuré en mètres cubes, selon les dimensions indiquées aux plans, sans déduction pour les armatures ni pour les conduits de moins de 150 mm de diamètre. Le prix couvre la fourniture, la mise en place, la finition et le mûrissement.</p>")
    if v2:
        p.append("<h2>15.9 Bétonnage par temps froid</h2>")
        p.append("<p>Lorsque la température ambiante est inférieure à 5 °C ou risque de le devenir dans les 24 heures suivant la mise en place, l'entrepreneur doit soumettre une méthode de protection comprenant les abris, le chauffage et la surveillance des températures du béton.</p>")
        p.append("<p>Les frais de protection par temps froid sont payés selon l'article de bordereau prévu à cette fin.</p>")
    # Remplissage pour obtenir plusieurs pages
    p.append("<h2>Annexe A — Tolérances</h2>")
    for i in range(1, 25):
        p.append(f"<p>A.{i} Tolérance d'exécution n° {i} : l'écart admissible par rapport aux dimensions des plans est de ±{5 + i} mm, mesuré selon la méthode décrite à la norme CSA A23.1, à moins d'indication contraire au devis spécial.</p>")
    return "".join(p)


def devis(v2):
    out = fitz.open()
    import io
    buf = io.BytesIO()
    writer = fitz.DocumentWriter(buf)
    story = fitz.Story(html=devis_html(v2), user_css=CSS)
    mediabox = fitz.paper_rect("letter")
    # Version 2 : autres marges (autre modèle de document).
    where = mediabox + ((72, 72, -72, -80) if not v2 else (80, 64, -66, -86))
    more = True
    while more:
        dev = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
    writer.close()
    out = fitz.open("pdf", buf.getvalue())
    for i, page in enumerate(out):
        page.insert_text((72, 760), f"Devis Section 15 — page {i + 1} de {len(out)}", fontsize=8, fontname="helv", color=(0.35, 0.35, 0.35))
    return out


if __name__ == "__main__":
    for doc, nom in ((plans(False), "plans-pont-rev-A.pdf"), (plans(True), "plans-pont-rev-B.pdf"),
                     (devis(False), "devis-beton-v1.pdf"), (devis(True), "devis-beton-v2.pdf")):
        doc.set_metadata({"title": nom[:-4], "author": "Exemple PDFo Comparo", "creator": "generer_exemples.py"})
        doc.save(ICI / nom, garbage=3, deflate=True)
        print(nom, len(doc), "pages")
