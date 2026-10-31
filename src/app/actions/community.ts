"use server";

import {hasCommunityAccess} from "@/lib/community/access";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {checkStoredProfanity} from "@/lib/community/stored-word-filter";
import { containsUrl } from "@/lib/community/word-filter";
import { checkMessageModeration } from "@/lib/moderation";
import { recordModerationFlag } from "@/lib/moderation/flag-service";
import {
  getMockCommunityStore,
  getMockCommunityReadsStore,
  getMockCommunityRulesAcceptedStore,
} from "@/lib/community/data";
import type { CommunityMessage } from "@/lib/community/types";

// In-memory rate limiting map: userId -> timestamp[]
const userPostTimestamps = new Map<string, number[]>();

function checkRateLimit(userId: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const timestamps = userPostTimestamps.get(userId) || [];
  // Keep only timestamps from the last 1 hour
  const recent = timestamps.filter((t) => now - t < 3600000);

  // Check 5 messages per 10 seconds
  const last10s = recent.filter((t) => now - t < 10000);
  if (last10s.length >= 5) {
    return {
      allowed: false,
      error: "Vous envoyez des messages trop vite. Veuillez patienter quelques secondes (max 5 msgs / 10s).",
    };
  }

  // Check 100 messages per hour
  if (recent.length >= 100) {
    return {
      allowed: false,
      error: "Limite horaire atteinte (100 messages par heure). Veuillez réessayer plus tard.",
    };
  }

  recent.push(now);
  userPostTimestamps.set(userId, recent);
  return { allowed: true };
}

export type CommunityActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Post a new message in the global community group.
 */
export async function postMessageAction(
  body: string,
  replyToId?: string | null,
  attachmentUrl?: string | null,
  clientMessageId?: string | null,
  locale: string = "fr"
): Promise<CommunityActionResult<CommunityMessage>> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) {
      return { success: false, error: "Vous devez être connecté pour participer à la communauté." };
    }

    const trimmedBody = body?.trim() || "";
    if (!trimmedBody && !attachmentUrl) {
      return { success: false, error: "Le message ne peut pas être vide." };
    }

    if (trimmedBody.length > 2000) {
      return { success: false, error: "Le message ne doit pas dépasser 2 000 caractères." };
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error };
    }

    // Moderation: Check Phone Numbers and WhatsApp / Off-platform attempts
    // Applies to student role (admins exempt)
    if (user.role !== "admin") {
      const modCheck = checkMessageModeration(trimmedBody);
      if (modCheck.blocked) {
        await recordModerationFlag({
          userId: user.id,
          channelId: "community",
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

    // Profanity and safety filter
    const profanity = await checkStoredProfanity(trimmedBody);
    if (profanity.blocked) {
      return {
        success: false,
        error: profanity.reason || "Le message contient des propos contraires aux règles de la communauté.",
      };
    }

    // Idempotency: If clientMessageId provided, check if already exists
    if (clientMessageId) {
      try {
        const supabase = await createClient();
        const { data: existing } = await supabase
          .from("community_messages")
          .select(`
            id,
            author_id,
            body,
            attachment_url,
            reply_to_id,
            pinned,
            pinned_at,
            deleted_at,
            created_at,
            profiles (
              display_name,
              full_name,
              role,
              avatar_url
            )
          `)
          .eq("author_id", user.id)
          .eq("client_message_id", clientMessageId)
          .maybeSingle();

        if (existing) {
          return {
            success: true,
            data: {
              id: existing.id,
              authorId: existing.author_id,
              authorName:
                (existing.profiles as any)?.display_name ||
                (existing.profiles as any)?.full_name ||
                user.fullName,
              authorRole: ((existing.profiles as any)?.role as any) || user.role,
              authorAvatarUrl: (existing.profiles as any)?.avatar_url || null,
              body: existing.body,
              attachmentUrl: existing.attachment_url || null,
              replyToId: existing.reply_to_id || null,
              pinned: Boolean(existing.pinned),
              pinnedAt: existing.pinned_at || null,
              deletedAt: null,
              createdAt: existing.created_at,
              reactions: [],
            },
          };
        }
      } catch {}

      const store = getMockCommunityStore();
      const existingInStore = store.find(
        (m: any) => m.authorId === user.id && m.clientMessageId === clientMessageId
      );
      if (existingInStore) {
        return { success: true, data: existingInStore };
      }
    }

    // Check link restrictions (< 24 hours account age)
    if (containsUrl(trimmedBody)) {
      try {
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("created_at")
          .eq("id", user.id)
          .single();

        if (profile?.created_at) {
          const accountAgeMs = Date.now() - new Date(profile.created_at).getTime();
          if (accountAgeMs < 24 * 60 * 60 * 1000) {
            return {
              success: false,
              error: "Pour éviter les spams, votre compte doit être actif depuis au moins 24 heures pour partager des liens.",
            };
          }
        }
      } catch {}
    }

    // Check if user is muted or banned
    try {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("banned_at, muted_until")
        .eq("id", user.id)
        .single();

      if (profile?.banned_at) {
        return { success: false, error: "Votre compte a été banni de la communauté." };
      }
      if (profile?.muted_until && new Date(profile.muted_until) > new Date()) {
        const until = new Date(profile.muted_until).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          success: false,
          error: `Vous avez été mis en sourdine par un modérateur jusqu'à ${until}.`,
        };
      }
    } catch {}

    // Check reply preview if replyToId is present
    let replyPreview: { id: string; authorName: string; body: string } | null = null;
    if (replyToId) {
      try {
        const supabase = await createClient();
        const { data: parentMsg } = await supabase
          .from("community_messages")
          .select("id, body, profiles(display_name, full_name)")
          .eq("id", replyToId)
          .single();
        if (parentMsg) {
          replyPreview = {
            id: parentMsg.id,
            authorName:
              (parentMsg.profiles as any)?.display_name ||
              (parentMsg.profiles as any)?.full_name ||
              "Membre",
            body: parentMsg.body,
          };
        }
      } catch {}

      if (!replyPreview) {
        const store = getMockCommunityStore();
        const parent = store.find((m) => m.id === replyToId);
        if (parent) {
          replyPreview = {
            id: parent.id,
            authorName: parent.authorName,
            body: parent.body,
          };
        }
      }
    }

    // Attempt Supabase insert
    try {
      const supabase = await createClient();
      const { data: inserted, error: insertError } = await supabase
        .from("community_messages")
        .insert({
          author_id: user.id,
          body: trimmedBody,
          reply_to_id: replyToId || null,
          attachment_url: attachmentUrl || null,
          client_message_id: clientMessageId || null,
        })
        .select(`
          id,
          author_id,
          body,
          attachment_url,
          reply_to_id,
          pinned,
          pinned_at,
          deleted_at,
          created_at,
          profiles (
            display_name,
            full_name,
            role,
            avatar_url
          )
        `)
        .single();

      if (inserted && !insertError) {
        const message: CommunityMessage = {
          id: inserted.id,
          authorId: inserted.author_id,
          authorName:
            (inserted.profiles as any)?.display_name ||
            (inserted.profiles as any)?.full_name ||
            user.fullName,
          authorRole: ((inserted.profiles as any)?.role as any) || user.role,
          authorAvatarUrl: (inserted.profiles as any)?.avatar_url || null,
          body: inserted.body,
          attachmentUrl: inserted.attachment_url || null,
          replyToId: inserted.reply_to_id || null,
          replyPreview,
          pinned: Boolean(inserted.pinned),
          pinnedAt: inserted.pinned_at || null,
          deletedAt: null,
          createdAt: inserted.created_at,
          reactions: [],
        };

        revalidatePath("/[locale]/dashboard/communaute", "page");
        revalidatePath("/[locale]/admin/communaute", "page");
        return { success: true, data: message };
      }
    } catch {}

    // Fallback: in-memory mock store
    const store = getMockCommunityStore();
    const newMsg: CommunityMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      authorId: user.id,
      authorName: user.fullName || "Utilisateur",
      authorRole: user.role,
      authorAvatarUrl: null,
      body: trimmedBody,
      attachmentUrl: attachmentUrl || null,
      replyToId: replyToId || null,
      replyPreview,
      pinned: false,
      pinnedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      reactions: [],
      clientMessageId: clientMessageId || undefined,
    } as any;
    store.push(newMsg);

    return { success: true, data: newMsg };
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible d'envoyer le message." };
  }
}

