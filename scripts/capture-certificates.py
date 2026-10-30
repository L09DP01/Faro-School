from pathlib import Path
from playwright.sync_api import sync_playwright
import json

dest = Path('docs/screenshots/certificates').resolve()
dest.mkdir(parents=True, exist_ok=True)
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width in (1440, 390):
        page = browser.new_page(viewport={'width': width, 'height': 1000 if width == 1440 else 844}, device_scale_factor=1)
        for view in ('preview', 'student', 'verification-valid', 'verification-revoked', 'verification-not_found'):
            page.goto(f'http://127.0.0.1:4181/?view={view}')
            page.wait_for_load_state('networkidle')
            if view == 'student':
                assert page.get_by_role('heading',name='Mes certificats',exact=True).is_visible()
                assert page.get_by_label("Barre d'onglets mobile").locator('a').count()==5
            page.evaluate('document.fonts.ready')
            page.screenshot(path=str(dest / f'{view}-{width}.png'), full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Horizontal overflow: {view} {width}'
            checks.append(f'{view}-{width}: rendered, no horizontal overflow')
            if view == 'preview':
                boxes = page.locator('svg[role=img] text').evaluate_all('(nodes)=>nodes.map(n=>({text:n.textContent,x:n.getBBox().x,width:n.getBBox().width}))')
                assert all(b['x'] >= 20 and b['x']+b['width'] <= 822 for b in boxes), boxes
        page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    for view in ('celebration','confirm'):
        page.goto(f'http://127.0.0.1:4181/?view={view}')
        page.wait_for_load_state('networkidle')
        page.screenshot(path=str(dest/f'{view}-390.png'),full_page=True)
    page.get_by_label('Nom complet', exact=True).fill("D'Haiti")
    assert page.get_by_role('button', name='Confirmer et délivrer').is_enabled()
    page.get_by_label('Nom complet', exact=True).fill('X')
    assert page.get_by_role('button', name='Confirmer et délivrer').is_disabled()
    page.goto('http://127.0.0.1:4181/?view=student&locale=ht')
    page.wait_for_load_state('networkidle')
    assert page.get_by_role('heading',name='Sètifika mwen yo').is_visible()
    assert 'CERTIFICAT DE RÉUSSITE' in page.locator('svg[role=img]').text_content()
    page.screenshot(path=str(dest/'student-kr-390.png'),full_page=True)
    page.close()
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto('http://127.0.0.1:4181/?view=admin')
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(dest/'admin-1440.png'),full_page=True)
    page.get_by_role('heading',name='Signature et validation').locator('..').screenshot(path=str(dest/'settings-preview-1440.png'))
    page.get_by_label('Rechercher par numéro, nom ou formation').fill("D'Haiti")
    assert page.locator('tbody tr').count()==1
    browser.close()
(dest/'browser-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf8')
print(f'{len(checks)} responsive views checked; confirmation validation, KR French-only certificate and admin search verified.')
