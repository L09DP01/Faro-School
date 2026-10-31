import {createClient} from '@/lib/supabase/server';
export async function courseProgress(courseIds:string[],userIds:string[]){
 const totals=new Map<string,number>(),done=new Map<string,number>();if(!courseIds.length||!userIds.length)return{totals,done};const db=await createClient();
 const [ls,ps]=await Promise.all([db.from('lessons').select('id,modules!inner(course_id)').eq('is_published',true).in('modules.course_id',courseIds),db.from('lesson_progress').select('user_id,lesson_id,completed_at').in('user_id',userIds).not('completed_at','is',null)]);
 if(ls.error||ps.error)throw Error('progress_unavailable');const courseByLesson=new Map<string,string>();for(const l of ls.data||[]){const m=l.modules as unknown as {course_id:string};courseByLesson.set(l.id,m.course_id);totals.set(m.course_id,(totals.get(m.course_id)||0)+1);}
 for(const p of ps.data||[]){const course=courseByLesson.get(p.lesson_id);if(course){const key=p.user_id+':'+course;done.set(key,(done.get(key)||0)+1);}}return{totals,done};
}
