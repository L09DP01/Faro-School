import { Link } from "@/i18n/navigation";
import { Container } from "@/components";
import { useTranslations } from "next-intl";

export function CtaSection() {
  const t = useTranslations("landing.cta");

  return (
    <section className="py-16 md:py-24 border-b border-border bg-gradient-to-t from-muted/30 to-background">
      <Container>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {t("headline")}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("subtitle")}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/formations"
              className="w-full sm:w-auto text-center px-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t("btnCatalog")} →
            </Link>
            <Link
              href="/inscription"
              className="w-full sm:w-auto text-center px-6 py-3.5 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t("btnRegister")}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
