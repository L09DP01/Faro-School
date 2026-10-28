"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { callAiAssistant } from "@/lib/messaging/ai-assistant";
import type { InstructorAiSettings, InstructorAiVersion } from "@/lib/messaging/types";

// In-memory fallback store per instructor
declare global {
  // eslint-disable-next-line no-var
  var __mockInstructorAiSettingsStore: Map<string, InstructorAiSettings> | undefined;
  // eslint-disable-next-line no-var
  var __mockInstructorAiVersionsStore: Map<string, InstructorAiVersion[]> | undefined;
}

function initializeMockAiStores() {
  if (!globalThis.__mockInstructorAiSettingsStore) {
    globalThis.__mockInstructorAiSettingsStore = new Map();
  }
  if (!globalThis.__mockInstructorAiVersionsStore) {
    globalThis.__mockInstructorAiVersionsStore = new Map();
  }
}

const DEFAULT_SETTINGS = (name: string): InstructorAiSettings => ({
  enabled: true,
  name: `Assistant de ${name}`,
  tone: "friendly",
  languages: ["fr", "ht"],
  greeting: `Bonjour ! Je suis l'assistant pédagogique de ${name}. Comment puis-je vous aider ?`,
  customInstructions: "Encourage les élèves à pratiquer sur des cas réels en Haïti. Reste concis.",
  knowledgeBase: {
    faq: [
      {
        id: "faq-1",
        question: "Quels outils sont nécessaires pour suivre ce cours ?",
        answer: "Un smartphone ou un ordinateur avec accès Internet et votre compte Faro School actif.",
      },
      {
        id: "faq-2",
        question: "Comment obtenir de l'aide sur un exercice ?",
        answer: "Posez votre question dans cette boîte de dialogue. Je vous réponds ou transmets directement au formateur.",
      },
    ],
    snippets: [
      "Les vidéos sont optimisées pour charger avec peu de bande passante.",
      "Chaque module comporte un quiz et un exercice d'application pratique.",
    ],
  },
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
  escalationEmail: "formateur@faroschool.com",
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

    initializeMockAiStores();

    // Try Supabase fetch
    try {
      const supabase = await createClient();

      const { data: versionsData } = await supabase
        .from("instructor_ai_versions")
        .select("id, instructor_id, version_number, settings, created_at")
        .eq("instructor_id", instructorId)
        .order("version_number", { ascending: false })
        .limit(5);

      if (versionsData && versionsData.length > 0) {
        const versions: InstructorAiVersion[] = versionsData.map((v: any) => ({
          id: v.id,
          instructorId: v.instructor_id,
          versionNumber: v.version_number,
          settings: v.settings,
          createdAt: v.created_at,
        }));

        return {
          success: true,
          data: {
            settings: versions[0].settings,
            versions,
          },
        };
      }
    } catch {}

    // Mock store fallback
    const current =
      globalThis.__mockInstructorAiSettingsStore!.get(instructorId) ||
      DEFAULT_SETTINGS(user.fullName || "Formateur");

    let versions = globalThis.__mockInstructorAiVersionsStore!.get(instructorId) || [];
    if (versions.length === 0) {
      const initialVersion: InstructorAiVersion = {
        id: `v-init-${Date.now()}`,
        instructorId,
        versionNumber: 1,
        settings: current,
        createdAt: new Date().toISOString(),
      };
      versions = [initialVersion];
      globalThis.__mockInstructorAiVersionsStore!.set(instructorId, versions);
      globalThis.__mockInstructorAiSettingsStore!.set(instructorId, current);
    }

    return {
      success: true,
      data: {
        settings: current,
        versions,
      },
    };
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

    // Database save & version rotation
    try {
      const supabase = await createClient();
      await supabase.rpc("save_instructor_ai_version", {
        p_instructor_id: instructorId,
        p_settings: cleanSettings,
      });
    } catch {}

    // In-memory fallback rotation
    initializeMockAiStores();
    globalThis.__mockInstructorAiSettingsStore!.set(instructorId, cleanSettings);

    const versions = globalThis.__mockInstructorAiVersionsStore!.get(instructorId) || [];
    const nextVerNum = (versions[0]?.versionNumber || 0) + 1;
    const newVersion: InstructorAiVersion = {
      id: `v-${Date.now()}`,
      instructorId,
      versionNumber: nextVerNum,
      settings: cleanSettings,
      createdAt: new Date().toISOString(),
    };

    const updatedVersions = [newVersion, ...versions].slice(0, 5);
    globalThis.__mockInstructorAiVersionsStore!.set(instructorId, updatedVersions);

    revalidatePath("/[locale]/admin/assistant-ia", "page");
    return {
      success: true,
      data: {
        settings: cleanSettings,
        versions: updatedVersions,
      },
    };
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
    initializeMockAiStores();

    // Check version from Supabase
    let versionSettings: InstructorAiSettings | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("instructor_ai_versions")
        .select("settings, instructor_id")
        .eq("id", versionId)
        .single();

      if (data) {
        if (user.role !== "admin" && data.instructor_id !== user.id) {
          return { success: false, error: "Accès refusé à cette version." };
        }
        versionSettings = data.settings;
      }
    } catch {}

    // Check mock fallback
    if (!versionSettings) {
      const versions = globalThis.__mockInstructorAiVersionsStore!.get(instructorId) || [];
      const match = versions.find((v) => v.id === versionId);
      if (match) {
        versionSettings = match.settings;
      }
    }

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

    const res = await callAiAssistant({
      conversationId: "sandbox-test-conv",
      studentId: "sandbox-student",
      studentName: "Élève (Test Sandbox)",
      staffName: user.fullName || "Formateur",
      courseTitle: courseTitle || "Marketing Digital & Entrepreneuriat",
      instructorSettings: tempSettings,
      recentMessages: [
        { senderType: "student", body: "Bonjour formateur, j'ai une question sur le module." },
      ],
      currentQuestion: trimmed,
      locale: "fr",
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
