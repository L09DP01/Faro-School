import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {createRequire} from 'node:module';
async function main(){
 await mkdir('tmp/login-feedback',{recursive:true});
 await build({entryPoints:['src/components/auth/LoginForm.tsx'],outfile:'tmp/login-feedback/form.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'offline-login',setup(b){
 b.onResolve({filter:/^(react|next-intl|next-auth\/react|@\/i18n\/navigation|@\/components\/pwa\/PwaInstallBanner|\.\/(?:VerificationCodeForm|AuthSegmentedControl))$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='react'?'export const useState=value=>{const i=globalThis.feedbackCursor++;if(!(i in globalThis.feedbackState))globalThis.feedbackState[i]=value;return [globalThis.feedbackState[i],v=>globalThis.feedbackState[i]=v]}':a.path==='next-intl'?'export const useLocale=()=>"fr";export const useTranslations=()=>key=>key':a.path==='next-auth/react'?'export const signIn=async()=>globalThis.feedbackResult':a.path.includes('navigation')?'export const useRouter=()=>({});export const Link=()=>null':'export const VerificationCodeForm=()=>null;export const AuthSegmentedControl=()=>null;export const PwaInstallBanner=()=>null'}));
 }}]});
 const g=globalThis as any,Form=createRequire(resolve('package.json'))(resolve('tmp/login-feedback/form.cjs')).LoginForm;
 function findForm(node:any):any{if(!node)return;if(node.type==='form')return node;for(const child of [node.props?.children].flat(Infinity)){const found=findForm(child);if(found)return found;}}
 for(const [error,code,expected] of [['MissingCSRF',undefined,'errors.securitySessionExpired'],['CredentialsSignin',undefined,'errors.invalidCredentials'],['Configuration',undefined,'errors.serverError'],['CallbackRouteError',undefined,'errors.serverError'],['CredentialsSignin','ACCOUNT_LOCKED','errors.rateLimit']]){
  g.feedbackCursor=0;g.feedbackState=['admin@example.test','SyntheticOnly9!'];g.feedbackResult={error,code,ok:false};const form=findForm(Form({}));await form.props.onSubmit({preventDefault(){}});assert.equal(g.feedbackState[5],expected,error);
 }
 g.feedbackCursor=0;g.feedbackState=['admin@example.test','SyntheticOnly9!'];g.feedbackResult={error:'CredentialsSignin',code:'EMAIL_NOT_VERIFIED',ok:false};await findForm(Form({})).props.onSubmit({preventDefault(){}});assert.equal(g.feedbackState[7],'admin@example.test');
 console.log('PASS real login submit: MissingCSRF is not bad credentials; infrastructure, lockout and email verification errors remain distinct; no real sign-ins');
}
main().catch(e=>{console.error(e);process.exitCode=1});
