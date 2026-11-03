"use server";

import {scheduleAssistant} from '@/lib/messaging/background';
import {intakeReply,requestsHumanSupport} from '@/lib/messaging/assistant-policy';
import {resolveStudentRecipient,RecipientError} from "@/lib/messaging/recipients";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import {createAdminClient} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import { isStaffOnline, recordStaffHeartbeat, setStaffAvailability } from "@/lib/messaging/presence";
import { callAiAssistant } from "@/lib/messaging/ai-assistant";
import {processOutbox} from "@/lib/email/outbox";
import {
  getMockConversationsStore,
  getMockMessagesStore,
  getMockEscalationsStore,
} from "@/lib/messaging/data";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";
import { STUDENT_DM_ENABLED } from "@/config/messaging";
import { checkStoredProfanity } from "@/lib/community/stored-word-filter";
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
    if (trimmedBody && (await checkStoredProfanity(trimmedBody)).blocked) return {success:false,error:locale === "ht" ? "Mesaj sa a pa respekte règ yo." : "Ce message contient des mots interdits."};

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
        .select("banned_at,muted_until")
        .eq("id", user.id)
        .single();

      if ((!userProfile&&!isDemoMode()) || userProfile?.banned_at || (userProfile?.muted_until && Date.parse(userProfile.muted_until)>Date.now())) {
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

    if(user.role==='student'){
      if(recipientUserId)return{success:false,error:'forbidden'};
      try{const recipient=await resolveStudentRecipient(user,courseId);staffId=recipient.staffId;staffName=recipient.staffName;staffRole=recipient.staffRole;courseTitle=recipient.courseTitle;}
      catch(error){return{success:false,error:error instanceof RecipientError?error.code:'unavailable'};}
    } else if (recipientUserId) {
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
          .is("revoked_at",null)
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
    const sent=await sendPrivateMessageAction(conversationId, trimmedBody, null, locale);
    if(!sent.success)return{success:false,error:sent.error};

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
  locale: string = "fr",
  requestSupportTicket: boolean = false
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
        .select("banned_at,muted_until")
        .eq("id", user.id)
        .single();

      if ((!userProfile&&!isDemoMode()) || userProfile?.banned_at || (userProfile?.muted_until && Date.parse(userProfile.muted_until)>Date.now())) {
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

    if ((await checkStoredProfanity(trimmedBody)).blocked) return {success:false,error:locale === "ht" ? "Mesaj sa a pa respekte règ yo." : "Ce message contient des mots interdits."};
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
              clientMessageId,
            },
          };
        }
      } catch {}

      const messagesStore = isDemoMode()?getMockMessagesStore():new Map();
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
          assistance_epoch,
          assistance_mode,
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
          assistanceEpoch:row.assistance_epoch,
          assistanceMode:row.assistance_mode,
          createdAt: row.created_at,
          lastMessageAt: row.last_message_at,
        };
      }
    } catch {}

    if (!conv && isDemoMode()) {
      const store = getMockConversationsStore();
      conv = store.find((c) => c.id === conversationId) || null;
    }

    if (!conv) {
      return { success: false, error: "Conversation introuvable." };
    }

    // A shared technical ticket can be taken over by another verified administrator.
    if(user.role==='admin'&&!conv.courseId&&conv.staffId!==user.id){
      const db=await createClient();const {data,error}=await db.from('conversations').update({staff_id:user.id}).eq('id',conversationId).is('course_id',null).select('id').single();
      if(error||!data)return{success:false,error:'forbidden'};conv.staffId=user.id;conv.staffName=user.fullName||'Faro School';conv.staffRole='admin';
    }
    const isStudent = user.id === conv.studentId;
    const isStaff = user.id === conv.staffId;
    if (!isStudent && !isStaff) return {success:false,error:"forbidden"};
    if (conv.status === "closed") return {success:false,error:locale === "ht" ? "Konvèsasyon sa a fèmen." : "Cette discussion est clôturée."};

    const senderType = isStudent ? "student" : "staff";

    // Create user message
    const messageId = crypto.randomUUID();
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

      if(msgErr?.code==='23505'&&clientMessageId){const {data:existing}=await supabase.from('messages').select('id,created_at,read_at,delivered_at').eq('sender_id',user.id).eq('client_message_id',clientMessageId).eq('conversation_id',conversationId).maybeSingle();if(existing)return{success:true,data:{...studentMessage,id:existing.id,createdAt:existing.created_at,readAt:existing.read_at,deliveredAt:existing.delivered_at}};}
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

    // Load persisted context for the assistant, not the per-instance demo map.
    const {getConversationMessages}=await import('@/lib/messaging/data');

    conv.lastMessageAt = nowIso;
    conv.lastMessagePreview = trimmedBody;

    // =========================================================================
    // FLOW 1: STAFF REPLIED (Instructor or Admin answering)
    // =========================================================================
    if (!isStudent && isStaff) {
      conv.status = "staff_replied";

      if(conv.courseId)await createAdminClient().from('escalations').update({resolved_at:nowIso}).eq('conversation_id',conversationId).is('resolved_at',null);
      const escalations = isDemoMode()?getMockEscalationsStore():[];
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

    // Acknowledge persistence before AI generation; late replies are fenced in SQL.
    await scheduleAssistant(async()=>{try {
      const existingMsgs=await getConversationMessages(conversationId);
      const trusted=createAdminClient();
      const {data:pending,error:pendingError}=await trusted.from('escalations').select('id').eq('conversation_id',conversationId).is('resolved_at',null).limit(1).maybeSingle();
      if(pendingError)throw Error('handoff_state_unavailable');
      if(!conv.courseId&&pending)return;
      if(!conv.courseId){const {handleSupportMessage}=await import('@/lib/support/service');await handleSupportMessage({conversationId,messageId,actorId:user.id,epoch:conv.assistanceEpoch||0,question:trimmedBody,locale,explicitTicket:requestSupportTicket===true});return;}
      const staffOnline=await isStaffOnline(conv.staffId);
      if((!conv.courseId&&pending)||(conv.courseId&&staffOnline&&conv.status==='staff_replied'))return;
      const {data:staff}=await trusted.from('profiles').select('full_name,display_name,role').eq('id',conv.staffId).single();
      if(staff){conv.staffName=staff.full_name||staff.display_name||'Faro School';conv.staffRole=staff.role;}
      const mode=conv.courseId?'course':'support';
      requestSupportTicket=requestSupportTicket===true||(!conv.courseId&&requestsHumanSupport(trimmedBody));
      let summary='',settings:Partial<import('@/lib/messaging/types').InstructorAiSettings>|undefined,web=false,contextError=false;
      if(conv.courseId){
        const {data:context,error}=await trusted.from('course_ai_context').select('summary_fr,summary_ht,enabled,web_search_enabled').eq('course_id',conv.courseId).maybeSingle();
        const version=await trusted.from('instructor_ai_versions').select('settings').eq('instructor_id',conv.staffId).order('version_number',{ascending:false}).limit(1).maybeSingle();
        contextError=!!error||!!version.error;settings=version.data?.settings||undefined;
        if(context){summary=(user.locale==='ht'?context.summary_ht||context.summary_fr:context.summary_fr||context.summary_ht).slice(0,12000);settings={...settings,enabled:context.enabled&&settings?.enabled!==false};web=context.web_search_enabled===true;}
      }
      const result=!conv.courseId&&requestSupportTicket===true?{can_answer:false,answer:'',confidence:0,escalate_reason:'explicit_support_ticket',model:'faro-handoff',inputTokens:0,outputTokens:0}:contextError?{can_answer:false,answer:'',confidence:0,escalate_reason:'course_context_unavailable',model:'',inputTokens:0,outputTokens:0}:await callAiAssistant({conversationId,studentId:conv.studentId,studentName:conv.studentName,staffName:conv.staffName,courseTitle:conv.courseTitle,courseContextSummary:summary,mode,webSearchEnabled:web,instructorSettings:settings,recentMessages:existingMsgs.filter(m=>m.senderType!=='system'&&m.id!==messageId).slice(-12).map(m=>({senderType:m.senderType,body:m.body.slice(0,2000)})),currentQuestion:trimmedBody,locale:locale});
      if(result.escalate_reason?.includes('Kill Switch'))return;
      const answer=result.answer.trim().slice(0,4000),safeAnswer=answer&&!(await checkStoredProfanity(answer)).blocked;
      const meta={assistanceEpoch:conv.assistanceEpoch||0,supportTicketRequested:!conv.courseId&&requestSupportTicket===true,assistantMode:mode,assistantOwner:conv.courseId?conv.staffId:'faro-support',confidence:result.confidence,model:result.model,inputTokens:result.inputTokens,outputTokens:result.outputTokens,sources:'sources'in result?result.sources:undefined,searchWidget:'searchWidget'in result?result.searchWidget:undefined};
      if(!conv.courseId&&requestSupportTicket!==true&&!result.can_answer){
        const clarification=intakeReply(trimmedBody,'support',locale)||(user.locale==='ht'?'Di mwen ki etap ki bloke, non fòmasyon an si sa nesesè ak mesaj erè a egzakteman. Mwen ka gide w sou Faro School, men mwen pa ka modifye kont ou ni konfime yon tranzaksyon.':'Indiquez l’étape qui bloque, le nom de la formation si nécessaire et le message d’erreur exact. Je peux vous guider sur l’utilisation de Faro School, mais je ne peux ni modifier votre compte ni confirmer une transaction.');
        const {error}=await trusted.rpc('commit_assistant_reply',{p_actor:user.id,p_conversation:conversationId,p_message:messageId,p_body:clarification,p_meta:meta});
        if(error)throw Error('assistant_message_unavailable');
      }else if(result.can_answer&&safeAnswer){
        const {error}=await trusted.rpc('commit_assistant_reply',{p_actor:user.id,p_conversation:conversationId,p_message:messageId,p_body:answer,p_meta:meta});
        if(error)throw Error('assistant_message_unavailable');
      }else{
        const destination=conv.courseId?conv.staffName:(user.locale==='ht'?'ekip sipò Faro School':'l’équipe support Faro School');
        const notice=conv.courseId?(user.locale==='ht'?'Mwen transmèt kesyon sa a bay '+destination+'. Tann repons pwofesè a. Pandan tan sa a, ou ka poze mwen yon lòt kesyon.':'Je transmets cette question à '+destination+'. Attendez sa réponse ; vous pouvez me poser une autre question pendant ce temps.'):(user.locale==='ht'?'Mwen kreye yon tikè pou ekip sipò a. Saisie a an poz pandan w ap tann repons yon administratè.':'Je crée un ticket pour l’équipe support. La saisie est suspendue en attendant la réponse d’un administrateur.');
        const {data:handoff,error}=await trusted.rpc('queue_assistant_handoff',{p_actor:user.id,p_conversation:conversationId,p_message:messageId,p_reason:result.escalate_reason||'human_help_required',p_notice:(safeAnswer?answer+'\n\n':'')+notice,p_meta:meta});
        if(error)throw Error('handoff_unavailable');
        if(handoff?.email_id)await processOutbox(handoff.email_id);
        if(conv.courseId&&handoff?.created===false){
          const waiting=user.locale==='ht'?'Kesyon an toujou ap tann pwofesè a. Mwen pa gen yon repons ase sèten pou pwen sa a. Ou ka poze yon lòt kesyon pandan w ap tann.':'Cette question attend toujours le professeur. Je ne dispose pas d’une réponse assez fiable sur ce point. Vous pouvez poser une autre question pendant l’attente.';
          const {error:noticeError}=await trusted.rpc('commit_assistant_reply',{p_actor:user.id,p_conversation:conversationId,p_message:messageId,p_body:waiting,p_meta:meta});
          if(noticeError)throw Error('waiting_notice_unavailable');
        }
      }
    }catch{console.error('[messaging] assistant_or_handoff_unavailable');}});
    try{revalidatePath('/[locale]/dashboard/messages','page');revalidatePath('/[locale]/admin/messages','page');}catch{}
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

    return {success:await recordStaffHeartbeat(user.id,user.role)};
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

    if(!await setStaffAvailability(user.id,user.role,isAvailable))return{success:false,error:"availability_unavailable"};
    revalidatePath("/[locale]/admin/messages", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Marks messages in a conversation as read.
 */
export async function markConversationReadAction(conversationId:string):Promise<MessagingActionResult>{
 const user=await getCurrentUser();if(!user)return{success:false,error:'forbidden'};
 const db=await createClient();const {error}=await db.rpc('mark_private_conversation_read',{p_conversation:conversationId});return error?{success:false,error:'read_unavailable'}:{success:true};
}

/**
 * Permanently closes a conversation (staff only), with persisted-state verification.
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

    if(newStatus!=='closed')return{success:false,error:'conversation_closed'};
    const db=await createClient();const {error}=await db.rpc('set_conversation_control',{p_conversation:conversationId,p_control:'closed'});
    if(error)return{success:false,error:'forbidden'};
    const {data:closed,error:verifyError}=await db.from('conversations').select('id,status,assistance_mode').eq('id',conversationId).single();
    if(verifyError||closed?.status!=='closed')return{success:false,error:'closure_unconfirmed'};
    revalidatePath('/[locale]/admin/messages','page');revalidatePath('/[locale]/dashboard/messages','page');
    return{success:true,data:{conversationId,status:'closed',assistanceMode:closed.assistance_mode}};
  }catch{return{success:false,error:'unavailable'};}
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
  const user=await getCurrentUser();if(!user||user.role!=='admin')return{success:false,error:'forbidden'};
  if(courseId){const db=await createClient();const {data,error}=await db.from('courses').select('instructor_id').eq('id',courseId).single();if(error||data?.instructor_id!==user.id)return{success:false,error:'forbidden'};}
  return createConversationAction(courseId||null,subject,firstMessage,studentId,user.locale);
}

/** Live inbox reads: participants only; supervision has its separate audited action. */
export async function loadStaffInboxAction(conversationId?:string):Promise<MessagingActionResult<{conversations:Conversation[];messages:PrivateMessage[]}>>{
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role))return{success:false,error:'forbidden'};
 const {getStaffConversations,getConversationMessages}=await import('@/lib/messaging/data');
 const conversations=await getStaffConversations(user.id,false,user.role==='admin');
 if(conversationId&&!conversations.some(c=>c.id===conversationId))return{success:false,error:'not_found'};
 return{success:true,data:{conversations,messages:conversationId?await getConversationMessages(conversationId):[]}};
}

