import {certificateAdminError} from "@/lib/certificates/http";
import { certificateUser,issueCertificate } from "@/lib/certificates/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/permissions";
import { certificateNameSchema,csvCell,type Certificate } from "@/lib/certificates/shared";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request) {
 try {
  const user=await certificateUser(),db=createAdminClient();
  if(!can(user,"certificates.manage")&&user.role!=="instructor")return Response.json({error:"forbidden"},{status:403});
  const records:Array<Certificate&{courses:{slug:string;instructor_id:string}}>=[];
  for(let offset=0;;offset+=500){
   let query=db.from("certificates").select("*,courses!inner(slug,instructor_id)").order("issued_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+499);
   if(user.role==="instructor")query=query.eq("courses.instructor_id",user.id);
   const {data,error}=await query;if(error)throw error;
   records.push(...(data??[]));if(!data||data.length<500)break;
  }
  const certificates=records.filter(c=>can(user,"certificates.read",{instructor_id:c.courses.instructor_id}));
  const url=new URL(req.url);const term=(url.searchParams.get("q")??"").toLocaleLowerCase();const status=url.searchParams.get("status");
  const filtered=certificates.filter(c=>(!term||`${c.certificate_number} ${c.student_name} ${c.course_title}`.toLocaleLowerCase().includes(term))&&(!status||(status==="revoked"?!!c.revoked_at:!c.revoked_at)));
  if(url.searchParams.get("format")==="csv")return new Response("\uFEFF"+["number,student,course,issued_at,revoked_at",...filtered.map(c=>[c.certificate_number,c.student_name,c.course_title,c.issued_at,c.revoked_at].map(csvCell).join(","))].join("\r\n"),{headers:{"Cache-Control":"no-store","Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=certificats-faro.csv"}});
  const {data:settings,error:settingsError}=can(user,"certificates.manage")?await db.from("certificate_settings").select("signature_name,signature_title,signature_image_path").eq("id",true).single():{data:null,error:null};
  if(settingsError)throw new Error("unavailable");
  return Response.json({certificates:filtered,settings,canManage:can(user,"certificates.manage")},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return certificateAdminError(error);}
}
export async function POST(req:Request) {
 try {
  const user=await certificateUser();if(!can(user,"certificates.manage"))return Response.json({error:"forbidden"},{status:403});
  if(req.headers.get("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return Response.json({error:"forbidden"},{status:403});
  const body=z.discriminatedUnion("action",[
   z.object({action:z.literal("revoke"),id:z.string().uuid(),reason:z.string().trim().min(3).max(500)}),
   z.object({action:z.literal("reissue"),id:z.string().uuid(),courseId:z.string().uuid(),name:certificateNameSchema}),
   z.object({action:z.literal("settings"),signature_name:z.string().trim().max(100),signature_title:z.string().trim().max(100)})
  ]).parse(await req.json());
  const db=createAdminClient();
  if(body.action==="reissue")return Response.json(await issueCertificate(body.courseId,body.name,body.id),{headers:{"Cache-Control":"no-store"}});
  const result=body.action==="revoke"?await db.rpc("revoke_course_certificate",{p_actor:user.id,p_id:body.id,p_reason:body.reason}):await db.from("certificate_settings").update({signature_name:body.signature_name,signature_title:body.signature_title,updated_at:new Date().toISOString()}).eq("id",true);
  if(result.error)throw result.error;
  return Response.json({success:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return certificateAdminError(error);}
}
