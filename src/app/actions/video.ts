"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eligibility } from "@/lib/certificates/service";
import { terminateOtherSessions, registerOrHeartbeatSession } from "@/lib/video/session";
import { headers } from "next/headers";

/**
 * Server Action: Save playback position and/or mark lesson complete.
 * Debounced and called every 10 seconds or on video pause.
 */
export async function saveLessonProgressAction(
  lessonId: string,
  positionSec: number,
  markCompleted: boolean = false
): Promise<{
  success: boolean;
  completed: boolean;
  certificateAvailable?: boolean;
  certificateIssued?: boolean;
  certificateCode?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, completed: false, error: "Non autorisé" };
    }

    const supabase = await createClient();

    // 1. Check existing progress
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("completed_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    const isAlreadyCompleted = Boolean(existing?.completed_at);
    const finalCompletedAt =
      markCompleted || isAlreadyCompleted
        ? existing?.completed_at || new Date().toISOString()
        : null;

    // 2. Upsert progress
    const { error: upsertError } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          last_position_sec: Math.max(0, Math.floor(positionSec)),
          completed_at: finalCompletedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (upsertError) {
      return { success: false, completed: false, error: upsertError.message };
    }

    // 3. If marked complete, check 100% course completion and issue certificate
    let certResult: { issued: boolean; code?: string; alreadyHad?: boolean; available?:boolean } = {
      issued: false,
      code: undefined,
    };
    if (finalCompletedAt) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("modules!inner(course_id)")
        .eq("id", lessonId)
        .single();

      const courseId = (lesson?.modules as any)?.course_id;
      if (courseId) {
        certResult = await eligibility(user.id, courseId).then(e=>({issued:false,code:undefined,available:e.eligible && !e.certificate}));
      }
    }

    return {
      success: true,
      completed: Boolean(finalCompletedAt),
      certificateAvailable: certResult.available??false,
      certificateIssued: false,
      certificateCode: certResult.code,
    };
  } catch (err: any) {
    return { success: false, completed: false, error: err?.message };
  }
}

/**
 * Server Action: Save private student note for a lesson.
 */
export async function saveLessonNoteAction(
  lessonId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Non autorisé" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("lesson_notes")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          content: String(content),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Server Action: Heartbeat check for multi-device playback.
 */
export async function heartbeatSessionAction(
  deviceId: string
): Promise<{ allowed: boolean; activeDevicesCount: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { allowed: false, activeDevicesCount: 0, error: "Non autorisé" };
    }

    const headerList = await headers();
    const userAgent = headerList.get("user-agent") || undefined;
    const result = await registerOrHeartbeatSession(user.id, deviceId, userAgent);

    return {
      allowed: result.allowed,
      activeDevicesCount: result.activeDevicesCount,
      error: result.error,
    };
  } catch (err: any) {
    return { allowed: false, activeDevicesCount: 0, error: err?.message };
  }
}

/**
 * Server Action: Terminate all other sessions except current device.
 */
export async function terminateOtherSessionsAction(
  deviceId: string
): Promise<{ success: boolean; terminatedCount: number }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, terminatedCount: 0 };
    }

    const result = await terminateOtherSessions(user.id, deviceId);
    return { success: true, terminatedCount: result.terminatedCount };
  } catch {
    return { success: false, terminatedCount: 0 };
  }
}
