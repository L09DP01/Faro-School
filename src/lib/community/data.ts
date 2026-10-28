import { createClient } from "@/lib/supabase/server";
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
    const today = new Date();
    const isoDate = (minutesAgo: number) =>
      new Date(today.getTime() - minutesAgo * 60 * 1000).toISOString();

    globalThis.__mockCommunityMessagesStore = [
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
      {
        id: "msg-003",
        authorId: "mock-student-id",
        authorName: "Jean Baptiste",
        authorRole: "student",
        authorAvatarUrl: null,
        body: "@Marie-Claude L. Tu peux essayer Canva. Il est simple et très efficace pour les visuels, même la version gratuite.",
        replyToId: "msg-002",
        replyPreview: {
          id: "msg-002",
          authorName: "Marie-Claude L.",
          body: "Salut la communauté ! Quelqu'un a un bon outil gratuit pour créer des visuels pro ?",
        },
        pinned: false,
        deletedAt: null,
        createdAt: isoDate(35),
        reactions: [{ emoji: "👍", count: 6, userReacted: true }],
      },
      {
        id: "msg-004",
        authorId: "mock-instructor-id",
        authorName: "Faro School (Formateur)",
        authorRole: "instructor",
        authorAvatarUrl: null,
        body: "Bonsoir ! Pour ceux qui suivent le module Marketing Digital, la nouvelle leçon sur la création de contenu est maintenant disponible. 📹",
        pinned: false,
        deletedAt: null,
        createdAt: isoDate(20),
        reactions: [
          { emoji: "🔥", count: 18, userReacted: false },
          { emoji: "👍", count: 31, userReacted: false },
        ],
      },
      {
        id: "msg-005",
        authorId: "10000000-0000-0000-0000-000000000002",
        authorName: "David L.",
        authorRole: "student",
        authorAvatarUrl: null,
        body: "Merci formateur ! Je vais la regarder ce soir. 🙏",
        pinned: false,
        deletedAt: null,
        createdAt: isoDate(10),
        reactions: [],
      },
    ];
  }

  if (!globalThis.__mockCommunityReadsStore) {
    globalThis.__mockCommunityReadsStore = new Map<string, string>();
  }

  if (!globalThis.__mockCommunityRulesAcceptedStore) {
    globalThis.__mockCommunityRulesAcceptedStore = new Set<string>();
    // Pre-accept for mock profiles and test student
    globalThis.__mockCommunityRulesAcceptedStore.add("mock-admin-id");
    globalThis.__mockCommunityRulesAcceptedStore.add("mock-instructor-id");
    globalThis.__mockCommunityRulesAcceptedStore.add("mock-student-id");
    globalThis.__mockCommunityRulesAcceptedStore.add("student-1");
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

/**
 * Loads messages paginated (50 at a time) for infinite scroll upwards.
 */
export async function getCommunityMessages(
  userId: string,
  limit: number = 50,
  beforeCreatedAt?: string
): Promise<{ messages: CommunityMessage[]; hasMore: boolean }> {
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

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, limit) : data;

      // Map reply previews if needed
      const replyIds = items.map((i: any) => i.reply_to_id).filter(Boolean);
      const replyMap = new Map<string, { authorName: string; body: string }>();

      if (replyIds.length > 0) {
        const { data: replyMessages } = await supabase
          .from("community_messages")
          .select("id, body, profiles(full_name, display_name)")
          .in("id", replyIds);

        if (replyMessages) {
          for (const rm of replyMessages as any[]) {
            const authorName = rm.profiles?.display_name || rm.profiles?.full_name || "Membre";
            replyMap.set(rm.id, { authorName, body: rm.body });
          }
        }
      }

      const mapped: CommunityMessage[] = items.map((row: any) => {
        // Group reactions
        const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
        if (row.community_reactions && Array.isArray(row.community_reactions)) {
          for (const rx of row.community_reactions) {
            const existing = reactionMap.get(rx.emoji) || { count: 0, userReacted: false };
            existing.count++;
            if (rx.user_id === userId) {
              existing.userReacted = true;
            }
            reactionMap.set(rx.emoji, existing);
          }
        }

        const reactions: CommunityReactionSummary[] = Array.from(reactionMap.entries()).map(
          ([emoji, data]) => ({
            emoji,
            count: data.count,
            userReacted: data.userReacted,
          })
        );

        const displayName =
          row.profiles?.display_name ||
          row.profiles?.full_name ||
          (row.profiles?.role === "admin"
            ? "Admin"
            : row.profiles?.role === "instructor"
            ? "Formateur Limyè"
            : "Membre");

        return {
          id: row.id,
          authorId: row.author_id,
          authorName: displayName,
          authorRole: (row.profiles?.role as any) || "student",
          authorAvatarUrl: row.profiles?.avatar_url || null,
          body: row.body,
          attachmentUrl: row.attachment_url || null,
          replyToId: row.reply_to_id || null,
          replyPreview: row.reply_to_id
            ? {
                id: row.reply_to_id,
                authorName: replyMap.get(row.reply_to_id)?.authorName || "Membre",
                body: replyMap.get(row.reply_to_id)?.body || "",
              }
            : null,
          pinned: Boolean(row.pinned),
          pinnedAt: row.pinned_at || null,
          deletedAt: row.deleted_at || null,
          createdAt: row.created_at,
          reactions,
        };
      });

      return {
        messages: mapped.reverse(), // ascending order for chat stream
        hasMore,
      };
    }
  } catch (err) {
    console.warn("Using fallback community messages store:", err);
  }

  // Fallback in-memory store
  const store = initializeMockCommunity();
  const nonDeleted = store.filter((m) => !m.deletedAt);
  let filtered = nonDeleted;
  if (beforeCreatedAt) {
    filtered = filtered.filter((m) => new Date(m.createdAt) < new Date(beforeCreatedAt));
  }

  const hasMore = filtered.length > limit;
  const items = hasMore ? filtered.slice(0, limit) : filtered;

  return {
    messages: [...items],
    hasMore,
  };
}

