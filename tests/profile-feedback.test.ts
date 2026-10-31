import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/profile-feedback',{recursive:true});
 await build({entryPoints:['src/components/dashboard/ProfileForm.tsx','src/components/dashboard/ChangeEmailForm.tsx'],outbase:'src',outdir:'tmp/profile-feedback',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'offline-feedback',setup(b){
 b.onResolve({filter:/^(react|next-intl|next\/navigation|@\/i18n\/navigation)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='react'?'export const useState=initial=>{const i=globalThis.formCursor++;if(!(i in globalThis.formStates))globalThis.formStates[i]=initial;return [globalThis.formStates[i],v=>globalThis.formStates[i]=v]}':a.path==='next-intl'?'export const useTranslations=()=>key=>key':a.path==='next/navigation'?'export const useRouter=()=>globalThis.formRouter;export const usePathname=()=>"/fr/dashboard/profil/parametres"':'export const Link=()=>null'}));
 }}]});
 const req=createRequire(resolve('package.json')),Form=req(resolve('tmp/profile-feedback/components/dashboard/ProfileForm.js')).ProfileForm,Email=req(resolve('tmp/profile-feedback/components/dashboard/ChangeEmailForm.js')).ChangeEmailForm,g=globalThis as any;
 const find=(node:any,type:any):any[]=>!node?[]:[...(node.type===type?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(n=>find(n,type))];
 const calls:any[]=[],cookies:string[]=[];g.formRouter={replace:(v:string)=>calls.push(v),refresh:()=>calls.push('refresh')};g.document={};Object.defineProperty(g.document,'cookie',{set:(v:string)=>cookies.push(v)});g.window={location:{protocol:'https:',search:'',hash:''}};g.setTimeout=()=>0;
 const props={user:{fullName:'Compte exemple',phone:null,email:null,locale:'fr'},currentLocale:'fr',section:'settings'};
 g.formCursor=0;g.formStates=[];g.formStates[2]='ht';g.fetch=async(_url:string,options:any)=>{calls.push(JSON.parse(options.body));return Response.json({success:true})};let forms=find(Form(props),'form');await forms[0].props.onSubmit({preventDefault(){}});
 assert.deepEqual(calls[0],{locale:'ht'});assert.ok(calls.includes('/ht/dashboard/profil/parametres'));assert.equal(cookies.length,2);assert.ok(cookies.every(c=>c.includes('=ht;')&&c.includes('Secure')));
 g.formCursor=0;g.formStates=[];g.fetch=async()=>{throw new Error('INTERNAL_NETWORK_MESSAGE')};forms=find(Form(props),'form');await forms[0].props.onSubmit({preventDefault(){}});assert.equal(g.formStates[5],'errors.unavailable');
 g.formCursor=0;g.formStates=[];g.formStates[6]='CurrentOnly9!';g.formStates[7]=g.formStates[8]='NewSyntheticOnly9!';g.fetch=async()=>Response.json({success:true});forms=find(Form(props),'form');await forms[1].props.onSubmit({preventDefault(){}});assert.equal(g.formStates[10],true);g.formCursor=0;const changed=Form(props);assert.ok(find(changed,'div').some(n=>JSON.stringify(n).includes('reconnect')));
 calls.length=0;g.formCursor=0;g.formStates=[false,'new@example.test','','123456',true,'',false];const email=Email({locale:'fr'});await email.props.onSubmit({preventDefault(){}});assert.equal(g.formStates[0],true);assert.ok(calls.includes('refresh'));
 console.log('PASS actual profile submit: immediate locale route/cookie sync, safe translated network errors, password reconnect CTA and email identity refresh; all transport mocked');
}
main().catch(e=>{console.error(e);process.exitCode=1});
