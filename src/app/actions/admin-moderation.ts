"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import {
  logAdminAction,
  saveWordFilterSettings,
  saveCommunityRulesSettings,
  type WordFilterSettings,
  type CommunityRulesSettings,
} from "@/lib/admin/moderation";
import { getMockCommunityStore } from "@/lib/community/data";
import { updateModerationFlagStatus } from "@/lib/moderation/flag-service";

export type AdminActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Deletes a reported message from the moderation queue and marks report resolved.
 */
export async function deleteReportedMessageAction(
  reportId: string,
  messageId: string,
  reason: string = "Suppression suite à signalement"
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    const nowIso = new Date().toISOString();

    try {
      const supabase = await createClient();
      const { error: msgErr } = await supabase
        .from("community_messages")
        .update({ deleted_at: nowIso })
        .eq("id", messageId);
      if (msgErr && !isDemoMode()) {
        return { success: false, error: msgErr.message };
      }

      const { error: repErr } = await supabase
        .from("community_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      if (repErr && !isDemoMode()) {
        return { success: false, error: repErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur de base de données." };
      }
    }

    if (isDemoMode()) {
      // In-memory fallback
      const communityStore = getMockCommunityStore();
      const msg = communityStore.find((m: any) => m.id === messageId);
      if (msg) {
        msg.deletedAt = nowIso;
      }

      const reportsStore = (globalThis as any).__mockCommunityReportsStore as any[] | undefined;
      if (reportsStore) {
        const rep = reportsStore.find((r) => r.id === reportId);
        if (rep) {
          rep.status = "resolved";
          rep.messageDeleted = true;
        }
      }
    }

    logAdminAction(user.id, "moderation_delete_message", messageId, reason, { reportId });

    revalidatePath("/[locale]/admin/moderation", "page");
    revalidatePath("/[locale]/admin/communaute", "page");
    revalidatePath("/[locale]/dashboard/communaute", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la suppression." };
  }
}

/**
 * Mutes an author from the report queue (1h, 24h, 7d).
 */
export async function muteReportAuthorAction(
  reportId: string,
  authorId: string,
  duration: "1h" | "24h" | "7d",
  reason: string = "Mise en sourdine suite à signalement"
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    const now = Date.now();
    let durationMs = 60 * 60 * 1000;
    if (duration === "24h") durationMs = 24 * 60 * 60 * 1000;
    if (duration === "7d") durationMs = 7 * 24 * 60 * 60 * 1000;

    const mutedUntil = new Date(now + durationMs).toISOString();

    try {
      const supabase = await createClient();
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ muted_until: mutedUntil })
        .eq("id", authorId);
      if (profileErr && !isDemoMode()) {
        return { success: false, error: profileErr.message };
      }

      const { error: repErr } = await supabase
        .from("community_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      if (repErr && !isDemoMode()) {
        return { success: false, error: repErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur de base de données." };
      }
    }

    if (isDemoMode()) {
      const mutedStore = (globalThis as any).__mockMutedUsersStore as Map<string, any> | undefined;
      if (mutedStore) {
        mutedStore.set(authorId, {
          name: "Utilisateur",
          email: "user@example.com",
          role: "student",
          mutedUntil,
        });
      }

      const reportsStore = (globalThis as any).__mockCommunityReportsStore as any[] | undefined;
      if (reportsStore) {
        const rep = reportsStore.find((r) => r.id === reportId);
        if (rep) {
          rep.status = "resolved";
          rep.authorMutedUntil = mutedUntil;
        }
      }
    }

    logAdminAction(user.id, `moderation_mute_author_${duration}`, authorId, reason, {
      reportId,
      mutedUntil,
    });

    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la mise en sourdine." };
  }
}

/**
 * Bans a user permanently from the platform.
 */
export async function banReportAuthorAction(
  reportId: string,
  authorId: string,
  reason: string = "Bannissement définitif suite à signalement"
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    const bannedAt = new Date().toISOString();

    try {
      const supabase = await createClient();
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ banned_at: bannedAt })
        .eq("id", authorId);
      if (profileErr && !isDemoMode()) {
        return { success: false, error: profileErr.message };
      }

      const { error: repErr } = await supabase
        .from("community_reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      if (repErr && !isDemoMode()) {
        return { success: false, error: repErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur de base de données." };
      }
    }

    if (isDemoMode()) {
      const bannedStore = (globalThis as any).__mockBannedUsersStore as Map<string, any> | undefined;
      if (bannedStore) {
        bannedStore.set(authorId, {
          name: "Utilisateur",
          email: "banned@example.com",
          role: "student",
          bannedAt,
        });
      }

      const reportsStore = (globalThis as any).__mockCommunityReportsStore as any[] | undefined;
      if (reportsStore) {
        const rep = reportsStore.find((r) => r.id === reportId);
        if (rep) {
          rep.status = "resolved";
          rep.authorBannedAt = bannedAt;
        }
      }
    }

    logAdminAction(user.id, "moderation_ban_author", authorId, reason, {
      reportId,
      bannedAt,
    });

    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du bannissement." };
  }
}

