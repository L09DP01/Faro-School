import {requireCommunityAccess} from "./access";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
import type {
  CommunityMessage,
  CommunityGroupInfo,
  CommunityMember,
  CommunityReactionSummary,
} from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __mockCommunityMessagesStore: CommunityMessage[] | undefined;
  // eslint-disable-next-line no-var
  var __mockCommunityReadsStore: Map<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __mockCommunityRulesAcceptedStore: Set<string> | undefined;
}

function initializeMockCommunity(): CommunityMessage[] {
  if (!globalThis.__mockCommunityMessagesStore) {
    globalThis.__mockCommunityMessagesStore = getDemoCommunityMessages();
  }
  if (!globalThis.__mockCommunityReadsStore) {
    globalThis.__mockCommunityReadsStore = new Map<string, string>();
  }
  if (!globalThis.__mockCommunityRulesAcceptedStore) {
    globalThis.__mockCommunityRulesAcceptedStore = new Set<string>();
  }
  return globalThis.__mockCommunityMessagesStore;
}

export function getMockCommunityStore(): CommunityMessage[] {
  return initializeMockCommunity();
}

export function getMockCommunityReadsStore(): Map<string, string> {
  initializeMockCommunity();
  return globalThis.__mockCommunityReadsStore!;
}

export function getMockCommunityRulesAcceptedStore(): Set<string> {
  initializeMockCommunity();
  return globalThis.__mockCommunityRulesAcceptedStore!;
}

export async function getPinnedMessage(): Promise<CommunityMessage | null> {
  await requireCommunityAccess();
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
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
          id,
          full_name,
          display_name,
          role,
          avatar_url
        )
      `)
      .eq("pinned", true)
      .is("deleted_at", null)
      .order("pinned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && row) {
      return {
        id: row.id,
        authorId: row.author_id,
        authorName: (row.profiles as any)?.display_name || (row.profiles as any)?.full_name || "Membre",
        authorRole: (row.profiles as any)?.role || "admin",
        authorAvatarUrl: (row.profiles as any)?.avatar_url || null,
        body: row.body,
        attachmentUrl: row.attachment_url,
        replyToId: row.reply_to_id,
        pinned: true,
        pinnedAt: row.pinned_at,
        deletedAt: null,
        createdAt: row.created_at,
        reactions: [],
      };
    }
  } catch {}

  if (isDemoMode()) {
    const store = initializeMockCommunity();
    return store.find((m) => m.pinned && !m.deletedAt) || null;
  }
  return null;
}

function getDemoCommunityMessages(): CommunityMessage[] {
  const today = new Date();
  const isoDate = (minutesAgo: number) =>
    new Date(today.getTime() - minutesAgo * 60 * 1000).toISOString();

  return [
    {
      id: "msg-001",
      authorId: "mock-admin-id",
      authorName: "Jean Pierre",
      authorRole: "admin",
      authorAvatarUrl: null,
      body: "Bonjour à tous ! 👋 Bienvenue dans la communauté Faro School. N'hésitez pas à poser vos questions, partager vos réalisations et aider les autres. 🚀",
      pinned: true,
      pinnedAt: isoDate(70),
      deletedAt: null,
      createdAt: isoDate(70),
      reactions: [
        { emoji: "👍", count: 24, userReacted: false },
        { emoji: "❤️", count: 8, userReacted: false },
        { emoji: "👏", count: 5, userReacted: false },
      ],
    },
    {
      id: "msg-002",
      authorId: "10000000-0000-0000-0000-000000000001",
      authorName: "Marie-Claude L.",
      authorRole: "student",
      authorAvatarUrl: null,
      body: "Salut la communauté ! Quelqu'un a un bon outil gratuit pour créer des visuels pro ?",
      pinned: false,
      deletedAt: null,
      createdAt: isoDate(45),
      reactions: [],
    },
  ];
}

/**
 * Loads messages paginated (50 at a time) for infinite scroll upwards.
 * In production: always reads from real database; returns empty when no messages exist.
 */
export async function getCommunityMessages(
  userId: string,
  limit: number = 50,
  beforeCreatedAt?: string
): Promise<{ messages: CommunityMessage[]; hasMore: boolean }> {
  await requireCommunityAccess();
  try {
    const supabase = await createClient();

    let query = supabase
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
          id,
          full_name,
          display_name,
          role,
          avatar_url
        ),
        community_reactions (
          emoji,
          user_id
        )
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (beforeCreatedAt) {
      query = query.lt("created_at", beforeCreatedAt);
    }

    const { data: rows, error } = await query;

    if (!error && rows) {
      const hasMore = rows.length > limit;
      const sliced = hasMore ? rows.slice(0, limit) : rows;

      // Group reactions per message
      const messages: CommunityMessage[] = sliced.map((row: any) => {
        const reactionsRaw: Array<{ emoji: string; user_id: string }> =
          row.community_reactions || [];

        const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
        for (const r of reactionsRaw) {
          const current = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
          current.count += 1;
          if (r.user_id === userId) {
            current.userReacted = true;
          }
          reactionMap.set(r.emoji, current);
        }

        const reactions: CommunityReactionSummary[] = Array.from(
          reactionMap.entries()
        ).map(([emoji, val]) => ({
          emoji,
          count: val.count,
          userReacted: val.userReacted,
        }));

        const author = row.profiles;
        return {
          id: row.id,
          authorId: row.author_id,
          authorName: author?.display_name || author?.full_name || "Membre",
          authorRole: author?.role || "student",
          authorAvatarUrl: author?.avatar_url || null,
          body: row.body,
          attachmentUrl: row.attachment_url || null,
          replyToId: row.reply_to_id || null,
          pinned: Boolean(row.pinned),
          pinnedAt: row.pinned_at || null,
          deletedAt: row.deleted_at || null,
          createdAt: row.created_at,
          reactions,
        };
      });

      // Reverse so chronological order (oldest to newest) is rendered bottom-up
      messages.reverse();
      return { messages, hasMore };
    }
  } catch (err) {
    console.error("[Community] Error fetching messages:", err);
  }

  if (isDemoMode()) {
    const demoMsgs = getDemoCommunityMessages();
    return { messages: demoMsgs, hasMore: false };
  }

  return { messages: [], hasMore: false };
}

/**
 * Returns overall group metadata (real member count, real presence or 0, unread count).
 * No artificial floor of 142 online or +2500 fake members.
 */
export async function getCommunityGroupInfo(userId: string): Promise<CommunityGroupInfo> {
  await requireCommunityAccess();
  let totalMembers = 0;
  let onlineCount = 0;
  let lastMsgSnippet = "Bienvenue dans la communauté";
  let lastMsgTime = "";
  let pinnedMessage: CommunityMessage | null = null;

  try {
    const supabase = await createClient();

    // 1. Exact count of registered members
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (count !== null && count !== undefined) {
      totalMembers = count;
    }

    // 2. Count members active within last 15 minutes (real presence)
    const activeCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: activeCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_seen_at", activeCutoff);
    if (activeCount !== null && activeCount !== undefined) {
      onlineCount = activeCount;
    }

    // 3. Fetch latest non-deleted message for snippet
    const { data: latestMsg } = await supabase
      .from("community_messages")
      .select("body, created_at, profiles(display_name, full_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMsg) {
      const author = (latestMsg.profiles as any)?.display_name || (latestMsg.profiles as any)?.full_name || "Membre";
      lastMsgSnippet = `${author}: ${latestMsg.body}`;
      lastMsgTime = new Date(latestMsg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // 4. Fetch pinned message
    const { data: pinnedRow } = await supabase
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
          id,
          full_name,
          display_name,
          role,
          avatar_url
        )
      `)
      .eq("pinned", true)
      .is("deleted_at", null)
      .order("pinned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pinnedRow) {
      pinnedMessage = {
        id: pinnedRow.id,
        authorId: pinnedRow.author_id,
        authorName: (pinnedRow.profiles as any)?.display_name || (pinnedRow.profiles as any)?.full_name || "Membre",
        authorRole: (pinnedRow.profiles as any)?.role || "admin",
        authorAvatarUrl: (pinnedRow.profiles as any)?.avatar_url || null,
        body: pinnedRow.body,
        attachmentUrl: pinnedRow.attachment_url,
        replyToId: pinnedRow.reply_to_id,
        pinned: true,
        pinnedAt: pinnedRow.pinned_at,
        deletedAt: null,
        createdAt: pinnedRow.created_at,
        reactions: [],
      };
    }
  } catch (err) {
    console.error("[Community] Error fetching group info:", err);
  }

  const unreadCount = await getUnreadCommunityCount(userId);

  return {
    id: "faro-school-global",
    name: "Communauté Faro School",
    description: "Discussions de la communauté Faro School",
    totalMembersCount: totalMembers,
    onlineCount,
    lastMessageSnippet: lastMsgSnippet,
    lastMessageTime: lastMsgTime,
    unreadCount,
    pinnedMessage,
  };
}

