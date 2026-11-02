import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {createClient} from '@/lib/supabase/server';
import {z} from 'zod';
export async function POST(req:Request){
 try{
  const user=await getCurrentUser();if(!user||!can(user,'course.manage'))return Response.json({error:'forbidden'},{status:403});
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'forbidden'},{status:403});
  const result=z.object({fullName:z.string().trim().min(2).max(60),title:z.string().trim().max(120),bio:z.string().trim().max(3000),avatarUrl:z.string().max(2048).refine(v=>v===''||/^\/api\/covers\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v)||/^https:\/\/[^\s]+$/.test(v))}).safeParse(await req.json());
  if(!result.success)return Response.json({error:'invalid_profile'},{status:400});
  const db=await createClient();const {fullName,title,bio,avatarUrl}=result.data;const {error}=await db.rpc('save_public_author_profile',{p_full_name:fullName,p_title:title,p_bio:bio,p_avatar_url:avatarUrl});
  if(error)return Response.json({error:'profile_unavailable'},{status:503});
  return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'profile_unavailable'},{status:503});}
}
