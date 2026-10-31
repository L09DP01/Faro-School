"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { callAiAssistant } from "@/lib/messaging/ai-assistant";
import type { InstructorAiSettings, InstructorAiVersion } from "@/lib/messaging/types";

const DEFAULT_SETTINGS = (name: string): InstructorAiSettings => ({
  enabled: true,
  name: `Assistant de ${name}`,
  tone: "friendly",
  languages: ["fr", "ht"],
  greeting: `Bonjour ! Je suis l'assistant pédagogique de ${name}. Comment puis-je vous aider ?`,
  customInstructions: "Encourage les élèves à pratiquer sur des cas réels en Haïti. Reste concis.",
  knowledgeBase: {faq:[],snippets:[]},
  alwaysEscalate: [
    "remboursement",
    "rembourser",
    "paiement",
    "moncash",
    "natcash",
    "certificat",
    "diplôme",
    "note",
    "plainte",
    "compte",
    "mot de passe",
  ],
  confidenceThreshold: 0.75,
  availabilityHours: {
    enabled: true,
    start: "08:00",
    end: "20:00",
  },
  escalationEmail: "",
});

const AiSettingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().min(2).max(100),
  tone: z.enum(["friendly", "professional", "concise"]).or(z.string()),
  languages: z.array(z.enum(["fr", "ht"])).min(1),
  greeting: z.string().max(500).optional(),
  customInstructions: z.string().max(4000).optional(),
  knowledgeBase: z.object({
    faq: z.array(
      z.object({
        id: z.string(),
        question: z.string().min(2).max(300),
        answer: z.string().min(2).max(1000),
      })
    ),
    snippets: z.array(z.string().min(2).max(500)),
  }),
  alwaysEscalate: z.array(z.string()),
  confidenceThreshold: z.number().min(0.5).max(0.95),
  availabilityHours: z
    .object({
      enabled: z.boolean(),
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  escalationEmail: z.string().email().optional().or(z.literal("")),
});

export type AiActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Returns the current AI settings and last 5 versions for an instructor.
 * Enforces strict isolation: instructors can ONLY see their own.
 */
export async function getInstructorAiDataAction(
  targetInstructorId?: string
): Promise<AiActionResult<{ settings: InstructorAiSettings; versions: InstructorAiVersion[] }>> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    // Strict Isolation: instructors can ONLY read their own
    const instructorId = user.role === "instructor" ? user.id : targetInstructorId || user.id;

    const db=await createClient();const {data,error}=await db.from('instructor_ai_versions').select('id,instructor_id,version_number,settings,created_at').eq('instructor_id',instructorId).order('version_number',{ascending:false}).limit(5);
    if(error)return{success:false,error:'settings_unavailable'};
    const versions:InstructorAiVersion[]=(data||[]).map(v=>({id:v.id,instructorId:v.instructor_id,versionNumber:v.version_number,settings:v.settings,createdAt:v.created_at}));
    return{success:true,data:{settings:versions[0]?.settings||DEFAULT_SETTINGS(user.fullName||'Faro School'),versions}};
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Saves instructor AI settings, validates with Zod, and creates a new version (last 5 kept).
 */
export async function saveInstructorAiSettingsAction(
  rawSettings: any,
  targetInstructorId?: string
): Promise<AiActionResult<{ settings: InstructorAiSettings; versions: InstructorAiVersion[] }>> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    // Strict isolation
    const instructorId = user.role === "instructor" ? user.id : targetInstructorId || user.id;

    // Validate with Zod
    const parsed = AiSettingsSchema.safeParse(rawSettings);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return {
        success: false,
        error: `Validation échouée: ${firstIssue?.path.join(".")} - ${firstIssue?.message}`,
      };
    }

    const cleanSettings: InstructorAiSettings = parsed.data as InstructorAiSettings;

    const db=await createClient();const {error}=await db.rpc('save_instructor_ai_version',{p_instructor_id:instructorId,p_settings:cleanSettings});
    if(error)return{success:false,error:'settings_unavailable'};
    revalidatePath('/[locale]/admin/assistant-ia','page');return getInstructorAiDataAction(instructorId);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 1-Click Restore of an older version (from the last 5 versions).
 */
export async function restoreInstructorAiVersionAction(
  versionId: string,
  targetInstructorId?: string
): Promise<AiActionResult<{ settings: InstructorAiSettings; versions: InstructorAiVersion[] }>> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    const instructorId = user.role === "instructor" ? user.id : targetInstructorId || user.id;

    // Check version from Supabase
    let versionSettings: InstructorAiSettings | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("instructor_ai_versions")
        .select("settings, instructor_id")
        .eq("id", versionId)
        .eq("instructor_id", instructorId)
        .single();

      if (data) {
        if (user.role !== "admin" && data.instructor_id !== user.id) {
          return { success: false, error: "Accès refusé à cette version." };
        }
        versionSettings = data.settings;
      }
    } catch {}


    if (!versionSettings) {
      return { success: false, error: "Version introuvable." };
    }

    // Save as restored current version
    return await saveInstructorAiSettingsAction(versionSettings, instructorId);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Sandbox Live Test: Runs a test question against the instructor's temporary settings.
 * Does NOT persist in production conversation database.
 */
export async function testInstructorAiAction(
  question: string,
  tempSettings: InstructorAiSettings,
  courseTitle?: string
): Promise<
  AiActionResult<{
    answer: string;
    canAnswer: boolean;
    confidence: number;
    escalateReason?: string;
    model: string;
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "instructor" && user.role !== "admin")) {
      return { success: false, error: "Non autorisé." };
    }

    const trimmed = question?.trim();
    if (!trimmed) {
      return { success: false, error: "Veuillez poser une question pour le test." };
    }

    const parsed=AiSettingsSchema.safeParse(tempSettings);if(!parsed.success)return{success:false,error:'invalid_settings'};
    const db=await createClient();const {data:conversation,error}=await db.from('conversations').select('id,student_id').eq('staff_id',user.id).order('last_message_at',{ascending:false}).limit(1).maybeSingle();
    if(error||!conversation)return{success:false,error:user.locale==='ht'?'Yon konvèsasyon reyèl nesesè pou teste IA.':'Une conversation réelle est nécessaire pour tester l’assistant.'};
    const res = await callAiAssistant({
      conversationId: conversation.id,
      studentId: conversation.student_id,
      studentName: "Élève (Test Sandbox)",
      staffName: user.fullName || "Formateur",
      courseTitle: courseTitle || "Assistance Faro School",
      instructorSettings: tempSettings,
      recentMessages: [
        { senderType: "student", body: "Bonjour formateur, j'ai une question sur le module." },
      ],
      currentQuestion: trimmed,
      locale: user.locale,
    });

    return {
      success: true,
      data: {
        answer: res.answer,
        canAnswer: res.can_answer,
        confidence: res.confidence,
        escalateReason: res.escalate_reason,
        model: res.model,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
