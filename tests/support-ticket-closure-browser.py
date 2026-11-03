from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for locale in ['fr','ht']:
  for width in [393,1280]:
   page=browser.new_page(viewport={'width':width,'height':900})
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:4198/?mode=admin-ticket&locale='+locale)
   resolve=page.get_by_role('button',name='Rezoud tikè a' if locale=='ht' else 'Résoudre le ticket',exact=True)
   resolve.wait_for()
   page.get_by_text('Historique conservé',exact=False).wait_for()
   page.evaluate('window.__unconfirmedClosure=true')
   resolve.click()
   page.get_by_text('Fèmti a pa konfime. Rafrechi epi eseye ankò.' if locale=='ht' else 'Clôture non confirmée. Actualisez puis réessayez.',exact=True).wait_for()
   assert resolve.is_enabled()
   assert not page.locator('[data-message-composer] textarea').is_disabled()
   page.evaluate('window.__unconfirmedClosure=false')
   resolve.click()
   closed=page.get_by_role('button',name='Fèmen' if locale=='ht' else 'Clôturé',exact=True)
   closed.wait_for()
   assert closed.is_disabled()
   assert page.locator('[data-message-composer] textarea').is_disabled()
   page.wait_for_timeout(5200)
   assert closed.is_disabled(),'Server refresh must keep closure'
   assert page.get_by_text('Historique conservé',exact=True).is_visible()
   if width<1024:
    page.get_by_role('button',name='Retounen nan lis la' if locale=='ht' else 'Retour à la liste',exact=True).click()
   page.get_by_role('button',name='Tout (0)' if locale=='ht' else 'Tous (0)',exact=True).click()
   assert page.locator('[data-conversation-list] button').count()==0,'Closed ticket must not remain in All'
   page.get_by_role('button',name='Fèmen (1)' if locale=='ht' else 'Clôturé (1)',exact=True).click()
   assert page.locator('[data-conversation-list] button').count()==1
   page.locator('[data-conversation-list] button').click()
   page.get_by_text('Historique conservé',exact=False).wait_for()
   assert not errors,errors
   page.goto('http://127.0.0.1:4198/?mode=closed-ticket&locale='+locale)
   page.get_by_text('Historique conservé',exact=False).wait_for()
   assert page.locator('[data-chat-composer] input').is_disabled()
   assert page.get_by_role('button',name='Kreye yon tikè sipò' if locale=='ht' else 'Créer un ticket support',exact=False).count()==0
   page.get_by_text('Tikè a rezoud epi fèmen. Ou ka li ansyen mesaj yo.' if locale=='ht' else 'Ticket résolu et clôturé. Vous pouvez consulter les anciens messages.',exact=True).wait_for()
   assert not errors,errors
   page.goto('http://127.0.0.1:4198/?mode=closed-list&locale='+locale)
   page.get_by_role('tab',name='Tout' if locale=='ht' else 'Tous',exact=True).wait_for()
   links=page.locator('a[href$="/dashboard/messages/conv"]')
   assert links.count()==0,'Student All must exclude the archive'
   page.get_by_role('tab',name='Fèmen' if locale=='ht' else 'Clôturés',exact=True).click()
   assert links.count()==1,'Closed history must remain accessible in archive'
   page.get_by_role('tab',name='Tout' if locale=='ht' else 'Tous',exact=True).click()
   assert links.count()==0
   assert not errors,errors
   page.close()
 browser.close()
print('PASS admin/student terminal closure FR/HT at mobile/desktop widths: unconfirmed success rejected, closed persists after refresh, composer disabled, history retained, no reopen button.')