/**
 * Toggle an emoji reaction on a message.
 */
export async function toggleReactionAction(
  messageId: string,
  emoji: string
): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) {
      return { success: false, error: "Vous devez être connecté pour réagir." };
    }

    try {
      const supabase = await createClient();
      const { data: existing } = await supabase
        .from("community_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .single();

      if (existing) {
        await supabase
          .from("community_reactions")
          .delete()
          .eq("id", existing.id);
      } else {
        await supabase.from("community_reactions").insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      }
      return { success: true };
    } catch {}

    // Fallback in-memory
    const store = getMockCommunityStore();
    const msg = store.find((m) => m.id === messageId);
    if (msg) {
      const existing = msg.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userReacted) {
          existing.count = Math.max(0, existing.count - 1);
          existing.userReacted = false;
        } else {
          existing.count += 1;
          existing.userReacted = true;
        }
      } else {
        msg.reactions.push({ emoji, count: 1, userReacted: true });
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de réaction." };
  }
}

/**
 * Pin or unpin a message (Admin & Instructor only).
 */
export async function pinMessageAction(
  messageId: string,
  targetPinned: boolean
): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "instructor")) {
      return { success: false, error: "Seuls les administrateurs et formateurs peuvent épingler des messages." };
    }

    try {
      const supabase = await createClient();
      // Unpin other messages if pinning this one
      if (targetPinned) {
        await supabase
          .from("community_messages")
          .update({ pinned: false })
          .eq("pinned", true);
      }

      const { error } = await supabase
        .from("community_messages")
        .update({
          pinned: targetPinned,
          pinned_at: targetPinned ? new Date().toISOString() : null,
        })
        .eq("id", messageId);

      if (!error) {
        revalidatePath("/[locale]/dashboard/communaute", "page");
        revalidatePath("/[locale]/admin/communaute", "page");
        return { success: true };
      }
    } catch {}

    // Fallback store
    const store = getMockCommunityStore();
    if (targetPinned) {
      store.forEach((m) => {
        m.pinned = false;
        m.pinnedAt = null;
      });
    }
    const target = store.find((m) => m.id === messageId);
    if (target) {
      target.pinned = targetPinned;
      target.pinnedAt = targetPinned ? new Date().toISOString() : null;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de l'épinglage." };
  }
}

