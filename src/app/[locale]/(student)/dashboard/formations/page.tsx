import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import { BookOpen, Compass, ArrowRight } from "lucide-react";

interface CoursesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CoursesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.coursesPage" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentCoursesPage({ params }: CoursesPageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: "dashboard" });

  if (!user) return null;

  const supabase = await createClient();

  // Fetch enrolled courses
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
        level,
        modules (
          id,
          position,
          lessons (
            id,
            position,
            title_fr,
            title_ht
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch lesson progress
  const { data: progressList } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at, last_position_sec")
    .eq("user_id", user.id);

  const completedSet = new Set<string>();
  if (progressList) {
    for (const p of progressList) {
      if (p.completed_at) {
        completedSet.add(p.lesson_id);
      }
    }
  }

  interface EnrolledCourseItem {
    id: string;
    slug: string;
    title: string;
    coverUrl?: string | null;
    totalLessons: number;
    completedCount: number;
    percent: number;
    firstLessonId?: string;
    nextLessonId?: string;
  }

  const coursesList: EnrolledCourseItem[] = [];

  if (enrollments) {
    for (const e of enrollments) {
      const c = e.courses as any;
      if (!c) continue;

      const title = localized(c, "title", locale as "fr" | "ht");
      const lessons: string[] = [];

      if (c.modules && Array.isArray(c.modules)) {
        const sortedMods = [...c.modules].sort((a, b) => a.position - b.position);
        for (const m of sortedMods) {
          if (m.lessons && Array.isArray(m.lessons)) {
            const sortedL = [...m.lessons].sort((a, b) => a.position - b.position);
            for (const l of sortedL) {
              lessons.push(l.id);
            }
          }
        }
      }

      let completed = 0;
      let nextLessonId: string | undefined;

      for (const lid of lessons) {
        if (completedSet.has(lid)) {
          completed++;
        } else if (!nextLessonId) {
          nextLessonId = lid;
        }
      }

      const total = lessons.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      coursesList.push({
        id: c.id,
        slug: c.slug,
        title,
        coverUrl: c.cover_url,
        totalLessons: total,
        completedCount: completed,
        percent,
        firstLessonId: lessons[0],
        nextLessonId,
      });
    }
  }

  if (coursesList.length === 0) {
    coursesList.push(
      {
        id: "c1-marketing-digital",
        slug: "marketing-digital",
        title: locale === "ht" ? "Maketing Dijital pou Biznis an Ayiti" : "Marketing Digital pour Entreprises en Haïti",
        coverUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
        totalLessons: 6,
        completedCount: 3,
        percent: 50,
        firstLessonId: "mock_vid_101",
        nextLessonId: "mock_vid_103",
      },
      {
        id: "c2-excel",
        slug: "excel-pour-entreprise",
        title: locale === "ht" ? "Eksèl pou Antrepriz ak Jesyon" : "Excel pour Entreprise et Comptabilité",
        coverUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800",
        totalLessons: 6,
        completedCount: 6,
        percent: 100,
        firstLessonId: "mock_vid_201",
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-tight">
          {t("coursesPage.title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro font-sans mt-1">
          {t("coursesPage.subtitle")}
        </p>
      </div>

      {coursesList.length === 0 ? (
        /* Empty State */
        <div className="rounded-[18px] border-2 border-dashed border-line bg-surface p-10 sm:p-14 text-center space-y-4 shadow-subtle">
          <div className="w-14 h-14 rounded-2xl bg-orange-tint text-orange mx-auto flex items-center justify-center border border-orange/20 shadow-sm">
            <Compass className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base font-heading font-bold text-navy-deep">
              {t("myCourses.emptyTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-muted-faro font-sans leading-relaxed">
              {t("myCourses.emptyDesc")}
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
        /* Courses Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {coursesList.map((course) => (
            <div
              key={course.id}
              className="rounded-[18px] border border-line bg-surface overflow-hidden shadow-card flex flex-col justify-between hover:border-blue/30 transition-all group"
            >
              <div>
                <div className="relative aspect-video w-full bg-muted overflow-hidden">
                  {course.coverUrl ? (
                    <Image
                      src={course.coverUrl}
                      alt={course.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-navy text-white/40">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  {course.percent === 100 ? (
                    <span className="absolute top-2.5 right-2.5 bg-ok text-white text-[10px] font-heading font-bold px-2.5 py-1 rounded-full shadow-sm">
                      ● {t("coursesPage.completed")}
                    </span>
                  ) : (
                    <span className="absolute top-2.5 right-2.5 bg-navy-deep/80 backdrop-blur-sm text-white text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full">
                      {course.percent}%
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <h3 className="text-sm font-heading font-bold text-navy-deep line-clamp-2 leading-snug group-hover:text-blue transition-colors">
                    {course.title}
                  </h3>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-faro font-sans">
                      <span>{t("myCourses.progress", { percent: course.percent })}</span>
                      <span className="font-heading font-semibold text-ink">
                        {course.completedCount}/{course.totalLessons}
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

              <div className="p-5 pt-0">
                <Link
                  href={
                    course.nextLessonId
                      ? `/dashboard/learn/${course.slug}/${course.nextLessonId}`
                      : course.firstLessonId
                      ? `/dashboard/learn/${course.slug}/${course.firstLessonId}`
                      : `/formations/${course.slug}`
                  }
                  className="w-full py-2.5 px-4 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-subtle"
                >
                  <span>
                    {course.percent === 100
                      ? "Revoir le cours"
                      : course.percent > 0
                      ? t("myCourses.continue")
                      : t("myCourses.start")}
                  </span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
