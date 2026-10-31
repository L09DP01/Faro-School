import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";

export interface CommunityReportItem {
  id: string;
  messageId: string;
  messageBody: string;
  messageCreatedAt: string;
  messageDeleted: boolean;
  authorId: string;
  authorName: string;
  authorRole: "student" | "instructor" | "admin";
  authorAvatarUrl?: string | null;
  authorMutedUntil?: string | null;
  authorBannedAt?: string | null;
  reporterId: string;
  reporterName: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

export interface MutedUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  mutedUntil: string;
  isExpired: boolean;
}

export interface BannedUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  bannedAt: string;
}

export interface WordFilterSettings {
  fr: string[];
  ht: string[];
}

export interface CommunityRulesSettings {
  fr: string;
  ht: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockCommunityReportsStore: CommunityReportItem[] | undefined;
  // eslint-disable-next-line no-var
  var __mockWordFilterStore: WordFilterSettings | undefined;
  // eslint-disable-next-line no-var
  var __mockCommunityRulesStore: CommunityRulesSettings | undefined;
  // eslint-disable-next-line no-var
  var __mockMutedUsersStore: Map<string, { name: string; email: string; role: string; mutedUntil: string }> | undefined;
  // eslint-disable-next-line no-var
  var __mockBannedUsersStore: Map<string, { name: string; email: string; role: string; bannedAt: string }> | undefined;
  // eslint-disable-next-line no-var
  var __mockAuditLogsStore: any[] | undefined;
}

