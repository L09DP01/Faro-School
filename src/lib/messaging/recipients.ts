import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import type {CurrentUser} from '@/lib/auth/get-user';
import {z} from 'zod';
export class RecipientError extends Error { constructor(public code:'courseUnavailable'|'recipientUnavailable'|'forbidden'){super(code);} }
/** Recipient IDs are resolved here, never accepted from a student's browser. */
export async function resolveStudentRecipient(user:CurrentUser,courseId:string|null){
 if(user.role!=='student'||!user.emailVerified)throw new RecipientError('forbidden');
 const db=createAdminClient({timeoutMs:10000});
 const {data:actor,error:actorError}=await db.from('profiles').select('id,role,email_verified_at,banned_at').eq('id',user.id).single();
 if(actorError||actor?.role!=='student'||!actor.email_verified_at||actor.banned_at)throw new RecipientError('forbidden');
 let staffId:string|undefined,courseTitle:string|null=null;
 if(courseId){
  if(!z.string().uuid().safeParse(courseId).success)throw new RecipientError('courseUnavailable');
  const {data:enrollment,error}=await db.from('enrollments').select('id').eq('user_id',user.id).eq('course_id',courseId).is('revoked_at',null).limit(1).maybeSingle();
  if(error||!enrollment)throw new RecipientError('courseUnavailable');
  const {data:course,error:courseError}=await db.from('courses').select('instructor_id,title_fr,title_ht').eq('id',courseId).single();
  if(courseError||!course?.instructor_id)throw new RecipientError('recipientUnavailable');
  staffId=course.instructor_id;courseTitle=user.locale==='ht'?(course.title_ht||course.title_fr):course.title_fr||course.title_ht;
 }
 let query=db.from('profiles').select('id,full_name,display_name,role,email_verified_at,banned_at').is('banned_at',null).not('email_verified_at','is',null);
 query=staffId?query.eq('id',staffId):query.eq('role','admin').order('created_at',{ascending:true}).limit(1);
 const {data:staff,error}=await query.maybeSingle();
 if(error||!staff||!['admin','instructor'].includes(staff.role)||(!courseId&&staff.role!=='admin'))throw new RecipientError('recipientUnavailable');
 return {staffId:staff.id as string,staffName:(staff.full_name||staff.display_name) as string,staffRole:staff.role as 'admin'|'instructor',courseTitle};
}
