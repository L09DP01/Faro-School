from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for width in [390,768,820,894,1024,1180,1280,1440]:
  for locale in ['fr','ht']:
   for community in [False,True]:
    page=browser.new_page(viewport={'width':width,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    mode='tablet-community' if community else 'tablet-messages'
    page.goto(f'http://127.0.0.1:4198/?mode={mode}&locale={locale}')
    panel_list=page.locator('main aside')
    panel_chat=page.locator('main section')
    panel_list.wait_for(state='visible')
    sidebar=page.get_by_test_id('app-sidebar')
    assert sidebar.is_visible()==(width>=768)
    before=sidebar.bounding_box() if width>=768 else None
    assert panel_chat.is_visible()==(width>=1280)
    if community:
     if width<1280:assert page.evaluate('window.__communityReads||0')==0,'Unopened community must not mark messages as read'
     page.get_by_role('button').filter(has_text='Communauté Faro School').click()
    else:page.locator('a[href="/dashboard/messages/local-thread"]').click()
    panel_chat.wait_for(state='visible')
    assert panel_list.is_visible()==(width>=1280)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width>=768:assert sidebar.bounding_box()==before,str((width,locale,community,before,sidebar.bounding_box()))
    if community:
     back=page.get_by_role('button',name='Retounen nan lis la' if locale=='ht' else 'Retour à la liste',exact=True)
     page.wait_for_function('(window.__communityReads||0)>0')
    else:back=page.locator('main header a[href="/dashboard/messages"]')
    assert back.is_visible()==(width<1280)
    if width<1280:
     back.click()
     panel_list.wait_for(state='visible')
     assert not panel_chat.is_visible()
    assert not errors,errors
    page.close()
 browser.close()
print('PASS FR/KR community and messages: 390/768/820/894/1024/1180 list-chat-back; 1280/1440 two panes; fixed sidebar geometry; no overflow or JS error; read only when community visible. Local fixtures, no remote data.')
