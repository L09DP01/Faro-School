"use client";
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {X,BookOpen,MessageSquare,GraduationCap,Building2,ArrowLeft,Loader2} from 'lucide-react';
import {openStaffConversationAction} from '@/app/actions/student-messaging';
import type {EnrolledCourseOption} from '@/lib/messaging/types';
interface Props{isOpen:boolean;onClose:()=>void;enrolledCourses:EnrolledCourseOption[];defaultCourseId?:string|null;locale:string}
export function NewConversationModal({isOpen,onClose,enrolledCourses,locale}:Props){
 const t=useTranslations('messagingFlow'),router=useRouter();
 const [step,setStep]=useState<'choose'|'teacher'>('choose'),[error,setError]=useState<string|null>(null),[pending,startTransition]=useTransition();
 const busy=useRef(false);
 useEffect(()=>{if(isOpen){setStep('choose');setError(null);}},[isOpen]);
 if(!isOpen)return null;
 const open=(courseId:string|null)=>{
  if(busy.current)return;busy.current=true;setError(null);
  startTransition(async()=>{try{
   const result=await openStaffConversationAction(courseId,locale);
   if(!result.success||!result.data){setError(t('errors.'+(['forbidden','courseUnavailable','recipientUnavailable'].includes(result.error??'')?result.error:'unavailable')));return;}
   onClose();router.push('/'+locale+'/dashboard/messages/'+encodeURIComponent(result.data.conversationId));router.refresh();
  }catch{setError(t('errors.unavailable'));}finally{busy.current=false;}});
 };
 return <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center compose-backdrop p-4" style={{paddingTop:'max(1rem,env(safe-area-inset-top,0px))',height:'calc(var(--app-height,100dvh) - var(--app-nav-height,0px))'}}>
  <section role="dialog" aria-modal="true" aria-labelledby="compose-title" className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card">
   <header className="mb-5 flex items-start justify-between gap-3"><div><h2 id="compose-title" className="font-heading text-lg font-bold text-ink">{t(step==='choose'?'write':'chooseCourse')}</h2><p className="mt-1 text-sm text-muted-faro">{t(step==='choose'?'chooseRecipient':'teacherHelp')}</p></div><button type="button" onClick={onClose} disabled={pending} aria-label={t('close')} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-ink"><X className="h-5 w-5"/></button></header>
   {error&&<p role="alert" className="mb-4 rounded-xl bg-red-tint p-3 text-sm text-red">{error}</p>}
   {pending?<p role="status" className="flex items-center justify-center gap-2 p-6 text-muted-faro"><Loader2 className="h-5 w-5 animate-spin"/>{t('opening')}</p>:step==='choose'?<div className="space-y-3">
    <button type="button" onClick={()=>setStep('teacher')} className="flex w-full items-center gap-4 rounded-xl border border-line bg-bg p-4 text-left text-ink"><GraduationCap className="h-6 w-6 shrink-0 text-orange"/><span><strong className="block">{t('teacher')}</strong><span className="text-sm text-muted-faro">{t('teacherHelp')}</span></span></button>
    <button type="button" onClick={()=>open(null)} className="flex w-full items-center gap-4 rounded-xl border border-line bg-bg p-4 text-left text-ink"><Building2 className="h-6 w-6 shrink-0 text-orange"/><span><strong className="block">{t('direction')}</strong><span className="text-sm text-muted-faro">{t('directionHelp')}</span></span></button>
   </div>:<div className="space-y-3"><button type="button" onClick={()=>setStep('choose')} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink"><ArrowLeft className="h-4 w-4"/>{t('back')}</button>
    {enrolledCourses.length===0?<p className="rounded-xl border border-line p-4 text-sm text-muted-faro">{t('noCourses')}</p>:enrolledCourses.map(course=><button type="button" key={course.id} onClick={()=>open(course.id)} className="flex w-full items-start gap-3 rounded-xl border border-line p-4 text-left text-ink"><BookOpen className="mt-1 h-5 w-5 shrink-0 text-orange"/><span className="min-w-0"><strong className="block break-words">{course.title}</strong><span className="mt-1 block break-words text-sm text-muted-faro">{course.instructorName}</span></span><MessageSquare className="ml-auto h-5 w-5 shrink-0 text-muted-faro"/></button>)}
   </div>}
  </section>
 </div>;
}
