from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
OUT=Path('docs/screenshots/pwa-iphone');OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 browser=p.webkit.launch(headless=True)
 for width,height,sat,sab in [(393,852,59,34),(430,932,59,34),(375,667,0,0),(320,568,0,0)]:
  device_name='iPhone 15 Pro Max' if width==430 else 'iPhone SE' if width<=375 else 'iPhone 15 Pro'
  options=dict(p.devices[device_name]);options.update(viewport={'width':width,'height':height},screen={'width':width,'height':height})
  context=browser.new_context(**options);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  cases=[('home','/fr/dashboard',''),('formations','/fr/dashboard/formations',''),('community-empty','/fr/dashboard/communaute','&enrolled=1'),('community-messages','/fr/dashboard/communaute','&enrolled=1&long=1'),('messages','/fr/dashboard/messages',''),('message-thread','/fr/dashboard/messages/teacher-thread','&long=1'),('profile','/fr/dashboard/profil',''),('settings','/fr/dashboard/profil/parametres',''),('lesson','/fr/dashboard/learn/sample/lesson-1','')]
  for name,route,extra in cases:
   page.goto('http://127.0.0.1:4186/?route='+route+'&pwa=1'+extra);page.wait_for_selector('.pwa-lesson-shell' if name=='lesson' else '.pwa-app-main');page.add_style_tag(content=f':root{{--sat:{sat}px;--sab:{sab}px}}')
   if name in ['home','formations']:page.wait_for_selector('[data-server-page] h1')
   if name=='home':
    assert page.locator('.pwa-home-stats > div').evaluate_all('''cards=>cards.every(card=>{const r=card.getBoundingClientRect(),head=card.firstElementChild,a=head.firstElementChild.getBoundingClientRect(),b=head.lastElementChild.getBoundingClientRect();return a.left>=r.left&&a.right<=r.right&&b.left>=r.left&&b.right<=r.right&&(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top)})'''),'stat tile overflow/overlap'
   if name=='lesson':assert page.locator('.pwa-bottom-nav').count()==0
   else:
    page.wait_for_selector('.pwa-bottom-nav');page.wait_for_function("document.documentElement.dataset.appRoute==='true'");nav=page.locator('.pwa-bottom-nav').bounding_box();assert abs(nav['y']+nav['height']-height)<1,(name,width,nav);assert abs(nav['height']-(64+sab))<1,(name,nav)
    assert page.locator('.pwa-bottom-nav').evaluate('(e)=>e.parentElement.tagName')=='BODY'
    assert page.locator('.pwa-bottom-nav > a > span:last-child').evaluate_all('(labels)=>labels.every(e=>e.scrollWidth<=e.clientWidth)'),(name,width,'nav label clipped')
    assert page.locator('.pwa-bottom-nav').evaluate('''e=>{for(let n=e.parentElement;n;n=n.parentElement){const s=getComputedStyle(n);if(s.transform!=='none'||s.filter!=='none'||s.contain!=='none')return false}return true}''')
    assert page.evaluate('document.documentElement.scrollWidth')<=width,(name,'horizontal overflow')
    header=page.locator('.pwa-app-header').bounding_box();assert header['height']>=56+sat-1
    for el in page.locator('input:visible:not([type=checkbox]),textarea:visible,select:visible').all():assert el.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=16,(name,width,el.get_attribute('id'),el.get_attribute('placeholder'),el.evaluate('(e)=>getComputedStyle(e).fontSize'))
    composer=page.locator('[data-chat-composer]:visible')
    if composer.count():assert composer.bounding_box()['y']+composer.bounding_box()['height']<=nav['y']+1,(name,'composer overlap')
    main=page.locator('.pwa-app-main');main.evaluate('(e)=>e.scrollTop=e.scrollHeight')
    if name in ['home','formations','profile','settings']:
     bottom=main.locator(':scope > div').bounding_box();assert bottom['y']+bottom['height']<=nav['y']-15,(name,width,bottom,nav)
    if name=='home' and width==393:
     page.screenshot(path=str(OUT/'after-home-bottom-393.png'))
     main.evaluate('(e)=>e.scrollTop=0')
    if width==393:page.screenshot(path=str(OUT/f'after-{name}-393.png'))
    if name=='home' and width in [375,320]:main.evaluate('(e)=>e.scrollTop=0');page.screenshot(path=str(OUT/f'after-home-{width}.png'))
   results.append({'case':name,'width':width,'height':height,'sat':sat,'sab':sab,'passed':True})
  if width==393:
   page.goto('http://127.0.0.1:4186/?route=/fr/dashboard&pwa=1&debug=safe&sat=59&sab=34');page.wait_for_selector('[data-server-page] h1');page.screenshot(path=str(OUT/'after-home-393-debug.png'))
   page.goto('http://127.0.0.1:4186/?route=/fr/dashboard/communaute&pwa=1&enrolled=1&long=1&debug=safe&sat=59&sab=34');page.wait_for_selector('[data-chat-composer] input:not([type=file])');
   page.locator('[data-chat-composer] input:not([type=file])').fill('Question de démonstration')
   # OS keyboards cannot be rendered by desktop WebKit. Simulate the focus, resize signal and reduced visible viewport.

   page.set_viewport_size({'width':393,'height':500});page.wait_for_function("document.documentElement.dataset.appKeyboard==='true'")
   assert not page.locator('.pwa-bottom-nav').is_visible();box=page.locator('[data-chat-composer]').bounding_box();assert box['y']+box['height']<=500+1
   page.locator('[data-message-stream]').evaluate('(e)=>e.scrollTop=e.scrollHeight')
   page.screenshot(path=str(OUT/'after-community-keyboard-simulated-393x500.png'))
   page.set_viewport_size({'width':393,'height':852});page.wait_for_function("document.documentElement.dataset.appKeyboard==='false'");nav=page.locator('.pwa-bottom-nav').bounding_box();assert abs(nav['y']+nav['height']-852)<1
   page.screenshot(path=str(OUT/'after-community-keyboard-closed-393.png'))
   page.goto('http://127.0.0.1:4186/?route=/fr/dashboard&pwa=1&debug=safe&sat=59&sab=34');page.wait_for_selector('[data-server-page] h1')
   assert page.locator('h1').inner_text().startswith('Bonjour, Lorvenson')
   assert 'Byenveni' not in page.locator('[data-server-page]').inner_text()
   page.goto('http://127.0.0.1:4186/?route=/ht/dashboard&pwa=1');page.wait_for_selector('[data-server-page] h1');assert page.locator('h1').inner_text().startswith('Bonjou, Lorvenson');assert 'Continue' not in page.locator('[data-server-page]').inner_text();page.screenshot(path=str(OUT/'after-home-kr-393.png'))
  assert not errors,errors
  context.close()
 browser.close()
Path('docs/screenshots/pwa-iphone/results.json').write_text(json.dumps({'engine':'Playwright WebKit','realIPhone':False,'keyboard':{'native':False,'focusAndViewportResizeSimulated':True,'visibleViewport':[393,500],'navHidden':True,'restoredNavBottom':852},'cases':results},indent=2),encoding='utf-8')
print('PASS',len(results),'WebKit page/viewport checks')
