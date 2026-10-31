import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const load=createRequire(resolve("package.json"));
async function main(){
 await mkdir("tmp/certificates/api",{recursive:true});
 const state:any={user:null,row:null,eligible:false,settingsError:false};
 (globalThis as any).__certificateHttp=state;
 (globalThis as any).__certificateDb={
  from(table:string){const builder:any={select(){return builder;},eq(){return builder;},order(){return builder;},range(){return builder;},then(ok:any){return Promise.resolve({data:[],error:null}).then(ok);},maybeSingle:async()=>({data:state.row,error:null}),single:async()=>({data:table==="profiles"?{email_verified_at:state.user?.emailVerified,banned_at:null}:{signature_name:"",signature_title:"",signature_image_path:null},error:table==="certificate_settings"&&state.settingsError?{}:null})};return builder;},
  async rpc(){return {data:null,error:{code:"P0001",message:"not_eligible"}};}
 };
 const entries={issue:"src/app/api/certificates/route.ts",pdf:"src/app/api/certificates/[id]/pdf/route.ts",admin:"src/app/api/admin/certificates/route.ts",signature:"src/app/api/admin/certificates/signature/route.ts"};
 for(const [name,entry] of Object.entries(entries)){
  await build({entryPoints:[entry],outfile:`tmp/certificates/api/${name}.cjs`,bundle:true,platform:"node",format:"cjs",packages:"external",plugins:[{name:"isolated-auth-and-database",setup(b){
   b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"stub"}));
   b.onResolve({filter:/^@\/lib\/auth\/get-user$/},()=>({path:"auth",namespace:"stub"}));
   b.onResolve({filter:/^@\/lib\/supabase\/admin$/},()=>({path:"db",namespace:"stub"}));
   b.onResolve({filter:/^@\/lib\/certificates\/pdf$/},()=>({path:"pdf",namespace:"stub"}));
   b.onLoad({filter:/.*/,namespace:"stub"},a=>({contents:a.path==="auth"?"export async function getCurrentUser(){return globalThis.__certificateHttp.user}":a.path==="db"?"export function createAdminClient(){return globalThis.__certificateDb};export const getAdminSupabase=createAdminClient;":a.path==="pdf"?"export async function loadCertificateAssets(){return {}};export async function renderCertificatePdf(){return new Uint8Array([37,80,68,70])}":"export {};",loader:"js"}));
  }}]});
 }
 const issue=load(resolve("tmp/certificates/api/issue.cjs")),pdf=load(resolve("tmp/certificates/api/pdf.cjs")),admin=load(resolve("tmp/certificates/api/admin.cjs"));
 const signature=load(resolve("tmp/certificates/api/signature.cjs"));
 const userId="11111111-1111-4111-8111-111111111111",id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",course="55555555-5555-4555-8555-555555555555";
 const issueReq=()=>new Request("https://faroschool.com/api/certificates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:course,name:"Jan-Pòl Étienne"})});
 const denied=await admin.GET(new Request('https://faroschool.com/api/admin/certificates'));assert.equal(denied.status,401);assert.equal(denied.headers.get('Cache-Control'),'no-store');assert.equal((await admin.POST(new Request('https://faroschool.com/api/admin/certificates',{method:'POST'}))).status,401);assert.equal((await signature.POST(new Request('https://faroschool.com/api/admin/certificates/signature',{method:'POST'}))).status,401);
 assert.equal((await issue.POST(issueReq())).status,401);
 state.user={id:userId,role:"student",emailVerified:null};assert.equal((await issue.POST(issueReq())).status,401);
 state.user.emailVerified="2026-10-29";assert.equal((await issue.POST(issueReq())).status,409);
 const forbidden=await admin.POST(new Request("https://faroschool.com/api/admin/certificates",{method:"POST",body:JSON.stringify({action:"revoke",id,reason:"Motif"})}));assert.equal(forbidden.status,403);
 state.user.role="instructor";assert.equal((await admin.POST(new Request("https://faroschool.com/api/admin/certificates",{method:"POST"}))).status,403);
 state.row={id,user_id:"22222222-2222-4222-8222-222222222222",certificate_number:"FARO-2026-7K4M9X2A",courses:{slug:"formation-test"}};
 state.user.role="student";assert.equal((await pdf.GET(new Request("https://faroschool.com"),{params:Promise.resolve({id})})).status,404);
 state.user.role="admin";state.settingsError=true;assert.equal((await admin.GET(new Request('https://faroschool.com/api/admin/certificates'))).status,503);state.settingsError=false;const empty=await admin.GET(new Request('https://faroschool.com/api/admin/certificates'));assert.equal(empty.status,200);assert.deepEqual((await empty.json()).certificates,[]);process.env.NEXT_PUBLIC_APP_URL="https://faroschool.com";
 const response=await pdf.GET(new Request("https://faroschool.com"),{params:Promise.resolve({id})});
 assert.equal(response.status,200);assert(response.headers.get("Cache-Control").includes("no-store"));assert(response.headers.get("Content-Disposition").includes("Certificat-Faro-School-formation-test.pdf"));
 state.user.role="student";state.row.user_id=userId;assert.equal((await pdf.GET(new Request("https://faroschool.com"),{params:Promise.resolve({id})})).status,200);
 const crossOrigin=new Request("https://faroschool.com/api/certificates",{method:"POST",headers:{Origin:"https://example.org"}});assert.equal((await issue.POST(crossOrigin)).status,403);
 console.log("PASS direct HTTP checks including admin/signature authentication and settings failure: unverified/anonymous, below threshold, student/instructor mutations, cross-origin, PDF ownership/admin, no-store and filename. SQL rules are independently exercised by certificates.test.ts.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
