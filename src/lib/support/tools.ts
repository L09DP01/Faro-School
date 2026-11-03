import 'server-only';
import {z} from 'zod';import {getCurrentUser} from '@/lib/auth/get-user';import{createClient}from'@/lib/supabase/server';import{toolNames,type ToolName}from'./types';
const input=z.object({courseSlug:z.string().regex(/^[a-z0-9-]{1,160}$/).optional()}).strict();
/** Read-only tools. Identity is never an argument controlled by a model. */
export async function runSupportTool(conversationId:string,name:ToolName,args:unknown={}){
 if(!toolNames.includes(name))throw Error('unknown_tool');const options=input.parse(args);
 const user=await getCurrentUser();if(!user?.emailVerified)throw Error('forbidden');const db=await createClient();
 const {data:conversation,error:accessError}=await db.from('conversations').select('id,student_id,course_id').eq('id',conversationId).eq('student_id',user.id).single();if(accessError||!conversation||conversation.course_id)throw Error('forbidden');
 if(name==='get_my_profile')return{available:true,data:{role:user.role,emailVerified:!!user.emailVerified,locale:user.locale}};
 let query:any;
 if(name==='get_available_courses'){query=db.from('courses').select('id,slug,title_fr,title_ht,description_fr,description_ht,price_htg,certificate_enabled,certificate_min_progress,instructor_id,options').eq('status','published');if(options.courseSlug)query=query.eq('slug',options.courseSlug);}
 else if(name==='get_my_enrollments'||name==='get_my_course_access')query=db.from('enrollments').select('course_id,revoked_at,courses(id,slug,title_fr,title_ht,status)').eq('user_id',user.id);
 else if(name==='get_my_orders'||name==='get_my_payment_status')query=db.from('orders').select('reference,course_id,status,created_at,courses(title_fr,title_ht,slug),payments(provider,status)').eq('user_id',user.id).order('created_at',{ascending:false});
 else if(name==='get_my_certificates')query=db.from('certificates').select('certificate_number,course_title,issued_at,revoked_at').eq('user_id',user.id).order('issued_at',{ascending:false});
 else if(name==='get_my_learning_progress')query=db.from('lesson_progress').select('lesson_id,completed_at,last_position_sec,lessons(title_fr,title_ht,modules(course_id))').eq('user_id',user.id);
 else query=db.from('conversations').select('id,status,assistance_mode').eq('student_id',user.id).is('course_id',null);
 const {data,error}=await query.limit(101);if(error)return{available:false,data:null};let rows=(data||[]).slice(0,100);if(name==='get_available_courses'&&rows.length){const {data:facts,error:factError}=await db.rpc('course_public_facts',{p_ids:rows.map((c:any)=>c.id)});if(!factError&&Array.isArray(facts))rows=rows.map((c:any)=>({...c,publicInstructor:facts.find((f:any)=>f.courseId===c.id)?.instructor?.fullName}));}return{available:true,data:rows,truncated:(data||[]).length>100};
}
