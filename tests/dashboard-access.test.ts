import assert from 'node:assert/strict';
import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 const state:any={user:{id:'student',role:'student',emailVerified:'2026-10-30'},enrolled:false,revoked:false,banned:false,error:false,writes:0,communityReads:0};
 (globalThis as any).__dashboardAccess=state;
 await mkdir('tmp/dashboard-access',{recursive:true});
 for(const[name,entry]of Object.entries({access:'src/lib/community/access.ts',actions:'src/app/actions/community.ts',unread:'src/app/api/dashboard/unread/route.ts'}))await build({entryPoints:[entry],outfile:'tmp/dashboard-access/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline',setup(b){
  b.onResolve({filter:/^(server-only|next\/cache|@\/lib\/auth\/get-user|@\/lib\/supabase\/(admin|server)|@\/lib\/community\/data|@\/lib\/messaging\/data)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>{let contents='export {};';
   if(a.path==='next/cache')contents='export const revalidatePath=()=>{};';
   if(a.path.endsWith('/get-user'))contents='export const getCurrentUser=async()=>globalThis.__dashboardAccess.user;';
   if(a.path.endsWith('/admin'))contents=`export function createAdminClient(){const s=globalThis.__dashboardAccess;return{from(table){const q={select(){return q},eq(){return q},is(){return q},limit(){return q},async maybeSingle(){return{error:s.error?{}:null,data:table==='profiles'?{banned_at:s.banned?'2026-10-30':null}:s.enrolled&&!s.revoked?{id:'enrollment'}:null}}};return q}}}`;
   if(a.path.endsWith('/server'))contents=`export async function createClient(){const s=globalThis.__dashboardAccess;s.writes++;return{from(){const q={select(){return q},eq(k,v){if(k==='user_id'&&v!==s.user.id)throw Error('wrong owner');return q},is(){return q},then(ok){return Promise.resolve({count:0,error:null}).then(ok)}};return q}}}`;
   if(a.path.endsWith('/community/data'))contents='export const getUnreadCommunityCount=async()=>{globalThis.__dashboardAccess.communityReads++;return 0};export const getMockCommunityStore=()=>[];export const getMockCommunityReadsStore=()=>new Map();export const getMockCommunityRulesAcceptedStore=()=>new Set();';
   if(a.path.endsWith('/messaging/data'))contents='export const getUnreadPrivateMessagesCount=async()=>0;';
   return{contents,loader:'js'};
  });
 }}]});
 const require=createRequire(resolve('package.json')),access=require(resolve('tmp/dashboard-access/access.cjs')),actions=require(resolve('tmp/dashboard-access/actions.cjs')),unread=require(resolve('tmp/dashboard-access/unread.cjs'));
 assert.equal(await access.hasCommunityAccess(state.user),false);
 for(const invoke of [()=>actions.postMessageAction('Hello'),()=>actions.toggleReactionAction('message','👍'),()=>actions.reportMessageAction('message','spam'),()=>actions.markCommunityReadAction(),()=>actions.acceptCommunityRulesAction()])assert.equal((await invoke()).success,false);
 assert.equal(state.writes,0,'Unenrolled student must not reach database write clients');
 let response=await unread.GET();assert.deepEqual(await response.json(),{community:0,messages:0,notifications:0});assert.equal(state.communityReads,0);assert.equal(response.headers.get('cache-control'),'no-store');
 state.enrolled=true;assert.equal(await access.hasCommunityAccess(state.user),true);
 state.revoked=true;assert.equal(await access.hasCommunityAccess(state.user),false);state.revoked=false;
 state.banned=true;assert.equal(await access.hasCommunityAccess(state.user),false);state.banned=false;
 state.error=true;assert.equal(await access.hasCommunityAccess(state.user),false);state.error=false;
 for(const role of ['admin','instructor']){state.user.role=role;state.enrolled=false;assert.equal(await access.hasCommunityAccess(state.user),true);}
 state.user=null;response=await unread.GET();assert.equal(response.status,401);
 console.log('PASS server community guards, direct actions denied before writes, empty badges zero, owner notification filter and private no-store endpoint; offline only');
}
main().catch(e=>{console.error('FAIL dashboard access',e instanceof Error?e.message:'unknown');process.exitCode=1});
