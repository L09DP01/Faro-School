"use client";
import {useCallback,useEffect,useState} from 'react';
import {usePwa} from '@/lib/pwa/use-pwa';
function workerSupportsPush(registration:ServiceWorkerRegistration){return new Promise<boolean>(resolve=>{
 const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(false);},1200);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.push===true);};
 registration.active?.postMessage({type:'FARO_FEATURES'},[channel.port2]);
});}
function publicKey(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export function MessageNotificationControls({locale='fr'}:{locale?:string}){
 const ht=locale==='ht',tr=useCallback((fr:string,kr:string)=>ht?kr:fr,[ht]);const{isIos,isStandalone,hasUpdate,applyUpdate}=usePwa();
 const[supported,setSupported]=useState(false),[enabled,setEnabled]=useState(false),[workerReady,setWorkerReady]=useState(false),[busy,setBusy]=useState(false),[key,setKey]=useState<string|null>(null),[notice,setNotice]=useState(''),[permission,setPermission]=useState<NotificationPermission>('default');
 const inspect=useCallback(async()=>{
  if(!('serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window))return;setSupported(true);setPermission(Notification.permission);
  try{const response=await fetch('/api/messaging/session',{cache:'no-store'});if(!response.ok)throw Error();const info=await response.json();if(!info.push?.configured){setNotice(tr('Notifications momentanément indisponibles.','Notifikasyon yo pa disponib pou kounye a.'));return;}setKey(info.push.publicKey);
   const registration=await navigator.serviceWorker.ready;setWorkerReady(await workerSupportsPush(registration));const subscription=await registration.pushManager.getSubscription();
   if(subscription&&Notification.permission==='granted'){const saved=await fetch('/api/push/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON())});setEnabled(saved.ok);}
  }catch{setNotice(tr('Vérification indisponible. Réessayez.','Verifikasyon pa disponib. Eseye ankò.'));}
 },[tr]);
 useEffect(()=>{void inspect();},[inspect]);
 const toggle=async()=>{if(busy)return;setBusy(true);setNotice('');try{
  if(enabled){const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();const response=await fetch('/api/push/subscriptions',{method:'DELETE'});if(!response.ok)throw Error();await subscription?.unsubscribe();setEnabled(false);return;}
  if(!workerReady){if(hasUpdate)applyUpdate();else await inspect();return;}
  if(!key)throw Error();const result=await Notification.requestPermission();setPermission(result);if(result!=='granted')return;
  const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(key)});
  const response=await fetch('/api/push/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON())});if(!response.ok)throw Error();setEnabled(true);
 }catch{setNotice(tr('Les notifications n’ont pas pu être activées. Réessayez.','Nou pa rive aktive notifikasyon yo. Eseye ankò.'));}finally{setBusy(false);}};
 if(!supported)return null;
 return <section className="rounded-xl border border-line p-3 space-y-2"><p className="text-sm font-semibold text-ink">{tr('Notifications des messages','Notifikasyon mesaj yo')}</p><p className="text-xs text-muted-faro">{tr('Recevez une alerte lorsque vous ne consultez pas la conversation.','Resevwa yon alèt lè ou pa nan diskisyon an.')}</p>
 {isIos&&!isStandalone?<p className="text-xs text-muted-faro">{tr('Ajoutez Faro School à l’écran d’accueil, puis ouvrez l’application pour activer les notifications.','Ajoute Faro School sou ekran akèy la, epi ouvri aplikasyon an pou aktive notifikasyon yo.')}</p>:<button type="button" disabled={busy||permission==='denied'||!key} onClick={()=>void toggle()} className="min-h-11 rounded-xl bg-orange px-4 text-sm font-semibold text-white disabled:opacity-50">{busy?tr('Vérification…','Verifikasyon…'):enabled?tr('Désactiver les notifications','Dezaktive notifikasyon yo'):!workerReady?hasUpdate?tr('Mettre à jour pour activer les notifications','Mete aplikasyon an ajou pou aktive notifikasyon yo'):tr('Vérifier les notifications','Verifye notifikasyon yo'):tr('Activer les notifications','Aktive notifikasyon yo')}</button>}
 {enabled&&<p role="status" className="text-xs text-ok">{tr('Notifications activées sur cet appareil.','Notifikasyon yo aktive sou aparèy sa a.')}</p>}
 {permission==='denied'&&<p className="text-xs text-muted-faro">{tr('Les notifications sont bloquées dans les réglages de votre navigateur ou appareil.','Notifikasyon yo bloke nan reglaj navigatè oswa aparèy ou a.')}</p>}
 {notice&&<p role="status" className="text-xs text-muted-faro">{notice}</p>}</section>;
}
