"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
export function CourseReviewForm({courseId}:{courseId:string}){
 const t=useTranslations('courseFacts'),router=useRouter();
 const [rating,setRating]=useState('5'),[comment,setComment]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 return <form className="rounded-2xl border border-line bg-surface p-6 space-y-4" onSubmit={async e=>{
  e.preventDefault();if(pending)return;setPending(true);setMessage('');
  try{const response=await fetch('/api/courses/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId,rating:Number(rating),comment})});if(!response.ok)throw Error();setMessage(t('saved'));router.refresh();}catch{setMessage(t('error'));}finally{setPending(false);}
 }}><h3 className="text-lg font-heading font-bold">{t('reviewTitle')}</h3><p className="text-sm text-muted-faro">{t('reviewHelp')}</p>
 <label className="block text-sm">{t('rating')}<select aria-label={t('rating')} className="ml-3 border border-line rounded-lg p-2 text-base" value={rating} onChange={e=>setRating(e.target.value)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
 <label className="block text-sm">{t('comment')}<textarea className="mt-2 block w-full rounded-lg border border-line p-3 text-base" required minLength={5} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)}/></label>
 <button disabled={pending} className="rounded-xl bg-orange text-white font-semibold px-5 py-3 disabled:opacity-50">{t('save')}</button>{message&&<p role="status" className="text-sm">{message}</p>}</form>;
}
