import {certificateAdminError} from "@/lib/certificates/http";
import { certificateUser } from "@/lib/certificates/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { can } from "@/lib/permissions";
import { PDFDocument } from "pdf-lib";
export async function POST(req:Request) {
 try {
  const user=await certificateUser();if(!can(user,"certificates.manage"))return Response.json({error:"forbidden"},{status:403});
  if(req.headers.get("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return Response.json({error:"forbidden"},{status:403});
  if(Number(req.headers.get("content-length"))>520000)return Response.json({error:"invalid_image"},{status:400});
  const file=(await req.formData()).get("file");
  if(!(file instanceof File)||file.type!=="image/png"||file.size>500*1024)return Response.json({error:"invalid_image"},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const png=[137,80,78,71,13,10,26,10];
  const view=new DataView(bytes.buffer);const colorType=bytes[25];
  if(bytes.length<33||!png.every((b,i)=>bytes[i]===b)||view.getUint32(16)>4096||view.getUint32(20)>4096||![4,6].includes(colorType))return Response.json({error:"invalid_image"},{status:400});
  try{const check=await PDFDocument.create();await check.embedPng(bytes);}catch{return Response.json({error:"invalid_image"},{status:400});}
  const zone=process.env.BUNNY_STORAGE_ZONE_NAME,key=process.env.BUNNY_STORAGE_API_KEY;
  if(!zone||!key)throw new Error("configuration");
  const path=`certificates/signatures/${crypto.randomUUID()}.png`;
  const response=await fetch(`https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${path}`,{method:"PUT",headers:{AccessKey:key,"Content-Type":"image/png"},body:bytes});
  if(!response.ok)throw new Error("upload");
  const {error}=await createAdminClient().from("certificate_settings").update({signature_image_path:path,updated_at:new Date().toISOString()}).eq("id",true);
  if(error)throw error;
  return Response.json({path},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return certificateAdminError(error);}
}
