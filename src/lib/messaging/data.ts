import {createAdminClient} from "@/lib/supabase/admin";
import {cache} from "react";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import type {
  Conversation,
  PrivateMessage,
  EnrolledCourseOption,
  EscalationRecord,
} from "./types";
import { isStaffOnline } from "./presence";

// Only invoked with staff IDs from a conversation already visible through RLS.
// Return display fields only: never expose staff email, phone or credentials.
const visibleStaffDisplay=cache(async(staffId:string)=>{
 const {data,error}=await createAdminClient({timeoutMs:10000}).from('profiles').select('id,full_name,display_name,role,avatar_url').eq('id',staffId).in('role',['admin','instructor']).maybeSingle();
 return error?null:data;
});

declare global {
  // eslint-disable-next-line no-var
  var __mockConversationsStore: Conversation[] | undefined;
  // eslint-disable-next-line no-var
  var __mockPrivateMessagesStore: Map<string, PrivateMessage[]> | undefined;
  // eslint-disable-next-line no-var
  var __mockEscalationsStore: EscalationRecord[] | undefined;
}

function initializeMockMessaging(): {
  conversations: Conversation[];
  messages: Map<string, PrivateMessage[]>;
  escalations: EscalationRecord[];
} {
  if (!globalThis.__mockConversationsStore) {
    const now = new Date();
    const iso = (minsAgo: number) =>
      new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();

    const conv1: Conversation = {
      id: "conv-001",
      studentId: "student-mock-id",
      studentName: "Étudiant Test",
      staffId: "instructor-mock-id",
      staffName: "Jean-Marc Baptiste",
      staffRole: "instructor",
      courseId: "course-mock-1",
      courseTitle: "Lancer un business e-commerce rentable en Haïti",
      subject: "Question sur l'intégration MonCash",
      status: "open",
      createdAt: iso(120),
      lastMessageAt: iso(5),
      unreadCount: 1,
      lastMessagePreview: "Merci pour votre question ! Je regarde vos captures.",
    };

    globalThis.__mockConversationsStore = [conv1];
    const messagesMap = new Map<string, PrivateMessage[]>();
    messagesMap.set("conv-001", [
      {
        id: "msg-p-1",
        conversationId: "conv-001",
        senderType: "student",
        senderId: "student-mock-id",
        senderName: "Étudiant Test",
        senderRole: "student",
        body: "Bonjour formateur, je bloque sur la configuration du webhook MonCash dans le module 4.",
        createdAt: iso(30),
      },
    ]);

    globalThis.__mockPrivateMessagesStore = messagesMap;
    globalThis.__mockEscalationsStore = [];
  }

  return {
    conversations: globalThis.__mockConversationsStore,
    messages: globalThis.__mockPrivateMessagesStore!,
    escalations: globalThis.__mockEscalationsStore!,
  };
}

export function getMockConversationsStore(): Conversation[] {
  return initializeMockMessaging().conversations;
}

export function getMockMessagesStore(): Map<string, PrivateMessage[]> {
  return initializeMockMessaging().messages;
}

export function getMockEscalationsStore(): EscalationRecord[] {
  return initializeMockMessaging().escalations;
}

/**
 * Returns all conversations for a student from real database.
 * Never displays fake conversations in production.
 */
