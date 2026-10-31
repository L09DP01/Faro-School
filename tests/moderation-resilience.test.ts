import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/moderation-resilience',{recursive:true});const g=globalThis as any;g.modError=false;g.modValue=null;
 const db=`const db={from(){return{select(){return this},eq(){return this},or(){return this},order(){return this},limit(){return this},async maybeSingle(){return{data:globalThis.modValue===null?null:{value:globalThis.modValue},error:globalThis.modError?{code:'offline'}:null}},then(ok){return Promise.resolve({data:globalThis.modError?null:[],error:globalThis.modError?{code:'offline'}:null}).then(ok)}}}};export const createClient=async()=>db;`;
 const plugin:any={name:'offline',setup(b:any){b.onResolve({filter:/^@\/lib\/(supabase\/server|config)$/},(a:any)=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},(a:any)=>({contents:a.path.endsWith('/config')?'export const isDemoMode=()=>false;':db,loader:'js'}));}};
 const require=createRequire(resolve('package.json'));
 for(const [file,name]of[['src/lib/admin/moderation.ts','moderation'],['src/lib/moderation/flag-service.ts','flags']])await build({entryPoints:[file],outfile:`tmp/moderation-resilience/${name}.cjs`,bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[plugin]});
 const mod=require(resolve('tmp/moderation-resilience/moderation.cjs')),flags=require(resolve('tmp/moderation-resilience/flags.cjs'));
 assert.deepEqual(await mod.getWordFilterSettings(),{fr:[],ht:[]});assert.deepEqual(await mod.getCommunityRulesSettings(),{fr:'',ht:''});assert.deepEqual(await mod.getModerationReports(),[]);assert.deepEqual(await mod.getMutedAndBannedUsers(),{mutedUsers:[],bannedUsers:[]});assert.deepEqual(await flags.getModerationFlags(),[]);
 g.modValue={fr:'broken',ht:[]};await assert.rejects(()=>mod.getWordFilterSettings(),/settings_unavailable/);g.modValue={fr:[],ht:[]};await assert.rejects(()=>mod.getCommunityRulesSettings(),/settings_unavailable/);
 g.modError=true;for(const operation of [mod.getWordFilterSettings,mod.getCommunityRulesSettings,mod.getModerationReports,mod.getMutedAndBannedUsers,flags.getModerationFlags,mod.getModerationAuditLogs])await assert.rejects(()=>operation());
 console.log('PASS moderation resilience: optional missing settings accepted, malformed settings rejected, real empty results preserved, database failures propagated to unavailable sections instead of fake healthy data.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
