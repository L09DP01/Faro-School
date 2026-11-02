import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {createClient} from '@/lib/supabase/server';
import {BunnyStreamProvider} from '@/lib/video/bunny-stream';
export const dynamic='force-dynamic';
const schema=z.object({title:z.string().trim().min(1).max(200),courseId:z.string().uuid().optional()});
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){try{
 const user=await getCurrentUser();if(!user)return json({error:'unauthorized'},401);if(!can(user,'course.manage'))return json({error:'forbidden'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'forbidden'},403);
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({error:'invalid_request'},400);
 if(parsed.data.courseId){const db=await createClient();const {data,error}=await db.from('courses').select('instructor_id').eq('id',parsed.data.courseId).single();if(error||!data||!can(user,'course.manage',data))return json({error:'forbidden'},403);}
 if(!process.env.BUNNY_STREAM_API_KEY||!/^\d+$/.test(process.env.BUNNY_STREAM_LIBRARY_ID||''))return json({error:'video_not_configured'},503);
 return json(await new BunnyStreamProvider().createDirectUpload(parsed.data.title));
}catch{return json({error:'upload_unavailable'},502);}}
