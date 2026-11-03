"use client";
import {useEffect,useState} from 'react';
import {initAuthenticatedRealtimeClient} from '@/lib/supabase/client';
export function useStaffOnline(staffId?:string){
 const [online,setOnline]=useState<boolean|null>(null);
 useEffect(()=>{
  setOnline(null);if(!staffId)return;let alive=true,busy=false,again=false,channel:any;
  const sync=async()=>{if(!alive)return;if(busy){again=true;return;}busy=true;try{
   const response=await fetch('/api/messaging/presence?staffId='+encodeURIComponent(staffId),{cache:'no-store'});
   if(!response.ok)throw Error();const value=await response.json();if(alive)setOnline(value.online===true);
  }catch{if(alive)setOnline(null);}finally{busy=false;if(again){again=false;void sync();}}};
  void sync();void initAuthenticatedRealtimeClient().then(client=>{if(!alive)return;channel=client.channel('staff-live:'+staffId,{config:{private:true}})
   .on('presence',{event:'sync'},()=>void sync()).on('broadcast',{event:'presence-change'},()=>void sync())
   .subscribe(()=>void sync());}).catch(()=>{});
  const timer=setInterval(()=>void sync(),10000);const wake=()=>void sync();window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  return()=>{alive=false;clearInterval(timer);void channel?.unsubscribe();window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);};
 },[staffId]);return online;
}
