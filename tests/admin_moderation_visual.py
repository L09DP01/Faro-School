"""Actual React components, local fixtures and failed mocked writes; no production I/O."""
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('docs/screenshots/admin-moderation')
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for locale in ['fr','ht']:
        for width in [390,768,1440]:
            page=browser.new_page(viewport={'width':width,'height':1000})
            page.goto(f'http://127.0.0.1:4195/?supervision&locale={locale}')
            page.wait_for_load_state('networkidle')
            assert 'waiting_staff' not in page.inner_text('body')
            assert '428571' not in page.inner_text('body')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (locale,width)
            cost=page.get_by_text('USD',exact=False).first
            assert cost.evaluate('(e)=>e.scrollWidth<=e.clientWidth'), (locale,width,'cost overflow')
            page.screenshot(path=str(out/f'supervision-{locale}-{width}.png'),full_page=True)
            page.goto(f'http://127.0.0.1:4195/?locale={locale}')
            page.wait_for_load_state('networkidle')
            assert page.get_by_role('alert').count()==0
            page.screenshot(path=str(out/f'moderation-{locale}-{width}.png'),full_page=True)
            if locale=='fr' and width==1440:
                page.get_by_role('button',name='Règles communautaires').click()
                page.get_by_role('button',name='Enregistrer',exact=False).click()
                page.get_by_role('status').filter(has_text='échoué').wait_for()
                page.goto('http://127.0.0.1:4195/?failed')
                page.get_by_role('alert').filter(has_text='Sanctions').wait_for()
                page.get_by_role('button',name='Membres sanctionnés').click()
                page.get_by_role('status').filter(has_text='Données indisponibles').wait_for()
                assert page.get_by_role('button',name='Membres sanctionnés').inner_text().endswith('—')
                page.screenshot(path=str(out/'moderation-unavailable.png'),full_page=True)
            page.close()
    browser.close()
print('PASS real components: FR/KR 390/768/1440, bounded cost, translated state, honest section failure, failed save feedback.')
