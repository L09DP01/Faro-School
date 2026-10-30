'use server';
import {getCurrentUser} from '@/lib/auth/get-user';
import {createClient} from '@/lib/supabase/server';
import {resolveStudentRecipient,RecipientError} from '@/lib/messaging/recipients';

export async function openStaffConversationAction(courseId:string|null,locale:string='fr'){
 try{
  const user=await getCurrentUser();if(!user)return{success:false,error:'forbidden'};
  const recipient=await resolveStudentRecipient(user,courseId),db=await createClient();
  let query=db.from('conversations').select('id').eq('student_id',user.id).eq('staff_id',recipient.staffId).neq('status','closed');
  query=courseId?query.eq('course_id',courseId):query.is('course_id',null);
  const {data:existing,error:lookupError}=await query.order('created_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if(lookupError)throw new Error('unavailable');
  if(existing)return{success:true,data:{conversationId:existing.id as string}};
  const {data,error}=await db.from('conversations').insert({student_id:user.id,staff_id:recipient.staffId,course_id:courseId,subject:courseId?recipient.courseTitle:(locale==='ht'?'Kontakte direksyon an':'Contacter la direction'),status:'open'}).select('id').abortSignal(AbortSignal.timeout(10000)).single();
  if(error||!data)throw new Error('unavailable');
  return{success:true,data:{conversationId:data.id as string}};
 }catch(error){return{success:false,error:error instanceof RecipientError?error.code:'unavailable'};}
}

export async function markSystemNotificationsReadAction(){
 const user=await getCurrentUser();if(!user)return{success:false};
 const db=await createClient();const {error}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);
 return{success:!error};
}
