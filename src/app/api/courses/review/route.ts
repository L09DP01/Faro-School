import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {createClient} from '@/lib/supabase/server';
import {checkStoredProfanity} from '@/lib/community/stored-word-filter';
export async function POST(req:Request){
 try{
  const user=await getCurrentUser();if(!user)return Response.json({error:'unauthorized'},{status:401});
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'forbidden'},{status:403});
  const parsed=z.object({courseId:z.string().uuid(),rating:z.number().int().min(1).max(5),comment:z.string().trim().min(5).max(2000)}).safeParse(await req.json());
  if(!parsed.success)return Response.json({error:'invalid_review'},{status:400});
  if((await checkStoredProfanity(parsed.data.comment)).blocked)return Response.json({error:'blocked'},{status:400});
  const db=await createClient();const {error}=await db.rpc('save_course_review',{p_course:parsed.data.courseId,p_rating:parsed.data.rating,p_comment:parsed.data.comment});
  if(error)return Response.json({error:'review_unavailable'},{status:403});
  return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'review_unavailable'},{status:503});}
}
