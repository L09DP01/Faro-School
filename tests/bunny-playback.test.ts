import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/bunny-playback',{recursive:true});const state={allowed:true};(globalThis as any).__bunnyPlayback=state;
 await build({entryPoints:['src/lib/video/bunny-stream.ts'],outfile:'tmp/bunny-playback/provider.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'access',setup(b){b.onResolve({filter:/^\.\/access$/},()=>({path:'access',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const checkLessonAccess=async()=>({canAccess:globalThis.__bunnyPlayback.allowed,videoId:'9978fc72-ab9d-4eb7-8cb5-65f5708f35ad'});",loader:'js'}));}}]});
 const original={library:process.env.BUNNY_STREAM_LIBRARY_ID,key:process.env.BUNNY_STREAM_TOKEN_AUTH_KEY};process.env.BUNNY_STREAM_LIBRARY_ID='123';process.env.BUNNY_STREAM_TOKEN_AUTH_KEY='fixture-only-key';
 try{
  const {BunnyStreamProvider}=createRequire(resolve('package.json'))(resolve('tmp/bunny-playback/provider.cjs'));const provider=new BunnyStreamProvider();const before=Math.floor(Date.now()/1000);const url=new URL(await provider.getPlaybackUrl('lesson','student',99999));
  assert.equal(url.origin,'https://player.mediadelivery.net');assert.equal(url.pathname,'/embed/123/9978fc72-ab9d-4eb7-8cb5-65f5708f35ad');const expires=Number(url.searchParams.get('expires'));assert(expires>=before&&expires<=before+7200);assert.equal(url.searchParams.get('token'),createHash('sha256').update('fixture-only-key9978fc72-ab9d-4eb7-8cb5-65f5708f35ad'+expires).digest('hex'));
  state.allowed=false;await assert.rejects(()=>provider.getPlaybackUrl('lesson','other'),/Accès refusé/);delete process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;await assert.rejects(()=>new BunnyStreamProvider().getPlaybackUrl('lesson','student'),/configuration unavailable/);
 }finally{for(const[name,value]of [['BUNNY_STREAM_LIBRARY_ID',original.library],['BUNNY_STREAM_TOKEN_AUTH_KEY',original.key]]){if(value===undefined)delete process.env[name!];else process.env[name!]=value;}}
 console.log('PASS Bunny playback: current embed endpoint, independent SHA256 signature check, bounded expiry, access denied and missing credentials fail closed; no remote calls.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
