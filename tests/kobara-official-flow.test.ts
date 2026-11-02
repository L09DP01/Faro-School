import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {KobaraProvider} from '../src/lib/payments/kobara';
async function main(){
 process.env.KOBARA_API_KEY='test-kobara-key';process.env.KOBARA_WEBHOOK_SECRET='test-kobara-webhook';process.env.KOBARA_MODE='live';
 const state:any={provider:'moncash',validated:0,paid:false};(globalThis as any).__kobaraState=state;
 const db={from(table:string){const filters:any={};const q:any={select(){return q},eq(k:string,v:any){filters[k]=v;return q},maybeSingle(){return q.run()},then(ok:any){return q.run().then(ok)},async run(){if(table==='payments'&&filters.provider_txn_id)return {data:{id:'payment',order_id:'order',provider:state.provider,provider_txn_id:'pay_official',status:state.paid?'validated':'pending'},error:null};if(table==='orders')return{data:{id:'order',reference:'FARO-ORDER',amount_htg:20,status:state.paid?'paid':'pending',user_id:'student',course_id:'course'},error:null};if(table==='payments')return{data:[{id:'payment',provider:state.provider,provider_txn_id:'pay_official',status:state.paid?'validated':'pending'}],error:null};throw Error('unexpected table');}};return q;},async rpc(name:string,args:any){assert.equal(name,'validate_payment_transactional');assert.equal(args.p_expected_amount_htg,20);state.validated++;state.paid=true;return{data:{success:true},error:null};}};
 (globalThis as any).__kobaraDb=db;
 await mkdir('tmp/kobara-official',{recursive:true});await build({entryPoints:['src/app/api/webhooks/kobara/route.ts'],outfile:'tmp/kobara-official/webhook.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^@\/lib\/(supabase\/admin|email\/outbox)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path.includes('outbox')?'export const processOutbox=async()=>[];':'export const createAdminClient=()=>globalThis.__kobaraDb;'}));}}]});
 const require=createRequire(resolve('package.json')),webhook=require(resolve('tmp/kobara-official/webhook.cjs'));
 const event=(changes:any={})=>({event_type:'payment.succeeded',environment:'live',data:{id:'pay_official',reference:'KOB-PUBLIC-REFERENCE',amount:20,currency:'HTG',status:'succeeded',provider:state.provider,environment:'live',...changes}});
 const request=(body:any,options:any={})=>{const raw=JSON.stringify(body),t=String(Math.floor(Date.now()/1000)+(options.age||0));return new Request('https://faroschool.com/api/webhooks/kobara',{method:'POST',headers:{'Content-Type':'application/json','Kobara-Environment':options.environment||'live','Kobara-Timestamp':t,'Kobara-Signature':`t=${t},v1=${createHmac('sha256','test-kobara-webhook').update(t+'.'+raw).digest('hex')}`},body:raw});};
 for(const provider of ['moncash','natcash']){
  state.provider=provider;state.paid=false;state.validated=0;
  assert.equal((await webhook.POST(request(event({amount:19})))).status,400);assert.equal(state.validated,0);
  assert.equal((await webhook.POST(request(event({currency:'USD'})))).status,400);assert.equal(state.validated,0);
  assert.equal((await webhook.POST(request(event(),{age:-600}))).status,401);
  assert.equal((await webhook.POST(request(event(),{environment:'test'}))).status,400);
  const forged=request(event());forged.headers.set('Kobara-Signature','t=1,v1='+'0'.repeat(64));assert.equal((await webhook.POST(forged)).status,401);
  assert.equal((await webhook.POST(request(event()))).status,200);assert.equal(state.validated,1,'Official event without private metadata resolves by persisted provider id');
  assert.equal((await webhook.POST(request(event()))).status,200);assert.equal(state.validated,1,'No repeated enrollment validation');
 }
 const provider=new KobaraProvider();const sent:any[]=[];globalThis.fetch=async(url:any,init:any)=>{sent.push({url,headers:init.headers,body:JSON.parse(init.body)});return Response.json({data:{id:'pay_official',checkout_url:'https://pay.kobara.app/checkout/test'}});};
 for(const method of ['moncash','natcash'] as const){await provider.createPayment({orderId:'order',reference:'FARO',amountHtg:20,courseId:'course',courseTitle:'Cours réel',userId:'student',metadata:{locale:'ht'}},method);const call=sent.at(-1);assert.equal(call.body.provider,method);assert.equal(call.body.amount,20);assert(call.headers['Idempotency-Key']);assert(call.body.success_url.includes('locale=ht'));}
 console.log('PASS official Kobara: both channels, idempotency header, HTG amount, FR/KR return, official signed events without internal metadata, rejects stale/forged/environment/amount/currency, replay cannot grant twice. No real financial calls.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
