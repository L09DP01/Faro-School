import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {checkLessonAccess} from '@/lib/video/access';
import {createAdminClient} from '@/lib/supabase/admin';
import {checkRateLimit} from '@/lib/security/rate-limit';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const questions=z.array(z.object({question:z.string().min(5).max(1000),choices:z.array(z.string().min(1).max(500)).length(4),correctIndex:z.number().int().min(0).max(3)})).min(1).max(20);
async function load(lessonId:string){
 const user=await getCurrentUser();if(!user||!z.string().uuid().safeParse(lessonId).success)return null;
 const access=await checkLessonAccess(lessonId,user.id);if(!access.canAccess)return null;
 const db=createAdminClient({timeoutMs:10000});const {data,error}=await db.from('lesson_quizzes').select('questions').eq('lesson_id',lessonId).maybeSingle();if(error)throw Error('unavailable');
 return{user,db,quiz:data?questions.parse(data.questions):null};
}
export async function GET(request:Request){try{const lessonId=new URL(request.url).searchParams.get('lessonId')||'';const context=await load(lessonId);if(!context)return reply({error:'not_found'},404);return reply({questions:context.quiz?.map(({question,choices})=>({question,choices}))||[]});}catch{return reply({error:'quiz_unavailable'},503);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'forbidden'},403);
 const body=z.object({lessonId:z.string().uuid(),answers:z.array(z.number().int().min(0).max(3)).min(1).max(20)}).parse(await request.json());const context=await load(body.lessonId);if(!context?.quiz)return reply({error:'not_found'},404);
 const limit=await checkRateLimit('lesson-quiz:'+context.user.id,20,60000);if(!limit.allowed)return reply({error:'rate_limit'},429);
 if(body.answers.length!==context.quiz.length)return reply({error:'invalid_answers'},400);
 const correct=context.quiz.map((q,i)=>q.correctIndex===body.answers[i]),score=Math.round(100*correct.filter(Boolean).length/correct.length);
 const {error}=await context.db.from('lesson_quiz_attempts').insert({lesson_id:body.lessonId,user_id:context.user.id,score,answers:body.answers});if(error)return reply({error:'score_unavailable'},503);
 return reply({score,correct});
 }catch{return reply({error:'invalid_or_unavailable'},400);}}
