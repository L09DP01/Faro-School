from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path('docs/screenshots/email').resolve()
out.mkdir(parents=True,exist_ok=True)
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for state in ('ok','failed'):
        page=browser.new_page(viewport={'width':1440,'height':1000})
        page.goto(f'http://127.0.0.1:4183/?view=admin&state={state}')
        page.get_by_role('heading',name='Emails transactionnels').wait_for()
        page.screenshot(path=str(out/f'admin-health-{state}-1440.png'),full_page=True)
        checks.append('admin-'+state)
        page.close()
    for locale in ('fr','ht'):
        for state in ('valid','expired','already_used'):
            page=browser.new_page(viewport={'width':390,'height':844})
            page.goto(f'http://127.0.0.1:4183/?view=verification&locale={locale}&state={state}&token=visual-fixture')
            page.get_by_role('button',name='Konfime imèl mwen' if locale=='ht' else 'Confirmer mon adresse e-mail').click()
            expected={'fr':{'valid':'Adresse e-mail vérifiée','expired':'Ce lien a expiré','already_used':'Ce lien a déjà été utilisé'},'ht':{'valid':'Adrès imèl verifye','expired':'Lyen sa a ekspire','already_used':'Lyen sa a deja itilize'}}[locale][state]
            page.get_by_role('heading',name=expected,exact=True).wait_for()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(out/f'verification-{locale}-{state}-390.png'),full_page=True)
            checks.append('verification-'+locale+'-'+state)
            page.close()
        page=browser.new_page(viewport={'width':390,'height':844})
        page.goto(f'http://127.0.0.1:4183/?view=code&locale={locale}')
        page.get_by_role('heading').wait_for()
        assert page.get_by_text('Si adrès sa a ka resevwa yon kont' if locale=='ht' else 'Si cette adresse peut recevoir un compte',exact=False).is_visible()
        page.screenshot(path=str(out/f'code-neutral-{locale}-390.png'),full_page=True)
        checks.append('honest-code-'+locale)
        page.close()
        for kind in ('verification','reset','payment_confirmed','invitation'):
            page=browser.new_page(viewport={'width':650,'height':850})
            page.goto(f'http://127.0.0.1:4183/?view=email&locale={locale}&kind={kind}')
            page.get_by_role('heading',level=1).wait_for()
            page.screenshot(path=str(out/f'email-{kind}-{locale}.png'),full_page=True)
            checks.append('email-'+kind+'-'+locale)
            page.close()
    browser.close()
(out/'checks.json').write_text(json.dumps({'method':'Real production components in offline fixtures; provider states simulated; codes and URLs masked. No real email sent.','checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
print(f'{len(checks)} email screenshots saved; FR/KR verification states checked at 390px.')
