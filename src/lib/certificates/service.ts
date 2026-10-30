import "server-only";
import {processOutbox} from "@/lib/email/outbox";
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
   const {data:queued,error:lookup}=await db.from('email_outbox').select('id').eq('idempotency_key','certificate:'+cert.id).maybeSingle();
   if(lookup)console.error('[email] certificate_outbox_unavailable');
   if(queued){const [sent]=await processOutbox(queued.id);if(sent?.status==='accepted'){const{error}=await db.from('certificates').update({email_sent_at:new Date().toISOString()}).eq('id',cert.id);if(error)console.error('[email] certificate_tracking_unavailable');}}

  }
  return cert;
 }
 throw new Error("unavailable");
}
