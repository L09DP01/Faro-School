import 'server-only';
import {randomCode,randomToken} from '@/lib/auth/tokens';
import {createAdminClient} from '@/lib/supabase/admin';
import {sha256} from '@/lib/webhooks/security';
import {sendResendEmail,type EmailMessage} from './transport';
import {type EmailResult,type EmailCategory} from './result';
import {renderEmail,EMAIL_TIMES,type TemplateInput} from './templates';
export interface OutboxRow {id:string;kind:string;user_id:string|null;recipient:string;locale:string;idempotency_key:string;status:string;attempts:number;correlation_id:string;data:Record<string,string>;created_at:string;prepared_at:string|null;provider_message_id:string|null;last_error_category:EmailCategory|null;provider_http_status:number|null}
export const BACKOFF_SECONDS=[60,300,1800,7200,21600];
export const transient=(category:EmailCategory|null)=>['provider_rate_limited','provider_unavailable','timeout','network','suppression_lookup_failed','unknown'].includes(category??'');
export function nextRetry(attempt:number,category:EmailCategory|null,retryAfter=0,now=Date.now()) {return transient(category)&&attempt<5?new Date(now+Math.max(BACKOFF_SECONDS[attempt-1]??21600,retryAfter)*1000).toISOString():null;}
function queued(correlationId=crypto.randomUUID()):EmailResult{return{status:'queued',category:null,httpStatus:null,messageId:null,correlationId,success:false};}
export async function deriveAuthSecrets(id:string):Promise<{code:string;token:string}>{
 const secret=process.env.AUTH_SECRET?.trim();if(!secret)throw new Error('config_missing');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('email-material:v1:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const db=createAdminClient();
 const {data:stored,error:lookup}=await db.from('email_outbox_material').select('nonce,ciphertext').eq('outbox_id',id).maybeSingle();
 if(lookup)throw new Error('email_material_unavailable');
 const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const unhex=(text:string)=>Uint8Array.from(text.match(/../g)??[],v=>parseInt(v,16));
 let material=stored;
 if(!material){
  const code=randomCode(),token=randomToken(),nonce=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:new TextEncoder().encode(id)},key,new TextEncoder().encode(JSON.stringify({code,token})));
  const {error}=await db.from('email_outbox_material').upsert({outbox_id:id,nonce:hex(nonce),ciphertext:hex(new Uint8Array(cipher))},{onConflict:'outbox_id',ignoreDuplicates:true});
  if(error)throw new Error('email_material_unavailable');
  const {data,error:read}=await db.from('email_outbox_material').select('nonce,ciphertext').eq('outbox_id',id).single();
  if(read||!data)throw new Error('email_material_unavailable');material=data;
 }
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(material.nonce),additionalData:new TextEncoder().encode(id)},key,unhex(material.ciphertext));
 return JSON.parse(new TextDecoder().decode(plain));
}
async function messageFor(row:OutboxRow):Promise<EmailMessage>{
 const db=createAdminClient(),base=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,'');if(!base)throw new Error('config_missing');
 let input:TemplateInput={kind:row.kind,locale:row.locale,...row.data};
 if(row.data.course_slug)input.url=base+'/'+row.locale+'/formations/'+encodeURIComponent(row.data.course_slug);
 if(row.kind==='payment_confirmed'&&row.data.order_id)input.receiptUrl=base+'/api/orders/'+encodeURIComponent(row.data.order_id)+'/receipt';
 if(row.kind==='certificate')input.url=base+'/'+row.locale+'/certificats';
 if(row.kind==='contact'){if(!process.env.SUPPORT_EMAIL?.trim())throw new Error('config_missing');input.url=base+'/'+row.locale+'/admin/messages';}
 if(row.kind==='escalation')input.url=base+'/'+row.locale+'/admin/messages/'+encodeURIComponent(row.data.conversation_id);
 if(['verification','reset','invitation','email_change'].includes(row.kind)){
  // Only references are persisted. Identical cryptographic material and request across retries.
  const {code,token}=await deriveAuthSecrets(row.id);
  const minutes=['verification','email_change'].includes(row.kind)?EMAIL_TIMES.verificationMinutes:row.kind==='invitation'?EMAIL_TIMES.invitationHours*60:EMAIL_TIMES.resetHours*60;
  const {error}=await db.rpc('prepare_outbox_token',{p_id:row.id,p_code_hash:await sha256(code),p_token_hash:await sha256(token),p_expires:new Date(Date.now()+minutes*60000).toISOString()});
  if(error)throw new Error('token_preparation_failed');
  const verify=['verification','email_change'].includes(row.kind);
  input={kind:row.kind,locale:row.locale,code:verify?code:undefined,url:`${base}/${row.locale}/${verify?'verification-email':'reinitialiser-mot-de-passe'}?token=${token}${row.data.next?'&next='+encodeURIComponent(row.data.next):''}`};
 }
 const content=row.kind==='custom'?{subject:row.data.subject,html:row.data.html,text:row.data.text}:renderEmail(input);
 return{...content,to:row.recipient,idempotencyKey:row.idempotency_key,correlationId:row.correlation_id,kind:row.kind};
}
export async function processClaimed(row:OutboxRow):Promise<EmailResult>{
 let result:EmailResult;
 try{result=await sendResendEmail(await messageFor(row));}
 catch(e){const category=e instanceof Error&&e.message==='config_missing'?'config_missing':'unknown';result={...queued(row.correlation_id),status:'failed',category,error:category};}
 const next=nextRetry(row.attempts,result.category,result.retryAfterSeconds);
 const status=result.status==='accepted'?'accepted':result.category==='suppressed'?'suppressed':next?'failed_temporary':'failed_permanent';
 const {error}=await createAdminClient().rpc('finish_email_outbox',{p_id:row.id,p_attempt:row.attempts,p_status:status,p_category:result.category,p_http:result.httpStatus,p_message:result.messageId,p_next:next});
 if(error)console.error('[email] outbox_finish_unavailable',{correlationId:row.correlation_id,category:result.category});
 return result;
}
export async function processOutbox(id?:string){
 const{data,error}=await createAdminClient().rpc('claim_email_outbox',{p_id:id??null,p_limit:id?1:5});
 if(error)throw new Error('outbox_claim_unavailable');
 const results:EmailResult[]=[];for(const row of (data??[]) as OutboxRow[])results.push(await processClaimed(row));return results;
}
export async function enqueueEmail(input:{kind:string;to:string;locale?:string;userId?:string|null;key:string;data?:Record<string,string>}):Promise<EmailResult>{
 const db=createAdminClient(),correlationId=crypto.randomUUID();
 try{
  const{error}=await db.from('email_outbox').upsert({kind:input.kind,recipient:input.to.trim().toLowerCase(),locale:input.locale==='ht'?'ht':'fr',user_id:input.userId??null,idempotency_key:input.key,data:input.data??{},correlation_id:correlationId},{onConflict:'idempotency_key',ignoreDuplicates:true});
  if(error)throw new Error('outbox_enqueue_unavailable');
  const{data:row,error:lookup}=await db.from('email_outbox').select('id,status,correlation_id,provider_message_id,last_error_category,provider_http_status').eq('idempotency_key',input.key).single();
  if(lookup||!row)throw new Error('outbox_enqueue_unavailable');
  if(['accepted','delivered'].includes(row.status))return{...queued(row.correlation_id),status:'accepted',category:null,messageId:row.provider_message_id,success:true};
  const [result]=await processOutbox(row.id);return result??queued(row.correlation_id);
 }catch{
  console.error('[email] outbox_unavailable',{correlationId});
  // Metadata only; even an unavailable outbox must leave an operator trace.
  const result:EmailResult={...queued(correlationId),status:'failed',category:'unknown',error:'outbox_unavailable'};
  try{await db.from('email_send_attempts').insert({kind:input.kind,status:'failed',category:'unknown',correlation_id:correlationId});}catch{/* Safe structured log above remains available in Worker logs. */}
  return result;
 }
}
export async function queueAuthEmail(to:string,kind:'verification'|'reset'|'invitation'|'registration_alert',locale:string,key=crypto.randomUUID(),next?:string){
 const{data,error}=await createAdminClient().from('profiles').select('id,locale').eq('email',to.trim().toLowerCase()).maybeSingle();
 if(error){const correlationId=crypto.randomUUID();console.error('[email] profile_lookup_unavailable',{correlationId});return{...queued(correlationId),status:'failed' as const,category:'unknown' as const};}
 if(!data)return queued();
 return enqueueEmail({kind,to,userId:data.id,locale:data.locale??locale,key:kind+':'+key,data:next?{next}:{}});
}
