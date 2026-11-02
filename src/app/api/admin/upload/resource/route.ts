import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {bunnyStorageConnection} from '@/lib/bunny-storage';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const user=await getCurrentUser();if(!user||!can(user,'course.manage'))return reply({error:'forbidden'},403);
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'forbidden'},403);
  if(Number(request.headers.get('content-length'))>10*1024*1024+65536)return reply({error:'file_too_large'},413);
  const file=(await request.formData()).get('file');if(!(file instanceof File)||file.size<5||file.size>10*1024*1024)return reply({error:'invalid_file'},400);
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return reply({error:'pdf_required'},400);
  const connection=bunnyStorageConnection();if(!connection)return reply({error:'storage_configuration'},503);
  const path=`lesson-resources/${user.id}/${crypto.randomUUID()}.pdf`;
  const result=await fetch(connection.url+'/'+path,{method:'PUT',headers:{AccessKey:connection.key,'Content-Type':'application/pdf'},body:bytes,signal:AbortSignal.timeout(45000)});
  if(!result.ok)return reply({error:'storage_unavailable'},503);
  return reply({name:file.name.replace(/[\r\n]/g,'').slice(0,180),fileUrl:path});
 }catch{return reply({error:'upload_unavailable'},503);}
}