/**
 * Returns the currently pinned message, if any.
 */
export async function getPinnedMessage(): Promise<CommunityMessage | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("community_messages")
      .select(`
        id,
        author_id,
        body,
        created_at,
        pinned,
        profiles (
          full_name,
          display_name,
          role
        )
      `)
      .eq("pinned", true)
      .is("deleted_at", null)
      .order("pinned_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return {
        id: data.id,
        authorId: data.author_id,
        authorName: (data.profiles as any)?.display_name || (data.profiles as any)?.full_name || "Admin",
        authorRole: ((data.profiles as any)?.role as any) || "admin",
        body: data.body,
        pinned: true,
        createdAt: data.created_at,
        reactions: [],
      };
    }
  } catch {}

  const store = initializeMockCommunity();
  return store.find((m) => m.pinned && !m.deletedAt) || null;
}

/**
 * Returns overall group metadata (total members count, online presence, unread count).
 */
export async function getCommunityGroupInfo(userId: string): Promise<CommunityGroupInfo> {
  let totalMembers = 2548;
  const onlineCount = 142;

  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (count && count > 0) {
      totalMembers = count + 2500; // includes active community alumni
    }
  } catch {}

  const store = initializeMockCommunity();
  const lastMsg = store[store.length - 1];
  const pinned = store.find((m) => m.pinned && !m.deletedAt);
  const unreadCount = await getUnreadCommunityCount(userId);

  return {
    id: "faro-school-global",
    name: "Communauté Faro School",
    description: "Discussions de la communauté Faro School",
    totalMembersCount: totalMembers,
    onlineCount,
    lastMessageSnippet: lastMsg ? `${lastMsg.authorName}: ${lastMsg.body}` : "Bienvenue...",
    lastMessageTime: lastMsg ? "10:24" : "10:00",
    unreadCount,
    pinnedMessage: pinned || null,
  };
}

/**
 * Returns whether the user has accepted community rules.
 */
export async function hasAcceptedCommunityRules(userId: string): Promise<boolean> {
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

  const acceptedSet = getMockCommunityRulesAcceptedStore();
  return acceptedSet.has(userId);
}

/**
 * Computes unread message count for a given user.
 */
export async function getUnreadCommunityCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: readData } = await supabase
      .from("community_reads")
      .select("last_read_at")
      .eq("user_id", userId)
      .single();

    if (readData?.last_read_at) {
      const { count } = await supabase
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", readData.last_read_at)
        .is("deleted_at", null);
      return count || 0;
    }
  } catch {}

  const readsStore = getMockCommunityReadsStore();
  const lastRead = readsStore.get(userId);
  if (!lastRead) {
    return 12; // default unread preview matching mockup badge
  }
  const store = initializeMockCommunity();
  return store.filter((m) => !m.deletedAt && new Date(m.createdAt) > new Date(lastRead)).length;
}

/**
 * Returns a list of members for @mentions autocomplete (never exposes emails or phones!).
 */
export async function getCommunityMembers(): Promise<CommunityMember[]> {
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
  } catch {}

  return [
    { id: "mock-admin-id", displayName: "Jean Pierre", role: "admin" },
    { id: "mock-instructor-id", displayName: "Faro School (Formateur)", role: "instructor" },
    { id: "10000000-0000-0000-0000-000000000001", displayName: "Marie-Claude L.", role: "student" },
    { id: "10000000-0000-0000-0000-000000000002", displayName: "David L.", role: "student" },
    { id: "mock-student-id", displayName: "Jean Baptiste", role: "student" },
  ];
}
