import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether a student has completed 100% of a course's lessons,
 * and if so, issues a unique certificate if not already issued.
 */
export async function checkAndIssueCertificate(
  supabase: SupabaseClient,
  userId: string,
  courseId: string
): Promise<{ issued: boolean; code?: string; alreadyHad: boolean }> {
  try {
    // 1. Check if certificate already exists
    const { data: existingCert } = await supabase
      .from("certificates")
      .select("code")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingCert) {
      return { issued: false, code: existingCert.code, alreadyHad: true };
    }

    // 2. Fetch all lesson IDs for this course
    const { data: modules } = await supabase
      .from("modules")
      .select("id, lessons(id)")
      .eq("course_id", courseId);

    const allLessonIds: string[] = [];
    if (modules) {
      for (const mod of modules) {
        if (Array.isArray(mod.lessons)) {
          for (const l of mod.lessons) {
            allLessonIds.push(l.id);
          }
        }
      }
    }

    if (allLessonIds.length === 0) {
      return { issued: false, alreadyHad: false };
    }

    // 3. Count completed lessons for user
    const { data: completedProgress } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .in("lesson_id", allLessonIds)
      .not("completed_at", "is", null);

    const completedCount = completedProgress?.length || 0;

    // 4. If all lessons are completed, issue certificate
    if (completedCount >= allLessonIds.length) {
      const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
      const code = `FS-${randomSuffix}`;

      const { data: newCert, error } = await supabase
        .from("certificates")
        .insert({
          user_id: userId,
          course_id: courseId,
          code,
          issued_at: new Date().toISOString(),
        })
        .select("code")
        .single();

      if (!error && newCert) {
        return { issued: true, code: newCert.code, alreadyHad: false };
      }
    }

    return { issued: false, alreadyHad: false };
  } catch {
    return { issued: false, alreadyHad: false };
  }
}
