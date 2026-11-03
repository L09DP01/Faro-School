from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for locale in ['fr','ht']:
  page=browser.new_page(viewport={'width':393,'height':852})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/messaging/presence?*',lambda route:route.fulfill(json={'online':page.evaluate("Object.values(window.__staffPresence||{}).flat().some(s=>s.active&&Date.parse(s.expiresAt)>Date.now())")}))
  page.goto('http://127.0.0.1:4198/?mode=ticket&locale='+locale)
  composer=page.locator('[data-chat-composer] input')
  assert not composer.is_disabled(),'Human support must accept more details'
  assert page.get_by_role('button',name='Kreye yon tikè sipò' if locale=='ht' else 'Créer un ticket support',exact=False).count()==0
  page.wait_for_function('window.__rtHandlers?.some(h=>h.type==="presence")')
  page.evaluate("window.__staffPresence={first:[{active:true,available:false,expiresAt:new Date(Date.now()+45000).toISOString()}],second:[{active:true,available:false,expiresAt:new Date(Date.now()+45000).toISOString()}]};window.__rtHandlers.filter(h=>h.type==='presence').forEach(h=>h.cb())")
  page.get_by_text('An liy' if locale=='ht' else 'En ligne',exact=True).wait_for()
  page.evaluate("delete window.__staffPresence.first;window.__rtHandlers.filter(h=>h.type==='presence').forEach(h=>h.cb())")
  assert page.get_by_text('An liy' if locale=='ht' else 'En ligne',exact=True).is_visible()
  page.evaluate("window.__staffPresence={};window.__rtHandlers.filter(h=>h.type==='presence').forEach(h=>h.cb())")
  page.get_by_text('Pa an liy' if locale=='ht' else 'Hors ligne',exact=True).wait_for()
  page.evaluate("const row={id:'instant',conversation_id:'conv',sender_id:'teacher',sender_type:'staff',body:'Instant private broadcast',created_at:new Date().toISOString()};window.__messageRows={instant:row};window.__rtHandlers.filter(h=>h.filter.event==='message-change').forEach(h=>h.cb({payload:{messageId:'instant',conversationId:'conv'}}))")
  page.get_by_text('Instant private broadcast',exact=False).wait_for(timeout=1200)
  page.evaluate('window.__failMessage=true;window.__sendDelay=200')
  composer.fill('Local retry message');composer.press('Enter')
  page.get_by_label('Ap voye' if locale=='ht' else 'Envoi en cours',exact=True).wait_for()
  retry=page.get_by_role('button',name='Voye mesaj la ankò' if locale=='ht' else 'Réessayer l’envoi',exact=True)
  retry.wait_for();client_id=page.evaluate('window.__sentMessage[2]');retry.click()
  page.get_by_label('Anrejistre' if locale=='ht' else 'Enregistré',exact=True).wait_for()
  assert page.evaluate('window.__sentMessage[2]')==client_id
  assert page.inner_text('[data-message-stream]').count('Local retry message')==1
  page.evaluate("const args=window.__sentMessage;window.__receipt={id:'server-'+args[2],client_message_id:args[2],conversation_id:args[0],sender_id:'student',sender_type:'student',body:args[1],created_at:new Date().toISOString(),delivered_at:new Date().toISOString()};window.__rtHandlers.filter(h=>h.filter.table==='messages').forEach(h=>h.cb({new:window.__receipt}))")
  page.get_by_label('Resevwa' if locale=='ht' else 'Distribué',exact=True).wait_for()
  page.evaluate("window.__receipt.read_at=new Date().toISOString();window.__rtHandlers.filter(h=>h.filter.table==='messages').forEach(h=>h.cb({new:window.__receipt}))")
  page.get_by_label('Li' if locale=='ht' else 'Lu',exact=True).wait_for()
  page.evaluate("for(let i=0;i<70;i++){const row={id:'history-'+i,conversation_id:'conv',sender_id:'teacher',sender_type:'staff',body:'Historical message '+i,created_at:new Date(Date.now()+i*1000).toISOString()};(window.__messageRows||(window.__messageRows={}))[row.id]=row;window.__rtHandlers.filter(h=>h.filter.table==='messages').forEach(h=>h.cb({new:row}))}")
  page.wait_for_function("document.querySelector('[data-message-stream]').scrollHeight>document.querySelector('[data-message-stream]').clientHeight+200")
  page.locator('[data-message-stream]').evaluate("pane=>{pane.scrollTop=0;pane.dispatchEvent(new Event('scroll',{bubbles:true}))}")
  page.evaluate("const row={id:'new-after-scroll',conversation_id:'conv',sender_id:'teacher',sender_type:'staff',body:'Latest while reading history',created_at:new Date(Date.now()+100000).toISOString()};(window.__messageRows||(window.__messageRows={}))[row.id]=row;window.__rtHandlers.filter(h=>h.filter.table==='messages').forEach(h=>h.cb({new:row}))")
  page.get_by_text('Latest while reading history',exact=False).wait_for()
  assert page.locator('[data-message-stream]').evaluate('pane=>pane.scrollTop')<10,'New arrival must not move a reader away from history'
  assert not errors,errors
  page.close()
 browser.close()
print('PASS FR/KR real chat UI: session join/leave and multiple sessions; human ticket writable; sending clock, network retry same ID, no duplicate, persisted/delivered/read indicators. Realtime/provider simulated locally.')
