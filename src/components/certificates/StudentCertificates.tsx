/* eslint-disable @next/next/no-img-element -- Native image keeps arbitrary course-cover URLs compatible with the existing unoptimized CDN. */
"use client";
import { useCallback,useEffect,useState } from "react";
import { useTranslations } from "next-intl";
import { Award,Download,Copy,MessageCircle,ArrowRight,CheckCircle2,X } from "lucide-react";
import { CertificatePreview } from "./CertificatePreview";
import { certificateNameSchema,verificationUrl,type Certificate,type CertificateEligibility } from "@/lib/certificates/shared";
export const certificateButton="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-heading font-semibold bg-orange text-navy-deep hover:bg-orange-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue disabled:opacity-50";
export interface AvailableCertificate extends CertificateEligibility {course_id:string;course:{title_fr:string;cover_url?:string|null}}
export function NameConfirmation({initialName,onConfirm,onClose,busy=false,error}:{initialName:string;onConfirm:(name:string)=>void;onClose:()=>void;busy?:boolean;error?:string}) {
 const t=useTranslations("certificates"),[name,setName]=useState(initialName);const valid=certificateNameSchema.safeParse(name).success;
 return <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-4" onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="certificate-name-title" className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-card">
   <button onClick={onClose} className="float-right p-2 text-muted-faro" aria-label={t("close")}><X size={20}/></button>
   <Award className="text-orange mb-4" size={32}/><h2 id="certificate-name-title" className="font-heading text-xl font-bold text-navy-deep">{t("confirmTitle")}</h2>
   <p className="text-sm text-muted-faro mt-3 mb-5">{t("confirmText")}</p>
   <form onSubmit={e=>{e.preventDefault();if(valid)onConfirm(name.trim());}}>
    <label className="block text-sm text-ink font-semibold" htmlFor="certificate-name">{t("name")}</label>
    <input autoFocus id="certificate-name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} required aria-describedby="certificate-name-error" className="mt-2 w-full border border-line rounded-xl p-3 bg-surface text-ink focus:outline-orange"/>
    <p id="certificate-name-error" className="text-xs text-red min-h-8 mt-2" role="status">{error?t.has(error)?t(error):t("error"):!valid?t("invalid_name"):""}</p>
    <div className="flex flex-wrap gap-3 mt-4"><button disabled={!valid||busy} className={certificateButton}>{busy?t("loading"):t("confirm")}</button><button type="button" onClick={onClose} className="min-h-11 px-4 text-navy font-semibold">{t("cancel")}</button></div>
   </form>
  </section>
 </div>;
}
export function CertificateCelebration({onGet}:{onGet:()=>void}) {
 const t=useTranslations("certificates");return <section className="rounded-2xl border border-orange/30 bg-orange-tint p-6 text-center shadow-card" aria-live="polite">
  <Award className="mx-auto text-orange mb-3" size={40}/><h2 className="font-heading text-2xl text-navy-deep font-bold">{t("congratulations")}</h2><p className="text-sm text-ink my-3">{t("celebration")}</p><button onClick={onGet} className={certificateButton}>{t("get")}<ArrowRight size={16}/></button>
 </section>;
}
export function StudentCertificates({locale,initialCertificates=[],initialAvailable=[],initialName="",baseUrl,signatureHost}:{locale:string;initialCertificates?:Certificate[];initialAvailable?:AvailableCertificate[];initialName?:string;baseUrl:string;signatureHost?:string}) {
 const t=useTranslations("certificates"),[certificates,setCertificates]=useState(initialCertificates),[available,setAvailable]=useState(initialAvailable),[fullName,setFullName]=useState(initialName),[selected,setSelected]=useState<AvailableCertificate|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{try{const r=await fetch("/api/certificates",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();setCertificates(d.certificates);setAvailable(d.available);setFullName(d.fullName);}catch{setError("unavailable");}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function issue(name:string){if(!selected)return;setBusy(true);setError("");try{const r=await fetch("/api/certificates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:selected.course_id,name})});const data=await r.json();if(!r.ok){setError(data.error);return;}setSelected(null);setNotice(t("issued"));await refresh();}catch{setError("unavailable");}finally{setBusy(false);}}
 const ready=available.filter(a=>a.eligible&&(!a.certificate||a.certificate.revoked_reason==="legacy_unconfirmed"));
 return <div className="space-y-7 pb-6">
  <div><p className="text-xs uppercase tracking-widest text-orange-strong font-heading font-bold">Faro School</p><h1 className="text-2xl md:text-3xl font-heading font-bold text-navy-deep mt-2">{t("title")}</h1><p className="text-muted-faro text-sm mt-2">{t("subtitle")}</p></div>
  <p role="status" className="text-sm text-ink">{notice}{!selected&&error?t.has(error)?t(error):t("error"):""}</p>
  {ready.map(a=><div key={a.course_id} className="space-y-2"><p className="text-sm font-heading text-navy-deep font-semibold">{a.course.title_fr}</p><CertificateCelebration onGet={()=>{setError("");setSelected(a);}}/></div>)}
  {certificates.length===0&&ready.length===0?<div className="bg-surface border border-dashed border-line rounded-2xl p-8 md:p-14 text-center"><Award size={44} className="mx-auto text-orange"/><h2 className="font-heading font-bold text-navy-deep text-xl mt-5">{t("empty")}</h2><p className="text-muted-faro text-sm my-4">{t("emptyText")}</p><a href={`/${locale}/dashboard/formations`} className={certificateButton}>{t("continue")}</a></div>:null}
  <div className="grid lg:grid-cols-2 gap-6">{certificates.map(c=>{const url=verificationUrl(baseUrl,c.certificate_number);return <article key={c.id} className="bg-surface rounded-2xl border border-line overflow-hidden shadow-card">
   {c.courses?.cover_url?<img src={c.courses.cover_url} alt="" className="h-28 w-full object-cover"/>:null}
   <div className="p-4 md:p-5 space-y-4"><div className="flex gap-2 items-start justify-between"><h2 className="font-heading text-navy-deep font-bold">{c.course_title}</h2><span className={`rounded-full px-2 py-1 text-xs whitespace-nowrap ${c.revoked_at?"bg-red-tint text-red":"bg-ok-tint text-ok"}`}>{t(c.revoked_at?"revoked":"obtained")}</span></div>
   <CertificatePreview certificate={c} url={url} signatureUrl={c.signature_image_path&&signatureHost?`https://${signatureHost}/${c.signature_image_path}`:undefined}/>
   <p className="text-xs text-muted-faro">{new Intl.DateTimeFormat(locale==="ht"?"fr-HT":"fr-FR",{dateStyle:"long"}).format(new Date(c.issued_at))} · {c.certificate_number}</p>
   <div className="flex flex-wrap gap-2">{!c.revoked_at?<a href={`/api/certificates/${c.id}/pdf`} className={certificateButton}><Download size={16}/>{t("download")}</a>:null}<button className="min-h-11 flex items-center gap-2 text-sm text-navy px-2" onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setNotice(t("copied"))).catch(()=>setNotice(url));}}><Copy size={16}/>{t("copy")}</button><a href={`https://wa.me/?text=${encodeURIComponent(t("shareText")+" "+url)}`} target="_blank" rel="noopener noreferrer" className="min-h-11 flex items-center gap-2 text-sm text-navy px-2"><MessageCircle size={16}/>{t("whatsapp")}</a></div></div>
  </article>})}</div>
  {selected?<NameConfirmation initialName={fullName} busy={busy} error={error} onClose={()=>setSelected(null)} onConfirm={issue}/>:null}
 </div>;
}
