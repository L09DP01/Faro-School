import { createAdminClient } from "@/lib/supabase/admin";
import { certificateUser } from "@/lib/certificates/service";
import { canDownloadCertificate, verificationUrl, type Certificate } from "@/lib/certificates/shared";
import { loadCertificateAssets,renderCertificatePdf } from "@/lib/certificates/pdf";
import { can } from "@/lib/permissions";
export const runtime = "nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 const noStore={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
 try {
  const user=await certificateUser();const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:404,headers:noStore});
  const {data,error}=await createAdminClient().from("certificates").select("*,courses(slug)").eq("id",id).maybeSingle();
  const cert=data as Certificate|null;
  if(error||!cert||!canDownloadCertificate(user,cert)||(user.id!==cert.user_id&&!can(user,"certificates.manage")))return new Response(null,{status:404,headers:noStore});
  const base=process.env.NEXT_PUBLIC_APP_URL;
  if(!base)throw new Error("app_url");
  const bytes=await renderCertificatePdf(cert,verificationUrl(base,cert.certificate_number),await loadCertificateAssets(base,cert.signature_image_path));
  const slug=(cert.courses?.slug??"formation").replace(/[^a-z0-9-]/gi,"");
  return new Response(bytes.buffer as ArrayBuffer,{headers:{...noStore,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="Certificat-Faro-School-${slug}.pdf"`}});
 }catch(e){const denied=e instanceof Error&&e.message==="unauthorized";return Response.json({error:denied?"unauthorized":"unavailable"},{status:denied?401:503,headers:noStore});}
}