/**
 * Soft delete a message.
 * Admin can delete any message. Author can delete within 5 minutes of creation.
 */
export async function deleteMessageAction(messageId: string): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) {
      return { success: false, error: "Vous devez être connecté." };
    }

    let isAllowed = user.role === "admin";

    try {
      const supabase = await createClient();
      const { data: msg } = await supabase
        .from("community_messages")
        .select("id, author_id, created_at")
        .eq("id", messageId)
        .single();

      if (msg) {
        if (!isAllowed && msg.author_id === user.id) {
          const ageMs = Date.now() - new Date(msg.created_at).getTime();
          if (ageMs <= 5 * 60 * 1000) {
            isAllowed = true;
          }
        }

        if (!isAllowed) {
          return {
            success: false,
            error: "Vous ne pouvez supprimer que vos propres messages dans un délai de 5 minutes.",
          };
        }

        const { error } = await supabase
          .from("community_messages")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", messageId);

        if (!error) {
          revalidatePath("/[locale]/dashboard/communaute", "page");
          revalidatePath("/[locale]/admin/communaute", "page");
          return { success: true };
        }
      }
    } catch {}

    // Fallback store
    const store = getMockCommunityStore();
    const msg = store.find((m) => m.id === messageId);
    if (msg) {
      if (!isAllowed && msg.authorId === user.id) {
        const ageMs = Date.now() - new Date(msg.createdAt).getTime();
        if (ageMs <= 5 * 60 * 1000) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        return {
          success: false,
          error: "Vous ne pouvez supprimer que vos propres messages dans un délai de 5 minutes.",
        };
      }

      msg.deletedAt = new Date().toISOString();
      return { success: true };
    }

    return { success: false, error: "Message introuvable." };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de suppression." };
  }
}

/**
 * Report a message for moderation.
 */
export async function reportMessageAction(
  messageId: string,
  reason: string
): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) {
      return { success: false, error: "Vous devez être connecté pour signaler un message." };
    }

    try {
      const supabase = await createClient();
      const { error } = await supabase.from("community_reports").insert({
        message_id: messageId,
        reporter_id: user.id,
        reason: reason.trim() || "Contenu inapproprié ou spam",
        status: "pending",
      });

      if (!error) {
        return { success: true };
      }
    } catch {}

    // Fallback simulation
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du signalement." };
  }
}

/**
 * Moderate a user: mute (1h, 24h, 7d), unmute, ban, or unban (Admin only).
 */
export async function moderateUserAction(
  targetUserId: string,
  action: "mute_1h" | "mute_24h" | "mute_7d" | "unmute" | "ban" | "unban",
  reason?: string
): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return { success: false, error: "Seul un administrateur peut modérer les utilisateurs." };
    }

    let mutedUntil: string | null = null;
    let bannedAt: string | null = null;
    const now = new Date();

    if (action === "mute_1h") {
      mutedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (action === "mute_24h") {
      mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (action === "mute_7d") {
      mutedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (action === "ban") {
      bannedAt = now.toISOString();
    } else if (action === "unmute") {
      mutedUntil = null;
    } else if (action === "unban") {
      bannedAt = null;
    }

    try {
      const supabase = await createClient();
      const updateData: any = {};
      if (action.startsWith("mute") || action === "unmute") {
        updateData.muted_until = mutedUntil;
      }
      if (action === "ban" || action === "unban") {
        updateData.banned_at = bannedAt;
      }

      await supabase.from("profiles").update(updateData).eq("id", targetUserId);

      // Audit log
      await supabase.from("admin_audit_logs").insert({
        admin_id: user.id,
        action: `community_moderation_${action}`,
        target_id: targetUserId,
        details: { reason: reason || "Modération communauté", action },
      });

      return { success: true };
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de modération." };
  }
}

/**
 * Mark community messages as read for the current user.
 */
export async function markCommunityReadAction(): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) return { success: false };

    const now = new Date().toISOString();

    try {
      const supabase = await createClient();
      await supabase.from("community_reads").upsert(
        {
          user_id: user.id,
          last_read_at: now,
        },
        { onConflict: "user_id" }
      );
    } catch {}

    const readsStore = getMockCommunityReadsStore();
    readsStore.set(user.id, now);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Accept community guidelines/rules.
 */
export async function acceptCommunityRulesAction(): Promise<CommunityActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user || !await hasCommunityAccess(user)) return { success: false, error: "Non connecté." };

    try {
      const supabase = await createClient();
      await supabase.from("community_rules_accepted").upsert(
        {
          user_id: user.id,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } catch {}

    const acceptedStore = getMockCommunityRulesAcceptedStore();
    acceptedStore.add(user.id);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
