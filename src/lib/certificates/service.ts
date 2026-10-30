import "server-only";
import {sendResendEmail} from "@/lib/email/transport";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/permissions";
import { certificateNameSchema, certificateNumber, verificationUrl, type Certificate, type CertificateEligibility } from "./shared";

export async function certificateUser() {
 const user = await getCurrentUser();
 if (!user?.emailVerified) throw new Error("unauthorized");
 // The existing guard verifies token_version; also reject bans, including an unchanged session.
 const { data, error } = await createAdminClient().from("profiles").select("banned_at,email_verified_at").eq("id",user.id).single();
 if(error || !data?.email_verified_at || data.banned_at) throw new Error("unauthorized");
 return user;
}
export async function eligibility(userId: string, courseId: string): Promise<CertificateEligibility> {
 const { data,error } = await createAdminClient().rpc("certificate_eligibility",{p_user:userId,p_course:courseId});
 if(error) throw new Error("unavailable");
 return data;
}
export async function issueCertificate(courseId: string, name: string, oldId?: string) {
 const user=await certificateUser();
 if(oldId && !can(user,"certificates.manage")) throw new Error("forbidden");
 const clean=certificateNameSchema.parse(name);
 for(let attempt=0;attempt<4;attempt++) {
  const db=createAdminClient();
  const {data,error}=await db.rpc("issue_course_certificate",{p_actor:user.id,p_course:courseId,p_name:clean,p_number:certificateNumber(),p_old:oldId??null});
  if(error?.code==="23505") continue;
  if(error) throw new Error(/not_eligible|not_enrolled|refunded/.test(error.message)?"not_eligible":"unavailable");
  const cert=data.certificate as Certificate;
  if(!cert.revoked_at && (data.created || !cert.email_sent_at)) {
   // Issuance is committed before email delivery. Never attach a PDF.
   const {data:owner}=await db.from("profiles").select("email,locale").eq("id",cert.user_id).single();
   if(owner?.email) await sendCertificateEmail(owner.email,owner.locale,cert).then(async()=>{await db.from("certificates").update({email_sent_at:new Date().toISOString()}).eq("id",cert.id);}).catch(()=>console.error("[certificate email] delivery failed",{certificateId:cert.id}));
  }
  return cert;
 }
 throw new Error("unavailable");
}
async function sendCertificateEmail(email:string,locale:string,cert:Certificate) {
 const base=process.env.NEXT_PUBLIC_APP_URL;
 if(!base) throw new Error("app_url");
 const ht=locale==="ht";
 const subject=ht?"Sètifika Faro School ou a pare":"Votre certificat Faro School est prêt";
 const text=[subject,cert.course_title,verificationUrl(base,cert.certificate_number),`${base}/${ht?"ht":"fr"}/certificats`].join("\n\n");
 const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
 const html=`<p>${esc(subject)}</p><p>${esc(cert.course_title)}</p><p><a href="${esc(verificationUrl(base,cert.certificate_number))}">${ht?"Verifye sètifika a":"Vérifier le certificat"}</a></p><p><a href="${esc(`${base}/${ht?"ht":"fr"}/certificats`)}">${ht?"Sètifika mwen yo":"Mes certificats"}</a></p>`;
 const result=await sendResendEmail({to:email,subject,text,html,idempotencyKey:`certificate/${cert.id}`});
 if(!result.success)throw new Error("email_delivery");
}
