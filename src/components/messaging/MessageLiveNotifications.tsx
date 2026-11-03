"use client";
import {useEffect} from 'react';
import {acknowledgeConversationDeliveryAction} from '@/app/actions/private-messaging';
import {usePathname} from 'next/navigation';
import {initAuthenticatedRealtimeClient} from '@/lib/supabase/client';
/** One private inbox connection across the app, including outside the chat page. */
export function MessageLiveNotifications(){
 const pathname=usePathname();
 useEffect(()=>{
  let stopped=false;const channels:any[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
  const emit=(value:any)=>{if(stopped)return;const data=value?.payload||value;
   if(typeof data?.conversationId==='string'&&typeof data?.messageId==='string'){window.dispatchEvent(new CustomEvent('faro:message',{detail:data}));void acknowledgeConversationDeliveryAction(data.conversationId).catch(()=>{});}
   if(timer)clearTimeout(timer);timer=setTimeout(()=>{window.dispatchEvent(new Event('faro:inbox-refresh'));window.dispatchEvent(new Event('faro:unread-changed'));},80);
  };
  const worker=(event:MessageEvent)=>{if(event.data?.type==='FARO_MESSAGE')emit(event.data);};
  navigator.serviceWorker?.addEventListener('message',worker);
  void(async()=>{try{
   const response=await fetch('/api/messaging/session',{cache:'no-store'});if(!response.ok)return;const session=await response.json();if(stopped)return;
   const client=await initAuthenticatedRealtimeClient();if(stopped)return;
   for(const topic of ['user-inbox:'+session.userId,...(session.role==='admin'?['support-inbox']:[])]){
    const channel=client.channel(topic,{config:{private:true}}).on('broadcast',{event:'message-change'},emit).on('broadcast',{event:'conversation-change'},emit).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+session.userId},()=>emit({})).subscribe(status=>{if(status==='SUBSCRIBED')emit({});});channels.push(channel);
   }
   if(session.role==='student'&&session.push?.configured&&'serviceWorker' in navigator&&'Notification' in window&&Notification.permission==='granted'){
    const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();
    if(subscription&&!stopped)await fetch('/api/push/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON())});
   }
  }catch{}})();
  return()=>{stopped=true;if(timer)clearTimeout(timer);for(const channel of channels)void channel.unsubscribe();navigator.serviceWorker?.removeEventListener('message',worker);};
 },[pathname]);return null;
}
