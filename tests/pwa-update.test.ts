import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
async function main(){
 const handlers:Record<string,Function>={},deleted:string[]=[];let skips=0,claims=0;
 runInNewContext(await readFile('public/sw.js','utf8'),{
  self:{addEventListener:(name:string,fn:Function)=>handlers[name]=fn,skipWaiting:()=>{skips++},clients:{claim:()=>{claims++}}},
  caches:{open:async()=>({addAll:async()=>{}}),keys:async()=>['faro-pwa-v1','faro-pwa-v2-dashboard','faro-pwa-v3-messaging','other-cache'],delete:async(key:string)=>{deleted.push(key)}},console,URL,
 });
 let pending:Promise<unknown>=Promise.resolve();const event={waitUntil:(value:Promise<unknown>)=>pending=value};
 handlers.install(event);await pending;assert.equal(skips,0,'Installing an update must not reload a user typing a message');
 handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(skips,1);
 handlers.activate(event);await pending;assert.deepEqual(deleted,['faro-pwa-v1','faro-pwa-v2-dashboard']);assert.equal(claims,1);
 console.log('PASS PWA update waits for explicit refresh and removes only obsolete Faro caches');
}
main().catch(e=>{console.error('FAIL PWA update',e instanceof Error?e.message:'unknown');process.exitCode=1});
