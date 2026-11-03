import {cookies} from 'next/headers';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {createAdminClient} from '@/lib/supabase/admin';
import {isSameOriginRequest} from '@/lib/http/same-origin';
import {decode64,isPushEndpoint,pushConfiguration} from '@/lib/push/web-push';
const cookieName='faro_push_subscription';
const schema=z.object({endpoint:z.string().max(2048).refine(isPushEndpoint),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]+$/).max(100),auth:z.string().regex(/^[A-Za-z0-9_-]+$/).max(30)}).strict()}).strict();
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function json(request:Request){const reader=request.body?.getReader();if(!reader)throw Error();let size=0,text='';const decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8192)throw Error();text+=decoder.decode(part.value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{await reader.cancel().catch(()=>{});}}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return reply({error:'forbidden'},403);
 const user=await getCurrentUser();if(!user||user.role!=='student')return reply({error:'forbidden'},403);
 if(!pushConfiguration())return reply({error:'unavailable'},503);
 try{const value=schema.parse(await json(request));const pub=decode64(value.keys.p256dh);if(pub.length!==65||pub[0]!==4||decode64(value.keys.auth).length!==16)return reply({error:'invalid'},400);
  await crypto.subtle.importKey('raw',new Uint8Array(pub).buffer,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const{data:id,error}=await createAdminClient().rpc('save_message_push_subscription',{p_user:user.id,p_token_version:user.tokenVersion,p_endpoint:value.endpoint,p_p256dh:value.keys.p256dh,p_auth:value.keys.auth});
  if(error||typeof id!=='string')return reply({error:'unavailable'},503);
  (await cookies()).set(cookieName,id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:365*86400});return reply({enabled:true});
 }catch{return reply({error:'invalid'},400);}
}
export async function DELETE(request:Request){
 if(!isSameOriginRequest(request))return reply({error:'forbidden'},403);const user=await getCurrentUser();if(!user)return reply({error:'forbidden'},403);
 const store=await cookies(),id=store.get(cookieName)?.value;
 if(id){const{error}=await createAdminClient().from('message_push_subscriptions').delete().eq('id',id).eq('user_id',user.id);if(error)return reply({error:'unavailable'},503);}
 store.delete(cookieName);return reply({enabled:false});
}
