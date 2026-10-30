import {z} from 'zod';
import {emailAdmin,emailHealth} from '@/lib/email/admin';
import {enqueueEmail,processOutbox} from '@/lib/email/outbox';
import {reserveBudget} from '@/lib/auth/rate-limit';
import {createAdminClient} from '@/lib/supabase/admin';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){try{await emailAdmin();return Response.json(await emailHealth(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'forbidden'},{status:403});}}
export async function POST(request:Request){try{
 const user=await emailAdmin(),body=await request.json();
 const parsed=z.discriminatedUnion('action',[z.object({action:z.literal('test')}),z.object({action:z.literal('retry'),id:z.string().uuid()})]).safeParse(body);
 if(!parsed.success)return Response.json({error:'invalid'},{status:400});
 const ip=request.headers.get('cf-connecting-ip')??'unknown';
 const budget=await reserveBudget(user.id,ip,'email_admin_'+parsed.data.action,1,60,60);
 if(!budget.allowed)return Response.json({error:'limited'},{status:429});
 const db=createAdminClient();
 if(parsed.data.action==='test'){
  if(!user.email)return Response.json({error:'unavailable'},{status:503});
  const {error}=await db.from('admin_audit_logs').insert({admin_id:user.id,action:'email_test_requested',note:'Self-address verified test',metadata:{}});
  if(error)throw new Error('audit_unavailable');
  const result=await enqueueEmail({kind:'test',to:user.email,userId:user.id,locale:user.locale,key:'admin-test:'+crypto.randomUUID()});
  return Response.json({status:result.status,category:result.category,correlationId:result.correlationId});
 }
 const{error}=await db.rpc('admin_retry_email',{p_id:parsed.data.id,p_actor:user.id});
 if(error)return Response.json({error:'not_retryable'},{status:409});
 const[result]=await processOutbox(parsed.data.id);
 return Response.json({status:result?.status??'queued',category:result?.category??null,correlationId:result?.correlationId});
 }catch{return Response.json({error:'unavailable'},{status:503});}}
