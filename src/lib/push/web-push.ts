import 'server-only';
import {SignJWT,importJWK} from 'jose';
const encoder=new TextEncoder();
export const decode64=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const encode64=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const join=(...values:Uint8Array[])=>{const result=new Uint8Array(values.reduce((sum,value)=>sum+value.length,0));let offset=0;for(const value of values){result.set(value,offset);offset+=value.length;}return result;};
const buffer=(value:Uint8Array)=>new Uint8Array(value).buffer;
async function hmac(key:Uint8Array,value:Uint8Array){const imported=await crypto.subtle.importKey('raw',buffer(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',imported,buffer(value)));}
export function isPushEndpoint(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.push.apple.com')||url.hostname.endsWith('.notify.windows.com'));}catch{return false;}}
export function pushConfiguration(){const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT||'https://faroschool.com';if(!publicKey||!privateKey)return null;try{if(decode64(publicKey).length!==65||decode64(privateKey).length!==32||!/^https:\/\/|^mailto:/.test(subject))return null;}catch{return null;}return{publicKey,privateKey,subject};}
/** RFC 8291 single-record aes128gcm. Optional randomness is for published-vector tests only. */
export async function encryptWebPush(payload:Uint8Array,subscription:{p256dh:string;auth:string},options?:{keyPair?:CryptoKeyPair;salt?:Uint8Array}){
 if(payload.length>2800)throw Error('push_payload_too_large');const receiver=decode64(subscription.p256dh),auth=decode64(subscription.auth);
 if(receiver.length!==65||receiver[0]!==4||auth.length!==16)throw Error('invalid_push_keys');
 const pair=options?.keyPair||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const sender=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));const ua=await crypto.subtle.importKey('raw',buffer(receiver),{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:ua},pair.privateKey,256));
 const prkKey=await hmac(auth,shared);const ikm=await hmac(prkKey,join(encoder.encode('WebPush: info\0'),receiver,sender,new Uint8Array([1])));
 const salt=options?.salt||crypto.getRandomValues(new Uint8Array(16));if(salt.length!==16)throw Error('invalid_push_salt');
 const prk=await hmac(salt,ikm),cek=(await hmac(prk,join(encoder.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16),nonce=(await hmac(prk,join(encoder.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const key=await crypto.subtle.importKey('raw',buffer(cek),'AES-GCM',false,['encrypt']);const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(nonce)},key,buffer(join(payload,new Uint8Array([2])))));
 const header=new Uint8Array(5);new DataView(header.buffer).setUint32(0,4096);header[4]=sender.length;return join(salt,header,sender,encrypted);
}
export async function sendWebPush(subscription:{endpoint:string;p256dh:string;auth:string},payload:unknown){
 if(!isPushEndpoint(subscription.endpoint))throw Error('invalid_push_endpoint');const config=pushConfiguration();if(!config)throw Error('push_not_configured');
 const pub=decode64(config.publicKey);const key=await importJWK({kty:'EC',crv:'P-256',x:encode64(pub.slice(1,33)),y:encode64(pub.slice(33,65)),d:config.privateKey},'ES256');
 const token=await new SignJWT({aud:new URL(subscription.endpoint).origin,sub:config.subject}).setProtectedHeader({typ:'JWT',alg:'ES256'}).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+12*3600).sign(key);
 const body=await encryptWebPush(encoder.encode(JSON.stringify(payload)),subscription);
 const response=await fetch(subscription.endpoint,{method:'POST',headers:{Authorization:'vapid t='+token+', k='+config.publicKey,'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm',TTL:'3600',Urgency:'normal'},body:buffer(body),redirect:'error',signal:AbortSignal.timeout(10000)});
 await response.body?.cancel();return response.status;
}