/**
 * Returns whether the user has accepted community rules.
 */
export async function hasAcceptedCommunityRules(userId: string): Promise<boolean> {
  await requireCommunityAccess();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("community_rules_accepted")
      .select("accepted_at")
      .eq("user_id", userId)
      .single();
    if (data?.accepted_at) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Computes real unread message count for a given user.
 * Returns 0 when no new messages exist (never returns a fake badge of 12 in production).
 */
export async function getUnreadCommunityCount(userId: string): Promise<number> {
  await requireCommunityAccess();
  try {
    const supabase = await createClient();
    const { data: readData } = await supabase
      .from("community_reads")
      .select("last_read_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (readData?.last_read_at) {
      const { count } = await supabase
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", readData.last_read_at)
        .neq("author_id",userId)
        .is("deleted_at", null);
      return count || 0;
    }

    // If user has never read the community, count recent messages
    const { count: allCount } = await supabase
      .from("community_messages")
      .select("id", { count: "exact", head: true })
      .neq("author_id",userId)
      .is("deleted_at", null);

    return allCount || 0;
  } catch (err) {
    console.error("[Community] Error calculating unread count:", err);
  }

  return 0;
}

/**
 * Returns a list of members for @mentions autocomplete (never exposes emails or phones!).
 */
export async function getCommunityMembers(): Promise<CommunityMember[]> {
  await requireCommunityAccess();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, role, avatar_url")
      .limit(50);

    if (data && data.length > 0) {
      return data.map((p: any) => ({
        id: p.id,
        displayName: p.display_name || p.full_name || "Membre",
        role: (p.role as any) || "student",
        avatarUrl: p.avatar_url || null,
      }));
    }
  } catch (err) {
    console.error("[Community] Error fetching community members:", err);
  }

  if (isDemoMode()) {
    return [
      { id: "mock-admin-id", displayName: "Jean Pierre", role: "admin" },
      { id: "mock-instructor-id", displayName: "Faro School (Formateur)", role: "instructor" },
    ];
  }

  return [];
}
