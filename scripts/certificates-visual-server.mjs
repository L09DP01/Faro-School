// Local component-fixture server only. No auth bypass is added to Next.js.
import { createServer } from "node:http";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { resolve,extname } from "node:path";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await mkdir("tmp/certificates",{recursive:true});
const globals=(await readFile("src/styles/globals.css","utf8")).replace(/^@import[^\r\n]*[\r\n]*/gm,"");
await writeFile("tmp/certificates/input.css",globals+`
@font-face{font-family:Poppins;src:url('/fonts/certificates/Poppins-Bold.ttf');font-weight:600 700}
@font-face{font-family:Inter;src:url('/fonts/certificates/Inter-Regular.ttf');font-weight:100 900}
`);
execFileSync(process.execPath,["node_modules/tailwindcss/lib/cli.js","-i","tmp/certificates/input.css","-o","tmp/certificates/app.css","--content","tests/certificates-visual.tsx,src/components/certificates/*.tsx,src/components/dashboard/StudentDashboardShell.tsx,src/components/admin/AdminLayoutClient.tsx,src/components/brand/Logo.tsx,src/components/ui/UserAvatar.tsx,src/components/messaging/StaffAvailabilityToggle.tsx"],{stdio:"inherit",windowsHide:true});
await build({entryPoints:["tests/certificates-visual.tsx"],bundle:true,outfile:"tmp/certificates/app.js",platform:"browser",format:"iife",jsx:"automatic",plugins:[{name:"next-layout-fixtures",setup(b){
 b.onResolve({filter:/^next\/(navigation|image)$/},a=>({path:a.path,namespace:"next-fixture"}));
 b.onResolve({filter:/^@\/i18n\/navigation$/},a=>({path:a.path,namespace:"next-fixture"}));
 b.onResolve({filter:/^@\/app\/actions\/private-messaging$/},a=>({path:a.path,namespace:"next-fixture"}));
 b.onLoad({filter:/.*/,namespace:"next-fixture"},a=>({loader:"js",resolveDir:process.cwd(),contents:a.path==="next/navigation"?`export const usePathname=()=>location.search.includes('admin')?'/fr/admin/certificats':'/fr/certificats';export const useRouter=()=>({push:p=>location.href=p});`:a.path==="next/image"?`import React from 'react';export default function Image({priority,fill,quality,unoptimized,sizes,...p}){return React.createElement('img',p)}`:a.path.includes('private-messaging')?`export async function staffHeartbeatAction(){};export async function toggleStaffAvailabilityAction(){}`:`import React from 'react';export function Link({href,locale,prefetch,...p}){return React.createElement('a',{...p,href:typeof href==='string'?href:'#'})}`}));
 }}],define:{"process.env":"{}","process.env.NODE_ENV":'"development"'}});
if(process.argv.includes("--build-only"))process.exit(0);
const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>`;
const types={".js":"application/javascript",".css":"text/css",".ttf":"font/ttf",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp"};
createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const path=pathname==="/app.js"?resolve("tmp/certificates/app.js"):pathname==="/app.css"?resolve("tmp/certificates/app.css"):pathname==="/tokens.css"?resolve("src/styles/tokens.css"):resolve("public",pathname.slice(1));
  if(pathname==="/"){res.setHeader("Content-Type","text/html; charset=utf-8");res.end(html);return;}
  if(![resolve("public"),resolve("tmp/certificates"),resolve("src/styles")].some(p=>path.startsWith(p+"/")||path.startsWith(p+"\\"))){res.writeHead(404).end();return;}
  res.setHeader("Content-Type",types[extname(path)]??"application/octet-stream");res.end(await readFile(path));
 }catch{res.writeHead(404).end();}
}).listen(4181,"127.0.0.1",()=>console.log("Certificate production-component fixture server: http://127.0.0.1:4181"));