export async function getStaffAvailabilityAction():Promise<MessagingActionResult<{available:boolean}>>{
 const user=await getCurrentUser();if(!user||!['instructor','admin'].includes(user.role))return{success:false,error:'forbidden'};
 const db=await createClient();const {data,error}=await db.from('profiles').select('staff_available').eq('id',user.id).single();
 return error||!data?{success:false,error:'availability_unavailable'}:{success:true,data:{available:data.staff_available}};
}

/** Explicit takeover: online presence alone never silences the course assistant. */
export async function takeConversationControlAction(conversationId:string,control:'human'|'ai'='human'):Promise<MessagingActionResult>{
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role)||!['human','ai'].includes(control))return{success:false,error:'forbidden'};
 const db=await createClient();const {error}=await db.rpc('set_conversation_control',{p_conversation:conversationId,p_control:control});
 if(error)return{success:false,error:'forbidden'};
 revalidatePath('/[locale]/admin/messages','page');return{success:true};
}
export async function loadAssistantTakeoversAction():Promise<MessagingActionResult<Conversation[]>>{
 const user=await getCurrentUser();if(!user||!['admin','instructor'].includes(user.role))return{success:false,error:'forbidden'};
 const db=await createClient();const {data:profile,error}=await db.from('profiles').select('staff_available').eq('id',user.id).single();
 if(error||!profile)return{success:false,error:'unavailable'};if(!profile.staff_available)return{success:true,data:[]};
 const {getStaffConversations}=await import('@/lib/messaging/data');const conversations=await getStaffConversations(user.id,false,user.role==='admin');
 return{success:true,data:conversations.filter(c=>c.courseId&&c.staffId===user.id&&['open','ai_handling','waiting_staff'].includes(c.status)).slice(0,10)};
}

export async function acknowledgeConversationDeliveryAction(conversationId:string){const user=await getCurrentUser();if(!user)return{success:false};const db=await createClient();const {error}=await db.rpc('acknowledge_private_messages',{p_conversation:conversationId,p_read:false});return{success:!error};}

/** Failed refreshes are explicit: never replace a loaded history with an empty list. */
export async function loadStudentInboxAction(conversationId?:string):Promise<MessagingActionResult<{conversations:Conversation[];messages:PrivateMessage[]}>>{
 try{const user=await getCurrentUser();if(!user)return{success:false,error:'forbidden'};const {getStudentConversations,getConversationMessages}=await import('@/lib/messaging/data');const conversations=await getStudentConversations(user.id);if(conversationId&&!conversations.some(c=>c.id===conversationId))return{success:false,error:'not_found'};return{success:true,data:{conversations,messages:conversationId?await getConversationMessages(conversationId):[]}};}catch{return{success:false,error:'history_unavailable'};}
}
