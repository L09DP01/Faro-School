export default {
 scheduled(_event:unknown,env:{APP_URL:string;CRON_SECRET:string},ctx:{waitUntil(task:Promise<unknown>):void}){
  ctx.waitUntil((async()=>{
   const response=await fetch(new URL('/api/cron/email-outbox',env.APP_URL),{headers:{Authorization:'Bearer '+env.CRON_SECRET},signal:AbortSignal.timeout(55000)});
   if(!response.ok)throw new Error('email_outbox_cron_failed_status_'+response.status);
  })());
 }
};
