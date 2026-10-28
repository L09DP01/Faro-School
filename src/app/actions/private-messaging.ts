"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import { isStaffOnline, recordStaffHeartbeat, setStaffAvailability } from "@/lib/messaging/presence";
import { callAiAssistant } from "@/lib/messaging/ai-assistant";
import { sendEscalationEmail } from "@/lib/messaging/email";
import {
  getMockConversationsStore,
  getMockMessagesStore,
  getMockEscalationsStore,
} from "@/lib/messaging/data";
import type { Conversation, PrivateMessage, EscalationRecord } from "@/lib/messaging/types";
import { STUDENT_DM_ENABLED } from "@/config/messaging";
import { checkMessageModeration } from "@/lib/moderation";
import { recordModerationFlag } from "@/lib/moderation/flag-service";

export type MessagingActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Creates a new conversation and handles initial message dispatch.
 * Instructors are STRICTLY forbidden from initiating conversations with students.
 * Admins can initiate with any student.
 * Students can initiate with staff, or with other students if STUDENT_DM_ENABLED is true.
 */
export async function createConversationAction(
  courseId: string | null,
  subject: string,
  firstMessage: string,
  recipientUserId?: string | null,
  locale: string = "fr"
): Promise<MessagingActionResult<{ conversationId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Vous devez être connecté pour envoyer un message." };
    }

    // Hard Rule: Instructors CANNOT initiate conversations with students!
    if (user.role === "instructor") {
      return {
        success: false,
        error: "Les formateurs ne peuvent pas initier une conversation privée avec un élève.",
      };
    }

    const trimmedSubject = subject?.trim();
    const trimmedBody = firstMessage?.trim();

    if (!trimmedSubject) {
      return { success: false, error: "Veuillez renseigner un sujet." };
    }
    if (!trimmedBody) {
      return { success: false, error: "Le message ne peut pas être vide." };
    }

    // Moderation check on first message for non-admins
    if (user.role !== "admin") {
      const modCheck = checkMessageModeration(trimmedBody);
      if (modCheck.blocked) {
        await recordModerationFlag({
          userId: user.id,
          reason: modCheck.reason || "offplatform",
          excerpt: modCheck.maskedExcerpt || "Contenu bloqué",
        });
        return {
          success: false,
          error:
            locale === "ht"
              ? modCheck.noticeHt || "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye."
              : modCheck.noticeFr || "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
        };
      }
    }

    // Check if user account is banned
    try {
      const supabase = await createClient();
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("banned_at")
        .eq("id", user.id)
        .single();

      if (userProfile?.banned_at) {
        return {
          success: false,
          error: "Votre compte est suspendu. Vous ne pouvez pas envoyer de messages.",
        };
      }
    } catch {}

    let studentId = user.id;
    let staffId: string | null = null;
    let staffName = "Support Faro School";
    let staffRole: "instructor" | "admin" = "admin";
    let courseTitle: string | null = null;

    // Direct user-to-user DM initiation
    if (recipientUserId) {
      if (user.role === "admin") {
        // Admin initiating DM with a student
        studentId = recipientUserId;
        staffId = user.id;
        staffName = user.fullName || "Administrateur Faro School";
        staffRole = "admin";
      } else {
        // Hard Rule: Student initiating DM.
        // A student can NEVER message another student. Student-to-student DM is blocked by any path.
        let targetRole: string | null = null;
        let targetName = "Membre";
        try {
          const supabase = await createClient();
          const { data: targetProfile } = await supabase
            .from("profiles")
            .select("id, display_name, full_name, role")
            .eq("id", recipientUserId)
            .single();

          if (targetProfile) {
            targetRole = targetProfile.role;
            targetName = targetProfile.display_name || targetProfile.full_name || "Formateur";
          }
        } catch {}

        if (!targetRole || targetRole === "student" || !STUDENT_DM_ENABLED) {
          return {
            success: false,
            error: "Les conversations entre élèves sont strictement interdites. Vous pouvez uniquement contacter votre formateur ou le support.",
          };
        }

        staffId = recipientUserId;
        staffName = targetName;
        staffRole = targetRole as "instructor" | "admin";
      }
    } else if (courseId) {
      // Course-based question to instructor: student must be enrolled
      try {
        const supabase = await createClient();
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .maybeSingle();

        if (!enrollment && user.role !== "admin") {
          return {
            success: false,
            error: "Vous devez être inscrit à ce cours pour poser une question au formateur.",
          };
        }

        const { data: courseData } = await supabase
          .from("courses")
          .select(`
            id,
            title_fr,
            title_ht,
            instructor_id,
            instructor:profiles!instructor_id (
              id,
              display_name,
              full_name,
              role
            )
          `)
          .eq("id", courseId)
          .single();

        if (courseData) {
          courseTitle = courseData.title_fr || courseData.title_ht || "Formation";
          if (courseData.instructor_id) {
            staffId = courseData.instructor_id;
            staffName = (courseData.instructor as any)?.display_name || (courseData.instructor as any)?.full_name || "Formateur";
            staffRole = ((courseData.instructor as any)?.role as any) || "instructor";
          }
        }
      } catch {}

      if (!staffId) {
        staffId = "instructor-mock-id";
        staffName = "Jean-Marc Baptiste";
        staffRole = "instructor";
        courseTitle = courseTitle || "Formation Faro School";
      }
    } else {
      // General question -> admin
      try {
        const supabase = await createClient();
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, role")
          .eq("role", "admin")
          .limit(1)
          .single();

        if (adminProfile) {
          staffId = adminProfile.id;
          staffName = adminProfile.display_name || adminProfile.full_name || "Support Faro School";
          staffRole = "admin";
        }
      } catch {}

      if (!staffId) {
        staffId = "admin-mock-id";
        staffName = "Support Faro School";
        staffRole = "admin";
      }
    }

    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    // Create in Supabase
    try {
      const supabase = await createClient();
      const { data: convRow, error: convError } = await supabase
        .from("conversations")
        .insert({
          student_id: studentId,
          staff_id: staffId,
          course_id: courseId || null,
          subject: trimmedSubject,
          status: "open",
          created_at: nowIso,
          last_message_at: nowIso,
        })
        .select("id")
        .single();

      if (convError || !convRow) {
        if (!isDemoMode()) {
          return {
            success: false,
            error: `Échec de création de la conversation : ${convError?.message || "Erreur base de données"}`,
          };
        }
      } else {
        await sendPrivateMessageAction(convRow.id, trimmedBody, null, locale);
        return { success: true, data: { conversationId: convRow.id } };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return {
          success: false,
          error: `Échec de création de la conversation : ${err?.message || "Erreur"}`,
        };
      }
    }

    // Fallback store
    const store = getMockConversationsStore();
    const newConv: Conversation = {
      id: conversationId,
      studentId,
      studentName: user.id === studentId ? (user.fullName || "Étudiant Test") : "Étudiant",
      staffId,
      staffName,
      staffRole,
      courseId: courseId || null,
      courseTitle: courseTitle || "Support Général",
      subject: trimmedSubject,
      status: "open",
      createdAt: nowIso,
      lastMessageAt: nowIso,
      unreadCount: 0,
      lastMessagePreview: trimmedBody,
    };
    store.unshift(newConv);

    const messagesStore = getMockMessagesStore();
    messagesStore.set(conversationId, []);

    // Dispatch the first message
    await sendPrivateMessageAction(conversationId, trimmedBody, null, locale);

    try {
      revalidatePath("/[locale]/dashboard/messages", "page");
      revalidatePath("/[locale]/admin/messages", "page");
    } catch {}

    return { success: true, data: { conversationId } };
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible de démarrer la conversation." };
  }
}

