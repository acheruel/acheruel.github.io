import pymupdf, json
S = {
 "hif18046": [(41,49),(57,60),(75,77),(268,277),(353,356),(512,513)],
 "if12027":  [(33,40),(59,62),(127,129),(133,135),(235,241),(258,260)],
}
for name, ranges in S.items():
    src = pymupdf.open(f"pdfs/{name}.pdf"); out = pymupdf.open()
    pages = []
    for a,b in ranges:
        out.insert_pdf(src, from_page=a-1, to_page=b-1); pages += list(range(a,b+1))
    # signets du PDF original, renumérotés (Converto et d'autres s'en servent pour les titres)
    pos = {p: i + 1 for i, p in enumerate(pages)}
    toc, last = [], 0
    for lvl, t, p in src.get_toc():
        if p in pos and lvl <= last + 1:
            toc.append([lvl, t, pos[p]]); last = lvl
    out.set_toc(toc)
    out.save(f"pdfs/{name}-extrait.pdf", garbage=3, deflate=True)
    print(name, len(pages), "pages")
    json.dump(pages, open(f"pdfs/{name}-extrait.pages.json","w"))
