"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {initAuthenticatedRealtimeClient} from '@/lib/supabase/client';
export function LiveStaffPresence(){
 const pathname=usePathname();
 useEffect(()=>{
  let disposed=false,busy=false,eligible:boolean|null=null,channel:any=null,joining=false,subscribed=false,latest:any=null;
  const sessionId=crypto.randomUUID();
  const stop=()=>{void channel?.untrack();if(eligible!==true)return;navigator.sendBeacon('/api/messaging/presence',new Blob([JSON.stringify({sessionId,active:false})],{type:'application/json'}));};
  const track=()=>{if(subscribed&&latest&&!disposed)void channel.track(latest);};
  const connect=(staffId:string)=>{if(channel||joining)return;joining=true;void initAuthenticatedRealtimeClient().then(client=>{
   if(disposed)return;channel=client.channel('staff-live:'+staffId,{config:{private:true,presence:{key:sessionId}}});
   channel.subscribe((status:string)=>{subscribed=status==='SUBSCRIBED';if(subscribed)track();});
  }).catch(()=>{}).finally(()=>{joining=false;});};
  const beat=async()=>{
   if(busy||disposed||eligible===false)return;
   if(document.visibilityState!=='visible'||!navigator.onLine){stop();return;}
   busy=true;try{
    const info=await fetch('/api/messaging/presence',{cache:'no-store'});if(!info.ok){if(info.status===401)eligible=false;stop();return;}
    const staff=await info.json();if(!staff.staff){eligible=false;return;}eligible=true;
    // The authoritative HTTP lease never waits for a WebSocket connection.
    const response=await fetch('/api/messaging/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,active:true}),cache:'no-store'});
    if(!response.ok)return;const lease=await response.json();if(disposed||document.visibilityState!=='visible'||!navigator.onLine){stop();return;}
    latest={sessionId,active:true,available:staff.available,expiresAt:lease.expiresAt};connect(staff.userId);track();
   }catch{}finally{busy=false;}
  };
  const wake=()=>{if(document.visibilityState!=='visible'||!navigator.onLine){stop();return;}eligible=null;void beat();};
  void beat();const timer=setInterval(()=>void beat(),15000);
  for(const event of ['faro:logout','pagehide','offline'])window.addEventListener(event,stop);
  for(const event of ['online','focus','faro:availability','faro:presence-probe'])window.addEventListener(event,wake);
  document.addEventListener('visibilitychange',wake);
  return()=>{disposed=true;stop();void channel?.unsubscribe();clearInterval(timer);for(const event of ['faro:logout','pagehide','offline'])window.removeEventListener(event,stop);for(const event of ['online','focus','faro:availability','faro:presence-probe'])window.removeEventListener(event,wake);document.removeEventListener('visibilitychange',wake);};
 },[]);
 useEffect(()=>{window.dispatchEvent(new Event('faro:presence-probe'));},[pathname]);return null;
}
