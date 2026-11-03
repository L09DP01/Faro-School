import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/assistant-flow',{recursive:true});const g=globalThis as any;
 g.flow={course:false,online:false,pending:false,status:"open",muted:false,calls:[],writes:[],rpc:[],result:{answer:'Bonjour ! Comment puis-je vous aider ?',can_answer:true,confidence:1,model:'fixture',inputTokens:0,outputTokens:0}};
 const modules:Record<string,string>={
 '@/lib/support/service':`export const handleSupportMessage=async input=>{globalThis.flow.calls.push({mode:'support',courseContextSummary:'',...input});};`,
  '@/lib/messaging/background':`export const scheduleAssistant=async work=>{if(globalThis.queueAi){globalThis.aiTasks.push(work);}else await work();};`,
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
 g.flowDb={from(table:string){return{select(){return this},eq(){return this},is(){return this},order(){return this},limit(){return this},insert(data:any){g.flow.writes.push({table,data});return Promise.resolve({error:null})},update(data:any){g.flow.writes.push({table,data});return this},async maybeSingle(){return{data:table==='escalations'?(g.flow.pending?{id:'pending'}:null):table==='course_ai_context'?{summary_fr:'PRIVATE_SUMMARY '.repeat(10),summary_ht:'',enabled:true,web_search_enabled:true}:null,error:null}},async single(){return{data:table==='profiles'?{full_name:'Author',role:g.flow.course?'instructor':'admin',banned_at:null,muted_until:g.flow.muted?new Date(Date.now()+60000).toISOString():null}:table==='conversations'?{id:'conversation',student_id:'student',staff_id:'author',course_id:g.flow.course?'course':null,status:g.flow.status,courses:{title_fr:'Public title'},student:{full_name:'Student'},staff:{full_name:'Author',role:g.flow.course?'instructor':'admin'}}:null,error:null}},then(ok:any){return Promise.resolve({data:[],error:null}).then(ok)}}},async rpc(name:string,args:any){g.flow.rpc.push({name,args});return{data:{created:true,email_id:null},error:null}}};
 await build({entryPoints:['src/app/actions/private-messaging.ts'],outfile:'tmp/assistant-flow/actions.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline',setup(b){b.onResolve({filter:/^(@\/|next\/cache)/},a=>{if(modules[a.path])return{path:a.path,namespace:'stub'};});b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const actions=createRequire(resolve('package.json'))(resolve('tmp/assistant-flow/actions.cjs'));

 const reset=()=>{g.flow.calls=[];g.flow.writes=[];g.flow.rpc=[];};
 let response=await actions.sendPrivateMessageAction('conversation','Salut');assert(response.success);assert.equal(g.flow.calls[0].mode,'support');assert.equal(g.flow.calls[0].courseContextSummary,'');assert.equal(g.flow.calls[0].question,'Salut');
 reset();g.flow.course=true;
 for(const question of ['Comment faire cet exercice ?','Peux-tu donner un exemple ?','Je ne comprends pas la suite']){response=await actions.sendPrivateMessageAction('conversation',question);assert(response.success);}
 assert.equal(g.flow.calls.length,3);assert(g.flow.calls.every((p:any)=>p.mode==='course'&&p.courseContextSummary.includes('PRIVATE_SUMMARY')));
 reset();g.flow.online=true;await actions.sendPrivateMessageAction('conversation','Bonjour professeur');assert.equal(g.flow.calls.length,1,'Presence alone cannot stop the assistant');
 reset();g.flow.status='staff_replied';await actions.sendPrivateMessageAction('conversation','Le professeur a pris le relais');assert.equal(g.flow.calls.length,0);
 reset();g.flow.online=false;await actions.sendPrivateMessageAction('conversation','Le professeur est absent');assert.equal(g.flow.calls.length,1,'Resume after staff absence');
 reset();g.flow.status='waiting_staff';g.flow.pending=true;await actions.sendPrivateMessageAction('conversation','Une autre question');assert.equal(g.flow.calls.length,1);assert.equal(g.flow.rpc[0].name,'commit_assistant_reply');
 reset();g.flow.course=false;response=await actions.sendPrivateMessageAction('conversation','Autre question support');assert(response.success);assert(g.flow.writes.length>0,'Human support keeps accepting student messages');assert.equal(g.flow.calls.length,0);
 reset();g.flow.status='open';g.flow.pending=false;await actions.sendPrivateMessageAction('conversation','Je veux un humain',null,'fr',true);assert.equal(g.flow.calls[0].explicitTicket,true);
 reset();await actions.sendPrivateMessageAction('conversation','Salut');assert.equal(g.flow.calls[0].mode,'support');assert.equal(g.flow.rpc.length,0,'Support delegates to isolated backend');
 reset();g.flow.result={...g.flow.result,can_answer:true,answer:'Useful answer'};g.queueAi=true;g.aiTasks=[];response=await actions.sendPrivateMessageAction('conversation','Question before a ticket opens');assert(response.success);assert.equal(g.flow.calls.length,0,'Persistence acknowledged before background AI');g.flow.pending=true;await g.aiTasks[0]();assert.equal(g.flow.calls.length,0,'Ticket opened before generation suppresses provider call');g.queueAi=false;g.flow.pending=false;
 reset();g.flow.muted=true;response=await actions.sendPrivateMessageAction('conversation','Interdit');assert(!response.success);assert.equal(g.flow.writes.length,0);
 console.log('PASS actions: multi-turn course assistant, same author context, presence vs explicit takeover, offline resume, pending course questions, continuous human support, correct handoff and timed mute.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
