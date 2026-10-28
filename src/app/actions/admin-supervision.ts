"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  saveGlobalAiSettings,
  logBreakGlassAccess,
  hasAdminUnlockedConversation,
  type GlobalAiSettings,
} from "@/lib/admin/messaging-supervision";
import {
  getMockConversationsStore,
  getMockMessagesStore,
  getConversationById,
  getConversationMessages,
} from "@/lib/messaging/data";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";

export type SupervisionActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Toggles platform-wide AI kill switch.
 */
export async function toggleAiKillSwitchAction(
  killSwitch: boolean
): Promise<SupervisionActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Réservé aux administrateurs." };
    }

    const currentStore = (globalThis as any).__mockGlobalAiSettingsStore || {
      defaultModel: "claude-3-haiku-20240307",
      defaultConfidenceThreshold: 0.75,
      dailyCostCapUsd: 5.0,
      studentDailyLimit: 30,
      killSwitch: false,
    };

    const updated: GlobalAiSettings = {
      ...currentStore,
      killSwitch,
    };

    await saveGlobalAiSettings(updated, user.id);
    revalidatePath("/[locale]/admin/messagerie", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de mise à jour du Kill Switch." };
  }
}

/**
 * Saves global AI settings (model, threshold, caps).
 */
export async function saveGlobalAiConfigAction(
  settings: GlobalAiSettings
): Promise<SupervisionActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Réservé aux administrateurs." };
    }

    await saveGlobalAiSettings(settings, user.id);
    revalidatePath("/[locale]/admin/messagerie", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de configuration." };
  }
}

/**
 * Break-Glass unlock: allows an admin to inspect a private conversation
 * between a student and an instructor ONLY upon explicit report or escalation context.
 */
export async function unlockPrivateConversationBreakGlassAction(
  conversationId: string,
  context: "report" | "escalation",
  reason: string
): Promise<
  SupervisionActionResult<{
    conversation: Conversation;
    messages: PrivateMessage[];
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Accès superviseur réservé aux administrateurs." };
    }

    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      return {
        success: false,
        error: "Un motif écrit détaillé (au moins 10 caractères) est obligatoire pour justifier l'accès.",
      };
    }

    // Audit log this break-glass inspection
    await logBreakGlassAccess(
      user.id,
      user.fullName || "Admin",
      conversationId,
      context,
      trimmedReason
    );

    // Retrieve conversation and messages
    const conv = await getConversationById(conversationId, user.id, "admin");
    if (!conv) {
      return { success: false, error: "Conversation introuvable." };
    }

    const messages = await getConversationMessages(conversationId);

    return {
      success: true,
      data: {
        conversation: conv,
        messages,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur d'accès à la conversation." };
  }
}

/**
 * Admin initiates a direct private message to any student.
 */
export async function adminStartStudentConversationAction(
  studentId: string,
  subject: string,
  firstMessage: string
): Promise<SupervisionActionResult<{ conversationId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Réservé aux administrateurs." };
    }

    const trimmedSub = subject?.trim();
    const trimmedBody = firstMessage?.trim();

    if (!trimmedSub || !trimmedBody) {
      return { success: false, error: "Veuillez spécifier un sujet et un message." };
    }

    const convId = `conv-adm-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let studentName = "Étudiant";

    try {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", studentId)
        .single();
      if (profile) {
        studentName = profile.display_name || profile.full_name || "Étudiant";
      }

      await supabase.from("conversations").insert({
        id: convId,
        student_id: studentId,
        staff_id: user.id,
        course_id: null,
        subject: trimmedSub,
        status: "staff_replied",
        created_at: nowIso,
        last_message_at: nowIso,
      });

      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_type: "staff",
        sender_id: user.id,
        body: trimmedBody,
        created_at: nowIso,
      });

      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "staff_reply",
        payload: {
          conversationId: convId,
          messageSnippet: trimmedBody.slice(0, 100),
          senderName: "Administration Faro School",
        },
      });
    } catch {}

    // Mock store
    const store = getMockConversationsStore();
    store.unshift({
      id: convId,
      studentId,
      studentName,
      staffId: user.id,
      staffName: user.fullName || "Administration Faro School",
      staffRole: "admin",
      courseId: null,
      courseTitle: "Support Général & Administration",
      subject: trimmedSub,
      status: "staff_replied",
      createdAt: nowIso,
      lastMessageAt: nowIso,
      unreadCount: 0,
      lastMessagePreview: trimmedBody,
      isStaffOnline: true,
    });

    const msgStore = getMockMessagesStore();
    msgStore.set(convId, [
      {
        id: `msg-${Date.now()}`,
        conversationId: convId,
        senderType: "staff",
        senderId: user.id,
        senderName: user.fullName || "Administration Faro School",
        senderRole: "admin",
        body: trimmedBody,
        createdAt: nowIso,
      },
    ]);

    revalidatePath("/[locale]/admin/messagerie", "page");
    return { success: true, data: { conversationId: convId } };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur d'envoi du message." };
  }
}