/**
 * Dismisses a report without penalty.
 */
export async function dismissReportAction(
  reportId: string,
  reason: string = "Signalement classé sans suite (non fondé)"
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    try {
      const supabase = await createClient();
      const { error: repErr } = await supabase
        .from("community_reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      if (repErr && !isDemoMode()) {
        return { success: false, error: repErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur lors du rejet du signalement." };
      }
    }

    if (isDemoMode()) {
      const reportsStore = (globalThis as any).__mockCommunityReportsStore as any[] | undefined;
      if (reportsStore) {
        const rep = reportsStore.find((r) => r.id === reportId);
        if (rep) {
          rep.status = "dismissed";
        }
      }
    }

    logAdminAction(user.id, "moderation_dismiss_report", reportId, reason);

    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du rejet du signalement." };
  }
}

/**
 * 1-Click Unmute user.
 */
export async function unmuteUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    try {
      const supabase = await createClient();
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ muted_until: null })
        .eq("id", userId);
      if (profileErr && !isDemoMode()) {
        return { success: false, error: profileErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur lors de la levée de mise en sourdine." };
      }
    }

    if (isDemoMode()) {
      const mutedStore = (globalThis as any).__mockMutedUsersStore as Map<string, any> | undefined;
      if (mutedStore) {
        mutedStore.delete(userId);
      }
    }

    logAdminAction(user.id, "moderation_unmute_user", userId, "Levée de la mise en sourdine");

    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la levée de mise en sourdine." };
  }
}

/**
 * 1-Click Unban user.
 */
export async function unbanUserAction(userId: string): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    try {
      const supabase = await createClient();
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ banned_at: null })
        .eq("id", userId);
      if (profileErr && !isDemoMode()) {
        return { success: false, error: profileErr.message };
      }
    } catch (err: any) {
      if (!isDemoMode()) {
        return { success: false, error: err?.message || "Erreur lors du débannissement." };
      }
    }

    if (isDemoMode()) {
      const bannedStore = (globalThis as any).__mockBannedUsersStore as Map<string, any> | undefined;
      if (bannedStore) {
        bannedStore.delete(userId);
      }
    }

    logAdminAction(user.id, "moderation_unban_user", userId, "Rétablissement du compte débanni");

    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du débannissement." };
  }
}

/**
 * Updates word filter lists (FR and KR).
 */
export async function updateWordFilterAction(
  filters: WordFilterSettings
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    await saveWordFilterSettings(filters, user.id);
    revalidatePath("/[locale]/admin/moderation", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de mise à jour du filtre de mots." };
  }
}

/**
 * Updates community guidelines text (FR and KR).
 */
export async function updateCommunityRulesAction(
  rules: CommunityRulesSettings
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    await saveCommunityRulesSettings(rules, user.id);
    revalidatePath("/[locale]/admin/moderation", "page");
    revalidatePath("/[locale]/regles-communaute", "page");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de mise à jour des règles de la communauté." };
  }
}

/**
 * Reviews or dismisses an automated moderation flag (phone / WhatsApp offplatform).
 */
export async function reviewModerationFlagAction(
  flagId: string,
  status: "reviewed" | "dismissed"
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    await updateModerationFlagStatus(flagId, status, user.id);
    logAdminAction(user.id, `moderation_flag_${status}`, flagId, `Flag ${status}`);

    try {
      revalidatePath("/[locale]/admin/moderation", "page");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la mise à jour du flag." };
  }
}

/**
 * Mutes a user directly from a moderation flag (1h, 24h, 7d).
 */
export async function muteUserFromFlagAction(
  userId: string,
  duration: "1h" | "24h" | "7d",
  flagId?: string
): Promise<AdminActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !can(user, "community.moderate")) {
      return { success: false, error: "Action réservée aux administrateurs." };
    }

    const now = Date.now();
    let durationMs = 60 * 60 * 1000;
    if (duration === "24h") durationMs = 24 * 60 * 60 * 1000;
    if (duration === "7d") durationMs = 7 * 24 * 60 * 60 * 1000;

    const mutedUntil = new Date(now + durationMs).toISOString();

    try {
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({ muted_until: mutedUntil })
        .eq("id", userId);

      if (flagId) {
        await supabase
          .from("moderation_flags")
          .update({ status: "reviewed", reviewed_by: user.id })
          .eq("id", flagId);
      }
    } catch {}

    if (flagId) {
      await updateModerationFlagStatus(flagId, "reviewed", user.id);
    }

    logAdminAction(user.id, `moderation_mute_from_flag_${duration}`, userId, "Mise en sourdine suite à flag automatique", {
      flagId,
      mutedUntil,
    });

    try {
      revalidatePath("/[locale]/admin/moderation", "page");
    } catch {}
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la mise en sourdine." };
  }
}
