import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicCertificate, type Certificate } from "./shared";
export async function verifyPublicCertificate(number:string,ip:string) {
 const db=createAdminClient();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip)))).map(b=>b.toString(16).padStart(2,"0")).join("");
 const limit=await db.rpc("certificate_verification_limit",{p_identifier:`certificate:${hash}`});
 if(limit.error)throw new Error("unavailable");
 if(limit.data!==true)throw new Error("rate_limit");
 if(!/^FARO-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(number))return publicCertificate(null);
 const {data,error}=await db.from("certificates").select("student_name,course_title,issued_at,instructor_name,revoked_at").eq("certificate_number",number).maybeSingle();
 if(error)throw new Error("unavailable");
 return publicCertificate(data as Certificate|null);
}
