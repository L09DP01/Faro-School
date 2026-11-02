"use client";
import {useEffect,useState,useTransition} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from '@/i18n/navigation';
import {loadAssistantTakeoversAction,takeConversationControlAction} from '@/app/actions/private-messaging';
import type {Conversation} from '@/lib/messaging/types';

export function AssistantTakeoverPrompt({locale}:{locale:string}){
 const ht=locale==='ht',router=useRouter();
 const [items,setItems]=useState<Conversation[]>([]),[dismissed,setDismissed]=useState<string[]>([]),[pending,start]=useTransition(),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;const refresh=async()=>{if(document.visibilityState!=='visible')return;try{const r=await loadAssistantTakeoversAction();if(alive&&r.success)setItems(r.data||[]);}catch{}};void refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 const key=(c:Conversation)=>c.id+':'+c.lastMessageAt+':'+c.status;
 const item=items.find(c=>!dismissed.includes(key(c)));
 if(!item)return null;
 return createPortal(<div className="fixed inset-0 z-[80] bg-ink/40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="assistant-takeover-title" className="max-w-md w-full rounded-2xl bg-surface border border-line p-6 shadow-card space-y-4">
  <h2 id="assistant-takeover-title" className="font-heading font-bold text-lg text-ink">{ht?'Pran relè asistan an':'Prendre le relais de l’assistant'}</h2>
  <p className="text-sm text-muted-faro">{item.studentName} · {item.courseTitle}</p>
  <p className="text-sm text-ink">{ht?'Ou disponib. Ou ka li echanj yo epi reponn elèv la. IA a ap sispann lè ou pran relè a.':'Vous êtes disponible. Consultez les échanges et répondez à l’élève. L’IA s’arrête lorsque vous prenez le relais.'}</p>
  {error&&<p role="alert" className="text-red text-sm">{ht?'Nou pa ka pran relè a. Eseye ankò.':'La prise de relais a échoué. Réessayez.'}</p>}
  <div className="flex flex-wrap gap-3"><button disabled={pending} onClick={()=>start(async()=>{setError(false);const r=await takeConversationControlAction(item.id);if(!r.success){setError(true);return;}setDismissed(d=>[...d,key(item)]);router.push('/admin/messages?convId='+encodeURIComponent(item.id));router.refresh();})} className="min-h-11 rounded-xl bg-orange px-4 font-semibold text-white disabled:opacity-50">{ht?'Pran relè a':'Prendre le relais'}</button><button disabled={pending} onClick={()=>setDismissed(d=>[...d,key(item)])} className="min-h-11 rounded-xl border border-line px-4 text-ink">{ht?'Kite IA a kontinye':'Laisser l’IA continuer'}</button></div>
 </section></div>,document.body);
}
