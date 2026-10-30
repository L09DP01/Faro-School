import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {maskRecipient} from './result';
import {validEmailFrom} from './transport';
export async function emailAdmin(){const user=await getCurrentUser();if(!user?.emailVerified||!can(user,'emails.manage'))throw new Error('forbidden');return user;}
export async function emailHealth(){
 const db=createAdminClient({timeoutMs:10000}),since=new Date(Date.now()-86400000).toISOString();
 const[suppress,outbox,attempts,summary]=await Promise.all([
 db.from('email_suppressions').select('recipient_hash',{head:true,count:'exact'}).limit(1),
 db.from('email_outbox').select('id,kind,recipient,status,attempts,last_error_category,provider_http_status,correlation_id,updated_at,created_at').gte('created_at',since).in('status',['failed_temporary','failed_permanent','suppressed','bounced','complained']).order('updated_at',{ascending:false}).limit(100),
 db.from('email_send_attempts').select('status,category,correlation_id,created_at,kind').gte('created_at',since).order('created_at',{ascending:false}).limit(100),
 db.rpc('email_status_summary'),
 ]);
 const rows=outbox.data??[],logs=attempts.data??[];
 const counts:Record<string,number>={};for(const r of rows)counts[r.status]=(counts[r.status]??0)+1;
 const lastSuccess=logs.find(r=>r.status==='accepted')?.created_at??null,lastFailure=logs.find(r=>r.category)?.category??null;
 return{health:{key:!!process.env.RESEND_API_KEY?.trim(),sender:!!process.env.EMAIL_FROM?.trim()&&validEmailFrom(process.env.EMAIL_FROM.trim()),suppressions:!suppress.error,outbox:!outbox.error,webhook:!!process.env.RESEND_WEBHOOK_SECRET?.trim().startsWith('whsec_'),lastSuccess:summary.data?.lastSuccess??lastSuccess,lastFailure:summary.data?.lastFailure??lastFailure},counts:(summary.data?.counts??counts) as Record<string,number>,truncated:rows.length===100,failures:rows.filter(r=>['failed_temporary','failed_permanent','suppressed','bounced','complained'].includes(r.status)).map(r=>({...r,recipient:maskRecipient(r.recipient)})),tracking:logs.filter(r=>r.category).map(r=>({kind:r.kind,category:r.category,correlationId:r.correlation_id,at:r.created_at}))};
}
export type EmailHealth=Awaited<ReturnType<typeof emailHealth>>;
