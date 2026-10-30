import { getAdminSupabase } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/webhooks/security";
import {EMAIL_TIMES} from "@/lib/email/templates";
export const VERIFICATION_MINUTES=EMAIL_TIMES.verificationMinutes;
export const RESET_HOURS=EMAIL_TIMES.resetHours;
export const INVITATION_HOURS=EMAIL_TIMES.invitationHours;
export function randomCode():string {
 const bytes=new Uint32Array(1),range=900000,limit=Math.floor(4294967296/range)*range;
 do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
 return String(100000+bytes[0]%range);
}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");}
export type VerifyResult={success:true;email:string;userId:string}|{success:false;reason:"invalid"|"expired"|"max_attempts"|"already_used"|"not_found"};
export async function createEmailVerificationToken(email:string){
 const code=randomCode(),token=randomToken();
 const {error}=await getAdminSupabase().rpc("create_verification_token",{p_email:email.trim().toLowerCase(),p_code_hash:await sha256(code),p_token_hash:await sha256(token),p_expires:new Date(Date.now()+VERIFICATION_MINUTES*60000).toISOString()});
 if(error)throw new Error("token_creation_unavailable");return{code,token};
}
export async function verifyEmailCode(email:string,code:string):Promise<VerifyResult>{
 const{data,error}=await getAdminSupabase().rpc("consume_verification_token",{p_email:email.trim().toLowerCase(),p_code_hash:await sha256(code.trim())});
 if(error||!data)throw new Error("verification_unavailable");return data;
}
export async function verifyEmailLinkToken(token:string):Promise<VerifyResult>{
 const{data,error}=await getAdminSupabase().rpc("consume_verification_token",{p_token_hash:await sha256(token.trim())});
 if(error||!data)throw new Error("verification_unavailable");return data;
}
export async function createPasswordResetToken(userId:string,expiresInHours:number=RESET_HOURS){
 const token=randomToken();const{error}=await getAdminSupabase().rpc("create_reset_token",{p_user:userId,p_hash:await sha256(token),p_expires:new Date(Date.now()+expiresInHours*3600000).toISOString()});
 if(error)throw new Error("reset_creation_unavailable");return token;
}
export async function verifyAndConsumePasswordResetToken(token:string):Promise<{success:boolean;userId?:string;reason?:string}>{
 const{data,error}=await getAdminSupabase().rpc("consume_reset_token",{p_hash:await sha256(token.trim())});
 if(error||!data)throw new Error("reset_unavailable");return data;
}
