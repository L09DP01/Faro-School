import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {pushConfiguration,sendWebPush} from './web-push';
export async function dispatchMessagePush(conversationId?:string){
 if(!pushConfiguration())return{configured:false,processed:0};
 if(conversationId)await new Promise(resolve=>setTimeout(resolve,650));
 const db=createAdminClient();const{data,error}=await db.rpc('claim_message_push_jobs',{p_conversation:conversationId||null,p_limit:8});if(error)throw Error('push_queue_unavailable');
 if(!Array.isArray(data))return{configured:true,processed:0};
 const deliver=async(job:any)=>{
  let state='pending',reason:string|null=null;
  try{
   if(job.read||!job.eligible){state='skipped';reason='read_or_ineligible';}
   else if(Date.now()-Date.parse(job.createdAt)>6*3600*1000){state='dead';reason='expired';}
   else{const locale=job.locale==='ht'?'ht':'fr';const status=await sendWebPush(job,{type:'faro-message',messageId:job.messageId,conversationId:job.conversationId,title:'Faro School',body:locale==='ht'?'Ou resevwa yon nouvo mesaj.':'Vous avez reçu un nouveau message.',locale,url:'/'+locale+'/dashboard/messages/'+job.conversationId});
    if(status>=200&&status<300)state='sent';else if(status===404||status===410){state='dead';reason='subscription_expired';await db.from('message_push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('id',job.subscriptionId);}else{reason='provider_'+status;if(job.attempts>=5||status===400)state='dead';}
   }
  }catch{reason='delivery_unavailable';if(job.attempts>=5)state='dead';}
  const{error:doneError}=await db.rpc('finish_message_push_job',{p_id:job.id,p_claim:job.claimId,p_state:state,p_error:reason});if(doneError)console.error('[push] result_unavailable');
 };for(let offset=0;offset<data.length;offset+=4)await Promise.all(data.slice(offset,offset+4).map(deliver));return{configured:true,processed:data.length};
}
