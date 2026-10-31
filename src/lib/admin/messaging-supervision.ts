import {assistantModel,ASSISTANT_MODELS} from "@/lib/messaging/models";
import {z} from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "./moderation";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";


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
        defaultModel: assistantModel(val.default_model,!!process.env.GEMINI_API_KEY,!!process.env.ANTHROPIC_API_KEY),
        defaultConfidenceThreshold: val.default_confidence_threshold ?? 0.75,
        dailyCostCapUsd: val.daily_cost_cap_usd ?? 5.0,
        studentDailyLimit: val.student_daily_limit ?? 30,
        killSwitch: Boolean(val.kill_switch),
      };
    }
  } catch {}

  throw new Error("settings_unavailable");
}

/**
 * Saves global AI settings.
 */
export async function saveGlobalAiSettings(
  settings: GlobalAiSettings,
  adminId: string
): Promise<void> {
  settings=z.object({defaultModel:z.enum(ASSISTANT_MODELS),defaultConfidenceThreshold:z.number().min(0).max(1),dailyCostCapUsd:z.number().min(0).max(1000),studentDailyLimit:z.number().int().min(0).max(1000),killSwitch:z.boolean()}).parse(settings);
  try {
    const supabase = await createClient();
    const {error}=await supabase.from("platform_settings").upsert(
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
    if(error)throw new Error("settings_unavailable");
  } catch {throw new Error("settings_unavailable");}


  await logAdminAction(
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
  const db=await createClient();const {data,error}=await db.rpc('get_messaging_supervision_stats',{p_period:period});if(error||!data)throw Error('supervision_unavailable');return data;
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
  try {
    const supabase = await createClient();
    const {error}=await supabase.from("private_conversation_access_logs").insert({
      admin_id: adminId,
      conversation_id: conversationId,
      context,
      reason,
    });
    if(error)throw new Error("audit_unavailable");
  } catch {throw new Error("audit_unavailable");}

  await logAdminAction(
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

  return [];
}
