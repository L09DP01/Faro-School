import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/auth-login',{recursive:true});
 await build({entryPoints:['src/auth.ts'],outfile:'tmp/auth-login/fixture.cjs',bundle:true,platform:'node',format:'cjs',packages:'external',plugins:[{name:'offline-auth',setup(b){
 b.onResolve({filter:/^(next-auth(?:\/providers\/credentials)?|@\/lib\/(?:auth\/(?:rate-limit|password)|supabase\/admin))$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='next-auth'?'export class CredentialsSignin extends Error{};export default config=>{globalThis.authFixture=config;return {}}':a.path.includes('providers/')?'export default config=>config':a.path.endsWith('rate-limit')?'export const normalizeEmail=s=>s.trim().toLowerCase();export const checkLoginRateLimit=async(e,ip)=>{globalThis.loginIp=ip;return {allowed:!globalThis.locked}};export const recordFailedLogin=async()=>{};export const clearFailedLogins=async()=>{}':a.path.endsWith('password')?'export const verifyPassword=async p=>p==="correct-password";export const dummyHashWork=async()=>{}':'export const getAdminSupabase=()=>({from:table=>({select(){return this},eq(){return this},async single(){return {data:table==="profiles"?globalThis.profile:globalThis.creds}}})});'}));
 }}]});
 const g=globalThis as any;
 createRequire(resolve('package.json'))(resolve('tmp/auth-login/fixture.cjs'));
 const authorize=g.authFixture.providers[0].authorize;
 g.profile={id:'sample',email:'admin@example.test',role:'admin',email_verified_at:'2026-10-30'};g.creds={password_hash:'fixture',token_version:2};
 const request=new Request('https://example.test/api/auth/callback/credentials',{headers:{'cf-connecting-ip':'192.0.2.8'}});
 const result=await authorize({email:' ADMIN@example.test ',password:'correct-password',ip:'forged'},request);
 assert.equal(result.role,'admin');assert.equal(result.tokenVersion,2);assert.equal(g.loginIp,'192.0.2.8');
 assert.equal(await authorize({email:'admin@example.test',password:'wrong'},request),null);
 g.profile.email_verified_at=null;await assert.rejects(()=>authorize({email:'admin@example.test',password:'correct-password'},request),e=>(e as any).code==='EMAIL_NOT_VERIFIED');
 g.locked=true;await assert.rejects(()=>authorize({email:'admin@example.test',password:'correct-password'},request),e=>(e as any).code==='ACCOUNT_LOCKED');
 console.log('PASS actual Credentials authorize: admin session, trusted request IP, incorrect password, unverified and locked accounts; offline mocks');
}
main().catch(e=>{console.error(e);process.exit(1)});
