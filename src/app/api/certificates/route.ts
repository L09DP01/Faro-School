import { NextResponse } from "next/server";
import { certificateUser, eligibility, issueCertificate } from "@/lib/certificates/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { certificateNameSchema } from "@/lib/certificates/shared";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET() {
 try {
  const user=await certificateUser(), db=createAdminClient();
  const [certs,enrolls]=await Promise.all([
   db.from("certificates").select("*,courses(slug,cover_url)").eq("user_id",user.id).order("issued_at",{ascending:false}),
   db.from("enrollments").select("course_id,courses(title_fr,cover_url)").eq("user_id",user.id).is("revoked_at",null)
  ]);
  if(certs.error||enrolls.error)throw new Error("unavailable");
  const available=await Promise.all((enrolls.data??[]).map(async e=>({course_id:e.course_id,course:e.courses,...await eligibility(user.id,e.course_id)})));
  return NextResponse.json({certificates:certs.data,available,fullName:user.fullName},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return certificateError(e);}
}
export async function POST(req:Request) {
 try {
  if(req.headers.get("origin") && req.headers.get("origin")!==new URL(req.url).origin)return NextResponse.json({error:"forbidden"},{status:403});
  const body=z.object({courseId:z.string().uuid(),name:certificateNameSchema}).parse(await req.json());
  return NextResponse.json(await issueCertificate(body.courseId,body.name),{headers:{"Cache-Control":"no-store"}});
 }catch(e){return certificateError(e);}
}
function certificateError(error:unknown){
 const msg=error instanceof Error?error.message:"unavailable";
 const key=error instanceof z.ZodError?"invalid_name":["unauthorized","forbidden","not_eligible"].includes(msg)?msg:"unavailable";
 return NextResponse.json({error:key},{status:key==="unauthorized"?401:key==="forbidden"?403:key==="invalid_name"?400:key==="not_eligible"?409:503,headers:{"Cache-Control":"no-store"}});
}
