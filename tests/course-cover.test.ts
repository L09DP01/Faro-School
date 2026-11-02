import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {prepareCourseCover} from '../src/lib/video/prepare-course-cover';
async function main(){
 await mkdir('tmp/cover-tests',{recursive:true});
 const g=globalThis as any;g.coverUser={id:'admin',role:'admin'};
 for(const [name,entry] of [['upload','src/app/api/admin/upload/cover/route.ts'],['read','src/app/api/covers/[filename]/route.ts']])await build({entryPoints:[entry],outfile:`tmp/cover-tests/${name}.cjs`,bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'auth',setup(b){b.onResolve({filter:/^@\/lib\/(auth\/get-user|permissions)$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'js',contents:a.path.endsWith('permissions')?"export const can=u=>u.role==='admin'||u.role==='instructor';":"export const getCurrentUser=async()=>globalThis.coverUser;"}));}}]});
 const require=createRequire(resolve('package.json')),upload=require(resolve('tmp/cover-tests/upload.cjs')),read=require(resolve('tmp/cover-tests/read.cjs'));
 const bytes=new Uint8Array(1100000);bytes.set([137,80,78,71,13,10,26,10]);
 const request=(type='image/png')=>{const form=new FormData();form.set('file',new File([bytes],'cover.png',{type}));return new Request('https://faroschool.com/api/admin/upload/cover',{method:'POST',body:form});};
 g.coverUser.role='student';assert.equal((await upload.POST(request())).status,403);
 g.coverUser.role='admin';delete process.env.BUNNY_STORAGE_API_KEY;assert.equal((await upload.POST(request())).status,503);
 process.env.BUNNY_STORAGE_ZONE_NAME='fixture';process.env.BUNNY_STORAGE_API_KEY='test-cover-key';
 let calls=0;g.fetch=async(url:any,init:any)=>{calls++;assert(String(url).startsWith('https://storage.bunnycdn.com/fixture/courses/covers/'));assert.equal(init.headers.AccessKey,'test-cover-key');assert.equal(init.body.byteLength,bytes.length);return new Response(null,{status:201});};
 const response=await upload.POST(request()),result=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert(result.url.startsWith('/api/covers/'));assert(result.url.length<100);assert(!JSON.stringify(result).includes('test-cover-key'));
 assert.equal((await upload.POST(request('image/svg+xml'))).status,400);assert.equal(calls,1);
 g.coverUser.role='instructor';assert.equal((await upload.POST(request())).status,200);
 g.fetch=async()=>new Response('failure',{status:403});assert.equal((await upload.POST(request())).status,502);
 const path=result.url.split('/').at(-1);g.fetch=async()=>new Response(bytes,{status:200});const image=await read.GET(new Request('https://faroschool.com'),{params:Promise.resolve({filename:path})});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.equal((await image.arrayBuffer()).byteLength,bytes.length);
 assert.equal((await read.GET(new Request('https://faroschool.com'),{params:Promise.resolve({filename:'../private.pdf'})})).status,404);
 const inline='data:image/png;base64,'+Buffer.from(bytes).toString('base64');assert(inline.length>1024*1024);
 g.fetch=async(url:any,init:any)=>{assert.equal(url,'/api/admin/upload/cover');assert.equal(init.body.get('file').size,bytes.length);return Response.json({url:result.url});};assert.equal(await prepareCourseCover(inline),result.url);
 g.fetch=async()=>{throw Error('offline');};await assert.rejects(()=>prepareCourseCover(inline));assert.equal(await prepareCourseCover(result.url),result.url);
 console.log('PASS covers: actual multipart bytes, Bunny PUT, short URL, no secrets, teacher/admin only, malformed type denied, private paths inaccessible, old >1MB cover repaired before action. All remote I/O mocked.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
