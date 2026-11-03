from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for locale,label in [('fr','Créer un ticket support'),('ht','Kreye yon tikè sipò')]:
  page=browser.new_page(viewport={'width':393,'height':852})
  page.goto('http://127.0.0.1:4198/?mode=support&locale='+locale)
  page.get_by_role('button',name=label,exact=False).wait_for()
  assert not page.locator('input[type=text]').last.is_disabled()
  composer=page.locator('[data-chat-composer] input')
  composer.fill('Salut' if locale=='fr' else 'Bonjou')
  composer.press('Enter')
  page.wait_for_function('window.__sentMessage?.[4]===false')
  assert page.evaluate('window.__sentMessage[1]')==('Salut' if locale=='fr' else 'Bonjou')
  page.get_by_role('button',name=label,exact=False).click()
  page.wait_for_function('window.__sentMessage?.[4]===true')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.close()
 browser.close()
print('PASS FR/KR mobile support: input enabled, explicit ticket button, no overflow. Local fixtures only.')
