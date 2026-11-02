from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':393,'height':852})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/api/video/playback?*',lambda r:r.fulfill(json={'playbackUrl':'https://player.mediadelivery.net/embed/123/fixture?token=local&expires=9999999999'}))
 page.route('https://player.mediadelivery.net/**',lambda r:r.fulfill(content_type='text/html',body='<body>Local player</body>'))
 page.route('**/api/video/notes?*',lambda r:r.fulfill(json={'content':''}))
 page.goto('http://127.0.0.1:4198/?detached=1')
 page.wait_for_function('window.__resume===15')
 page.get_by_role('link',name='Retour aux formations').click()
 page.get_by_role('heading',name='Mes formations').wait_for()
 page.wait_for_function('window.__disposedEvents?.length===4')
 assert not errors,errors
 assert page.locator('iframe').count()==0
 browser.close()
print('PASS real React lesson unmount: back arrow, detached iframe cleanup, destination visible, no page error')
