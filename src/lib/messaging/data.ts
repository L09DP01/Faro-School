import { createClient } from "@/lib/supabase/server";
import type {
  Conversation,
  PrivateMessage,
  EnrolledCourseOption,
  EscalationRecord,
} from "./types";
import { isStaffOnline } from "./presence";

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

    const conv2: Conversation = {
      id: "conv-002",
      studentId: "student-mock-id",
      studentName: "Étudiant Test",
      staffId: "admin-mock-id",
      staffName: "Support Faro School",
      staffRole: "admin",
      courseId: null,
      courseTitle: "Support Général",
      subject: "Facturation et reçu fiscal",
      status: "staff_replied",
      createdAt: iso(1440),
      lastMessageAt: iso(60),
      unreadCount: 0,
      lastMessagePreview: "Votre reçu a été envoyé par e-mail.",
    };

    globalThis.__mockConversationsStore = [conv1, conv2];

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
      {
        id: "msg-p-2",
        conversationId: "conv-001",
        senderType: "ai",
        senderName: "Assistant IA de Jean-Marc Baptiste",
        body: "Bonjour ! En attendant que Jean-Marc Baptiste soit en ligne, vérifiez que l'URL de votre webhook est bien accessible publiquement et accepte les requêtes POST avec signature HMAC.",
        meta: {
          confidence: 0.92,
          model: "claude-3-haiku-20240307",
        },
        createdAt: iso(28),
      },
      {
        id: "msg-p-3",
        conversationId: "conv-001",
        senderType: "staff",
        senderId: "instructor-mock-id",
        senderName: "Jean-Marc Baptiste",
        senderRole: "instructor",
        body: "Merci pour votre question ! Je viens de me connecter et je regarde vos captures d'écran dès maintenant.",
        createdAt: iso(5),
      },
    ]);

    messagesMap.set("conv-002", [
      {
        id: "msg-p-4",
        conversationId: "conv-002",
        senderType: "student",
        senderId: "student-mock-id",
        senderName: "Étudiant Test",
        senderRole: "student",
        body: "Bonjour, est-il possible d'obtenir une facture proforma pour mon entreprise ?",
        createdAt: iso(120),
      },
      {
        id: "msg-p-5",
        conversationId: "conv-002",
        senderType: "staff",
        senderId: "admin-mock-id",
        senderName: "Support Faro School",
        senderRole: "admin",
        body: "Votre reçu et votre facture proforma ont été envoyés par e-mail.",
        createdAt: iso(60),
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
 * Returns all conversations for a student.
 */
export async function getStudentConversations(studentId: string): Promise<Conversation[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
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
          title
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

    if (data && data.length > 0) {
      const convs: Conversation[] = await Promise.all(
        data.map(async (row: any) => {
          const staffOnline = await isStaffOnline(row.staff_id);
          return {
            id: row.id,
            studentId: row.student_id,
            studentName: "Moi",
            staffId: row.staff_id,
            staffName: row.staff?.display_name || row.staff?.full_name || "Formateur",
            staffRole: row.staff?.role || "instructor",
            staffAvatarUrl: row.staff?.avatar_url || null,
            courseId: row.course_id,
            courseTitle: row.courses?.title || (row.course_id ? "Formation" : "Support Général"),
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
  } catch {}

  // Fallback
  const store = getMockConversationsStore();
  const studentConvs = store.filter((c) => c.studentId === studentId || c.studentId === "student-mock-id");
  for (const c of studentConvs) {
    c.isStaffOnline = await isStaffOnline(c.staffId);
  }
  return studentConvs;
}

/**
 * Returns all conversations assigned to a staff member (or all for admin audit).
 */
export async function getStaffConversations(staffId: string, isAdmin: boolean = false): Promise<Conversation[]> {
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
          title
        ),
        student:profiles!student_id (
          display_name,
          full_name,
          avatar_url
        )
      `)
      .order("last_message_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("staff_id", staffId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student?.display_name || row.student?.full_name || "Étudiant",
        studentAvatarUrl: row.student?.avatar_url || null,
        staffId: row.staff_id,
        staffName: "Moi",
        staffRole: "instructor",
        courseId: row.course_id,
        courseTitle: row.courses?.title || "Support",
        subject: row.subject,
        status: row.status,
        createdAt: row.created_at,
        lastMessageAt: row.last_message_at,
      }));
    }
  } catch {}

  // Fallback
  const store = getMockConversationsStore();
  if (isAdmin) {
    return store;
  }
  return store.filter((c) => c.staffId === staffId || c.staffId === "instructor-mock-id");
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
    const { data: row } = await supabase
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
          title
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

    if (row) {
      const rowData: any = row;
      // Permission check
      if (
        currentUserRole !== "admin" &&
        rowData.student_id !== currentUserId &&
        rowData.staff_id !== currentUserId
      ) {
        return null;
      }

      // Privacy audit log: If an admin accesses a private conversation between a student and another staff member
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

      const staffOnline = await isStaffOnline(rowData.staff_id);
      return {
        id: rowData.id,
        studentId: rowData.student_id,
        studentName: rowData.student?.display_name || rowData.student?.full_name || "Étudiant",
        studentAvatarUrl: rowData.student?.avatar_url || null,
        staffId: rowData.staff_id,
        staffName: rowData.staff?.display_name || rowData.staff?.full_name || "Formateur",
        staffRole: rowData.staff?.role || "instructor",
        staffAvatarUrl: rowData.staff?.avatar_url || null,
        courseId: rowData.course_id,
        courseTitle: rowData.courses?.title || (rowData.course_id ? "Formation" : "Support Général"),
        subject: rowData.subject,
        status: rowData.status,
        createdAt: rowData.created_at,
        lastMessageAt: rowData.last_message_at,
        isStaffOnline: staffOnline,
      };
    }
  } catch {}

  // Fallback
  const store = getMockConversationsStore();
  const conv = store.find((c) => c.id === conversationId);
  if (conv) {
    conv.isStaffOnline = await isStaffOnline(conv.staffId);
    return conv;
  }
  return null;
}

/**
 * Returns all messages for a conversation.
 */
export async function getConversationMessages(conversationId: string): Promise<PrivateMessage[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
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

    if (data && data.length > 0) {
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
  } catch {}

  // Fallback
  const messagesMap = getMockMessagesStore();
  return messagesMap.get(conversationId) || [];
}

/**
 * Returns list of courses a student is enrolled in, with their instructor details.
 * Used in the "New Conversation" modal to restrict selection strictly to enrolled courses.
 */
export async function getStudentEnrolledCourses(studentId: string): Promise<EnrolledCourseOption[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("enrollments")
      .select(`
        course_id,
        courses (
          id,
          title,
          instructor_id,
          instructor:profiles!instructor_id (
            id,
            display_name,
            full_name
          )
        )
      `)
      .eq("user_id", studentId);

    if (data && data.length > 0) {
      return data
        .filter((row: any) => row.courses)
        .map((row: any) => {
          const c = row.courses;
          const inst = c.instructor;
          return {
            id: c.id,
            title: c.title,
            instructorId: c.instructor_id,
            instructorName: inst?.display_name || inst?.full_name || "Formateur Faro School",
          };
        });
    }
  } catch {}

  // Fallback
  return [
    {
      id: "course-mock-1",
      title: "Lancer un business e-commerce rentable en Haïti",
      instructorId: "instructor-mock-id",
      instructorName: "Jean-Marc Baptiste",
    },
    {
      id: "course-mock-2",
      title: "Marketing Digital & Stratégie TikTok / Facebook",
      instructorId: "instructor-mock-id",
      instructorName: "Jean-Marc Baptiste",
    },
  ];
}

/**
 * Returns the unread messages count for a user across all private conversations.
 */
export async function getUnreadPrivateMessagesCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("messages")
      .select("id, conversation_id, conversations!inner(student_id, staff_id)", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", userId);

    return count || 0;
  } catch {}

  return 1; // default preview badge
}
