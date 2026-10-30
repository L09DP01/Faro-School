from pathlib import Path
import json
from pypdf import PdfReader

dest=Path('docs/screenshots/certificates')
results=[]
for name in ['standard','kr','long-name','long-title','apostrophe']:
    pdf=PdfReader(dest/f'pdf-{name}.pdf')
    assert len(pdf.pages)==1
    page=pdf.pages[0]
    assert abs(float(page.mediabox.width)-841.89)<1
    text=page.extract_text()
    for phrase in ['CERTIFICAT DE RÉUSSITE','Faro School certifie que','a suivi avec succès la formation','Vérifier l’authenticité','diplôme d’État','29 octobre 2026']:
        assert phrase in text, (name,phrase)
    if name in ['standard','kr','long-title']:
        assert 'Jan-Pòl Étienne' in text
    if name=='apostrophe':
        assert "D'Haiti" in text
    if name=='long-name':
        long_name="Marie Éléonore Saint-Juste D'Haïti "+'A'*(60-len("Marie Éléonore Saint-Juste D'Haïti "))
        assert len(long_name)==60 and long_name in text
    fonts=page['/Resources']['/Font'].get_object()
    assert len(fonts)>=3
    for font in fonts.values():
        descendant=font.get_object()['/DescendantFonts'][0].get_object()
        descriptor=descendant['/FontDescriptor'].get_object()
        assert '/FontFile2' in descriptor or '/FontFile3' in descriptor
    results.append({'case':name,'french':True,'embedded_fonts':len(fonts),'pages':1,'accents':True})
(dest/'pdf-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print('PASS 5/5 one-page landscape PDFs: French text, embedded fonts, accents, apostrophe, 60-character name.')
