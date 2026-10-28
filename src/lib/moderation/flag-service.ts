import { createClient } from "@/lib/supabase/server";

export interface ModerationFlagRecord {
  id: string;
  channelId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  userId: string;
  userName?: string;
  userEmail?: string;
  reason: "phone" | "offplatform";
  excerpt: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  reviewedBy?: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockModerationFlagsStore: ModerationFlagRecord[] | undefined;
}

export function getMockModerationFlagsStore(): ModerationFlagRecord[] {
  if (!globalThis.__mockModerationFlagsStore) {
    globalThis.__mockModerationFlagsStore = [
      {
        id: "flag-001",
        channelId: "community",
        userId: "user-violator-1",
        userName: "Jean Pierre",
        userEmail: "jp@example.com",
        reason: "phone",
        excerpt: "+509 •• •• 45 67",
        status: "open",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "flag-002",
        channelId: "community",
        userId: "user-violator-2",
        userName: "Marc Antoine",
        userEmail: "marc@example.com",
        reason: "offplatform",
        excerpt: "ekri m sou whatsapp...",
        status: "open",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }
  return globalThis.__mockModerationFlagsStore;
}

/**
 * Records a moderation flag when a message is blocked.
 * If user accumulates 3 flags in 24 hours, automatically mutes them for 24 hours.
 */
export async function recordModerationFlag(params: {
  userId: string;
  channelId?: string;
  conversationId?: string;
  messageId?: string;
  reason: "phone" | "offplatform";
  excerpt: string;
}): Promise<{ isMuted: boolean; flagCount: number }> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let flagCount = 1;
  let isMuted = false;

  try {
    const supabase = await createClient();

    // 1. Insert flag into database
    await supabase.from("moderation_flags").insert({
      user_id: params.userId,
      channel_id: params.channelId || null,
      conversation_id: params.conversationId || null,
      message_id: params.messageId || null,
      reason: params.reason,
      excerpt: params.excerpt,
      status: "open",
      created_at: now.toISOString(),
    });

    // 2. Count flags for this user in last 24h
    const { count } = await supabase
      .from("moderation_flags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .gte("created_at", twentyFourHoursAgo);

    flagCount = count || 1;

    // 3. If >= 3 flags, mute for 24h
    if (flagCount >= 3) {
      const muteUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("profiles")
        .update({ muted_until: muteUntil })
        .eq("id", params.userId);

      // Create notification for admin
      await supabase.from("notifications").insert({
        user_id: params.userId,
        type: "security_alert",
        payload: {
          title: "Compte mis en sourdine",
          message:
            "Votre compte a été mis en sourdine pendant 24 heures suite à plusieurs tentatives de partage de numéros ou d'invitations hors plateforme.",
        },
      });

      isMuted = true;
    }
  } catch {
    // In-memory fallback
    const store = getMockModerationFlagsStore();
    const newFlag: ModerationFlagRecord = {
      id: `flag-${Date.now()}`,
      channelId: params.channelId || null,
      conversationId: params.conversationId || null,
      messageId: params.messageId || null,
      userId: params.userId,
      reason: params.reason,
      excerpt: params.excerpt,
      status: "open",
      createdAt: now.toISOString(),
    };
    store.unshift(newFlag);

    const userRecentFlags = store.filter(
      (f) => f.userId === params.userId && new Date(f.createdAt) >= new Date(twentyFourHoursAgo)
    );
    flagCount = userRecentFlags.length;
    if (flagCount >= 3) {
      isMuted = true;
    }
  }

  return { isMuted, flagCount };
}

/**
 * Retrieves moderation flags for admin review.
 */
export async function getModerationFlags(status: "open" | "all" = "all"): Promise<ModerationFlagRecord[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("moderation_flags")
      .select(`
        id,
        channel_id,
        conversation_id,
        message_id,
        user_id,
        reason,
        excerpt,
        status,
        created_at,
        reviewed_by,
        profiles:user_id (
          display_name,
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (status === "open") {
      query = query.eq("status", "open");
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        channelId: d.channel_id,
        conversationId: d.conversation_id,
        messageId: d.message_id,
        userId: d.user_id,
        userName: d.profiles?.display_name || d.profiles?.full_name || "Utilisateur",
        userEmail: d.profiles?.email || undefined,
        reason: d.reason,
        excerpt: d.excerpt,
        status: d.status,
        createdAt: d.created_at,
        reviewedBy: d.reviewed_by,
      }));
    }
  } catch {}

  const store = getMockModerationFlagsStore();
  if (status === "open") {
    return store.filter((f) => f.status === "open");
  }
  return store;
}

/**
 * Updates a moderation flag status.
 */
export async function updateModerationFlagStatus(
  flagId: string,
  status: "reviewed" | "dismissed",
  adminId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    await supabase
      .from("moderation_flags")
      .update({ status, reviewed_by: adminId })
      .eq("id", flagId);
  } catch {}

  const store = getMockModerationFlagsStore();
  const f = store.find((flag) => flag.id === flagId);
  if (f) {
    f.status = status;
    f.reviewedBy = adminId;
  }
  return true;
}
