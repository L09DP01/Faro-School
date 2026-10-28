import { Container } from "@/components";
import { useTranslations } from "next-intl";

export function InstructorSection() {
  const t = useTranslations("landing.instructor");

  return (
    <section className="py-12 md:py-16 border-b border-border bg-muted/20">
      <Container>
        <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Photo placeholder with initials / avatar */}
            <div className="relative shrink-0">
              <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full border-4 border-background bg-gradient-to-tr from-primary/30 via-muted to-primary/10 flex items-center justify-center text-primary shadow-inner">
                <svg className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground/60" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div className="absolute bottom-1 right-1 rounded-full bg-emerald-500 p-1.5 border-2 border-background" title="Instructeur certifié" />
            </div>

            {/* Info and 3 numbers */}
            <div className="space-y-4 text-center md:text-left">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {t("badge")}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {t("name")}
                </h2>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t("role")}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("bio")}
              </p>

              {/* 3 numbers */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div className="p-2 text-center md:text-left">
                  <span className="block text-base sm:text-lg font-black text-foreground">8+</span>
                  <span className="text-[11px] text-muted-foreground">{t("statExp")}</span>
                </div>
                <div className="p-2 text-center md:text-left">
                  <span className="block text-base sm:text-lg font-black text-foreground">1 500+</span>
                  <span className="text-[11px] text-muted-foreground">{t("statStudents")}</span>
                </div>
                <div className="p-2 text-center md:text-left">
                  <span className="block text-base sm:text-lg font-black text-foreground">98%</span>
                  <span className="text-[11px] text-muted-foreground">{t("statSatisfaction")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
