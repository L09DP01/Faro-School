import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { TopCourse } from "@/lib/admin/dashboard";

interface AdminTopCoursesProps {
  courses: TopCourse[];
  locale: string;
}

export function AdminTopCourses({ courses, locale }: AdminTopCoursesProps) {
  const t = useTranslations("admin.dashboard.topCourses");

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-7 shadow-card space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep tracking-tight">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-faro font-sans mt-0.5">{t("subtitle")}</p>
      </div>

      {courses.length === 0 ? (
        <p className="text-xs text-muted-faro py-6 text-center font-sans">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-4 pt-1">
          {courses.map((course, idx) => {
            const title = locale === "ht" ? course.titleHt : course.titleFr;
            const rank = idx + 1;

            return (
              <div key={course.courseId || course.slug} className="space-y-2">
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 ${
                        rank === 1
                          ? "bg-orange-tint text-orange border border-orange/20 shadow-sm"
                          : rank === 2
                          ? "bg-blue-tint text-blue border border-blue/20"
                          : rank === 3
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-bg text-muted-faro border border-line"
                      }`}
                    >
                      {rank}
                    </span>
                    <Link
                      href={`/formations/${course.slug}`}
                      className="font-heading font-bold text-navy-deep hover:text-blue transition-colors truncate text-xs sm:text-sm"
                    >
                      {title}
                    </Link>
                  </div>
                  <span className="font-heading font-bold text-ink shrink-0 text-xs">
                    {course.studentCount} élèves
                  </span>
                </div>

                {/* Colored Progress Bar */}
                <div className="h-2 w-full bg-line rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(course.percentage, 5)}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      rank === 1 ? "bg-orange" : "bg-blue"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
