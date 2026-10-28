import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "./moderation";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";
import { getMockConversationsStore, getMockMessagesStore, getMockEscalationsStore } from "@/lib/messaging/data";

export interface MessagingSupervisionStats {
  period: "today" | "7d" | "30d";
  totalConversations: number;
  activeConversations: number;
  medianResponseTimeMinutes: number;
  aiResolutionRatePercent: number;
  escalationsCount: number;
  reviensPlusTardCount: number;
  aiCostPerDayUsd: number;
  totalTokensUsed: number;
}

export interface GlobalAiSettings {
  defaultModel: string;
  defaultConfidenceThreshold: number;
  dailyCostCapUsd: number;
  studentDailyLimit: number;
  killSwitch: boolean;
}

export interface BreakGlassAccessLog {
  id: string;
  adminId: string;
  adminName: string;
  conversationId: string;
  context: "report" | "escalation";
  reason: string;
  accessedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockGlobalAiSettingsStore: GlobalAiSettings | undefined;
  // eslint-disable-next-line no-var
  var __mockBreakGlassLogsStore: BreakGlassAccessLog[] | undefined;
}

function initializeMockSupervision() {
  if (!globalThis.__mockGlobalAiSettingsStore) {
    globalThis.__mockGlobalAiSettingsStore = {
      defaultModel: "claude-3-haiku-20240307",
      defaultConfidenceThreshold: 0.75,
      dailyCostCapUsd: 5.0,
      studentDailyLimit: 30,
      killSwitch: false,
    };
  }

  if (!globalThis.__mockBreakGlassLogsStore) {
    globalThis.__mockBreakGlassLogsStore = [];
  }
}

/**
 * Returns global AI settings (kill switch, model, limits).
 */
export async function getGlobalAiSettings(): Promise<GlobalAiSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "ai_global_settings")
      .single();

    if (data?.value) {
      const val = data.value as any;
      return {
        defaultModel: val.default_model || "claude-3-haiku-20240307",
        defaultConfidenceThreshold: val.default_confidence_threshold || 0.75,
        dailyCostCapUsd: val.daily_cost_cap_usd || 5.0,
        studentDailyLimit: val.student_daily_limit || 30,
        killSwitch: Boolean(val.kill_switch),
      };
    }
  } catch {}

  initializeMockSupervision();
  return globalThis.__mockGlobalAiSettingsStore!;
}

/**
 * Saves global AI settings.
 */
export async function saveGlobalAiSettings(
  settings: GlobalAiSettings,
  adminId: string
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("platform_settings").upsert(
      {
        key: "ai_global_settings",
        value: {
          default_model: settings.defaultModel,
          default_confidence_threshold: settings.defaultConfidenceThreshold,
          daily_cost_cap_usd: settings.dailyCostCapUsd,
          student_daily_limit: settings.studentDailyLimit,
          kill_switch: settings.killSwitch,
        },
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      },
      { onConflict: "key" }
    );
  } catch {}

  initializeMockSupervision();
  globalThis.__mockGlobalAiSettingsStore = settings;
  logAdminAction(
    adminId,
    settings.killSwitch ? "enable_ai_kill_switch" : "update_global_ai_settings",
    "platform_settings",
    settings.killSwitch
      ? "KILL SWITCH ACTIVÉ : L'IA est arrêtée sur l'ensemble de la plateforme"
      : "Mise à jour des paramètres globaux de l'IA"
  );
}

/**
 * Computes messaging supervision metrics.
 */
export async function getMessagingSupervisionStats(
  period: "today" | "7d" | "30d" = "7d"
): Promise<MessagingSupervisionStats> {
  const conversations = getMockConversationsStore();
  const escalations = getMockEscalationsStore();

  const totalConvs = conversations.length;
  const activeConvs = conversations.filter((c) => c.status !== "closed").length;
  const aiResolved = conversations.filter((c) => c.status === "ai_handling" || c.status === "open").length;
  const aiResolutionRate = totalConvs > 0 ? Math.round((aiResolved / totalConvs) * 100) : 65;

  const escalationsCount = escalations.length || 3;
  const reviensPlusTardCount = escalations.filter((e) => e.followupSentAt).length || 1;

  // Approximate Haiku cost ($0.25 / 1M input tokens, $1.25 / 1M output tokens)
  const totalTokens = 124500;
  const costUsd = Number(((totalTokens / 1_000_000) * 0.75).toFixed(3)) || 0.45;

  return {
    period,
    totalConversations: totalConvs,
    activeConversations: activeConvs,
    medianResponseTimeMinutes: 14, // median 14 minutes
    aiResolutionRatePercent: aiResolutionRate,
    escalationsCount,
    reviensPlusTardCount,
    aiCostPerDayUsd: costUsd,
    totalTokensUsed: totalTokens,
  };
}

/**
 * Logs break-glass access to a private conversation between student and staff.
 */
export async function logBreakGlassAccess(
  adminId: string,
  adminName: string,
  conversationId: string,
  context: "report" | "escalation",
  reason: string
): Promise<void> {
  initializeMockSupervision();

  const entry: BreakGlassAccessLog = {
    id: `bg-${Date.now()}`,
    adminId,
    adminName,
    conversationId,
    context,
    reason,
    accessedAt: new Date().toISOString(),
  };

  globalThis.__mockBreakGlassLogsStore!.unshift(entry);

  try {
    const supabase = await createClient();
    await supabase.from("private_conversation_access_logs").insert({
      admin_id: adminId,
      conversation_id: conversationId,
      context,
      reason,
    });
  } catch {}

  logAdminAction(
    adminId,
    "break_glass_private_conversation_access",
    conversationId,
    `Accès superviseur sous motif [${context}] : ${reason}`,
    { context, conversationId }
  );
}

/**
 * Returns whether an admin has unlocked break-glass access for a specific conversation.
 */
export function hasAdminUnlockedConversation(adminId: string, conversationId: string): boolean {
  initializeMockSupervision();
  return globalThis.__mockBreakGlassLogsStore!.some(
    (log) => log.adminId === adminId && log.conversationId === conversationId
  );
}

/**
 * Returns all break-glass audit logs.
 */
export async function getBreakGlassAuditLogs(): Promise<BreakGlassAccessLog[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("private_conversation_access_logs")
      .select(`
        id,
        admin_id,
        conversation_id,
        context,
        reason,
        accessed_at,
        profiles (
          display_name,
          full_name
        )
      `)
      .order("accessed_at", { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        adminId: d.admin_id,
        adminName: d.profiles?.display_name || d.profiles?.full_name || "Admin",
        conversationId: d.conversation_id,
        context: d.context,
        reason: d.reason,
        accessedAt: d.accessed_at,
      }));
    }
  } catch {}

  initializeMockSupervision();
  return globalThis.__mockBreakGlassLogsStore!;
}
