import {getCurrentUser} from '@/lib/auth/get-user';
import {createClient} from '@/lib/supabase/server';
import {isSameOriginRequest} from '@/lib/http/same-origin';
import {createAdminClient} from '@/lib/supabase/admin';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const user=await getCurrentUser();if(!user)return reply({staff:false},401);
 const staffId=new URL(request.url).searchParams.get('staffId');
 if(staffId){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(staffId))return reply({error:'invalid'},400);
  const scoped=await createClient();const {data:allowed,error:accessError}=await scoped.rpc('can_observe_staff',{p_staff:staffId});
  if(accessError||allowed!==true)return reply({error:'forbidden'},403);
  const {data:online,error}=await createAdminClient().rpc('staff_is_online',{p_staff:staffId});
  return error?reply({error:'unavailable'},503):reply({online:online===true});
 }
 if(!['admin','instructor'].includes(user.role))return reply({staff:false});
 const {data,error}=await createAdminClient().from('profiles').select('staff_available').eq('id',user.id).single();
 return error?reply({staff:false},503):reply({staff:true,userId:user.id,available:data.staff_available!==false});
}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return reply({error:'forbidden'},403);
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role))return reply({error:'forbidden'},403);
 let body:any;try{body=await request.json();}catch{return reply({error:'invalid'},400);}
 if(typeof body.sessionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.sessionId)||typeof body.active!=='boolean')return reply({error:'invalid'},400);
 const expiresAt=new Date(body.active?Date.now()+45000:Date.now()).toISOString();
 const {error}=await createAdminClient().from('staff_presence_sessions').upsert({user_id:user.id,session_id:body.sessionId,token_version:user.tokenVersion,expires_at:expiresAt},{onConflict:'user_id,session_id'});
 return error?reply({error:'unavailable'},503):reply({expiresAt});
}
