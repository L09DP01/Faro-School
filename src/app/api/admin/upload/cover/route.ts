import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {coverStorage, validCoverBytes} from '@/lib/video/course-cover';
export const dynamic='force-dynamic';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  try{
    const user=await getCurrentUser();
    if(!user||!can(user,'course.manage'))return reply({error:'forbidden'},403);
    if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'forbidden'},403);
    if(Number(request.headers.get('content-length'))>3*1024*1024+65536)return reply({error:'invalid_image'},413);
    const file=(await request.formData()).get('file');
    if(!(file instanceof File)||!file.size||file.size>3*1024*1024)return reply({error:'invalid_image'},400);
    const bytes=new Uint8Array(await file.arrayBuffer());
    const extension=validCoverBytes(bytes,file.type);
    if(!extension)return reply({error:'invalid_image'},400);
    const storage=coverStorage();
    if(!storage)return reply({error:'storage_not_configured'},503);
    const name=`${crypto.randomUUID()}.${extension}`;
    const response=await fetch(`${storage.url}/${name}`,{method:'PUT',headers:{AccessKey:storage.key,'Content-Type':file.type},body:bytes,signal:AbortSignal.timeout(20000)});
    if(!response.ok)return reply({error:'cover_upload_failed'},502);
    return reply({success:true,url:`/api/covers/${name}`});
  }catch{return reply({error:'cover_upload_failed'},502);}
}
