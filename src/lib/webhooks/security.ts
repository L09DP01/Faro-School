// Cloudflare Workers: Web Crypto only, no Buffer or Node crypto.
export class WebhookError extends Error{constructor(public status:number,message:string){super(message);}}
export function webhookResponse(body:Record<string,unknown>,status=200){return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});}
export async function readWebhookBody(request:Request,maxBytes=65536){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")??""))throw new WebhookError(415,"unsupported_content_type");
 const size=request.headers.get("content-length");
 if(size&&(!/^\d+$/.test(size)||Number(size)>maxBytes))throw new WebhookError(413,"payload_too_large");
 const reader=request.body?.getReader();if(!reader)throw new WebhookError(400,"empty_body");
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();throw new WebhookError(413,"payload_too_large");}chunks.push(value);}}finally{reader.releaseLock();}
 const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}return body;
}
export function parseWebhook(body:Uint8Array):unknown{try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body));}catch{throw new WebhookError(400,"invalid_json");}}
export async function sha256(value:string|Uint8Array){const bytes=typeof value==="string"?new TextEncoder().encode(value):new Uint8Array(value);return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");}
export function recipientHash(email:string){return sha256(email.trim().toLowerCase());}
function base64(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
async function verifyHmac(keyBytes:Uint8Array,signature:Uint8Array,body:Uint8Array){
 const key=await crypto.subtle.importKey("raw",new Uint8Array(keyBytes),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,new Uint8Array(signature),new Uint8Array(body));
}
export async function verifyBunny(body:Uint8Array,headers:Headers,secret:string){
 if(headers.get("x-bunnystream-signature-version")!=="v1"||headers.get("x-bunnystream-signature-algorithm")!=="hmac-sha256")return false;
 const signature=headers.get("x-bunnystream-signature")??"";if(!/^[0-9a-f]{64}$/.test(signature))return false;
 return verifyHmac(new TextEncoder().encode(secret),Uint8Array.from(signature.match(/../g)!,h=>parseInt(h,16)),body);
}
export async function verifyResend(body:Uint8Array,headers:Headers,secret:string,now=Date.now()){
 const id=headers.get("svix-id")??"",timestamp=headers.get("svix-timestamp")??"",signatures=headers.get("svix-signature")??"";
 if(!/^[A-Za-z0-9_-]{1,256}$/.test(id)||!/^\d{1,12}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||signatures.length>4096)return false;
 const key=base64(secret.replace(/^whsec_/,""));if(key.length<16)throw new WebhookError(503,"webhook_not_configured");
 const prefix=new TextEncoder().encode(id+"."+timestamp+"."),signed=new Uint8Array(prefix.length+body.length);signed.set(prefix);signed.set(body,prefix.length);
 for(const entry of signatures.split(/\s+/)){const [version,signature]=entry.split(",");if(version!=="v1"||!signature)continue;try{if(await verifyHmac(key,base64(signature),signed))return true;}catch{/* An invalid signature candidate never authorizes the request. */}}
 return false;
}
export function webhookFailure(error:unknown){
 if(error instanceof WebhookError)return webhookResponse({error:error.message},error.status);
 // Never log provider payloads, recipients, subjects, credentials or signatures.
 console.error("[webhook] processing_unavailable");return webhookResponse({error:"processing_unavailable"},503);
}
