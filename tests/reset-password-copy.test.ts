import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createRequire} from 'node:module';import {renderToStaticMarkup} from 'react-dom/server';import {createElement} from 'react';import {updatePasswordSchema} from '../src/lib/validators/auth';
async function main(){
 await mkdir('tmp/reset-copy',{recursive:true});
 await build({entryPoints:['src/components/auth/ResetPasswordForm.tsx'],outfile:'tmp/reset-copy/form.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'offline-render',setup(b){
 b.onResolve({filter:/^(react|next-intl|@\/i18n\/navigation)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='react'?'export const useEffect=()=>{};export const useState=value=>{const i=globalThis.resetCursor++;return [i===0?globalThis.resetStatus:value,()=>{}]}':a.path==='next-intl'?'export const useTranslations=()=>globalThis.resetTranslator':'import {jsx} from "react/jsx-runtime";export const Link=props=>jsx("a",props)'}));
 }}]});
 const require=createRequire(resolve('package.json')),Form=require(resolve('tmp/reset-copy/form.cjs')).ResetPasswordForm;
 const {createTranslator}=require('next-intl'),g=globalThis as any;
 for(const locale of ['fr','ht']){
  const messages=JSON.parse(await readFile('src/messages/'+locale+'.json','utf8'));
  g.resetTranslator=createTranslator({locale,messages,namespace:'auth',onError:(e:any)=>{throw e}});
  for(const status of ['checking','ready','expired','success']){
   g.resetCursor=0;g.resetStatus=status;const html=renderToStaticMarkup(createElement(Form));
   assert.doesNotMatch(html,/auth\.[A-Za-z]/,locale+' '+status);
   if(status==='ready'){assert.ok(html.includes(messages.auth.newPasswordLabel));assert.ok(html.includes(messages.auth.updatePasswordSubmit));assert.ok(html.includes('10'));assert.ok(html.includes('for="reset_password"'));}
   if(status==='success')assert.ok(html.includes(messages.auth.resetSuccessTitle));
   if(status==='expired')assert.ok(html.includes(messages.auth.expiredLinkTitle));
  }
  for(const password of ['abcdefghij','ABCDEFGHIJ','Abcdefghij']){
   const result=updatePasswordSchema.safeParse({password,confirmPassword:password});assert.equal(result.success,false);
   if(!result.success)for(const issue of result.error.issues)assert.ok(messages.auth.errors[issue.message]);
  }
 }
 assert.equal(updatePasswordSchema.safeParse({password:'Learning-2026!',confirmPassword:'Learning-2026!'}).success,true);
 console.log('PASS real reset form rendered in FR/KR: checking, ready, expired, success; no raw translation keys; password rules and accessible labels');
}
main().catch(e=>{console.error(e);process.exitCode=1});
