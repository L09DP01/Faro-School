import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { recipientHash } from "@/lib/webhooks/security";
import { type EmailCategory, type EmailResult } from "./result";
export type { EmailResult } from "./result";
export interface EmailMessage { to: string; subject: string; html: string; text?: string; idempotencyKey?: string; correlationId?: string; kind?: string }
export function validEmailFrom(value: string) {
 const address=value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1]??value;
 return !/[\r\n]/.test(value)&&z.string().email().safeParse(address).success;
}
export function retryAfter(value: string|null, now=Date.now()) {
 if(!value)return undefined;
 const seconds=/^\d+$/.test(value)?Number(value):Math.ceil((Date.parse(value)-now)/1000);
 return Number.isFinite(seconds)?Math.max(0,seconds):undefined;
}
export async function sendResendEmail(message: EmailMessage): Promise<EmailResult> {
 const correlationId=message.correlationId??crypto.randomUUID();
 let outcome:EmailResult={status:"failed",category:"unknown",httpStatus:null,messageId:null,correlationId,success:false};
 const fail=(category:EmailCategory,httpStatus:number|null=null):EmailResult=>({...outcome,category,error:category,httpStatus});
 const key=process.env.RESEND_API_KEY?.trim(),from=process.env.EMAIL_FROM?.trim();
 try {
  if(!key&&process.env.NODE_ENV!=="production"&&process.env.APP_ENV!=="production") {
   console.info("EMAIL NOT SENT (no key)");outcome={...fail("config_missing"),status:"skipped"};
  }else if(!key||!from||!validEmailFrom(from))outcome=fail("config_missing");
  else if(!z.string().email().max(320).safeParse(message.to.trim()).success)outcome=fail("provider_validation");
  else {
   const to=message.to.trim().toLowerCase();let suppression;
   try{suppression=await createAdminClient().from("email_suppressions").select("suppressed").eq("recipient_hash",await recipientHash(to)).maybeSingle();}
   catch{suppression={error:true,data:null};}
   if(suppression.error)outcome=fail("suppression_lookup_failed");
   else if(suppression.data?.suppressed)outcome=fail("suppressed");
   else {
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(message.idempotencyKey?{"Idempotency-Key":message.idempotencyKey}:{})},body:JSON.stringify({from,to:[to],subject:message.subject,html:message.html,text:message.text??message.html.replace(/<[^>]*>/g," "),...(process.env.SUPPORT_EMAIL?.trim()?{reply_to:process.env.SUPPORT_EMAIL.trim()}:{})}),signal:AbortSignal.timeout(10000)});
    const status=response.status;
    if(!response.ok)outcome={...fail(status===401||status===403?"provider_auth":status===429?"provider_rate_limited":status>=500?"provider_unavailable":status>=400?"provider_validation":"unknown",status),retryAfterSeconds:retryAfter(response.headers.get("retry-after"))};
    else{const parsed=z.object({id:z.string().uuid()}).safeParse(await response.json());outcome=parsed.success?{...outcome,status:"accepted",category:null,httpStatus:status,messageId:parsed.data.id,id:parsed.data.id,success:true}:fail("unknown",status);}
   }
  }
 }catch(error){outcome=fail(error instanceof Error&&["TimeoutError","AbortError"].includes(error.name)?"timeout":"network");}
 try{const{error}=await createAdminClient().from("email_send_attempts").insert({kind:message.kind??"legacy",status:outcome.status,category:outcome.category,http_status:outcome.httpStatus,provider_message_id:outcome.messageId,correlation_id:correlationId});if(error)console.error("[email] tracking_unavailable",{correlationId,category:outcome.category});}
 catch{console.error("[email] tracking_unavailable",{correlationId,category:outcome.category});}
 return outcome;
}
