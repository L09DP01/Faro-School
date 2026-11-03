"use client";
import {useEffect,useState} from 'react';
import {initAuthenticatedRealtimeClient,getSupabaseToken} from '@/lib/supabase/client';
export function useStaffOnline(staffId?:string){const [online,setOnline]=useState(false);useEffect(()=>{setOnline(false);if(!staffId)return;let alive=true,channel:any,client:any;const sync=()=>{if(!alive)return;const sessions=Object.values(channel?.presenceState()||{}).flat() as any[];setOnline(sessions.some(s=>s.active===true&&Date.parse(s.expiresAt)>Date.now()));};
 void initAuthenticatedRealtimeClient().then(db=>{if(!alive)return;client=db;channel=db.channel('staff-live:'+staffId,{config:{private:true}}).on('presence',{event:'sync'},sync).subscribe(status=>{if(status!=='SUBSCRIBED'&&alive)setOnline(false);});}).catch(()=>{});
 const timer=setInterval(sync,5000),refresh=setInterval(()=>{void getSupabaseToken().then(t=>{if(t&&client)void client.realtime.setAuth(t);});},40*60*1000);
 return()=>{alive=false;clearInterval(timer);clearInterval(refresh);void channel?.unsubscribe();};},[staffId]);return online;}
