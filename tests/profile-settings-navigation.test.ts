import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir,readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {renderToStaticMarkup} from 'react-dom/server';import {createElement} from 'react';import {createTranslator} from 'next-intl';
async function main(){
 await mkdir('tmp/profile-audit',{recursive:true});
 await build({entryPoints:['src/components/dashboard/StudentDashboardShell.tsx','src/components/dashboard/ProfileForm.tsx'],outdir:'tmp/profile-audit',outbase:'src',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'offline-profile',setup(b){
 b.onResolve({filter:/^(next\/navigation|next\/image|next-intl|@\/i18n\/navigation)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='next/navigation'?'export const usePathname=()=>globalThis.auditPath;export const useRouter=()=>({refresh(){}})':a.path==='next-intl'?'export const useTranslations=namespace=>globalThis.auditTranslator(namespace)':a.path==='next/image'?'import {jsx} from "react/jsx-runtime";export default function Image({fill,priority,...props}){return jsx("img",props)}':'import {jsx} from "react/jsx-runtime";export const Link=({href,...props})=>jsx("a",{...props,href:href.startsWith("/")?"/"+globalThis.auditLocale+href:href})'}));
 }}]});
 const req=createRequire(resolve('package.json')),Shell=req(resolve('tmp/profile-audit/components/dashboard/StudentDashboardShell.js')).StudentDashboardShell,Form=req(resolve('tmp/profile-audit/components/dashboard/ProfileForm.js')).ProfileForm,g=globalThis as any;
 const user={fullName:'Compte exemple',phone:null,email:null,locale:'fr',role:'student'};
 for(const locale of ['fr','ht']){
  const messages=JSON.parse(await readFile('src/messages/'+locale+'.json','utf8'));g.auditLocale=locale;g.auditTranslator=(namespace:string)=>createTranslator({locale,messages,namespace,onError:(e:any)=>{throw e}});
  for(const suffix of ['/dashboard/profil','/dashboard/profil/','/dashboard/profil/parametres']){
   g.auditPath='/'+locale+suffix;const html=renderToStaticMarkup(createElement(Shell,{user,locale,children:'sample'}));const account=html.split('aria-label="Menu compte"')[1].split('</nav>')[0];const active=(account.match(/<a\b[^>]*aria-current="page"[^>]*>/g)||[]);
   assert.equal(active.length,1,'Exactly one account menu entry: '+g.auditPath);assert.ok(active[0].includes('href="/'+locale+(suffix.includes('parametres')?'/dashboard/profil/parametres':'/dashboard/profil')+'"'));
  }
  const profile=renderToStaticMarkup(createElement(Form,{user,currentLocale:locale}));assert.ok(profile.includes('id="profile-name"'));assert.ok(profile.includes('id="profile-email"'));assert.ok(!profile.includes('id="new-pwd"'));assert.ok(!profile.includes('id="profile-locale"'));
  const settings=renderToStaticMarkup(createElement(Form,{user,currentLocale:locale,section:'settings'}));assert.ok(settings.includes('id="profile-locale"'));assert.ok(settings.includes('id="new-pwd"'));assert.ok(!settings.includes('id="profile-name"'));assert.ok(!settings.includes('id="profile-phone"'));assert.doesNotMatch(profile+settings,/dashboard\.profile\.[A-Za-z]/);
 }
 console.log('PASS real FR/KR shell: one active account link, nested settings/trailing slash; profile contains identity only, settings contain language/email/password');
}
main().catch(e=>{console.error(e);process.exitCode=1});
