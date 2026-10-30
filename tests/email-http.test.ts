import assert from 'node:assert/strict';
import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createRequire} from 'node:module';import {NextRequest} from 'next/server';
async function main(){
 const state:any={profile:null,allowed:true,queued:[],status:'failed',budgets:0};(globalThis as any).__emailHttp=state;
 await mkdir('tmp/email-http',{recursive:true});
 for(const name of ['signup','resend-code','forgot-password'])await build({entryPoints:['src/app/api/auth/'+name+'/route.ts'],outfile:'tmp/email-http/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'fixture'}));b.onResolve({filter:/^@\/lib\/(supabase\/admin|auth\/password|email\/outbox|auth\/rate-limit|email\/resend|auth\/tokens)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>{let code='export {};';if(a.path.endsWith('/admin'))code=`export function getAdminSupabase(){const s=globalThis.__emailHttp;return{from(){const b={select(){return b},eq(){return b},maybeSingle:async()=>({data:s.profile,error:null})};return b},rpc:async()=>({data:{user_id:'11111111-1111-4111-8111-111111111111'},error:null})}}`;
 if(a.path.endsWith('/password'))code=`export const hashPassword=async()=>"fixture-hash";`;
 if(a.path.endsWith('/outbox'))code=`export async function queueAuthEmail(to,kind){const s=globalThis.__emailHttp;const result={status:s.status,category:'provider_unavailable',correlationId:'fixture',success:false};s.queued.push({kind,result});return result;}`;
 if(a.path.endsWith('/rate-limit'))code=`export const normalizeEmail=e=>e.trim().toLowerCase();export const isDisposableEmail=()=>false;export const isCommonPassword=()=>false;export async function checkEmailDispatchLimit(){const s=globalThis.__emailHttp;s.budgets++;return{allowed:s.allowed}};export async function recordEmailDispatched(){}`;
 if(a.path.endsWith('/resend'))code=`export const sendVerificationEmail=()=>{throw Error('legacy email path')};export const sendSecurityAlertEmail=sendVerificationEmail;export const sendPasswordResetEmail=sendVerificationEmail;`;
 if(a.path.endsWith('/tokens'))code=`export const createEmailVerificationToken=()=>{throw Error('premature token')};export const createPasswordResetToken=createEmailVerificationToken;`;
 return{loader:'js',contents:code};});}}]});
 const require=createRequire(resolve('package.json')),handlers=Object.fromEntries(['signup','resend-code','forgot-password'].map(n=>[n,require(resolve('tmp/email-http/'+n+'.cjs'))]));
 const body={fullName:'Fictional Student',phone:'+50936123456',email:'fixture@example.test',password:'RandomUnique82%Words',acceptTerms:true,locale:'fr'};
 for(const name of ['signup','resend-code','forgot-password']){
  const replies:string[]=[];
  for(const profile of [null,{id:'11111111-1111-4111-8111-111111111111',email_verified_at:null},{id:'11111111-1111-4111-8111-111111111111',email_verified_at:'2026-10-01'}]){
   state.profile=profile;state.queued=[];state.budgets=0;
   const response=await handlers[name].POST(new NextRequest('https://example.test/api/auth/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
   assert.equal(response.status,200);const json=await response.json();replies.push(JSON.stringify(json));assert(!('alreadyVerified' in json));assert(!JSON.stringify(json).includes('@'));assert(state.budgets>0);
   if(name==='signup'&&profile?.email_verified_at)assert.equal(state.queued[0].kind,'registration_alert');
   assert(state.queued.every((r:any)=>r.result.status==='failed'));
  }
  assert.equal(new Set(replies).size,1,'Neutral response identical for all account states: '+name);
 }
 state.profile={id:'fixture',email_verified_at:null};state.allowed=false;state.queued=[];
 await handlers['resend-code'].POST(new NextRequest('https://example.test/api/auth/resend-code',{method:'POST',body:JSON.stringify(body)}));assert.equal(state.queued.length,0);
 console.log('PASS actual signup/resend/forgot HTTP handlers: identical neutral responses, alert budget, failures tracked, no legacy token generation, no full address response');
}
main().catch(()=>{console.error('FAIL email HTTP regression');process.exit(1)});
