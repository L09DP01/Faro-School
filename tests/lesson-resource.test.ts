import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 const state:any={user:{id:'11111111-1111-4111-8111-111111111111',role:'instructor'},enrolled:true,calls:[]};(globalThis as any).__resource=state;
 await mkdir('tmp/resource-http',{recursive:true});const modules:Record<string,string>={
  '@/lib/auth/get-user':'export const getCurrentUser=async()=>globalThis.__resource.user;',
  '@/lib/auth':'export const getCurrentUser=async()=>globalThis.__resource.user;',
  '@/lib/permissions':"export const can=user=>user.role==='admin'||user.role==='instructor';",
  '@/lib/bunny-storage':"export const bunnyStorageConnection=()=>({url:'https://ny.storage.bunnycdn.com/fixture',key:'fixture-key'});",
  '@/lib/video/bunny-storage':"export class BunnyStorage{getSignedResourceUrl(){throw Error('Unexpected legacy path')}}",
  '@/lib/supabase/server':`export const createClient=async()=>({from:table=>({select(){return this},eq(){return this},is(){return this},single(){return this.maybeSingle()},async maybeSingle(){return{data:table==='lesson_resources'?{id:'resource',name:'Support privé.pdf',file_url:'lesson-resources/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.pdf',lessons:{modules:{course_id:'course'}}}:table==='courses'?{instructor_id:'teacher'}:globalThis.__resource.enrolled?{id:'enrollment'}:null,error:null}}})});`
 };
 for(const[name,entry]of[['upload','src/app/api/admin/upload/resource/route.ts'],['download','src/app/api/video/resources/[resourceId]/download/route.ts']])await build({entryPoints:[entry],outfile:'tmp/resource-http/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline',setup(b){b.onResolve({filter:/^@\//},a=>modules[a.path]?{path:a.path,namespace:'stub'}:undefined);b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:modules[a.path],loader:'js'}));}}]});
 const require=createRequire(resolve('package.json')),upload=require(resolve('tmp/resource-http/upload.cjs')),download=require(resolve('tmp/resource-http/download.cjs'));
 const originalFetch=globalThis.fetch;globalThis.fetch=async(input:any,init:any)=>{state.calls.push({input:String(input),init});assert(String(input).startsWith('https://ny.storage.bunnycdn.com/fixture/lesson-resources/'));assert.equal(init.headers.AccessKey,'fixture-key');return init.method==='PUT'?new Response(null,{status:201}):new Response('%PDF-local-private-resource',{headers:{'Content-Type':'application/pdf'}});};
 try{
  const request=(bytes:string,type='application/pdf')=>{const data=new FormData();data.set('file',new File([bytes],'Document.pdf',{type}));return new Request('https://faroschool.com/api/admin/upload/resource',{method:'POST',body:data})};
  let response=await upload.POST(request('%PDF-valid fixture'));assert.equal(response.status,200);const result=await response.json();assert.match(result.fileUrl,/^lesson-resources\/[\da-f-]+\/[\da-f-]+\.pdf$/);assert(!JSON.stringify(result).includes('fixture-key'));assert(!JSON.stringify(result).includes('storage.bunnycdn.com'));
  const count=state.calls.length;assert.equal((await upload.POST(request('<html>not a PDF</html>'))).status,400);state.user.role='student';assert.equal((await upload.POST(request('%PDF-denied'))).status,403);assert.equal(state.calls.length,count);
  response=await download.GET(new Request('https://faroschool.com/api/video/resources/resource/download'),{params:Promise.resolve({resourceId:'resource'})});assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control')!,/no-store/);assert.match(response.headers.get('Content-Disposition')!,/attachment/);assert.equal(await response.text(),'%PDF-local-private-resource');
  state.enrolled=false;const reads=state.calls.length;assert.equal((await download.GET(new Request('https://faroschool.com/api/video/resources/resource/download'),{params:Promise.resolve({resourceId:'resource'})})).status,403);assert.equal(state.calls.length,reads,'Denied access never reads Storage');
 }finally{globalThis.fetch=originalFetch;}
 console.log('PASS resource HTTP: real PDF bytes PUT to private random Storage path, forged HTML/student upload denied, no secret or provider URL returned, enrolled-only download/no-store and no storage read without access.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
