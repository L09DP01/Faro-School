"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {initAuthenticatedRealtimeClient,getSupabaseToken} from '@/lib/supabase/client';
export function LiveStaffPresence(){
 const pathname=usePathname();
 useEffect(()=>{let disposed=false,channel:any=null,client:any=null;const sessionId=crypto.randomUUID();let busy=false,eligible:boolean|null=null;
 const stop=()=>{if(!channel)return;void channel?.untrack();navigator.sendBeacon('/api/messaging/presence',new Blob([JSON.stringify({sessionId,active:false})],{type:'application/json'}));};
 const beat=async()=>{if(busy||disposed||eligible===false)return;if(document.visibilityState!=='visible'||!navigator.onLine){stop();return;}busy=true;try{
  const info=await fetch('/api/messaging/presence',{cache:'no-store'});if(!info.ok){if(info.status===401)eligible=false;stop();return;}const staff=await info.json();if(!staff.staff){eligible=false;return;}eligible=true;
  if(!channel){client=await initAuthenticatedRealtimeClient();if(disposed)return;channel=client.channel('staff-live:'+staff.userId,{config:{private:true,presence:{key:sessionId}}});channel.subscribe((status:string)=>{if(status==='SUBSCRIBED')void beat();});}
  const res=await fetch('/api/messaging/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,active:true}),cache:'no-store'});
  if(res.ok&&!disposed){const lease=await res.json();await channel.track({sessionId,active:true,available:staff.available,expiresAt:lease.expiresAt});}
 }catch{void channel?.untrack();}finally{busy=false;}};
 void beat();const timer=setInterval(()=>void beat(),20000);const refresh=setInterval(()=>{void getSupabaseToken().then(token=>{if(token&&client)void client.realtime.setAuth(token);});},40*60*1000);
 const wake=()=>{eligible=null;void beat();};window.addEventListener('faro:logout',stop);window.addEventListener('pagehide',stop);window.addEventListener('offline',stop);window.addEventListener('online',wake);window.addEventListener('faro:availability',wake);window.addEventListener('faro:presence-probe',wake);document.addEventListener('visibilitychange',wake);
 return()=>{disposed=true;stop();void channel?.unsubscribe();clearInterval(timer);clearInterval(refresh);window.removeEventListener('faro:logout',stop);window.removeEventListener('pagehide',stop);window.removeEventListener('offline',stop);window.removeEventListener('online',wake);window.removeEventListener('faro:availability',wake);window.removeEventListener('faro:presence-probe',wake);document.removeEventListener('visibilitychange',wake);};
 },[]);useEffect(()=>{window.dispatchEvent(new Event('faro:presence-probe'));},[pathname]);return null;
}
