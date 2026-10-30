import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {createAdminClient} from '@/lib/supabase/admin';
import {isDisposableEmail,reserveBudget} from '@/lib/auth/rate-limit';
import {verifyPassword} from '@/lib/auth/password';
import {enqueueEmail} from '@/lib/email/outbox';
export const runtime='nodejs';
export async function POST(request:Request){try{
 const user=await getCurrentUser();if(!user?.emailVerified)return Response.json({error:'unauthorized'},{status:401});
 const parsed=z.object({email:z.string().trim().email().toLowerCase(),currentPassword:z.string().min(1)}).safeParse(await request.json());
 if(!parsed.success||isDisposableEmail(parsed.data.email))return Response.json({error:'invalid'},{status:400});
 const ip=request.headers.get('cf-connecting-ip')??'unknown';
 if(!(await reserveBudget(parsed.data.email,ip,'email_change')).allowed||!(await reserveBudget(user.id,ip,'email_change_account')).allowed)return Response.json({error:'limited'},{status:429});
 const db=createAdminClient();const{data:creds,error}=await db.from('user_credentials').select('password_hash').eq('user_id',user.id).single();
 if(error||!creds||!await verifyPassword(parsed.data.currentPassword,creds.password_hash))return Response.json({error:'current_password_invalid'},{status:400});
 const{data:other,error:lookup}=await db.from('profiles').select('id').eq('email',parsed.data.email).maybeSingle();
 if(lookup)return Response.json({error:'unavailable'},{status:503});
 if(!other){const sent=await enqueueEmail({kind:'email_change',to:parsed.data.email,userId:user.id,locale:user.locale,key:'email-change:'+crypto.randomUUID()});if(sent.status!=='accepted')console.warn('[email] email_change_pending',{correlationId:sent.correlationId});}
 return Response.json({requested:true},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'unavailable'},{status:503});}}
