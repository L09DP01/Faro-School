import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';
async function main(){
 await mkdir('tmp/pwa-controls',{recursive:true});
 const g=globalThis as any;
 await build({entryPoints:['src/lib/pwa/use-pwa.tsx','src/components/auth/LogoutButton.tsx','src/components/pwa/PwaViewport.tsx'],outdir:'tmp/pwa-controls',outbase:'src',bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'offline-controls',setup(b){
 b.onResolve({filter:/^(react(?:\/jsx-runtime)?|next-auth\/react|next\/navigation)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='next/navigation'?'export const usePathname=()=>globalThis.viewportPath??"/fr/dashboard"':a.path==='next-auth/react'?'export const signOut=async options=>{globalThis.logoutOptions=options;if(globalThis.logoutFailure)throw Error("offline");globalThis.logoutEvents.push("session-cleared")}':a.path.endsWith('jsx-runtime')?'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;':'export const createContext=()=>({Provider:"provider"});export const useContext=()=>null;export const useCallback=f=>f;export const useState=initial=>{const i=globalThis.cursor++;if(!(i in globalThis.states))globalThis.states[i]=initial;return [globalThis.states[i],v=>globalThis.states[i]=v]};export const useEffect=f=>{if(!globalThis.effectsRun)globalThis.effects.push(f)}'}));
 }}]});
 const req=createRequire(resolve('package.json'));const Provider=req(resolve('tmp/pwa-controls/lib/pwa/use-pwa.js')).PwaProvider;
 function render(){g.cursor=0;return Provider({children:null}).props.value;}
 for(const ua of ['Mozilla Windows Chrome','Mozilla Android Chrome','Mozilla iPhone CriOS Safari']){
  g.states=[];g.effects=[];g.effectsRun=false;g.cursor=0;const listeners:any={};const store=new Map();
  const nav:any={userAgent:ua,platform:ua.includes('iPhone')?'iPhone':'other',maxTouchPoints:1};Object.defineProperty(g,'navigator',{configurable:true,value:nav});
  g.document={cookie:'faro_display=standalone'};g.localStorage={getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)};
  g.window={navigator:nav,matchMedia:()=>({matches:false}),location:{search:'?source=pwa',protocol:'https:'},addEventListener:(n:string,f:any)=>listeners[n]=f,removeEventListener(){}};
  render();for(const f of g.effects)f();g.effectsRun=true;let value=render();assert.equal(value.isStandalone,false,'cookie/source are not display mode');
  let prevented=false;listeners.beforeinstallprompt({preventDefault(){prevented=true},prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})});value=render();
  assert.equal(prevented,ua.includes('Android'));assert.equal(value.isInstallable,!ua.includes('Windows'));
  if(ua.includes('iPhone')){await value.triggerInstallPrompt();assert.equal(render().showIosModal,true);}
  if(ua.includes('Android')){assert.equal(await value.triggerInstallPrompt(),true);}
 }
 const Viewport=req(resolve('tmp/pwa-controls/components/pwa/PwaViewport.js')).PwaViewport;
 g.effects=[];g.effectsRun=false;const styles=new Map(),events:any={};g.HTMLElement=class {matches(){return true}scrollIntoView(){}};g.requestAnimationFrame=(f:any)=>f();
 g.document={documentElement:{dataset:{},style:{setProperty:(k:string,v:string)=>styles.set(k,v),removeProperty:(k:string)=>styles.delete(k)}},activeElement:null,addEventListener:(n:string,f:any)=>events[n]=f,removeEventListener(){}};
 g.window={location:{search:""},innerHeight:844,visualViewport:{height:764,scale:1,addEventListener:(n:string,f:any)=>events[n]=f,removeEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),addEventListener:(n:string,f:any)=>events[n]=f,removeEventListener(){}};
 Viewport();g.effects.forEach((f:any)=>f());assert.equal(styles.has('--app-height'),false,'a visual inset without keyboard must not leave a bottom gap');
 g.document.activeElement=new g.HTMLElement();g.window.visualViewport.height=400;events.resize();assert.equal(styles.has('--app-height'),false);assert.equal(g.document.documentElement.dataset.appKeyboard,'true');
 g.window.innerHeight=400;g.window.visualViewport.height=400;events.resize();assert.equal(g.document.documentElement.dataset.appKeyboard,'true','resizes-content must hide navigation too');
 g.window.innerHeight=844;g.window.visualViewport.height=844;events.resize();assert.equal(g.document.documentElement.dataset.appKeyboard,'false','keyboard closes while input remains focused');
 g.document.activeElement=null;events.focusout();assert.equal(styles.has('--app-height'),false,'CSS owns height');assert.equal(g.document.documentElement.dataset.appKeyboard,'false');
 const oldMode=process.env.NODE_ENV;
 for(const mode of ['production','development']){
  (process.env as any).NODE_ENV=mode;g.effects=[];g.effectsRun=false;styles.clear();g.document.documentElement.dataset={};g.window.location.search='?debug=safe&sat=59&sab=34';Viewport();g.effects.forEach((f:any)=>f());
  assert.equal(g.document.documentElement.dataset.safeDebug,mode==='production'?undefined:'true');assert.equal(styles.get('--sat'),mode==='production'?undefined:'59px');
 }
 (process.env as any).NODE_ENV=oldMode;
 const Logout=req(resolve('tmp/pwa-controls/components/auth/LogoutButton.js')).LogoutButton;
 g.states=[];g.cursor=0;g.logoutEvents=[];g.window={location:{replace:(path:string)=>g.logoutEvents.push(path)}};
 let button=Logout({locale:'ht',children:'exit'}).props.children[0];await button.props.onClick();assert.deepEqual(g.logoutEvents,['session-cleared','/ht/connexion']);assert.deepEqual(g.logoutOptions,{redirect:false});
 g.states=[];g.cursor=0;g.logoutEvents=[];g.logoutFailure=true;button=Logout({locale:'fr',children:'exit'}).props.children[0];await button.props.onClick();assert.deepEqual(g.logoutEvents,[],'failed signout must not pretend the user logged out');
 console.log('PASS actual PWA provider: desktop native UI untouched, Android prompt, iPhone instructions despite old cookie; viewport inset/keyboard/blur height, logout clears session before redirect and handles failure');
}
main().catch(e=>{console.error(e);process.exitCode=1});
