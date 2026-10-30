import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {createRequire} from "node:module";
import {createHmac} from "node:crypto";
import {build} from "esbuild";
import {PGlite} from "@electric-sql/pglite";
import {verifyResend,recipientHash} from "../src/lib/webhooks/security";

async function main(){
 let checks=0;const pass=(name:string)=>{checks++;console.log("PASS "+name);};
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE lessons(id uuid PRIMARY KEY,video_id text,duration_sec integer NOT NULL DEFAULT 0);
 CREATE TABLE profiles(id uuid PRIMARY KEY,email_verified_at timestamptz);
 GRANT SELECT,UPDATE ON lessons TO service_role;`);
 const migration=(await import("node:fs/promises")).readdir("supabase/migrations");
 const file=(await migration).find(f=>f.endsWith("_bunny_resend_webhooks.sql"))!;assert(file);
 await db.exec(await readFile("supabase/migrations/"+file,"utf8"));
 const state={down:false,metadataDown:false,providerCalls:0,mailCalls:0,suppressLookupDown:false};
 const fake={
  from(table:string){const filters:Record<string,string>={};const b={select(){return b;},eq(k:string,v:string){filters[k]=v;return b;},async maybeSingle(){
   if(state.down||(state.suppressLookupDown&&table==="email_suppressions"))return{data:null,error:{message:"offline"}};
   try{const keys=Object.keys(filters);assert(["webhook_events","email_suppressions"].includes(table));assert(keys.every(k=>["provider","event_id","recipient_hash"].includes(k)));
    const result=await db.query(`SELECT * FROM ${table} WHERE ${keys.map((k,i)=>k+"=$"+(i+1)).join(" AND ")}`,Object.values(filters));return{data:result.rows[0]??null,error:null};
   }catch{return{data:null,error:{message:"db_error"}};}
  }};return b;},
  async rpc(name:string,args:Record<string,unknown>){
   if(state.down)return{data:null,error:{message:"offline"}};
   try{assert(["apply_bunny_webhook","apply_resend_webhook"].includes(name));const keys=Object.keys(args),values=Object.values(args).map(v=>Array.isArray(v)?"{"+v.join(",")+"}":v);
    const r=await db.query<{result:unknown}>(`SELECT public.${name}(${keys.map((k,i)=>k+"=>$"+(i+1)).join(",")}) AS result`,values);return{data:r.rows[0].result,error:null};
   }catch{return{data:null,error:{message:"db_error"}};}
  }
 };
 (globalThis as any).__webhookDb=fake;
 await mkdir("tmp/webhooks",{recursive:true});
 for(const [name,path] of Object.entries({bunny:"src/app/api/webhooks/bunny/route.ts",resend:"src/app/api/webhooks/resend/route.ts",transport:"src/lib/email/transport.ts"})){
  await build({entryPoints:[path],outfile:"tmp/webhooks/"+name+".cjs",bundle:true,platform:"node",format:"cjs",packages:"external",plugins:[{name:"offline-db",setup(b){
   b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"stub"}));
   b.onResolve({filter:/^@\/lib\/supabase\/admin$/},()=>({path:"db",namespace:"stub"}));
   b.onLoad({filter:/.*/,namespace:"stub"},a=>({loader:"js",contents:a.path==="db"?"export function createAdminClient(){return globalThis.__webhookDb}":"export {};"}));
  }}]});
 }
 const require=createRequire(resolve("package.json")),bunny=require(resolve("tmp/webhooks/bunny.cjs")),resend=require(resolve("tmp/webhooks/resend.cjs")),transport=require(resolve("tmp/webhooks/transport.cjs"));
 const video="11111111-1111-4111-8111-111111111111",lesson="22222222-2222-4222-8222-222222222222",message="33333333-3333-4333-8333-333333333333",suppression="44444444-4444-4444-8444-444444444444";
 const now=Date.now()-10000,at=(n=0)=>new Date(now+n).toISOString();
 const event={VideoLibraryId:123,VideoGuid:video,Status:3,EventId:crypto.randomUUID(),Timestamp:at()};
 const secret="test-bunny-read-only-key",resendSecret="whsec_"+Buffer.from("test-resend-webhook-32-byte-secret").toString("base64");
 process.env.BUNNY_STREAM_LIBRARY_ID="123";process.env.BUNNY_STREAM_READ_ONLY_API_KEY=secret;process.env.RESEND_WEBHOOK_SECRET=resendSecret;
 const bunnyRequest=(e:unknown,overrides:Record<string,string>={})=>{const body=typeof e==="string"?e:JSON.stringify(e);return new Request("https://faroschool.com/api/webhooks/bunny",{method:"POST",headers:{"Content-Type":"application/json","X-BunnyStream-Signature-Version":"v1","X-BunnyStream-Signature-Algorithm":"hmac-sha256","X-BunnyStream-Signature":createHmac("sha256",secret).update(body).digest("hex"),...overrides},body});};
 const resendRequest=(e:unknown,id="msg_"+crypto.randomUUID(),ts=String(Math.floor(Date.now()/1000)))=>{const body=typeof e==="string"?e:JSON.stringify(e);return new Request("https://faroschool.com/api/webhooks/resend",{method:"POST",headers:{"Content-Type":"application/json","svix-id":id,"svix-timestamp":ts,"svix-signature":"v1,"+createHmac("sha256",Buffer.from(resendSecret.slice(6),"base64")).update(id+"."+ts+"."+body).digest("base64")},body});};
 const originalFetch=globalThis.fetch;globalThis.fetch=async(input,init)=>{
  const url=String(input);if(url.startsWith("https://video.bunnycdn.com/")){state.providerCalls++;assert.equal(new Headers(init?.headers).get("AccessKey"),secret);return state.metadataDown?new Response("unavailable",{status:503}):Response.json({guid:video,videoLibraryId:123,length:900});}
  if(url==="https://api.resend.com/emails"){state.mailCalls++;assert(!JSON.stringify(init?.body).includes("suppressed@example.test"));return Response.json({id:message});}
  throw Error("Unexpected network request in offline test");
 };
 try{
  assert.equal(bunny.runtime,"nodejs");assert.equal(resend.runtime,"nodejs");pass("route runtime matches the existing OpenNext Cloudflare adapter");
  const sampleBody=new TextEncoder().encode('{"event_type":"ping","data":{"success":true}}');
  assert(await verifyResend(sampleBody,new Headers({"svix-id":"msg_loFOjxBNrRLzqYUf","svix-timestamp":"1731705121","svix-signature":"v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0="}),"whsec_plJ3nmyCDGBKInavdOK15jsl",1731705121000));pass("official Svix reference vector validates with Web Crypto");
  assert.equal((await bunny.POST(bunnyRequest(event,{"X-BunnyStream-Signature":"0".repeat(64)}))).status,401);
  assert.equal((await bunny.POST(bunnyRequest(event,{"X-BunnyStream-Signature-Version":"v2"}))).status,401);pass("Bunny rejects forged signatures and unknown versions");
  assert.equal((await bunny.POST(bunnyRequest({...event,VideoLibraryId:999}))).status,403);pass("Bunny rejects a different library");
  assert.equal((await bunny.POST(bunnyRequest("{"))).status,400);
  assert.equal((await bunny.POST(bunnyRequest({...event,EventId:undefined}))).status,400);
  assert.equal((await bunny.POST(bunnyRequest("x".repeat(65537)))).status,413);pass("malformed, incomplete and oversized payloads rejected before effects");
  await db.query("INSERT INTO lessons VALUES($1,$2,0)",[lesson,video]);
  const response=await bunny.POST(bunnyRequest(event));assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal((await db.query<{duration_sec:number}>("SELECT duration_sec FROM lessons")).rows[0].duration_sec,900);pass("Bunny ready event reads trusted duration and updates the lesson");
  assert.equal((await (await bunny.POST(bunnyRequest(event))).json()).duplicate,true);assert.equal(state.providerCalls,1);pass("duplicate Bunny event does not call provider or apply effects twice");
  assert.equal((await bunny.POST(bunnyRequest({...event,EventId:crypto.randomUUID(),Status:1,Timestamp:at(-1000)}))).status,200);
  assert.equal((await db.query<{status:number}>("SELECT status FROM bunny_video_assets")).rows[0].status,3);pass("out-of-order Bunny callbacks cannot regress ready status");
  const laterVideo="55555555-5555-4555-8555-555555555555";
  await db.query("INSERT INTO lessons VALUES($1,$2,12)",[laterVideo,video]);assert.equal((await db.query<{duration_sec:number}>("SELECT duration_sec FROM lessons WHERE id=$1",[laterVideo])).rows[0].duration_sec,900);pass("lesson saved after callback inherits trusted video duration");
  assert.equal((await bunny.POST(bunnyRequest({...event,Status:32,EventId:crypto.randomUUID(),Timestamp:at(1000)}))).status,200);
  assert.equal((await db.query<{duration_sec:number}>("SELECT duration_sec FROM lessons")).rows[0].duration_sec,0);pass("video deletion is recorded without deleting course or lesson history");
  const retryEvent={...event,EventId:crypto.randomUUID(),Timestamp:at(2000)};state.metadataDown=true;
  assert.equal((await bunny.POST(bunnyRequest(retryEvent))).status,503);assert.equal((await db.query("SELECT * FROM webhook_events WHERE event_id=$1",[retryEvent.EventId])).rows.length,0);
  state.metadataDown=false;assert.equal((await bunny.POST(bunnyRequest(retryEvent))).status,200);pass("upstream failure returns 503 and retry succeeds without losing the event");
  const mail={type:"email.delivered",created_at:at(),data:{email_id:message,to:[" Student@Example.test "],subject:"private subject and code 123456"}};
  const mailId="msg_"+crypto.randomUUID();assert.equal((await resend.POST(resendRequest(mail,mailId))).status,200);
  assert.equal((await (await resend.POST(resendRequest(mail,mailId))).json()).duplicate,true);pass("Resend delivery recorded with Svix-id idempotence");
  assert.equal((await resend.POST(resendRequest(mail,undefined,String(Math.floor(Date.now()/1000)-301)))).status,401);
  const tampered=resendRequest(mail);tampered.headers.set("svix-signature","v1,"+Buffer.alloc(32).toString("base64"));assert.equal((await resend.POST(tampered)).status,401);pass("Resend rejects forged signatures and stale delivery timestamps");
  const rotate=resendRequest({...mail,type:"email.sent"});rotate.headers.set("svix-signature","v1,"+Buffer.alloc(32).toString("base64")+" "+rotate.headers.get("svix-signature"));assert.equal((await resend.POST(rotate)).status,200);pass("Svix multiple-signature key rotation accepted");
  await resend.POST(resendRequest({...mail,type:"email.sent",created_at:at(-2000)}));
  assert.equal((await db.query<{status:string}>("SELECT status FROM email_deliveries")).rows[0].status,"email.delivered");pass("old email events cannot overwrite newer delivery state");
  const blockedAddress="suppressed@example.test",hash=await recipientHash(blockedAddress);
  await resend.POST(resendRequest({...mail,type:"email.bounced",data:{email_id:message,to:[blockedAddress],bounce:{type:"Transient"}}}));assert.equal((await db.query("SELECT * FROM email_suppressions")).rows.length,0);pass("temporary bounce does not permanently suppress a recipient");
  await resend.POST(resendRequest({...mail,type:"email.bounced",data:{email_id:message,to:[blockedAddress],bounce:{type:"Permanent"}}}));assert.equal((await db.query<{suppressed:boolean}>("SELECT suppressed FROM email_suppressions WHERE recipient_hash=$1",[hash])).rows[0].suppressed,true);pass("permanent bounce suppresses future sends");
  process.env.RESEND_API_KEY="re_test_only";process.env.EMAIL_FROM="Faro <noreply@example.test>";
  const before=state.mailCalls;assert.equal((await transport.sendResendEmail({to:blockedAddress,subject:"private",html:"private code"})).category,"suppressed");assert.equal(state.mailCalls,before);pass("shared transport never sends to suppressed addresses");
  await resend.POST(resendRequest({type:"suppression.removed",created_at:at(3000),data:{id:suppression,email:blockedAddress,origin:"manual"}}));
  await resend.POST(resendRequest({...mail,type:"email.complained",created_at:at(1000),data:{email_id:message,to:[blockedAddress]}}));
  assert.equal((await db.query<{suppressed:boolean}>("SELECT suppressed FROM email_suppressions WHERE recipient_hash=$1",[hash])).rows[0].suppressed,false);pass("explicit suppression removal wins over an older complaint replay");
  assert((await transport.sendResendEmail({to:"normal@example.test",subject:"private",html:"private"})).success);assert.equal(state.mailCalls,before+1);pass("unsuppressed email uses the shared Resend transport");
  state.suppressLookupDown=true;assert.equal((await transport.sendResendEmail({to:"normal@example.test",subject:"private",html:"private"})).success,false);assert.equal(state.mailCalls,before+1);state.suppressLookupDown=false;pass("email transport fails closed if suppression lookup fails");
  const rawStored=JSON.stringify((await db.query("SELECT * FROM webhook_events")).rows)+JSON.stringify((await db.query("SELECT * FROM email_deliveries")).rows);assert(!rawStored.includes("@")&&!rawStored.includes("123456")&&!rawStored.includes("private subject"));pass("receipts never store raw email payload, subject, address, code or signature");
  await db.query("INSERT INTO profiles VALUES($1,NULL)",[lesson]);await resend.POST(resendRequest(mail));assert.equal((await db.query<{email_verified_at:null}>("SELECT email_verified_at FROM profiles")).rows[0].email_verified_at,null);pass("delivered email never verifies an account");
  state.down=true;assert.equal((await resend.POST(resendRequest(mail))).status,503);state.down=false;pass("database failure returns retryable 503");
  for(const role of ["anon","authenticated"]){await db.exec("SET ROLE "+role);for(const table of ["webhook_events","bunny_video_assets","email_deliveries","email_suppressions"])await assert.rejects(()=>db.query("SELECT * FROM "+table),/permission denied/);await assert.rejects(()=>db.query("SELECT apply_bunny_webhook('forged',123,$1,3,900,now(),$2)",[video,"a".repeat(64)]),/permission denied/);await db.exec("RESET ROLE");}pass("anonymous and authenticated roles cannot read tables or invoke ingestion RPCs");
  await db.exec("SET ROLE service_role");assert((await db.query("SELECT * FROM webhook_events")).rows.length>0);await db.exec("RESET ROLE");pass("trusted service role retains access under RLS");
  const rollbackId="msg_rollback";await assert.rejects(()=>db.query("SELECT apply_resend_webhook($1,'email.sent',$2,ARRAY['invalid-hash'],now(),$3,NULL,NULL)",[rollbackId,message,"a".repeat(64)]));assert.equal((await db.query("SELECT * FROM webhook_events WHERE event_id=$1",[rollbackId])).rows.length,0);pass("failed effect rolls back the receipt atomically");
  delete process.env.BUNNY_STREAM_READ_ONLY_API_KEY;assert.equal((await bunny.POST(bunnyRequest(event))).status,503);delete process.env.RESEND_WEBHOOK_SECRET;assert.equal((await resend.POST(resendRequest(mail))).status,503);pass("missing secrets fail closed");
 }finally{globalThis.fetch=originalFetch;await db.close();}
 console.log(checks+" webhook checks passed; real local PostgreSQL and mocked provider I/O, no remote Supabase operations.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
