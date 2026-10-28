import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkLessonAccess } from "@/lib/video/access";
import { localized } from "@/lib/i18n/localized";
import { LessonPlayerClient } from "@/components/video/LessonPlayerClient";

interface LessonPlayerPageProps {
  params: Promise<{
    locale: string;
    courseSlug: string;
    lessonId: string;
  }>;
}

export async function generateMetadata({
  params,
}: LessonPlayerPageProps): Promise<Metadata> {
  const { locale, lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("title_fr, title_ht")
    .eq("id", lessonId)
    .maybeSingle();

  const title = lesson
    ? localized(lesson, "title", locale as "fr" | "ht")
    : "Lecteur de cours";

  return {
    title: `${title} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function LessonPlayerPage({
  params,
}: LessonPlayerPageProps) {
  const { locale, courseSlug, lessonId } = await params;

  // 1. Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/connexion?next=/dashboard/learn/${courseSlug}/${lessonId}`);
  }

  const supabase = await createClient();

  // 2. Fetch course by slug
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select(`
      id,
      slug,
      title_fr,
      title_ht,
      status,
      modules (
        id,
        position,
        title_fr,
        title_ht,
        lessons (
          id,
          position,
          title_fr,
          title_ht,
          duration_sec,
          is_free_preview
        )
      )
    `)
    .eq("slug", courseSlug)
    .maybeSingle();

  if (courseError || !course) {
    notFound();
  }

  // 3. ACCESS GUARD (critical)
  // Must check enrollment (or is_free_preview) before returning anything.
  // Not enrolled -> redirect to course page.
  let access;
  try {
    access = await checkLessonAccess(lessonId, user.id);
  } catch {
    notFound();
  }

  if (!access.canAccess) {
    redirect(`/${locale}/formations/${courseSlug}`);
  }

  // 4. Fetch current lesson with resources
  const { data: currentLesson, error: lessonError } = await supabase
    .from("lessons")
    .select(`
      id,
      title_fr,
      title_ht,
      description_fr,
      description_ht,
      duration_sec,
      lesson_resources (
        id,
        name,
        file_url
      )
    `)
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonError || !currentLesson) {
    notFound();
  }

  // 5. Fetch lesson progress for this course
  const allLessonIds: string[] = [];
  const formattedModules = (course.modules || [])
    .sort((a, b) => a.position - b.position)
    .map((m) => {
      const sortedLessons = (m.lessons || [])
        .sort((a, b) => a.position - b.position)
        .map((l) => {
          allLessonIds.push(l.id);
          return {
            id: l.id,
            title: localized(l, "title", locale as "fr" | "ht"),
            position: l.position,
            duration_sec: l.duration_sec || 0,
            is_free_preview: Boolean(l.is_free_preview),
          };
        });

      return {
        id: m.id,
        title: localized(m, "title", locale as "fr" | "ht"),
        position: m.position,
        lessons: sortedLessons,
      };
    });

  const { data: progressRecords } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at, last_position_sec")
    .eq("user_id", user.id)
    .in("lesson_id", allLessonIds);

  const completedLessonIds: string[] = [];
  let initialPositionSec = 0;

  if (progressRecords) {
    for (const prog of progressRecords) {
      if (prog.completed_at) {
        completedLessonIds.push(prog.lesson_id);
      }
      if (prog.lesson_id === lessonId) {
        initialPositionSec = prog.last_position_sec || 0;
      }
    }
  }

  const courseTitle = localized(course, "title", locale as "fr" | "ht");
  const lessonTitle = localized(currentLesson, "title", locale as "fr" | "ht");
  const lessonDescription = localized(currentLesson, "description", locale as "fr" | "ht");

  const resourcesList = (currentLesson.lesson_resources || []).map((r) => ({
    id: r.id,
    name: r.name,
    file_url: r.file_url,
  }));

  return (
    <LessonPlayerClient
      courseSlug={course.slug}
      courseTitle={courseTitle}
      lessonId={currentLesson.id}
      lessonTitle={lessonTitle}
      lessonDescription={lessonDescription}
      modules={formattedModules}
      resources={resourcesList}
      completedLessonIds={completedLessonIds}
      initialPositionSec={initialPositionSec}
      user={{
        name: user.fullName || "Étudiant",
        phone: user.phone || "",
      }}
      locale={locale}
    />
  );
}