function initializeMockModeration() {
  if (!globalThis.__mockWordFilterStore) {
    globalThis.__mockWordFilterStore = {
      fr: ["connard", "salope", "bâtard", "batard", "enculé", "encule", "pute", "nique", "merde", "trouduc"],
      ht: ["madichon", "tenten", "kokat", "koko", "baba", "kriye", "salopri", "fatra", "volè", "vole", "kouto", "kaka"],
    };
  }

  if (!globalThis.__mockCommunityRulesStore) {
    globalThis.__mockCommunityRulesStore = {
      fr: `### Règles de la Communauté Faro School

1. **Respect et courtoisie** : Tous les membres méritent respect et bienveillance. Aucun propos haineux, discriminatoire ou insultant ne sera toléré.
2. **Pas de spam ni d'auto-promotion** : Les liens externes suspects, sollicitations financières ou offres douteuses sont strictement interdits.
3. **Entraide et partage** : Posez vos questions clairement et partagez vos apprentissages pour grandir ensemble.`,
      ht: `### Règleman Kominote Faro School

1. **Respè ak bèl konpòtman** : Tout manm merite respè ak jantiyès. Okenn jouman, diskriminasyon oswa ensilte pap tolere.
2. **Pa fè spam ni piblisite** : Lyen dwòl, pwopozisyon lajan fasil oswa aktivite sispèk entèdi nèt.
3. **Kole zepòl ak pataj** : Poze kesyon w yo klè epi pataje sa w aprann pou nou tout ka avanse ansanm.`,
    };
  }

  if (!globalThis.__mockMutedUsersStore) {
    globalThis.__mockMutedUsersStore = new Map([
      [
        "mock-muted-user-1",
        {
          name: "Jean Paul",
          email: "jean.paul@yahoo.com",
          role: "student",
          mutedUntil: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        },
      ],
    ]);
  }

  if (!globalThis.__mockBannedUsersStore) {
    globalThis.__mockBannedUsersStore = new Map([
      [
        "mock-banned-user-1",
        {
          name: "Marc Antoine",
          email: "marc.spammer@gmail.com",
          role: "student",
          bannedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    ]);
  }

  if (!globalThis.__mockCommunityReportsStore) {
    globalThis.__mockCommunityReportsStore = [
      {
        id: "rep-001",
        messageId: "msg-bad-1",
        messageBody: "Rejoignez ce groupe WhatsApp pour doubler vos goudes en 24h sans effort !",
        messageCreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        messageDeleted: false,
        authorId: "10000000-0000-0000-0000-000000000002",
        authorName: "David L.",
        authorRole: "student",
        authorAvatarUrl: null,
        authorMutedUntil: null,
        authorBannedAt: null,
        reporterId: "mock-student-id",
        reporterName: "Jean Baptiste",
        reason: "Spam financier suspect et arnaque pyramidale",
        status: "pending",
        createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
      {
        id: "rep-002",
        messageId: "msg-bad-2",
        messageBody: "Tu ne comprends rien, apprends à lire avant de poser des questions !",
        messageCreatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        messageDeleted: false,
        authorId: "mock-user-aggressive",
        authorName: "Élève Agressif",
        authorRole: "student",
        authorAvatarUrl: null,
        authorMutedUntil: null,
        authorBannedAt: null,
        reporterId: "10000000-0000-0000-0000-000000000001",
        reporterName: "Marie Dieudonné",
        reason: "Propos agressifs et non respectueux des règles",
        status: "pending",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  if (!globalThis.__mockAuditLogsStore) {
    globalThis.__mockAuditLogsStore = [];
  }
}

export async function logAdminAction(adminId:string,action:string,targetId:string,reason?:string,details?:any){
 const db=await createClient();const {error}=await db.from('admin_audit_logs').insert({admin_id:adminId,action,target_id:targetId,reason:reason||null,details:details||{}});
 if(error)throw new Error('audit_unavailable');
}
export async function getModerationAuditLogs(){
 const db=await createClient();const {data,error}=await db.from('admin_audit_logs').select('id,admin_id,action,target_id,reason,details,created_at').order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error('audit_unavailable');return(data||[]).map(row=>({id:row.id,adminId:row.admin_id,action:row.action,targetId:row.target_id,reason:row.reason,details:row.details,createdAt:row.created_at}));
}

/**
 * Returns reports queue.
 */
export async function getModerationReports(status: string = "pending"): Promise<CommunityReportItem[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("community_reports")
      .select(`
        id,
        message_id,
        reporter_id,
        reason,
        status,
        created_at,
        message:community_messages!message_id (
          id,
          body,
          created_at,
          deleted_at,
          author:profiles!author_id (
            id,
            display_name,
            full_name,
            role,
            avatar_url,
            muted_until,
            banned_at
          )
        ),
        reporter:profiles!reporter_id (
          display_name,
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        messageId: row.message_id,
        messageBody: row.message?.body || "[Message supprimé]",
        messageCreatedAt: row.message?.created_at || row.created_at,
        messageDeleted: Boolean(row.message?.deleted_at),
        authorId: row.message?.author?.id || "unknown",
        authorName:
          row.message?.author?.display_name ||
          row.message?.author?.full_name ||
          "Utilisateur",
        authorRole: row.message?.author?.role || "student",
        authorAvatarUrl: row.message?.author?.avatar_url || null,
        authorMutedUntil: row.message?.author?.muted_until || null,
        authorBannedAt: row.message?.author?.banned_at || null,
        reporterId: row.reporter_id,
        reporterName: row.reporter?.display_name || row.reporter?.full_name || "Membre",
        reason: row.reason,
        status: row.status,
        createdAt: row.created_at,
      }));
    }
    if (data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Moderation] Error fetching moderation reports:", err);
  }

  if (isDemoMode()) {
    initializeMockModeration();
    const store = globalThis.__mockCommunityReportsStore!;
    if (status === "all") return store;
    return store.filter((r) => r.status === status);
  }

  return [];
}

/**
 * Returns lists of muted and banned users with automatic expiry check.
 */
export async function getMutedAndBannedUsers(): Promise<{
  mutedUsers: MutedUserItem[];
  bannedUsers: BannedUserItem[];
}> {
  const now = new Date();

  try {
    const supabase = await createClient();

    // 1. Fetch profiles with muted_until or banned_at
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, email, role, muted_until, banned_at")
      .or("muted_until.is.not.null,banned_at.is.not.null");

    if (data && data.length > 0) {
      const mutedUsers: MutedUserItem[] = [];
      const bannedUsers: BannedUserItem[] = [];

      for (const p of data) {
        if (p.muted_until) {
          const muteDate = new Date(p.muted_until);
          const isExpired = muteDate <= now;
          mutedUsers.push({
            id: p.id,
            name: p.display_name || p.full_name || "Utilisateur",
            email: p.email || "",
            role: p.role,
            mutedUntil: p.muted_until,
            isExpired,
          });
        }
        if (p.banned_at) {
          bannedUsers.push({
            id: p.id,
            name: p.display_name || p.full_name || "Utilisateur",
            email: p.email || "",
            role: p.role,
            bannedAt: p.banned_at,
          });
        }
      }

      return { mutedUsers, bannedUsers };
    }
  } catch (err) {
    console.error("[Moderation] Error fetching muted/banned users:", err);
  }

  if (isDemoMode()) {
    initializeMockModeration();
    const mutedUsers: MutedUserItem[] = [];
    globalThis.__mockMutedUsersStore!.forEach((v, k) => {
      const isExpired = new Date(v.mutedUntil) <= now;
      mutedUsers.push({
        id: k,
        name: v.name,
        email: v.email,
        role: v.role,
        mutedUntil: v.mutedUntil,
        isExpired,
      });
    });

    const bannedUsers: BannedUserItem[] = [];
    globalThis.__mockBannedUsersStore!.forEach((v, k) => {
      bannedUsers.push({
        id: k,
        name: v.name,
        email: v.email,
        role: v.role,
        bannedAt: v.bannedAt,
      });
    });

    return { mutedUsers, bannedUsers };
  }

  return { mutedUsers: [], bannedUsers: [] };
}

/**
 * Returns word filters for FR and KR.
 */
export async function getWordFilterSettings(): Promise<WordFilterSettings> {
  try {
    const supabase = await createClient();
    const { data,error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "word_filter")
      .single();

    if(error)throw Error("settings_unavailable");
    if (data?.value) {
      return data.value as WordFilterSettings;
    }
  } catch {throw Error("settings_unavailable");}
  return {fr:[],ht:[]};
}

/**
 * Saves word filters.
 */
export async function saveWordFilterSettings(
  filters: WordFilterSettings,
  adminId: string
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: "word_filter",
        value: filters,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      },
      { onConflict: "key" }
    );
    if (error && !isDemoMode()) {
      throw error;
    }
  } catch (err) {
    if (!isDemoMode()) throw err;
  }

  initializeMockModeration();
  globalThis.__mockWordFilterStore = filters;
  await logAdminAction(adminId, "update_word_filter", "platform_settings", "Mise à jour des filtres de mots");
}

/**
 * Returns community rules text for FR and KR.
 */
export async function getCommunityRulesSettings(): Promise<CommunityRulesSettings> {
  try {
    const supabase = await createClient();
    const { data,error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "community_rules")
      .single();

    if(error)throw Error("settings_unavailable");
    if (data?.value) {
      return data.value as CommunityRulesSettings;
    }
  } catch {throw Error("settings_unavailable");}
  return {fr:"",ht:""};
}

/**
 * Saves community rules text.
 */
export async function saveCommunityRulesSettings(
  rules: CommunityRulesSettings,
  adminId: string
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: "community_rules",
        value: rules,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      },
      { onConflict: "key" }
    );
    if (error && !isDemoMode()) {
      throw error;
    }
  } catch (err) {
    if (!isDemoMode()) throw err;
  }

  initializeMockModeration();
  globalThis.__mockCommunityRulesStore = rules;
  await logAdminAction(adminId, "update_community_rules", "platform_settings", "Mise à jour du texte des règles de communauté");
}
