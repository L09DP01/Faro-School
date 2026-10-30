/* eslint-disable @next/next/no-img-element -- Small local brand asset, shared with the PDF and standalone verification page. */
import { useTranslations } from "next-intl";
import { ShieldCheck,ShieldX,Search,Award } from "lucide-react";
import type { PublicCertificate } from "@/lib/certificates/shared";
export function VerificationView({result,locale}:{result:PublicCertificate;locale:string}) {
 const t=useTranslations("certificates");const Icon=result.status==="valid"?ShieldCheck:result.status==="revoked"?ShieldX:Search;
 const date=(s:string)=>new Intl.DateTimeFormat(locale==="ht"?"fr-HT":"fr-FR",{dateStyle:"long",timeZone:"UTC"}).format(new Date(s));
 return <main className="min-h-[70vh] bg-bg px-4 py-12 md:py-20"><div className="max-w-2xl mx-auto">
  <a href={`/${locale}`} className="block mb-8"><img src="/brand/logo-on-light.png" alt="Faro School" className="w-36 mx-auto"/></a>
  <section className="bg-surface rounded-2xl border border-line shadow-card p-6 md:p-10">
   <p className="text-xs font-heading uppercase tracking-widest text-muted-faro text-center">{t("verification")}</p>
   <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mt-6 ${result.status==="valid"?"bg-ok-tint text-ok":result.status==="revoked"?"bg-red-tint text-red":"bg-blue-tint text-blue"}`}><Icon size={32}/></div>
   <h1 className="text-2xl font-heading font-bold text-navy-deep text-center mt-5">{t(result.status)}</h1>
   {result.status==="valid"?<><dl className="mt-8 divide-y divide-line">{[[t("student"),result.student_name],[t("course"),result.course_title],[t("date"),date(result.issued_at)],[t("instructor"),result.instructor_name]].map(([label,value])=><div key={label} className="py-4"><dt className="text-xs text-muted-faro mb-1">{label}</dt><dd className="text-navy-deep font-heading font-semibold break-words">{value}</dd></div>)}</dl><p className="mt-6 flex gap-2 items-center text-sm text-muted-faro"><Award className="text-orange" size={20}/>{t("issuer")}</p></>:result.status==="revoked"?<><p className="text-muted-faro text-sm mt-5 text-center">{t("revokedText")}</p><p className="mt-6 text-sm text-navy-deep text-center">{t("revocationDate")} : {date(result.revoked_at)}</p></>:<p className="text-muted-faro mt-5 text-center">{t("notFoundText")}</p>}
  </section>
 </div></main>;
}
