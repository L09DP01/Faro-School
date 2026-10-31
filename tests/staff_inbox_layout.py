"""Real components, local fake messages, no production login or database access."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('docs/screenshots/staff-inbox')
out.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    for engine in [p.chromium, p.webkit]:
        webkit = next(Path('tmp/playwright-browsers').glob('webkit-*/Playwright.exe'), None)
        options = {'executable_path': str(webkit.resolve())} if engine.name == 'webkit' and webkit else {}
        browser = engine.launch(headless=True, **options)
        sizes = [(1440, 900), (1024, 768), (768, 1024), (820, 1180), (390, 844), (320, 568)]
        for width, height in sizes:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
            context.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true});")
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.goto('http://127.0.0.1:4193/?debug=safe&sat=24&sab=20')
            page.wait_for_load_state('networkidle')
            page.wait_for_selector('[data-message-stream]')
            page.wait_for_function("document.querySelector('[data-message-stream]').textContent.includes('Dernier message')")
            stream = page.locator('[data-message-stream]')
            header = page.locator('[data-conversation-header]')
            composer = page.locator('[data-message-composer]')
            outer = page.locator('.pwa-admin-main')
            original_header = header.bounding_box()
            original_composer = composer.bounding_box()
            assert original_composer['y'] + original_composer['height'] <= height, (width, height, original_composer)
            assert original_header['y'] >= 24, (width, height, original_header)
            assert stream.bounding_box()['height'] > 0, (width, height, 'message pane collapsed')
            send = composer.locator('button')
            assert send.bounding_box()['height'] >= 44
            assert send.evaluate("(e)=>getComputedStyle(e).backgroundColor") not in ['rgba(0, 0, 0, 0)', 'transparent']
            stream.evaluate('(e)=>e.scrollTop=0')
            stream.hover()
            page.mouse.wheel(0, 600)
            page.wait_for_timeout(100)
            assert header.bounding_box() == original_header, 'Chat header moved'
            assert composer.bounding_box() == original_composer, 'Composer moved'
            outer.evaluate('(e)=>e.scrollTop=10000')
            assert composer.bounding_box() == original_composer, 'Outer page scrolled'
            stream.evaluate('(e)=>e.scrollTop=e.scrollHeight')
            last = stream.get_by_text('Dernier message de la conversation — entièrement visible.')
            box = last.bounding_box()
            assert box['y'] + box['height'] <= original_composer['y'], (width, 'last message covered')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal page overflow'
            assert page.evaluate('document.scrollingElement.scrollHeight <= innerHeight + 1'), 'Body scrolls'
            assert stream.evaluate("(e)=>getComputedStyle(e).scrollbarWidth") == 'none'
            if width >= 768:
                toggle = page.get_by_role('button', name='Masquer le menu latéral')
                initial_width = stream.bounding_box()['width']
                toggle.click()
                assert not page.locator('#admin-sidebar').is_visible()
                assert stream.bounding_box()['width'] > initial_width
                page.screenshot(path=str(out / f'{engine.name}-{width}x{height}-collapsed.png'))
                page.get_by_role('button', name='Ouvrir le menu latéral').click()
                assert page.locator('#admin-sidebar').is_visible()
            if width < 1024:
                page.get_by_role('button', name='Retour à la liste').click()
                names = page.locator('[data-conversation-list]')
                assert names.is_visible()
                names.evaluate('(e)=>e.scrollTop=e.scrollHeight')
                assert names.evaluate('(e)=>e.scrollTop > 0')
                page.get_by_role('button', name='Jan-Pòl Étienne', exact=False).click()
                page.wait_for_selector('[data-message-stream]')
            else:
                names = page.locator('[data-conversation-list]')
                names.evaluate('(e)=>e.scrollTop=e.scrollHeight')
                assert names.evaluate('(e)=>e.scrollTop > 0')
                assert composer.bounding_box() == original_composer
            page.screenshot(path=str(out / f'{engine.name}-{width}x{height}.png'))
            page.locator('textarea').focus()
            assert page.locator('textarea').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)') >= 16
            page.set_viewport_size({'width': width, 'height': max(400, height-300)})
            page.wait_for_timeout(100)
            visible_composer = composer.bounding_box()
            assert visible_composer['y'] + visible_composer['height'] <= max(400, height-300) + 1
            page.locator('textarea').blur()
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_timeout(100)
            assert composer.bounding_box()['y'] + composer.bounding_box()['height'] <= height
            assert not errors, errors
            results.append({'browser': engine.name, 'width': width, 'height': height, 'fixed_header_and_composer': True, 'independent_scrollers': True, 'collapsible_sidebar': width >= 768, 'resized_viewport_restored': True})
            context.close()
        context = browser.new_context(viewport={'width': 768, 'height': 1024})
        page = context.new_page()
        page.goto('http://127.0.0.1:4193/?locale=ht')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Kache meni lateral la').click()
        assert not page.locator('#admin-sidebar').is_visible()
        page.get_by_role('button', name='Retounen nan lis la').click()
        assert page.locator('[data-conversation-list]').is_visible()
        page.get_by_role('button', name='Jan-Pòl Étienne', exact=False).click()
        page.set_viewport_size({'width': 1024, 'height': 768})
        page.wait_for_timeout(100)
        assert page.locator('[data-conversation-list]').is_visible()
        page.screenshot(path=str(out / f'{engine.name}-ipad-landscape-kr.png'))
        context.close()
        browser.close()
out.joinpath('layout-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(f'PASS {len(results)} real-component layouts: fixed header/composer, hidden scrollbars, independent scrolling, tablet sidebar, viewport resize. Native iPad keyboard not tested.')
