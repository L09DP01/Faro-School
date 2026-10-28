import { useTranslations } from "next-intl";
import { UserCheck } from "lucide-react";

export function CourseInstructor() {
  const t = useTranslations("courseDetail.instructor");

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-4 shadow-card">
      <div>
        <span className="font-heading text-xs font-bold uppercase tracking-wider text-orange">
          {t("badge")}
        </span>
        <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink mt-0.5">
          {t("title")}
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
        {/* Round Photo Placeholder */}
        <div className="relative shrink-0">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-orange/30 bg-orange-tint flex items-center justify-center text-orange font-heading font-bold text-xl shadow-subtle">
            <svg className="w-9 h-9 text-orange" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <span
            className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-ok text-white border-2 border-surface"
            title="Instructeur certifié"
          >
            <UserCheck className="w-3 h-3 stroke-[3]" />
          </span>
        </div>

        {/* Content */}
        <div className="space-y-2 text-center sm:text-left">
          <div>
            <h3 className="font-heading text-base sm:text-lg font-bold text-ink">
              {t("name")}
            </h3>
            <p className="font-sans text-xs font-medium text-muted-faro">
              {t("role")}
            </p>
          </div>
          <p className="font-sans text-xs sm:text-sm text-muted-faro leading-relaxed max-w-xl">
            {t("bio")}
          </p>
        </div>
      </div>
    </div>
  );
}
