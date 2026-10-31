import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/profile-api',{recursive:true});
 await build({entryPoints:['src/app/api/auth/profile/route.ts'],outfile:'tmp/profile-api/route.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline-profile-api',setup(b){
 b.onResolve({filter:/^@\/lib\/(?:auth$|supabase\/(?:server|admin)$|auth\/(?:password|rate-limit)$|email\/outbox$)/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='@/lib/auth'?'export const getCurrentUser=async()=>globalThis.profileUser':a.path.endsWith('/server')?'export const createClient=async()=>({from:()=>({update:v=>({eq:async(k,id)=>{globalThis.profileWrites.push({id,values:v});return {error:globalThis.profileFailure?{message:"INTERNAL_SQL_DETAIL"}:null}}})})})':a.path.endsWith('/admin')?'export const getAdminSupabase=()=>({from:()=>({select(){return this},eq(){return this},async single(){return {data:{password_hash:"synthetic",token_version:1}}}}),rpc:async()=>({data:true})})':a.path.endsWith('/password')?'export const verifyPassword=async p=>p==="CurrentOnly9!";export const hashPassword=async()=>"synthetic"':a.path.endsWith('/rate-limit')?'export const isCommonPassword=()=>false':'export const processOutbox=async()=>[]'}));
 }}]});
 const handler=createRequire(resolve('package.json'))(resolve('tmp/profile-api/route.cjs')).POST,g=globalThis as any;
 g.profileUser={id:'own-account',emailVerified:'2026-10-30'};g.profileWrites=[];
 const post=(body:unknown)=>handler(new Request('https://example.test/api/auth/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 for(const fullName of ['  ','X','x'.repeat(61)]){const r=await post({fullName});assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'invalid_data'});}
 assert.equal(g.profileWrites.length,0);
 assert.equal((await post({fullName:'  Jan-Pòl Étienne  ',phone:''})).status,200);assert.deepEqual(g.profileWrites.at(-1),{id:'own-account',values:{full_name:'Jan-Pòl Étienne',phone:null}});
 assert.equal((await post({locale:'ht'})).status,200);assert.deepEqual(g.profileWrites.at(-1).values,{locale:'ht'});
 const writes=g.profileWrites.length;await post({role:'admin'});assert.equal(g.profileWrites.length,writes);
 assert.equal((await post({phone:'bad'})).status,400);
 g.profileFailure=true;const failed=await post({fullName:'Correct Name'});const text=await failed.text();assert.doesNotMatch(text,/INTERNAL_SQL_DETAIL/);assert.equal(JSON.parse(text).error,'profile_update_unavailable');g.profileFailure=false;
 assert.equal((await post({newPassword:'NewSyntheticOnly9!',currentPassword:'wrong'})).status,400);
 g.profileUser=null;assert.equal((await post({fullName:'Correct Name'})).status,401);
 console.log('PASS actual profile API: trimmed/bounded names, clear phone, own user only, locale, role injection ignored, current password and no raw SQL details; offline');
}
main().catch(e=>{console.error(e);process.exitCode=1});
