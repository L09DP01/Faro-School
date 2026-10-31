"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  getGlobalAiSettings,
  saveGlobalAiSettings,
  logBreakGlassAccess,
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

    const current = await getGlobalAiSettings();
    const updated: GlobalAiSettings = {
      ...current,
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
  const user=await getCurrentUser();if(!user||!can(user,'admin.dashboard'))return{success:false,error:'forbidden'};
  const {createConversationAction}=await import('./private-messaging');
  return createConversationAction(null,subject,firstMessage,studentId,user.locale);
}
