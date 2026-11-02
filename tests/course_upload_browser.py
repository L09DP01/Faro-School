from pathlib import Path
import json,time,re
from playwright.sync_api import sync_playwright
out=Path('docs/screenshots/course-upload');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':1440,'height':1000})
 data=b'FAKE_VIDEO_BYTES_FOR_LOCAL_TRANSPORT_TEST'*100;received=[];state={'failed':False}
 def tus(route):
  request=route.request;headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,PATCH,HEAD,OPTIONS','Access-Control-Allow-Headers':'*','Access-Control-Expose-Headers':'Location,Upload-Offset'}
  if request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
  if request.method=='POST':
   if state['failed']:route.fulfill(status=500,headers=headers);return
   route.fulfill(status=201,headers={**headers,'Location':'https://video.bunnycdn.com/tusupload/fixture'});return
  if request.method=='PATCH':received.append(request.post_data_buffer);route.fulfill(status=204,headers={**headers,'Upload-Offset':str(sum(len(v) for v in received))});return
  route.fulfill(status=200,headers={**headers,'Upload-Offset':'0'})
 page.route('https://video.bunnycdn.com/**',tus)
 page.route('**/api/admin/video/direct-upload',lambda r:r.fulfill(status=200,json={'videoId':'55555555-5555-4555-8555-555555555555','uploadUrl':'https://video.bunnycdn.com/tusupload','authorizationSignature':'fixture','authorizationExpire':int(time.time())+3600,'libraryId':'123'}))
 page.goto('http://127.0.0.1:4194');page.wait_for_load_state('networkidle')
 with page.expect_file_chooser() as chooser:page.get_by_role('button',name=re.compile('Téléverser une vidéo')).click()
 chooser.value.set_files({'name':'cours.mp4','mimeType':'video/mp4','buffer':data})
 page.get_by_text('Fichier envoyé.',exact=False).wait_for();assert b''.join(received)==data
 page.get_by_text('Vidéo associée',exact=False).scroll_into_view_if_needed();page.screenshot(path=str(out/'file-upload-associated.png'))
 page.get_by_role('button',name='Enregistrer en brouillon').first.click();page.wait_for_function('window.__savedCourse');saved=page.evaluate('window.__savedCourse');assert saved['modules'][0]['lessons'][0]['videoId']=='55555555-5555-4555-8555-555555555555';assert saved['modules'][0]['lessons'][0]['durationSec']==0
 state['failed']=True
 with page.expect_file_chooser() as chooser:page.get_by_role('button',name='Remplacer',exact=True).click()
 chooser.value.set_files({'name':'autre.mp4','mimeType':'video/mp4','buffer':data})
 page.get_by_text('Le transfert vidéo a échoué.',exact=False).wait_for();assert page.get_by_text('55555555-5555-4555-8555-555555555555',exact=False).count()>0
 b.close();out.joinpath('result.json').write_text(json.dumps({'real_component':True,'file_picker':True,'bytes_transferred_to_mock':len(data),'associated_and_saved':True,'no_invented_duration':True,'old_video_preserved_on_failure':True,'live_bunny_upload':False},indent=2));print('PASS browser: file chooser, real bytes to mock TUS, lesson association/save, no fake duration, previous video preserved after failed replacement; no live Bunny upload.')
