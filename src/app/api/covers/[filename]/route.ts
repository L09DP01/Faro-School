import {coverStorage} from '@/lib/video/course-cover';
export async function GET(_request:Request,{params}:{params:Promise<{filename:string}>}){
  const {filename}=await params;
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(png|jpg|webp)$/.test(filename))return new Response(null,{status:404});
  const storage=coverStorage();if(!storage)return new Response(null,{status:503});
  try{
    const response=await fetch(`${storage.url}/${filename}`,{headers:{AccessKey:storage.key},signal:AbortSignal.timeout(15000)});
    if(!response.ok)return new Response(null,{status:response.status===404?404:502});
    const type=filename.endsWith('.png')?'image/png':filename.endsWith('.jpg')?'image/jpeg':'image/webp';
    return new Response(response.body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
  }catch{return new Response(null,{status:502});}
}
