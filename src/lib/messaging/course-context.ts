import 'server-only';
import {createClient} from '@/lib/supabase/server';
export interface CourseAssistantContext{course_id:string;summary_fr:string;summary_ht:string;enabled:boolean;web_search_enabled:boolean;updated_at?:string;}
export interface AuthorCourse{id:string;title_fr:string;title_ht:string;status:string;context:CourseAssistantContext|null;}
export async function getAuthorCourseContexts(authorId:string){
 const db=await createClient();const {data:courses,error}=await db.from('courses').select('id,title_fr,title_ht,status').eq('instructor_id',authorId).order('created_at',{ascending:false});
 if(error)throw Error('courses_unavailable');if(!courses?.length)return{courses:[] as AuthorCourse[],unavailable:false};
 const contexts=await db.from('course_ai_context').select('course_id,summary_fr,summary_ht,enabled,web_search_enabled,updated_at').in('course_id',courses.map(c=>c.id));
 return{unavailable:!!contexts.error,courses:courses.map(c=>({...c,context:(contexts.data||[]).find(x=>x.course_id===c.id)||null})) as AuthorCourse[]};
}
