from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path('docs/screenshots/pwa-mobile').resolve();out.mkdir(parents=True,exist_ok=True)
checks=[]
with sync_playwright() as p:
    try:
        browser=p.webkit.launch(headless=True);engine='webkit'
    except Exception:
        browser=p.chromium.launch(headless=True);engine='chromium'
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    context.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true});")
    page=context.new_page()
    page.goto('http://127.0.0.1:4184/')
    page.locator('.auth-mobile-header').wait_for()
    page.wait_for_function("document.documentElement.dataset.appStandalone==='true'")
    sizes=page.locator('input:not([type=checkbox])').evaluate_all('(nodes)=>nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))')
    assert all(size>=16 for size in sizes),sizes
    before=page.locator('.auth-mobile-header').bounding_box()
    page.screenshot(path=str(out/'pwa-login-390.png'),full_page=True)
    page.locator('.auth-form-panel').evaluate('(el)=>el.scrollTop=250')
    page.wait_for_timeout(150)
    after=page.locator('.auth-mobile-header').bounding_box()
    assert abs(before['y']-after['y'])<1
    assert page.evaluate('window.scrollY')==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(out/'pwa-header-scroll-390.png'),full_page=True)
    page.locator('input[type=email]').focus()
    page.evaluate("Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>420});window.visualViewport.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(200)
    assert page.locator('.auth-shell').bounding_box()['height']<=421
    assert abs(page.locator('.auth-mobile-header').bounding_box()['y'])<1
    page.screenshot(path=str(out/'pwa-keyboard-layout-390.png'),full_page=True)
    checks+=['Standalone: inputs >=16px','Header remains at top after content scroll','Root does not scroll','Keyboard-height simulation shrinks app shell','No horizontal overflow']
    page.goto('http://127.0.0.1:4184/?landing=1')
    page.wait_for_function("document.documentElement.dataset.appRoute==='false'")
    assert page.locator('input').evaluate('(el)=>getComputedStyle(el).fontSize')=='12px'
    assert page.locator('body').evaluate('(el)=>getComputedStyle(el).position')!='fixed'
    checks.append('Landing excluded from input and scroll overrides')
    context.close()
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page();page.goto('http://127.0.0.1:4184/');page.locator('input[type=email]').wait_for()
    assert page.locator('input[type=email]').evaluate('(el)=>parseFloat(getComputedStyle(el).fontSize)')>=16
    assert page.locator('body').evaluate('(el)=>getComputedStyle(el).position')!='fixed'
    page.screenshot(path=str(out/'web-login-390.png'),full_page=True)
    checks.append('Browser: >=16px controls, normal document scrolling')
    browser.close()
(out/'checks.json').write_text(json.dumps({'engine':engine,'checks':checks,'limits':'Headless mobile emulation and simulated keyboard; installed iPhone Safari, system keyboard and physical safe areas require a hardware check.'},indent=2),encoding='utf8')
print(f'PASS {engine}: {len(checks)} PWA/mobile checks; four screenshots saved')