/**
 * Sends a message within a private conversation, executing the AI & escalation flow.
 */
export async function sendPrivateMessageAction(
  conversationId: string,
  body: string,
  clientMessageId?: string | null,
  locale: string = "fr"
): Promise<MessagingActionResult<PrivateMessage>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non connecté." };
    }

    // Check banned status
    try {
      const supabase = await createClient();
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("banned_at")
        .eq("id", user.id)
        .single();

      if (userProfile?.banned_at) {
        return {
          success: false,
          error: "Votre compte est suspendu. Vous ne pouvez pas envoyer de messages.",
        };
      }
    } catch {}

    const trimmedBody = body?.trim();
    if (!trimmedBody) {
      return { success: false, error: "Message vide." };
    }

    // Moderation check: non-admins cannot send phone numbers or off-platform invitations
    if (user.role !== "admin") {
      const modCheck = checkMessageModeration(trimmedBody);
      if (modCheck.blocked) {
        await recordModerationFlag({
          userId: user.id,
          conversationId,
          reason: modCheck.reason || "offplatform",
          excerpt: modCheck.maskedExcerpt || "Contenu bloqué",
        });
        return {
          success: false,
          error:
            locale === "ht"
              ? modCheck.noticeHt || "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye."
              : modCheck.noticeFr || "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
        };
      }
    }

    // Idempotency: Check if clientMessageId already processed
    if (clientMessageId) {
      try {
        const supabase = await createClient();
        const { data: existingMsg } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_type, sender_id, body, created_at, read_at")
          .eq("sender_id", user.id)
          .eq("client_message_id", clientMessageId)
          .maybeSingle();

        if (existingMsg) {
          return {
            success: true,
            data: {
              id: existingMsg.id,
              conversationId: existingMsg.conversation_id,
              senderType: existingMsg.sender_type as any,
              senderId: existingMsg.sender_id,
              senderName: user.fullName || "Utilisateur",
              senderRole: user.role,
              body: existingMsg.body,
              createdAt: existingMsg.created_at,
              readAt: existingMsg.read_at,
            },
          };
        }
      } catch {}

      const messagesStore = getMockMessagesStore();
      const existingMsgs = messagesStore.get(conversationId) || [];
      const foundInStore = existingMsgs.find(
        (m: any) => m.senderId === user.id && m.clientMessageId === clientMessageId
      );
      if (foundInStore) {
        return { success: true, data: foundInStore };
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch conversation details
    let conv: Conversation | null = null;
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
            id,
            title_fr,
            title_ht,
            description_fr,
            description_ht
          ),
          staff:profiles!staff_id (
            id,
            display_name,
            full_name,
            role,
            instructors (
              escalation_email,
              ai_enabled,
              ai_settings
            )
          ),
          student:profiles!student_id (
            id,
            display_name,
            full_name
          )
        `)
        .eq("id", conversationId)
        .single();

      if (row) {
        conv = {
          id: row.id,
          studentId: row.student_id,
          studentName: (row.student as any)?.display_name || (row.student as any)?.full_name || "Étudiant",
          staffId: row.staff_id,
          staffName: (row.staff as any)?.display_name || (row.staff as any)?.full_name || "Formateur",
          staffRole: ((row.staff as any)?.role as any) || "instructor",
          courseId: row.course_id,
          courseTitle: (row.courses as any)?.title_fr || (row.courses as any)?.title_ht || "Support Général",
          subject: row.subject,
          status: row.status,
          createdAt: row.created_at,
          lastMessageAt: row.last_message_at,
        };
      }
    } catch {}

    if (!conv) {
      const store = getMockConversationsStore();
      conv = store.find((c) => c.id === conversationId) || null;
    }

    if (!conv) {
      return { success: false, error: "Conversation introuvable." };
    }

    const isStudent = user.id === conv.studentId;
    const isStaff = user.id === conv.staffId || user.role === "admin";
    const senderType = isStudent ? "student" : "staff";

    // Create user message
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const studentMessage: PrivateMessage = {
      id: messageId,
      conversationId,
      senderType,
      senderId: user.id,
      senderName: user.fullName || (isStudent ? "Étudiant" : conv.staffName),
      senderRole: user.role,
      body: trimmedBody,
      createdAt: nowIso,
      readAt: null,
      clientMessageId: clientMessageId || undefined,
    } as any;

    // Save message in DB
    try {
      const supabase = await createClient();
      const { error: msgErr } = await supabase.from("messages").insert({
        id: messageId,
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: user.id,
        body: trimmedBody,
        created_at: nowIso,
        client_message_id: clientMessageId || null,
      });

      if (msgErr && !isDemoMode()) {
        return {
          success: false,
          error: `Échec d'enregistrement du message : ${msgErr.message}`,
        };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return {
          success: false,
          error: `Échec d'enregistrement du message : ${err?.message || "Erreur"}`,
        };
      }
    }

    // Save in mock store
    const messagesStore = getMockMessagesStore();
    const existingMsgs = messagesStore.get(conversationId) || [];
    existingMsgs.push(studentMessage);
    messagesStore.set(conversationId, existingMsgs);

    conv.lastMessageAt = nowIso;
    conv.lastMessagePreview = trimmedBody;

    // =========================================================================
    // FLOW 1: STAFF REPLIED (Instructor or Admin answering)
    // =========================================================================
    if (!isStudent && isStaff) {
      conv.status = "staff_replied";

      // If there is an active escalation, resolve it
      try {
        const supabase = await createClient();
        await supabase
          .from("escalations")
          .update({ resolved_at: nowIso })
          .eq("conversation_id", conversationId)
          .is("resolved_at", null);

        // Notify student
        await supabase.from("notifications").insert({
          user_id: conv.studentId,
          type: "staff_reply",
          payload: {
            conversationId,
            messageSnippet: trimmedBody.slice(0, 100),
            senderName: conv.staffName,
            courseTitle: conv.courseTitle,
          },
        });
      } catch {}

      const escalations = getMockEscalationsStore();
      escalations.forEach((esc) => {
        if (esc.conversationId === conversationId && !esc.resolvedAt) {
          esc.resolvedAt = nowIso;
        }
      });

      try {
        revalidatePath(`/[locale]/dashboard/messages/${conversationId}`, "page");
        revalidatePath(`/[locale]/admin/messages/${conversationId}`, "page");
      } catch {}
      return { success: true, data: studentMessage };
    }

    // =========================================================================
    // FLOW 2: STUDENT MESSAGE ARRIVED
    // =========================================================================
    const staffOnline = await isStaffOnline(conv.staffId);

    // 1. If staff is online -> Deliver live, notify staff, AI stays silent!
    if (staffOnline) {
      conv.status = "open";

      try {
        const supabase = await createClient();
        await supabase.from("notifications").insert({
          user_id: conv.staffId,
          type: "student_message",
          payload: {
            conversationId,
            studentName: conv.studentName,
            subject: conv.subject,
            messageSnippet: trimmedBody.slice(0, 100),
          },
        });
      } catch {}

      try {
        revalidatePath(`/[locale]/dashboard/messages/${conversationId}`, "page");
      } catch {}
      return { success: true, data: studentMessage };
    }

    // 2. Staff is offline -> Call AI Assistant
    const aiResult = await callAiAssistant({
      conversationId,
      studentId: conv.studentId,
      studentName: conv.studentName,
      staffName: conv.staffName,
      courseTitle: conv.courseTitle,
      recentMessages: existingMsgs.map((m) => ({ senderType: m.senderType, body: m.body })),
      currentQuestion: trimmedBody,
      locale: user.locale || "fr",
    });

    // If AI can answer confidently -> Post AI answer!
    if (aiResult.can_answer && aiResult.answer.trim()) {
      conv.status = "ai_handling";
      const aiMessage: PrivateMessage = {
        id: `msg-ai-${Date.now()}`,
        conversationId,
        senderType: "ai",
        senderName: `Assistant IA de ${conv.staffName}`,
        body: aiResult.answer,
        meta: {
          confidence: aiResult.confidence,
          model: aiResult.model,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
        },
        createdAt: new Date().toISOString(),
      };

      try {
        const supabase = await createClient();
        await supabase.from("messages").insert({
          id: aiMessage.id,
          conversation_id: conversationId,
          sender_type: "ai",
          sender_id: null,
          body: aiMessage.body,
          meta: aiMessage.meta,
          created_at: aiMessage.createdAt,
        });
        await supabase
          .from("conversations")
          .update({ status: "ai_handling", last_message_at: aiMessage.createdAt })
          .eq("id", conversationId);
      } catch {}

      existingMsgs.push(aiMessage);
      conv.lastMessageAt = aiMessage.createdAt;
      conv.lastMessagePreview = aiMessage.body;

      try {
        revalidatePath(`/[locale]/dashboard/messages/${conversationId}`, "page");
      } catch {}
      return { success: true, data: studentMessage };
    }

    // 3. AI cannot answer confidently / Out of scope / Asked for human -> ESCALATION PATH!
    conv.status = "waiting_staff";
    const deadlineAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // now + 2 minutes

    // Post system message informing the student
    const systemNoticeText =
      user.locale === "ht"
        ? `Mesaj ou a transmèt bay ${conv.staffName}. Kòm li pa an liy pou kounye a, li resevwa yon notifikasyon sou imèl li pou l reponn ou rapidman.`
        : `Votre question a été transmise à ${conv.staffName}. Comme le formateur n'est pas en ligne actuellement, une notification urgente lui a été envoyée.`;

    const systemMsg: PrivateMessage = {
      id: `msg-sys-${Date.now()}`,
      conversationId,
      senderType: "system",
      senderName: "Faro School",
      body: systemNoticeText,
      createdAt: new Date().toISOString(),
    };

    existingMsgs.push(systemMsg);

    // Record escalation
    const escalation: EscalationRecord = {
      id: `esc-${Date.now()}`,
      conversationId,
      triggerMessageId: messageId,
      reason: aiResult.escalate_reason || "Formateur hors ligne & question hors périmètre IA",
      emailStatus: "pending",
      deadlineAt,
      resolvedAt: null,
      followupSentAt: null,
      createdAt: nowIso,
    };

    const escalationsStore = getMockEscalationsStore();
    escalationsStore.push(escalation);

    try {
      const supabase = await createClient();
      await supabase.from("messages").insert({
        id: systemMsg.id,
        conversation_id: conversationId,
        sender_type: "system",
        sender_id: null,
        body: systemMsg.body,
        created_at: systemMsg.createdAt,
      });

      await supabase
        .from("conversations")
        .update({ status: "waiting_staff", last_message_at: systemMsg.createdAt })
        .eq("id", conversationId);

      await supabase.from("escalations").insert({
        id: escalation.id,
        conversation_id: conversationId,
        trigger_message_id: messageId,
        reason: escalation.reason,
        email_status: "pending",
        deadline_at: deadlineAt,
        created_at: nowIso,
      });
    } catch {}

    // Send escalation e-mail to staff
    const staffEmail = process.env.INSTRUCTOR_ESCALATION_EMAIL || "instructor@faroschool.com";
    const emailRes = await sendEscalationEmail({
      toEmail: staffEmail,
      studentName: conv.studentName,
      courseTitle: conv.courseTitle || "Formation Faro School",
      subject: conv.subject,
      question: trimmedBody,
      conversationId,
      locale: user.locale || "fr",
      recentMessagesSnippet: existingMsgs.slice(-4).map((m) => `${m.senderName}: ${m.body}`).join("\n"),
    });

    if (emailRes.success) {
      escalation.emailStatus = "sent";
      try {
        const supabase = await createClient();
        await supabase
          .from("escalations")
          .update({ email_status: "sent" })
          .eq("id", escalation.id);
      } catch {}
    }

    try {
      revalidatePath(`/[locale]/dashboard/messages/${conversationId}`, "page");
    } catch {}
    return { success: true, data: studentMessage };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'envoi du message." };
  }
}

