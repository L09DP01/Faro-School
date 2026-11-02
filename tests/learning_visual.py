"""Real components; local fixtures for Bunny API, database and AI. No real payment or message."""
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/screenshots/learning-repair');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for locale in ['fr','ht']:
  for width in [320,390,768,1440]:
   page=browser.new_page(viewport={'width':width,'height':900})
   page.route('**/api/video/playback?*',lambda r:r.fulfill(json={'playbackUrl':'https://player.mediadelivery.net/embed/123/fixture?token=local&expires=9999999999'}))
   page.route('https://player.mediadelivery.net/**',lambda r:r.fulfill(content_type='text/html;charset=utf-8',body='<body style="background:#101828;color:white">Lecteur Bunny simulé pour test local</body>'))
   page.route('**/api/video/notes?*',lambda r:r.fulfill(json={'content':'Une note privée existante'}))
   page.route('**/api/video/quiz?*',lambda r:r.fulfill(json={'questions':[{'question':'Quelle est la bonne réponse ?','choices':['A','B','C','D']}]}))
   page.route('**/api/video/quiz',lambda r:r.fulfill(json={'score':100,'correct':[True]}))
   page.goto(f'http://127.0.0.1:4198/?locale={locale}');page.wait_for_selector('iframe')
   assert page.locator('video').count()==0,'HTML embed must never be assigned to a video source'
   assert page.locator('iframe').get_attribute('allowfullscreen') is not None
   page.wait_for_function('window.__resume===15')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert 'Jean-Marc Joseph' not in page.inner_text('body')
   page.screenshot(path=str(out/f'player-{locale}-{width}.png'),full_page=True)
   page.get_by_role('button',name='Questions',exact=True).click();assert 'Élodie Paul' in page.inner_text('body');assert page.locator('a[href*="50936000000"]').count()==0
   page.get_by_role('button',name='Poze kesyon mwen' if locale=='ht' else 'Poser ma question',exact=False).click();assert page.evaluate('window.__destination').endswith('teacher-thread')
   page.get_by_role('button',name='Nòt mwen' if locale=='ht' else 'Mes notes',exact=True).click()
   page.locator('textarea').fill('Nouvelle note');page.wait_for_function('window.__savedNote?.[1]==="Nouvelle note"');page.locator('textarea').fill('');page.wait_for_function('window.__savedNote?.[1]===""')
   page.get_by_role('button',name='Tès opsyonèl' if locale=='ht' else 'Test facultatif',exact=True).click();page.get_by_role('radio',name='A',exact=True).check();page.get_by_role('button',name='Verifye repons mwen yo' if locale=='ht' else 'Vérifier mes réponses').click();page.get_by_role('status').filter(has_text='100/100').wait_for()
   page.goto(f'http://127.0.0.1:4198/?locale={locale}&mode=ticket');assert page.locator('input[type=text]').last.is_disabled();page.screenshot(path=str(out/f'paused-ticket-{locale}-{width}.png'),full_page=True)
   page.goto(f'http://127.0.0.1:4198/?locale={locale}&mode=extras');page.locator('summary').click();page.get_by_role('button',name='Ajoute yon kesyon' if locale=='ht' else 'Ajouter une question').click();assert page.get_by_role('radio').count()==4;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(out/f'lesson-editor-{locale}-{width}.png'),full_page=True)
   page.goto(f'http://127.0.0.1:4198/?locale={locale}&mode=popup');page.get_by_role('dialog').wait_for();page.screenshot(path=str(out/f'takeover-{locale}-{width}.png'),full_page=True);page.get_by_role('button',name='Pran relè a' if locale=='ht' else 'Prendre le relais',exact=True).click();page.wait_for_function('window.__takeover?.[0]==="conv"')
   page.close()
 browser.close()
print('PASS FR/KR real components at 320/390/768/1440: bounded iframe, resume, no overflow, course contact, private note save/delete, quiz grade, paused ticket and takeover. Bunny/provider APIs simulated locally.')
