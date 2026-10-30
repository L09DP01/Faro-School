import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {readWebhookBody,parseWebhook,verifyResend,recipientHash,sha256,WebhookError,webhookResponse,webhookFailure} from "@/lib/webhooks/security";
// OpenNext runs the Next.js nodejs runtime inside Cloudflare Workers.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const base=z.object({type:z.string().min(1).max(100),created_at:z.string().datetime({offset:true}),data:z.unknown()});
const email=z.object({email_id:z.string().uuid(),to:z.array(z.string().trim().email().max(320)).min(1).max(50),bounce:z.object({type:z.string().max(40)}).optional()});
const suppression=z.object({id:z.string().uuid(),email:z.string().trim().email().max(320),origin:z.enum(["bounce","complaint","manual"])});
const events=new Set(["email.sent","email.delivered","email.delivery_delayed","email.bounced","email.complained","email.failed","email.suppressed"]);
export async function POST(request:Request){try{
 const secret=process.env.RESEND_WEBHOOK_SECRET;
 if(!secret||!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret))throw new WebhookError(503,"webhook_not_configured");
 const raw=await readWebhookBody(request);
 if(!await verifyResend(raw,request.headers,secret))throw new WebhookError(401,"invalid_signature");
 const parsed=base.safeParse(parseWebhook(raw));if(!parsed.success)throw new WebhookError(400,"invalid_event");
 const e=parsed.data;if(Date.parse(e.created_at)>Date.now()+300000)throw new WebhookError(400,"invalid_event_time");
 let resource:string,recipients:string[],blocked:boolean|null=null,reason:string|null=null;
 if(e.type==="suppression.added"||e.type==="suppression.removed"){
  const s=suppression.safeParse(e.data);if(!s.success)throw new WebhookError(400,"invalid_event");
  resource=s.data.id;recipients=[s.data.email];blocked=e.type==="suppression.added";reason=s.data.origin;
 }else if(events.has(e.type)){
  const s=email.safeParse(e.data);if(!s.success)throw new WebhookError(400,"invalid_event");
  resource=s.data.email_id;recipients=s.data.to;
  if(e.type==="email.complained"||e.type==="email.suppressed"||(e.type==="email.bounced"&&s.data.bounce?.type==="Permanent")){blocked=true;reason=e.type.slice(6);}
 }else return webhookResponse({received:true,ignored:true});
 const hashes=[...new Set(await Promise.all(recipients.map(recipientHash)))];
 const {data,error}=await createAdminClient().rpc("apply_resend_webhook",{p_event_id:request.headers.get("svix-id"),p_type:e.type,p_resource:resource,p_recipients:hashes,p_occurred_at:e.created_at,p_hash:await sha256(raw),p_suppressed:blocked,p_reason:reason});
 if(error)throw new Error("webhook_transaction_failed");
 // Delivery is not email verification: these events never modify profiles or sessions.
 return webhookResponse({received:true,duplicate:data?.duplicate===true});
}catch(error){return webhookFailure(error);}}
