import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { CertificateCourseBadge } from "@/components/certificates/CertificateCourseBadge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  ArrowRight,
  Play,
  Sparkles,
  Compass,
} from "lucide-react";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return {
    title: `${t("nav.home")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentDashboardPage({
  params,
}: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: "dashboard" });

  if (!user) {
    return null;
  }

  const supabase = await createClient();

  // 1. Fetch user's enrollments with course details, modules and lessons
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      created_at,
      courses (
        id,
        slug,
        title_fr,
        title_ht,
        cover_url,
        price_htg,
        level,
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
            duration_sec
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // 2. Fetch user's lesson progress
  const { data: progressList } = await supabase
    .from("lesson_progress")
    .select(`
      lesson_id,
      completed_at,
      last_position_sec,
      updated_at
    `)
    .eq("user_id", user.id);

  // 3. Fetch user's certificates
  const { data: certificates } = await supabase
    .from("certificates")
    .select("id, code, course_id, issued_at")
    .eq("user_id", user.id);

  // Map progress by lesson_id for instant lookups
  const progressMap = new Map<
    string,
    { completed_at: string | null; last_position_sec: number; updated_at?: string }
  >();
  if (progressList) {
    for (const p of progressList) {
      progressMap.set(p.lesson_id, {
        completed_at: p.completed_at,
        last_position_sec: p.last_position_sec || 0,
        updated_at: p.updated_at,
      });
    }
  }

  // 4. Compute per-course statistics
  interface CourseStat {
    id: string;
    slug: string;
    title: string;
    coverUrl?: string | null;
    level?: string;
    totalLessons: number;
    completedLessons: number;
    percent: number;
    firstLessonId?: string;
    nextLesson?: { id: string; title: string; moduleTitle: string };
  }

  const coursesStats: CourseStat[] = [];
  const enrolledCourseIds: string[] = [];
  let totalSecondsLearned = 0;
  let totalCompletedLessonsCount = 0;

  if (enrollments) {
    for (const enrollment of enrollments) {
      const course = enrollment.courses as any;
      if (!course) continue;

      enrolledCourseIds.push(course.id);
      const title = localized(course, "title", locale as "fr" | "ht");

      const allLessons: Array<{
        id: string;
        title: string;
        moduleTitle: string;
        duration_sec: number;
      }> = [];

      if (course.modules && Array.isArray(course.modules)) {
        const sortedModules = [...course.modules].sort((a, b) => a.position - b.position);
        for (const mod of sortedModules) {
          const modTitle = localized(mod, "title", locale as "fr" | "ht");
          if (mod.lessons && Array.isArray(mod.lessons)) {
            const sortedLessons = [...mod.lessons].sort((a, b) => a.position - b.position);
            for (const l of sortedLessons) {
              allLessons.push({
                id: l.id,
                title: localized(l, "title", locale as "fr" | "ht"),
                moduleTitle: modTitle,
                duration_sec: l.duration_sec || 0,
              });
            }
          }
        }
      }

      let courseCompletedCount = 0;
      let nextLesson: { id: string; title: string; moduleTitle: string } | undefined;

      for (const lesson of allLessons) {
        const prog = progressMap.get(lesson.id);
        if (prog?.completed_at) {
          courseCompletedCount++;
          totalCompletedLessonsCount++;
          totalSecondsLearned += lesson.duration_sec;
        } else {
          if (!nextLesson) {
            nextLesson = {
              id: lesson.id,
              title: lesson.title,
              moduleTitle: lesson.moduleTitle,
            };
          }
          if (prog?.last_position_sec) {
            totalSecondsLearned += prog.last_position_sec;
          }
        }
      }

      const totalLessons = allLessons.length;
      const percent = totalLessons > 0 ? Math.round((courseCompletedCount / totalLessons) * 100) : 0;

      coursesStats.push({
        id: course.id,
        slug: course.slug,
        title,
        coverUrl: course.cover_url,
        level: course.level,
        totalLessons,
        completedLessons: courseCompletedCount,
        percent,
        firstLessonId: allLessons[0]?.id,
        nextLesson,
      });
    }
  }

  // General stat tile values
  const activeCoursesCount = coursesStats.filter((c) => c.percent < 100).length;
  const hoursLearned = Math.round((totalSecondsLearned / 3600) * 10) / 10;
  const certificatesCount = certificates?.length || 0;

  // "Continue Learning" candidate
  let recentLesson: {
    courseSlug: string;
    courseTitle: string;
    coverUrl?: string | null;
    moduleTitle: string;
    lessonTitle: string;
    lessonId: string;
    positionSec: number;
    coursePercent: number;
  } | null = null;

  if (coursesStats.length > 0) {
    const activeCourse = coursesStats.find((c) => c.percent < 100) || coursesStats[0];
    if (activeCourse.nextLesson) {
      recentLesson = {
        courseSlug: activeCourse.slug,
        courseTitle: activeCourse.title,
        coverUrl: activeCourse.coverUrl,
        moduleTitle: activeCourse.nextLesson.moduleTitle,
        lessonTitle: activeCourse.nextLesson.title,
        lessonId: activeCourse.nextLesson.id,
        positionSec: progressMap.get(activeCourse.nextLesson.id)?.last_position_sec || 0,
        coursePercent: activeCourse.percent,
      };
    } else if (activeCourse.firstLessonId) {
      recentLesson = {
        courseSlug: activeCourse.slug,
        courseTitle: activeCourse.title,
        coverUrl: activeCourse.coverUrl,
        moduleTitle: "",
        lessonTitle: activeCourse.title,
        lessonId: activeCourse.firstLessonId,
        positionSec: 0,
        coursePercent: activeCourse.percent,
      };
    }
  }

  // 5. Recommended course for the student (a published course not yet enrolled)
  let recommendedCourseQuery = supabase
    .from("courses")
    .select("id, slug, title_fr, title_ht, cover_url, price_htg, level")
    .eq("status", "published");

  if (enrolledCourseIds.length > 0) {
    recommendedCourseQuery = recommendedCourseQuery.not("id", "in", `(${enrolledCourseIds.join(",")})`);
  }

  const { data: recommendedCourses } = await recommendedCourseQuery.limit(1);
  const recommendedCourse = recommendedCourses?.[0] || null;

  const firstName = user.fullName ? user.fullName.split(" ")[0] : "Étudiant";
  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ET";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* PWA Install Banner */}
      <PwaInstallBanner locale={locale} />

      {/* ========================================================= */}
      {/* 1. TOP ROW: GREETING & SUBTITLE (Single greeting on page) */}
      {/* ========================================================= */}
      <div className="pb-1">
        <h1 className="text-xl sm:text-2xl md:text-[28px] font-heading font-bold text-navy-deep leading-tight">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro font-sans mt-0.5">
          {locale === "ht"
            ? "Byenveni sou espas aprantisaj ou. Kontinye avanse !"
            : "Byenveni sou espas aprantisaj ou — Continue de bâtir ton avenir."}
        </p>
      </div>

      {/* ========================================================= */}
      {/* 2. FOUR STAT CARDS (28px bold value, 2x2 mobile, no trunc)*/}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active courses */}
        <div className="rounded-[16px] border border-line bg-surface p-4 sm:p-5 shadow-card flex flex-col justify-between min-h-[96px] sm:min-h-[108px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] sm:text-sm font-heading font-medium text-muted-faro leading-tight">
              {locale === "ht" ? "Fòmasyon aktif" : "Formations actives"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-tint text-blue flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[28px] font-heading font-bold text-navy-deep leading-none pt-2">
            {activeCoursesCount}
          </div>
        </div>

        {/* Completed Lessons */}
        <div className="rounded-[16px] border border-line bg-surface p-4 sm:p-5 shadow-card flex flex-col justify-between min-h-[96px] sm:min-h-[108px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] sm:text-sm font-heading font-medium text-muted-faro leading-tight">
              {locale === "ht" ? "Leson fini" : "Leçons terminées"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-ok-tint text-ok flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[28px] font-heading font-bold text-navy-deep leading-none pt-2">
            {totalCompletedLessonsCount}
          </div>
        </div>

        {/* Hours Learned */}
        <div className="rounded-[16px] border border-line bg-surface p-4 sm:p-5 shadow-card flex flex-col justify-between min-h-[96px] sm:min-h-[108px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] sm:text-sm font-heading font-medium text-muted-faro leading-tight">
              {locale === "ht" ? "Lè aprantisaj" : "Heures d'apprentissage"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-orange-tint text-orange flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[28px] font-heading font-bold text-navy-deep leading-none pt-2">
            {hoursLearned}{" "}
            <span className="text-sm font-sans font-normal text-muted-faro">h</span>
          </div>
        </div>

        {/* Certificates */}
        <div className="rounded-[16px] border border-line bg-surface p-4 sm:p-5 shadow-card flex flex-col justify-between min-h-[96px] sm:min-h-[108px]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] sm:text-sm font-heading font-medium text-muted-faro leading-tight">
              {locale === "ht" ? "Sètifika" : "Certificats obtenus"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-[28px] font-heading font-bold text-navy-deep leading-none pt-2">
            {certificatesCount}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. "CONTINUE LEARNING" CARD (Visible without scrolling)   */}
      {/* ========================================================= */}
      {recentLesson && (
        <div className="rounded-[16px] border border-line bg-surface overflow-hidden shadow-card flex flex-col sm:flex-row items-stretch">
          {/* Cover: Compact 16:9 on mobile (max-h 110px) to guarantee Resume button is above the fold */}
          <div className="w-full sm:w-[200px] md:w-[220px] h-[105px] sm:h-auto shrink-0 relative bg-muted overflow-hidden">
            {recentLesson.coverUrl ? (
              <Image
                src={recentLesson.coverUrl}
                alt={recentLesson.courseTitle}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 220px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-navy-deep text-white/50">
                <BookOpen className="w-8 h-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-navy-deep/20 flex items-center justify-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface/90 text-navy-deep flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 fill-current" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-tint text-orange-strong font-heading font-bold text-[11px] uppercase tracking-wider border border-orange/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
                  {t("continueLearning.title")}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep leading-snug line-clamp-1">
                {recentLesson.courseTitle}
              </h2>

              {recentLesson.lessonTitle && (
                <p className="text-xs text-muted-faro font-sans truncate">
                  <span className="font-medium text-ink">
                    {recentLesson.moduleTitle ? `${recentLesson.moduleTitle} • ` : ""}
                    {recentLesson.lessonTitle}
                  </span>
                </p>
              )}
            </div>

            {/* Progress Bar and Resume Button */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex-1 max-w-[180px] sm:max-w-xs space-y-1">
                <div className="flex justify-between text-[11px] font-heading font-bold">
                  <span className="text-muted-faro">Progression</span>
                  <span className="text-blue">{recentLesson.coursePercent}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue transition-all"
                    style={{ width: `${recentLesson.coursePercent}%` }}
                  />
                </div>
              </div>

              <Link
                href={`/dashboard/learn/${recentLesson.courseSlug}/${recentLesson.lessonId}${
                  recentLesson.positionSec > 0 ? `?t=${recentLesson.positionSec}` : ""
                }`}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-orange hover:bg-orange-hover text-white font-heading font-bold text-xs sm:text-sm shadow-orange transition-all shrink-0"
              >
                <span>{t("continueLearning.resume")}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. MAIN CONTENT & RIGHT COLUMN (Course cards + Sidebar)  */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: My Courses (7 cols) */}
        <section className="lg:col-span-7 space-y-5" aria-labelledby="mes-formations-heading">
          <div className="flex items-center justify-between">
            <h2 id="mes-formations-heading" className="text-lg font-heading font-bold text-navy-deep">
              {t("myCourses.title")}
            </h2>
            {coursesStats.length > 0 && (
              <Link
                href="/dashboard/formations"
                className="text-xs font-heading font-semibold text-blue hover:underline"
              >
                {t("myCourses.viewAll", { count: coursesStats.length })} →
              </Link>
            )}
          </div>

          {coursesStats.length === 0 ? (
            /* Empty State for student with no courses */
            <div className="rounded-[18px] border-2 border-dashed border-line bg-surface p-8 sm:p-12 text-center space-y-4 shadow-subtle">
              <div className="w-14 h-14 rounded-2xl bg-orange-tint text-orange mx-auto flex items-center justify-center border border-orange/20 shadow-sm">
                <Compass className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="text-base font-heading font-bold text-navy-deep">
                  {t("myCourses.emptyTitle")}
                </h3>
                <p className="text-xs sm:text-sm text-muted-faro font-sans leading-relaxed">
                  {locale === "ht"
                    ? "Ou poko enskri nan okenn fòmasyon. Chwazi yon kou jodi a pou w devlope konpetans ou !"
                    : t("myCourses.emptyDesc")}
                </p>
              </div>
              <Link
                href="/formations"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-orange"
              >
                <span>{t("myCourses.explore")}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            </div>
          ) : (
            /* Enrolled Courses Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coursesStats.map((course) => (
                <div
                  key={course.id}
                  className="rounded-[18px] border border-line bg-surface overflow-hidden shadow-card flex flex-col justify-between hover:border-blue/30 transition-all group"
                >
                  <div>
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full bg-muted overflow-hidden">
                      {course.coverUrl ? (
                        <Image
                          src={course.coverUrl}
                          alt={course.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-navy text-white/40">
                          <BookOpen className="w-8 h-8" />
                        </div>
                      )}
                      {course.percent === 100 ? (
                        <span className="absolute top-2.5 right-2.5 bg-ok text-white text-[10px] font-heading font-bold px-2.5 py-1 rounded-full shadow-sm">
                          ● {t("myCourses.completedBadge")}
                        </span>
                      ) : (
                        <span className="absolute top-2.5 right-2.5 bg-navy-deep/80 backdrop-blur-sm text-white text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full">
                          {course.percent}%
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <h3 className="text-sm font-heading font-bold text-navy-deep line-clamp-2 leading-snug group-hover:text-blue transition-colors">
                        {course.title}
                      </h3>
                  <CertificateCourseBadge courseId={course.id} locale={locale}/>

                      {/* Blue Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] text-muted-faro font-sans">
                          <span>{t("myCourses.progress", { percent: course.percent })}</span>
                          <span className="font-heading font-semibold text-ink">
                            {course.completedLessons}/{course.totalLessons}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              course.percent === 100 ? "bg-ok" : "bg-blue"
                            }`}
                            style={{ width: `${course.percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Hint: "Continuer →" */}
                  <div className="p-4 sm:p-5 pt-0">
                    <Link
                      href={
                        course.nextLesson
                          ? `/dashboard/learn/${course.slug}/${course.nextLesson.id}`
                          : course.firstLessonId
                          ? `/dashboard/learn/${course.slug}/${course.firstLessonId}`
                          : `/formations/${course.slug}`
                      }
                      className="w-full py-2.5 px-3 rounded-xl border border-line bg-bg hover:bg-blue-tint hover:border-blue/30 text-xs font-heading font-bold text-blue transition-all flex items-center justify-between"
                    >
                      <span>
                        {course.percent === 100
                          ? "Revoir le cours"
                          : course.percent > 0
                          ? t("myCourses.continue")
                          : t("myCourses.start")}
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Next Steps, Certificate Progress, Recommended (5 cols) */}
        <aside className="lg:col-span-5 space-y-6">
          {/* 1. Next Steps (Numbered blue-tint squares) */}
          <div className="rounded-[18px] border border-line bg-surface p-5 sm:p-6 shadow-card space-y-4">
            <h2 className="text-sm font-heading font-bold text-navy-deep">
              {t("nextSteps.title")}
            </h2>

            {coursesStats.filter((c) => c.nextLesson).length === 0 ? (
              <p className="text-xs text-muted-faro py-3 text-center font-sans">
                {t("nextSteps.allCaughtUp")}
              </p>
            ) : (
              <div className="space-y-3">
                {coursesStats
                  .filter((c) => c.nextLesson)
                  .slice(0, 3)
                  .map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-bg border border-line/60 hover:border-blue/30 transition-all gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Numbered blue-tint square */}
                        <div className="w-8 h-8 rounded-lg bg-blue-tint text-blue font-heading font-bold text-xs flex items-center justify-center shrink-0 border border-blue/20">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wider text-muted-faro block truncate">
                            {c.title}
                          </span>
                          <h4 className="text-xs font-heading font-bold text-navy-deep truncate mt-0.5">
                            {c.nextLesson?.title}
                          </h4>
                        </div>
                      </div>

                      <Link
                        href={`/dashboard/learn/${c.slug}/${c.nextLesson?.id}`}
                        className="px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-heading font-semibold hover:bg-blue/90 transition-colors shrink-0"
                      >
                        Suivre →
                      </Link>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 2. Certificate-progress card with an amber-tint gradient */}
          <div className="rounded-[18px] border border-orange/20 bg-gradient-to-br from-orange-tint via-surface to-amber-50 p-5 sm:p-6 shadow-subtle space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-tint text-orange flex items-center justify-center border border-orange/20">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-heading font-bold text-navy-deep">
                  Objectif Certificat
                </h3>
              </div>
              <Sparkles className="w-4 h-4 text-orange" />
            </div>

            <p className="text-xs text-muted-faro font-sans leading-relaxed">
              Complétez 100% des leçons et modules d&apos;une formation pour débloquer automatiquement votre attestation officielle avec code de vérification unique.
            </p>

            <div className="pt-1">
              <Link
                href="/dashboard/certificats"
                className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-orange-strong hover:underline"
              >
                <span>Voir mes certificats</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 3. Recommended Course */}
          {recommendedCourse && (
            <div className="rounded-[18px] border border-line bg-surface p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-orange-strong">
                  {t("recommended.badge")}
                </span>
                <span className="text-[11px] font-sans text-muted-faro">Populaire</span>
              </div>

              <div className="flex gap-3.5 items-center">
                {recommendedCourse.cover_url ? (
                  <div className="relative w-18 h-14 rounded-xl overflow-hidden bg-muted shrink-0 border border-line">
                    <Image
                      src={recommendedCourse.cover_url}
                      alt={localized(recommendedCourse, "title", locale as "fr" | "ht")}
                      fill
                      className="object-cover"
                      sizes="72px"
                    />
                  </div>
                ) : (
                  <div className="w-18 h-14 rounded-xl bg-navy-deep flex items-center justify-center shrink-0 text-white/50">
                    <BookOpen className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xs font-heading font-bold text-navy-deep line-clamp-2 leading-snug">
                    {localized(recommendedCourse, "title", locale as "fr" | "ht")}
                  </h4>
                  <span className="text-xs font-heading font-bold text-navy-deep block mt-1">
                    {recommendedCourse.price_htg.toLocaleString("fr-HT")} HTG
                  </span>
                </div>
              </div>

              <Link
                href={`/formations/${recommendedCourse.slug}`}
                className="w-full py-2.5 px-4 text-xs font-heading font-bold rounded-xl bg-navy text-white hover:bg-navy-deep transition-colors flex items-center justify-center gap-2"
              >
                <span>{t("recommended.discover")}</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