/**
 * Staff heartbeat sent every 30 seconds.
 */
export async function staffHeartbeatAction(): Promise<MessagingActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    await recordStaffHeartbeat(user.id, user.role);

    // Check if any open escalations for this staff can be resolved
    try {
      const supabase = await createClient();
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("staff_id", user.id)
        .eq("status", "waiting_staff");

      if (convs && convs.length > 0) {
        for (const c of convs) {
          await supabase
            .from("escalations")
            .update({ resolved_at: new Date().toISOString() })
            .eq("conversation_id", c.id)
            .is("resolved_at", null);

          // Post "Le formateur a rejoint la conversation"
          await supabase.from("messages").insert({
            conversation_id: c.id,
            sender_type: "system",
            body: "Le formateur a rejoint la conversation. / Fòmatè a rantre nan konvèsasyon an.",
            created_at: new Date().toISOString(),
          });

          await supabase
            .from("conversations")
            .update({ status: "open" })
            .eq("id", c.id);
        }
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Toggles staff availability (Disponible / Indisponible).
 */
export async function toggleStaffAvailabilityAction(
  isAvailable: boolean
): Promise<MessagingActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    await setStaffAvailability(user.id, user.role, isAvailable);
    revalidatePath("/[locale]/admin/messages", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Marks messages in a conversation as read.
 */
export async function markConversationReadAction(
  conversationId: string
): Promise<MessagingActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false };

    try {
      const supabase = await createClient();
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    } catch {}

    const messagesStore = getMockMessagesStore();
    const msgs = messagesStore.get(conversationId);
    if (msgs) {
      msgs.forEach((m) => {
        if (m.senderId !== user.id) {
          m.readAt = new Date().toISOString();
        }
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Closes or reopens a conversation (Staff only).
 */
export async function closeConversationAction(
  conversationId: string,
  newStatus: "closed" | "open" = "closed"
): Promise<MessagingActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    const nowIso = new Date().toISOString();

    try {
      const supabase = await createClient();
      await supabase
        .from("conversations")
        .update({ status: newStatus, last_message_at: nowIso })
        .eq("id", conversationId);

      const systemText =
        newStatus === "closed"
          ? user.locale === "ht"
            ? "Fòmatè a make konvèsasyon sa a kòm rezoud epi li fèmen l."
            : "La discussion a été clôturée par le formateur."
          : user.locale === "ht"
            ? "Fòmatè a relouvri konvèsasyon sa a."
            : "La discussion a été rouverte par le formateur.";

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "system",
        body: systemText,
        created_at: nowIso,
      });
    } catch {}

    const conversations = getMockConversationsStore();
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.status = newStatus;
      conv.lastMessageAt = nowIso;
    }

    const messagesStore = getMockMessagesStore();
    const msgs = messagesStore.get(conversationId) || [];
    msgs.push({
      id: `msg-sys-${Date.now()}`,
      conversationId,
      senderType: "system",
      body:
        newStatus === "closed"
          ? "La discussion a été clôturée par le formateur."
          : "La discussion a été rouverte par le formateur.",
      createdAt: nowIso,
    });
    messagesStore.set(conversationId, msgs);

    revalidatePath("/[locale]/admin/messages", "page");
    revalidatePath(`/[locale]/dashboard/messages/${conversationId}`, "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Starts a new conversation with an enrolled student (Instructor action).
 */
export async function startInstructorConversationAction(
  studentId: string,
  courseId: string,
  subject: string,
  firstMessage: string
): Promise<MessagingActionResult<{ conversationId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    const trimmedSubject = subject?.trim();
    const trimmedBody = firstMessage?.trim();

    if (!trimmedSubject || !trimmedBody) {
      return { success: false, error: "Veuillez renseigner un sujet et un message." };
    }

    const convId = `conv-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let studentName = "Étudiant";
    let courseTitle = "Formation";

    try {
      const supabase = await createClient();

      // Fetch student details
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", studentId)
        .single();
      if (studentProfile) {
        studentName = studentProfile.display_name || studentProfile.full_name || "Étudiant";
      }

      // Fetch course title
      const { data: courseData } = await supabase
        .from("courses")
        .select("title_fr, title_ht")
        .eq("id", courseId)
        .single();
      if (courseData) {
        courseTitle = courseData.title_fr || courseData.title_ht || "Formation";
      }

      // Insert conversation
      await supabase.from("conversations").insert({
        id: convId,
        student_id: studentId,
        staff_id: user.id,
        course_id: courseId,
        subject: trimmedSubject,
        status: "staff_replied",
        created_at: nowIso,
        last_message_at: nowIso,
      });

      // Insert first message
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_type: "staff",
        sender_id: user.id,
        body: trimmedBody,
        created_at: nowIso,
      });

      // Notify student
      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "staff_reply",
        payload: {
          conversationId: convId,
          messageSnippet: trimmedBody.slice(0, 100),
          senderName: user.fullName || "Formateur",
          courseTitle,
        },
      });
    } catch {}

    // Mock store update
    const convStore = getMockConversationsStore();
    const newConv: Conversation = {
      id: convId,
      studentId,
      studentName,
      staffId: user.id,
      staffName: user.fullName || "Formateur",
      staffRole: user.role as "instructor" | "admin",
      courseId,
      courseTitle,
      subject: trimmedSubject,
      status: "staff_replied",
      createdAt: nowIso,
      lastMessageAt: nowIso,
      unreadCount: 0,
      lastMessagePreview: trimmedBody,
      isStaffOnline: true,
    };
    convStore.unshift(newConv);

    const messagesStore = getMockMessagesStore();
    messagesStore.set(convId, [
      {
        id: `msg-${Date.now()}`,
        conversationId: convId,
        senderType: "staff",
        senderId: user.id,
        senderName: user.fullName || "Formateur",
        senderRole: user.role as "instructor" | "admin",
        body: trimmedBody,
        createdAt: nowIso,
      },
    ]);

    revalidatePath("/[locale]/admin/messages", "page");
    return { success: true, data: { conversationId: convId } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
