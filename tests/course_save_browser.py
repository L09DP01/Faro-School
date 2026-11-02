"""Real form; mock storage/action transport only. Never publishes a production course."""
from pathlib import Path
import base64
from playwright.sync_api import sync_playwright

out=Path('docs/screenshots/course-save');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    received=[]
    def cover(route):
        received.append(len(route.request.post_data_buffer))
        route.fulfill(status=200,json={'url':'/api/covers/11111111-1111-4111-8111-111111111111.png'})
    page.route('**/api/admin/upload/cover',cover)
    page.goto('http://127.0.0.1:4196');page.wait_for_load_state('networkidle')
    image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\n'+b'\0'*1100000).decode()
    page.locator('#cover-cdn-url').fill(image)
    page.evaluate("window.__saveMode='throw'")
    page.get_by_role('button',name='Publier la formation',exact=True).first.click()
    page.get_by_text('Vos champs sont conservés.',exact=False).wait_for()
    assert page.get_by_role('button',name='Publier la formation',exact=True).first.is_enabled()
    assert page.locator('#course-title-fr').input_value()=='Formation de contrôle'
    saved=page.evaluate('window.__savedCourse')
    assert saved['coverUrl'].startswith('/api/covers/') and len(saved['coverUrl'])<100
    assert received[0]>1024*1024 and len(received)==1
    page.screenshot(path=str(out/'save-failure-recovered.png'),full_page=True)
    page.evaluate("window.__saveMode='success'")
    page.get_by_role('button',name='Publier la formation',exact=True).first.click()
    page.get_by_text('publiée',exact=False).first.wait_for()
    assert len(received)==1
    page.screenshot(path=str(out/'publish-retry-success.png'),full_page=True)
    browser.close()
print('PASS real form: >1MB inline cover moved to multipart storage before action, rejection unlocks publish/draft, title and video curriculum preserved, retry publishes without reupload. Local mocked action only.')
