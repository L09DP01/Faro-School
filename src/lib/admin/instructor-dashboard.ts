import { createClient } from "@/lib/supabase/server";

export interface InstructorKpiData {
  studentsCount: number;
  averageProgressPercent: number;
  completionRatePercent: number;
  unreadConversationsCount: number;
  escalationsWaitingCount: number;
  coursesCount: number;
  publishedCoursesCount: number;
}

export interface StudentActivityItem {
  id: string;
  studentName: string;
  courseTitle: string;
  actionType: "lesson_completed" | "certificate_earned" | "new_message" | "enrollment";
  detail: string;
  timestamp: string;
}

export interface InstructorDashboardResult {
  kpis: InstructorKpiData;
  recentActivity: StudentActivityItem[];
}

export async function getInstructorDashboardData(instructorId:string):Promise<InstructorDashboardResult>{
 const db=await createClient();const {data:courses,error}=await db.from('courses').select('id,title_fr,status').eq('instructor_id',instructorId);if(error)throw Error('dashboard_unavailable');
 const ids=(courses||[]).map(c=>c.id);const {getAdminStudentsList}=await import('./students');const {getStaffConversations}=await import('../messaging/data');const [students,conversations]=await Promise.all([getAdminStudentsList(instructorId),getStaffConversations(instructorId,false)]);
 const {data:certificates,error:certError}=ids.length?await db.from('certificates').select('user_id,course_id').in('course_id',ids).is('revoked_at',null):{data:[],error:null};if(certError)throw Error('dashboard_unavailable');
 const {count:escalations,error:escalationError}=await db.from('escalations').select('id,conversations!inner(staff_id)',{count:'exact',head:true}).eq('conversations.staff_id',instructorId).is('resolved_at',null);if(escalationError)throw Error('dashboard_unavailable');
 const {count:unread,error:unreadError}=await db.from('messages').select('conversation_id,conversations!inner(staff_id)',{count:'exact',head:true}).eq('conversations.staff_id',instructorId).eq('sender_type','student').is('read_at',null);if(unreadError)throw Error('dashboard_unavailable');
 const enrollmentCount=students.reduce((sum,s)=>sum+s.enrollments.length,0);
 return{kpis:{studentsCount:students.length,averageProgressPercent:students.length?Math.round(students.reduce((sum,s)=>sum+(s.progressPercent||0),0)/students.length):0,completionRatePercent:enrollmentCount?Math.round((certificates||[]).length/enrollmentCount*100):0,unreadConversationsCount:unread||0,escalationsWaitingCount:escalations||0,coursesCount:ids.length,publishedCoursesCount:(courses||[]).filter(c=>c.status==='published').length},recentActivity:conversations.slice(0,10).map(c=>({id:c.id,studentName:c.studentName,courseTitle:c.courseTitle||'',actionType:'new_message',detail:c.subject,timestamp:c.lastMessageAt}))};
}
