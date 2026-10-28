import { createClient } from "@/lib/supabase/server";

export interface LessonAccessCheck {
  canAccess: boolean;
  isFreePreview: boolean;
  videoId: string | null;
  courseId: string;
}

/**
 * Checks if a user has permission to watch a lesson:
 * 1. Admin users have universal access
 * 2. Lessons with is_free_preview = true are accessible to everyone
 * 3. Enrolled students have full access to their enrolled courses
 */
export async function checkLessonAccess(
  lessonId: string,
  userId: string
): Promise<LessonAccessCheck> {
  const supabase = await createClient();

  // Fetch lesson and parent module/course
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select(`
      id,
      video_id,
      is_free_preview,
      modules!inner (
        course_id
      )
    `)
    .eq("id", lessonId)
    .single();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found");
  }

  const moduleData = lesson.modules as unknown as { course_id: string };
  const courseId = moduleData.course_id;

  if (lesson.is_free_preview) {
    return {
      canAccess: true,
      isFreePreview: true,
      videoId: lesson.video_id,
      courseId,
    };
  }

  if (!userId) {
    return {
      canAccess: false,
      isFreePreview: false,
      videoId: null,
      courseId,
    };
  }

  // Check if admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    return {
      canAccess: true,
      isFreePreview: false,
      videoId: lesson.video_id,
      courseId,
    };
  }

  // Check enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();

  const isEnrolled = !!enrollment;

  return {
    canAccess: isEnrolled,
    isFreePreview: false,
    videoId: isEnrolled ? lesson.video_id : null,
    courseId,
  };
}
