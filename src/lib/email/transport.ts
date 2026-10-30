import "server-only";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {recipientHash} from "@/lib/webhooks/security";
export interface EmailMessage{to:string;subject:string;html:string;text?:string;idempotencyKey?:string}
export interface EmailResult{success:boolean;error?:string;id?:string}
export async function sendResendEmail(message:EmailMessage):Promise<EmailResult>{
 const key=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM;
 if(!key){
  if(process.env.NODE_ENV!=="production"&&process.env.APP_ENV!=="production")return{success:true};
  return{success:false,error:"email_configuration"};
 }
 if(!from)return{success:false,error:"email_configuration"};
 const address=z.string().trim().email().max(320).safeParse(message.to);if(!address.success)return{success:false,error:"email_invalid"};
 const to=address.data.toLowerCase();
 try{
  const {data,error}=await createAdminClient().from("email_suppressions").select("suppressed").eq("recipient_hash",await recipientHash(to)).maybeSingle();
  if(error)return{success:false,error:"email_unavailable"};
  if(data?.suppressed)return{success:false,error:"email_suppressed"};
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(message.idempotencyKey?{"Idempotency-Key":message.idempotencyKey}:{})},body:JSON.stringify({from,to:[to],subject:message.subject,html:message.html,...(message.text?{text:message.text}:{})}),signal:AbortSignal.timeout(10000)});
  // Provider errors may contain recipient data. Do not log or forward raw bodies.
  if(!response.ok)return{success:false,error:"email_delivery"};
  const result=z.object({id:z.string().uuid()}).safeParse(await response.json());
  return result.success?{success:true,id:result.data.id}:{success:false,error:"email_delivery"};
 }catch{return{success:false,error:"email_unavailable"};}
}