export async function getStudentConversations(studentId: string): Promise<Conversation[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        student_id,
        staff_id,
        course_id,
        subject,
        status,
        created_at,
        last_message_at,
        courses (
          id,
          title_fr,
          title_ht
        ),
        staff:profiles!staff_id (
          display_name,
          full_name,
          role,
          avatar_url
        )
      `)
      .eq("student_id", studentId)
      .order("last_message_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const convs: Conversation[] = await Promise.all(
        data.map(async (row: any) => {
          const staffOnline = await isStaffOnline(row.staff_id);
          if(!row.staff)row.staff=await visibleStaffDisplay(row.staff_id);
          const cTitle =
            row.courses?.title_fr ||
            row.courses?.title_ht ||
            (row.course_id ? "Formation" : "Support Général");

          return {
            id: row.id,
            studentId: row.student_id,
            studentName: "Moi",
            staffId: row.staff_id,
            staffName: row.staff?.full_name || row.staff?.display_name || "Formateur",
            staffRole: row.staff?.role || "instructor",
            staffAvatarUrl: row.staff?.avatar_url || null,
            courseId: row.course_id,
            courseTitle: cTitle,
            subject: row.subject,
            status: row.status,
            createdAt: row.created_at,
            lastMessageAt: row.last_message_at,
            isStaffOnline: staffOnline,
          };
        })
      );
      return convs;
    }

    if (!error && data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Messaging] Error fetching student conversations:", err);
  }

  // Fallback ONLY in demo mode
  if (isDemoMode()) {
    const store = getMockConversationsStore();
    const studentConvs = store.filter(
      (c) => c.studentId === studentId || c.studentId === "student-mock-id"
    );
    for (const c of studentConvs) {
      c.isStaffOnline = await isStaffOnline(c.staffId);
    }
    return studentConvs;
  }

  return [];
}

/**
 * Returns all conversations assigned to a staff member (or all for admin audit).
 */
export async function getStaffConversations(
  staffId: string,
  isAdmin: boolean = false,
  includeSupport: boolean = false
): Promise<Conversation[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("conversations")
      .select(`
        id,
        student_id,
        staff_id,
        course_id,
        subject,
        status,
        created_at,
        last_message_at,
        courses (
          id,
          title_fr,
          title_ht
        ),
        staff:profiles!staff_id (full_name, display_name, role),
        student:profiles!student_id (
          display_name,
          full_name,
          avatar_url
        )
      `)
      .order("last_message_at", { ascending: false });

    if (!isAdmin) {
      query = includeSupport ? query.or(`staff_id.eq.${staffId},course_id.is.null`) : query.eq("staff_id", staffId);
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student?.display_name || row.student?.full_name || "Étudiant",
        studentAvatarUrl: row.student?.avatar_url || null,
        staffId: row.staff_id,
        staffName: row.staff?.full_name || row.staff?.display_name || "Faro School",
        staffRole: row.staff?.role || (row.course_id ? "instructor" : "admin"),
        courseId: row.course_id,
        courseTitle:
          row.courses?.title_fr ||
          row.courses?.title_ht ||
          (row.course_id ? "Formation" : "Support Général"),
        subject: row.subject,
        status: row.status,
        createdAt: row.created_at,
        lastMessageAt: row.last_message_at,
      }));
    }

    if (!error && data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Messaging] Error fetching staff conversations:", err);
  }

  if (isDemoMode()) {
    const store = getMockConversationsStore();
    if (isAdmin) {
      return store;
    }
    return store.filter((c) => c.staffId === staffId || c.staffId === "instructor-mock-id");
  }

  return [];
}

/**
 * Returns a conversation by ID, validating authorization.
 */
export async function getConversationById(
  conversationId: string,
  currentUserId: string,
  currentUserRole: string
): Promise<Conversation | null> {
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("conversations")
      .select(`
        id,
        student_id,
        staff_id,
        course_id,
        subject,
        status,
        created_at,
        last_message_at,
        courses (
          id,
          title_fr,
          title_ht
        ),
        student:profiles!student_id (
          display_name,
          full_name,
          avatar_url
        ),
        staff:profiles!staff_id (
          display_name,
          full_name,
          role,
          avatar_url
        )
      `)
      .eq("id", conversationId)
      .single();

    if (!error && row) {
      const rowData: any = row;
      // Permission check
      if (
        currentUserRole !== "admin" &&
        rowData.student_id !== currentUserId &&
        rowData.staff_id !== currentUserId
      ) {
        return null;
      }

      // Privacy audit log: If an admin accesses a private conversation between student and staff
      if (
        currentUserRole === "admin" &&
        rowData.student_id !== currentUserId &&
        rowData.staff_id !== currentUserId
      ) {
        try {
          await supabase.from("admin_audit_logs").insert({
            admin_id: currentUserId,
            action: "admin_read_private_conversation",
            metadata: {
              conversation_id: conversationId,
              student_id: rowData.student_id,
              staff_id: rowData.staff_id,
              accessed_at: new Date().toISOString(),
            },
          });
        } catch {}
      }

      if(!rowData.staff)rowData.staff=await visibleStaffDisplay(rowData.staff_id);
      const staffOnline = await isStaffOnline(rowData.staff_id);
      const cTitle =
        rowData.courses?.title_fr ||
        rowData.courses?.title_ht ||
        (rowData.course_id ? "Formation" : "Support Général");

      return {
        id: rowData.id,
        studentId: rowData.student_id,
        studentName: rowData.student?.display_name || rowData.student?.full_name || "Étudiant",
        studentAvatarUrl: rowData.student?.avatar_url || null,
        staffId: rowData.staff_id,
        staffName: rowData.staff?.full_name || rowData.staff?.display_name || "Formateur",
        staffRole: rowData.staff?.role || "instructor",
        staffAvatarUrl: rowData.staff?.avatar_url || null,
        courseId: rowData.course_id,
        courseTitle: cTitle,
        subject: rowData.subject,
        status: rowData.status,
        createdAt: rowData.created_at,
        lastMessageAt: rowData.last_message_at,
        isStaffOnline: staffOnline,
      };
    }
  } catch (err) {
    console.error("[Messaging] Error fetching conversation by ID:", err);
  }

  if (isDemoMode()) {
    const store = getMockConversationsStore();
    const conv = store.find((c) => c.id === conversationId);
    if (conv) {
      conv.isStaffOnline = await isStaffOnline(conv.staffId);
      return conv;
    }
  }

  return null;
}

/**
 * Returns all messages for a conversation.
 */
export async function getConversationMessages(conversationId: string): Promise<PrivateMessage[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        conversation_id,
        sender_type,
        sender_id,
        body,
        meta,
        created_at,
        read_at,
        profiles (
          display_name,
          full_name,
          role,
          avatar_url
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        senderName: row.profiles?.display_name || row.profiles?.full_name,
        senderRole: row.profiles?.role,
        senderAvatarUrl: row.profiles?.avatar_url,
        body: row.body,
        meta: row.meta || {},
        createdAt: row.created_at,
        readAt: row.read_at,
      }));
    }

    if (!error && data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Messaging] Error fetching messages:", err);
  }

  if (isDemoMode()) {
    const messagesMap = getMockMessagesStore();
    return messagesMap.get(conversationId) || [];
  }

  return [];
}

/**
 * Returns list of courses a student is enrolled in, with their instructor details.
 * Used in the "New Conversation" modal to restrict selection strictly to enrolled courses.
 */
export async function getStudentEnrolledCourses(studentId: string): Promise<EnrolledCourseOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        course_id,
        courses (
          id,
          title_fr,
          title_ht,
          instructor_id,
          instructor:profiles!instructor_id (
            id,
            display_name,
            full_name
          )
        )
      `)
      .eq("user_id", studentId).is("revoked_at",null);

    if (!error && data && data.length > 0) {
      return data
        .filter((row: any) => row.courses?.instructor_id && row.courses?.instructor)
        .map((row: any) => {
          const c = row.courses;
          const inst = c.instructor;
          return {
            id: c.id,
            title: c.title_fr || c.title_ht || "Formation",
            instructorId: c.instructor_id,
            instructorName: inst?.full_name || inst?.display_name || "Formateur Faro School",
          };
        });
    }

    if (!error && data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Messaging] Error fetching student enrolled courses:", err);
  }

  if (isDemoMode()) {
    return [
      {
        id: "course-mock-1",
        title: "Lancer un business e-commerce rentable en Haïti",
        instructorId: "instructor-mock-id",
        instructorName: "Jean-Marc Baptiste",
      },
    ];
  }

  return [];
}

/**
 * Returns the unread messages count for a user across all private conversations.
 */
export async function getUnreadPrivateMessagesCount(userId: string): Promise<number> {
  const db=await createClient();const {data,error}=await db.rpc('private_unread_count');if(error)throw Error('unread_unavailable');return Number(data||0);
}

/** Own system inbox, backed by the existing notification table and RLS. */
export async function getStudentSystemNotifications(userId:string){
 const db=await createClient();const {data,error}=await db.from('notifications').select('id,type,payload,read_at,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50);
 if(error)return[];
 return(data??[]).map(row=>({id:row.id as string,type:row.type as string,createdAt:row.created_at as string,readAt:row.read_at as string|null,senderName:typeof row.payload?.senderName==='string'?row.payload.senderName:null,courseTitle:typeof row.payload?.courseTitle==='string'?row.payload.courseTitle:null,message:typeof row.payload?.messageSnippet==='string'?row.payload.messageSnippet:null,conversationId:typeof row.payload?.conversationId==='string'?row.payload.conversationId:null}));
}
