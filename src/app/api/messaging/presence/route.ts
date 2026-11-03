import {getCurrentUser} from '@/lib/auth/get-user';
import {createAdminClient} from '@/lib/supabase/admin';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const user=await getCurrentUser();if(!user)return reply({staff:false},401);if(!['admin','instructor'].includes(user.role))return reply({staff:false});const {data,error}=await createAdminClient().from('profiles').select('staff_available').eq('id',user.id).single();return error?reply({staff:false},503):reply({staff:true,userId:user.id,available:data.staff_available!==false});}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'forbidden'},403);
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role))return reply({error:'forbidden'},403);
 let body:any;try{body=await request.json();}catch{return reply({error:'invalid'},400);}
 if(typeof body.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(body.sessionId)||typeof body.active!=='boolean')return reply({error:'invalid'},400);
 const expiresAt=new Date(body.active?Date.now()+45000:Date.now()).toISOString();
 const {error}=await createAdminClient().from('staff_presence_sessions').upsert({user_id:user.id,session_id:body.sessionId,token_version:user.tokenVersion,expires_at:expiresAt},{onConflict:'user_id,session_id'});
 return error?reply({error:'unavailable'},503):reply({expiresAt});
}
