'use server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/get-user';
import {createClient} from '@/lib/supabase/server';
import {can} from '@/lib/permissions';
import {revalidatePath} from 'next/cache';
const schema=z.object({course_id:z.string().uuid(),summary_fr:z.string().trim().max(12000),summary_ht:z.string().trim().max(12000),enabled:z.boolean(),web_search_enabled:z.boolean()}).refine(v=>v.summary_fr.length>=80||v.summary_ht.length>=80);
export async function saveCourseAiContextAction(input:unknown){
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role))return{success:false,error:'forbidden'};
 const parsed=schema.safeParse(input);if(!parsed.success)return{success:false,error:'invalid_summary'};
 const db=await createClient();const {data:course,error}=await db.from('courses').select('instructor_id').eq('id',parsed.data.course_id).single();
 if(error||!course||!can(user,'course.manage',course))return{success:false,error:'forbidden'};
 const result=await db.from('course_ai_context').upsert({...parsed.data,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'course_id'}).select('course_id').single();
 if(result.error||!result.data)return{success:false,error:'unavailable'};revalidatePath('/[locale]/admin/assistant-ia','page');return{success:true};
}
