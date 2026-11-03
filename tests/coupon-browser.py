from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for locale in ['fr','ht']:
  page=browser.new_page(viewport={'width':1280,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4198/?mode=coupons-admin&locale='+locale)
  page.get_by_role('button',name='Kreye yon kòd' if locale=='ht' else 'Nouveau code promo',exact=False).click()
  dialog=page.get_by_role('dialog');dialog.locator('input[type=text]').fill('PAYE');dialog.locator('input[type=number]').nth(0).fill('100');dialog.locator('input[type=number]').nth(1).fill('1');dialog.locator('input[type=date]').fill('2026-11-30');dialog.get_by_role('button',name='Anrejistre' if locale=='ht' else 'Enregistrer',exact=True).click();dialog.wait_for(state='hidden')
  sent=page.evaluate('window.__couponSaved');assert sent['code']=='PAYE' and sent['discountValue']==100 and sent['maxUses']==1;assert sent['expiresAt']=='2026-11-30T23:59:59.999Z'
  assert page.get_by_text('PAYE',exact=True).is_visible()
  page.evaluate("window.__couponSaveError='duplicate_code'");page.get_by_role('button',name='Kreye yon kòd' if locale=='ht' else 'Nouveau code promo',exact=False).click();dialog=page.get_by_role('dialog');dialog.locator('input[type=text]').fill('PAYE');dialog.get_by_role('button',name='Anrejistre' if locale=='ht' else 'Enregistrer',exact=True).click();page.get_by_text('Kòd promo sa a egziste deja.' if locale=='ht' else 'Ce code promotionnel existe déjà.',exact=True).wait_for();assert not errors,errors;page.close()
  for code,total in [('PAYE',0),('REDUC',10),('EXPIRED',None)]:
   page=browser.new_page(viewport={'width':393,'height':852});requests=[];success={'value':False}
   def preview(route):route.fulfill(status=400 if total is None else 200,json={'valid':total is not None,'code':code,'newTotalHtg':total,'discountHtg':20-(total or 0)})
   def buy(route):
    requests.append(route.request.post_data_json)
    if success['value']:route.fulfill(json={'success':True,'status':'paid','freeEnrollment':True,'redirectUrl':'/'+locale+'/dashboard/formations'})
    else:route.fulfill(status=400,json={'error':'couponInvalid'})
   page.route('**/api/coupons/validate',preview);page.route('**/api/payments/create',buy)
   page.goto('http://127.0.0.1:4198/?mode=coupon-checkout&locale='+locale+('&no-provider=1' if total==0 else ''))
   page.locator('#coupon-code').fill(code);page.get_by_role('button',name='Aplike' if locale=='ht' else 'Appliquer',exact=True).click()
   if total==0:
    activate=page.get_by_role('button',name='Aktive fòmasyon mwen an' if locale=='ht' else 'Activer ma formation',exact=False);activate.wait_for();assert activate.is_enabled();assert page.locator('input[type=tel]').count()==0;activate.click();page.get_by_text('Kòd sa a pa disponib.' if locale=='ht' else 'Ce code promotionnel est indisponible.',exact=False).wait_for();assert 'payerPhone' not in requests[0];assert requests[0]['couponCode']==code;success['value']=True;activate.click();page.wait_for_url('**/'+locale+'/dashboard/formations')
   elif total==10:
    page.get_by_role('button',name='Peye 10 HTG' if locale=='ht' else 'Payer 10 HTG',exact=False).wait_for();page.locator('input[type=tel]').fill('+50934395967');page.get_by_role('button',name='Peye 10 HTG' if locale=='ht' else 'Payer 10 HTG',exact=False).click();page.wait_for_timeout(100);assert requests[0]['couponCode']=='REDUC';assert requests[0]['provider']=='moncash'
   else:page.get_by_text('Kòd sa a pa disponib.' if locale=='ht' else 'Ce code promotionnel est indisponible.',exact=True).wait_for();assert page.get_by_role('button',name='Peye 20 HTG' if locale=='ht' else 'Payer 20 HTG',exact=False).is_visible();assert len(requests)==0
   page.close()
 browser.close()
print('PASS FR/HT coupon browser: exact PAYE 100%, limit one, full expiry day, duplicate visible; free checkout without phone or provider, backend refusal retained and verified activation redirect; paid discount and expired code. Local mocks only.')
