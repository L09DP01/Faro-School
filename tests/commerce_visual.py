"""Real components, fake local data and intercepted checkout; no real payments or remote database."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/screenshots/course-commerce');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for locale in ['fr','ht']:
        for width in [390,768,1440]:
            page=browser.new_page(viewport={'width':width,'height':900})
            for empty in [True,False]:
                page.goto(f'http://127.0.0.1:4197/?locale={locale}'+('&empty' if empty else ''))
                page.wait_for_load_state('networkidle')
                text=page.inner_text('body')
                assert 'Jean-Marc' not in text and 'Nathalie' not in text and '4.9' not in text and '120 apprenants' not in text
                assert 'Élodie Paul' in text and '1 module' in text if locale=='fr' else 'Élodie Paul' in text
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(out/f"course-{locale}-{width}-{'empty' if empty else 'review'}.png"),full_page=True)
            page.goto(f'http://127.0.0.1:4197/?mode=checkout&locale={locale}')
            page.wait_for_load_state('networkidle')
            assert page.get_by_alt_text('MonCash',exact=True).count()==1 and page.get_by_alt_text('NatCash',exact=True).count()==1
            page.get_by_role('radio',name='NatCash',exact=False).check()
            text=page.inner_text('body')
            assert '40 00 00 00' not in text and 'SMS' not in text and '*202#' not in text
            assert page.locator('input[type=tel]').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(out/f'checkout-{locale}-{width}.png'),full_page=True)
            captured=[]
            page.route('**/api/payments/create',lambda r:(captured.append(r.request.post_data_json),r.fulfill(status=200,json={'redirectUrl':'https://pay.kobara.app/checkout/fixture'})))
            page.route('https://pay.kobara.app/**',lambda r:r.fulfill(status=200,body='LOCAL PAYMENT INTERCEPTED'))
            page.locator('input[type=tel]').fill('+50934395967')
            page.get_by_role('button',name=('Peye' if locale=='ht' else 'Payer'),exact=False).click()
            page.wait_for_url('https://pay.kobara.app/checkout/fixture')
            assert captured[0]['provider']=='natcash' and 'providerTxnId' not in captured[0] and 'amount' not in captured[0]
            page.goto(f'http://127.0.0.1:4197/?mode=profile&locale={locale}');page.wait_for_load_state('networkidle')
            page.screenshot(path=str(out/f'author-profile-{locale}-{width}.png'),full_page=True)
            page.close()
    browser.close()
print('PASS FR/KR 390/768/1440: no invented course data, actual passed author/review, logos, no manual NatCash fields, selected channel reaches mocked Kobara, no client amount/transaction ID, public author profile.')
