import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/assistant-flow',{recursive:true});const g=globalThis as any;
 g.flow={course:false,online:false,pending:false,calls:[],writes:[],rpc:[],result:{answer:'Bonjour ! Comment puis-je vous aider ?',can_answer:true,confidence:1,model:'fixture',inputTokens:0,outputTokens:0}};
 const modules:Record<string,string>={
  '@/lib/auth/get-user':`export const getCurrentUser=async()=>({id:'student',role:'student',fullName:'Student',locale:'fr'});`,
  '@/lib/supabase/admin':`export const createAdminClient=()=>globalThis.flowDb;`,
  '@/lib/supabase/server':`export const createClient=async()=>globalThis.flowDb;`,
  '@/lib/config':`export const isDemoMode=()=>false;`,
  '@/lib/messaging/presence':`export const isStaffOnline=async()=>globalThis.flow.online;export const recordStaffHeartbeat=async()=>true;export const setStaffAvailability=async()=>true;`,
  '@/lib/messaging/ai-assistant':`export const callAiAssistant=async p=>{globalThis.flow.calls.push(p);return globalThis.flow.result;};`,
  '@/lib/email/outbox':`export const processOutbox=async()=>[];`,
  '@/lib/messaging/data':`export const getConversationMessages=async()=>[];export const getMockConversationsStore=()=>[];export const getMockMessagesStore=()=>new Map();export const getMockEscalationsStore=()=>[];`,
  '@/lib/community/stored-word-filter':`export const checkStoredProfanity=async()=>({blocked:false});`,
  '@/lib/moderation':`export const checkMessageModeration=()=>({blocked:false});`,
  '@/lib/moderation/flag-service':`export const recordModerationFlag=async()=>{};`,
  '@/config/messaging':`export const STUDENT_DM_ENABLED=false;`,
  '@/lib/messaging/recipients':`export const resolveStudentRecipient=async()=>({});export class RecipientError extends Error{}`,
  'next/cache':`export const revalidatePath=()=>{};`
 };
 g.flowDb={from(table:string){return{select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},insert(data:any){g.flow.writes.push({table,data});return Promise.resolve({error:null})},update(data:any){g.flow.writes.push({table,data});return this},async maybeSingle(){return{data:table==='escalations'?(g.flow.pending?{id:'pending'}:null):table==='course_ai_context'?{summary_fr:'PRIVATE_SUMMARY '.repeat(10),summary_ht:'',enabled:true,web_search_enabled:true}:null,error:null}},async single(){return{data:table==='profiles'?{full_name:'Author',role:g.flow.course?'instructor':'admin',banned_at:null}:table==='conversations'?{id:'conversation',student_id:'student',staff_id:'author',course_id:g.flow.course?'course':null,status:'open',courses:{title_fr:'Public title'},student:{full_name:'Student'},staff:{full_name:'Author',role:g.flow.course?'instructor':'admin'}}:null,error:null}},then(ok:any){return Promise.resolve({data:[],error:null}).then(ok)}}},async rpc(name:string,args:any){g.flow.rpc.push({name,args});return{data:{created:true,email_id:null},error:null}}};
 await build({entryPoints:['src/app/actions/private-messaging.ts'],outfile:'tmp/assistant-flow/actions.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline',setup(b){b.onResolve({filter:/^(@\/|next\/cache)/},a=>{if(modules[a.path])return{path:a.path,namespace:'stub'};});b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const actions=createRequire(resolve('package.json'))(resolve('tmp/assistant-flow/actions.cjs'));
 let response=await actions.sendPrivateMessageAction('conversation','Salut');assert(response.success);assert.equal(g.flow.calls[0].mode,'support');assert.equal(g.flow.calls[0].courseContextSummary,'');assert(g.flow.writes.some((w:any)=>w.table==='messages'&&w.data.sender_type==='ai'));assert.equal(g.flow.rpc.length,0);
 g.flow.calls=[];g.flow.course=true;response=await actions.sendPrivateMessageAction('conversation','Comment faire cet exercice ?');assert(response.success);assert.equal(g.flow.calls[0].mode,'course');assert.match(g.flow.calls[0].courseContextSummary,/PRIVATE_SUMMARY/);assert.equal(g.flow.calls[0].webSearchEnabled,true);
 g.flow.calls=[];g.flow.online=true;await actions.sendPrivateMessageAction('conversation','Bonjour professeur');assert.equal(g.flow.calls.length,0);g.flow.online=false;g.flow.pending=true;await actions.sendPrivateMessageAction('conversation','Ok');assert.equal(g.flow.calls.length,1,'Assistant may help while awaiting human without sending another email');assert.equal(g.flow.rpc.length,0);
 g.flow.pending=false;g.flow.result={...g.flow.result,can_answer:false,answer:'Je préfère vérifier avec le responsable.'};await actions.sendPrivateMessageAction('conversation','Je veux un humain');assert.equal(g.flow.rpc.length,1);assert.equal(g.flow.rpc[0].name,'queue_assistant_handoff');assert.match(g.flow.rpc[0].args.p_notice,/Author/);assert.match(g.flow.rpc[0].args.p_notice,/Je préfère/);
 g.flow.course=false;g.flow.online=true;await actions.sendPrivateMessageAction('conversation','Je veux un humain');assert.match(g.flow.rpc.at(-1).args.p_notice,/équipe support/);assert.equal(g.flow.calls.at(-1).mode,'support');
 console.log('PASS messaging action offline: message committed, support/course isolated, author summary, online author takeover, pending handoff without duplicate mail, polite answer retained, correct destination.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
