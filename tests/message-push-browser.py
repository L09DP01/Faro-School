from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 # HTTP lease must survive a completely unavailable WebSocket.
 page=browser.new_page();beats=[]
 page.add_init_script('window.__realtimeFailure=true')
 def presence(route):
  if route.request.method=='POST':
   beats.append(route.request.post_data_json);route.fulfill(json={'expiresAt':'2099-01-01T00:00:00Z'})
  else:route.fulfill(json={'staff':True,'userId':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','available':True})
 page.route('**/api/messaging/presence',presence)
 page.goto('http://127.0.0.1:4198/?mode=presence-writer');page.wait_for_timeout(500)
 assert any(b['active'] for b in beats),'HTTP heartbeat cannot depend on realtime socket'
 first=beats[0]['sessionId'];page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(200);assert any(not b['active'] for b in beats),'Hidden session lease stops immediately';page.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(200);assert sum(b['active'] for b in beats)>=2;page.evaluate("window.dispatchEvent(new Event('faro:logout'))");page.wait_for_timeout(200)
 assert any(not b['active'] and b['sessionId']==first for b in beats),'Logout closes the same lease'
 page.close()
 # Enable only by direct gesture, save current device, disable; no real push service called.
 for scenario in ['enable','denied','old','ios']:
  page=browser.new_page(viewport={'width':393,'height':852});saved=[]
  page.add_init_script('''window.__permissionRequests=0;window.__subscriptions=0;window.__oldWorker=SCENARIO==='old';window.__ios=SCENARIO==='ios';window.__notStandalone=SCENARIO==='ios';
  const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/local-only',keys:{p256dh:'local',auth:'local'}}),unsubscribe:async()=>{window.__unsubscribed=true}};
  window.PushManager=class{};Object.defineProperty(window,'Notification',{value:{permission:SCENARIO==='denied'?'denied':'default',requestPermission:async()=>{window.__permissionRequests++;return 'granted'}}});
  const registration={active:{postMessage:(message,ports)=>ports[0].postMessage({push:!window.__oldWorker})},pushManager:{getSubscription:async()=>window.__subscriptions?subscription:null,subscribe:async options=>{window.__subscribeOptions={userVisibleOnly:options.userVisibleOnly,keyLength:options.applicationServerKey.length};window.__subscriptions++;return subscription}}};
  Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(registration)}});'''.replace('SCENARIO',json.dumps(scenario)))
  page.route('**/api/messaging/session',lambda route:route.fulfill(json={'userId':'student','role':'student','push':{'configured':True,'publicKey':'BA'+'A'*85}}))
  def save(route):
   saved.append(route.request.method);route.fulfill(json={'enabled':route.request.method=='POST'})
  page.route('**/api/push/subscriptions',save)
  page.goto('http://127.0.0.1:4198/?mode=notification-controls');page.get_by_text('Notifications des messages',exact=True).wait_for();page.wait_for_timeout(150)
  assert page.evaluate('window.__permissionRequests')==0,'No automatic browser permission prompt'
  if scenario=='enable':
   page.get_by_role('button',name='Activer les notifications',exact=True).click();page.get_by_text('Notifications activées sur cet appareil.',exact=True).wait_for();assert saved==['POST'];assert page.evaluate('window.__permissionRequests')==1;assert page.evaluate('window.__subscribeOptions.userVisibleOnly')
   page.get_by_role('button',name='Désactiver les notifications',exact=True).click();page.wait_for_function('window.__unsubscribed');assert saved==['POST','DELETE']
  elif scenario=='denied':assert page.get_by_role('button').is_disabled()
  elif scenario=='old':page.get_by_role('button',name='Mettre à jour pour activer les notifications',exact=True).click();assert page.evaluate('window.__updateRequested');assert page.evaluate('window.__permissionRequests')==0
  else:assert page.get_by_text('Ajoutez Faro School à l’écran d’accueil',exact=False).is_visible();assert page.get_by_role('button').count()==0
  page.close()
 # Global inbox updates work outside the chat page.
 page=browser.new_page();page.add_init_script("window.__inbox=0;window.__unread=0;window.addEventListener('faro:inbox-refresh',()=>window.__inbox++);window.addEventListener('faro:unread-changed',()=>window.__unread++)")
 page.route('**/api/messaging/session',lambda route:route.fulfill(json={'userId':'student','role':'student','push':{'configured':False}}))
 page.goto('http://127.0.0.1:4198/?mode=global-live');page.wait_for_function('window.__rtHandlers?.some(h=>h.topic==="user-inbox:student")');page.wait_for_timeout(150);before=page.evaluate('window.__inbox');page.evaluate("window.__rtHandlers.find(h=>h.topic==='user-inbox:student'&&h.filter.event==='message-change').cb({payload:{conversationId:'conv',messageId:'new-id'}})");page.wait_for_function('window.__inbox>'+str(before));assert page.evaluate('window.__unread')>0;assert page.evaluate("window.__deliveryAcks.includes('conv')")
 page.close();browser.close()
print('PASS local browser: heartbeat without socket, logout lease stop, voluntary Push activation/disable, denied/iOS/old-SW states, global inbox refresh without navigation. No real account or notification service used.')
