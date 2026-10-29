import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import { Award, Download, ExternalLink, Check, ArrowRight } from "lucide-react";

interface CertificatesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CertificatesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.certificates" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentCertificatesPage({
  params,
}: CertificatesPageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: "dashboard.certificates" });
  const tCommon = await getTranslations({ locale, namespace: "dashboard.myCourses" });

  if (!user) return null;

  const supabase = await createClient();

  // Fetch certificates belonging to user
  const { data: certificates } = await supabase
    .from("certificates")
    .select(`
      id,
      code,
      issued_at,
      course_id,
      courses (
        id,
        slug,
        title_fr,
        title_ht
      )
    `)
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });

  const certList: any[] = certificates || [];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-tight">
          {t("title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro font-sans mt-1">
          {t("subtitle")}
        </p>
      </div>

      {!certList || certList.length === 0 ? (
        /* Empty State */
        <div className="rounded-[18px] border-2 border-dashed border-line bg-surface p-10 sm:p-14 text-center space-y-4 shadow-subtle">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200/60 shadow-sm">
            <Award className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base font-heading font-bold text-navy-deep">
              {t("emptyTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-muted-faro font-sans leading-relaxed">
              {t("emptyDesc")}
            </p>
          </div>
          <Link
            href="/dashboard/formations"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-orange"
          >
            <span>{tCommon("continue")}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </Link>
        </div>
      ) : (
        /* Certificates List Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {certList.map((cert) => {
            const course = cert.courses as any;
            const courseTitle = course
              ? localized(course, "title", locale as "fr" | "ht")
              : "Formation Professionnelle";
            const issuedDate = new Date(cert.issued_at).toLocaleDateString(
              locale === "ht" ? "ht-HT" : "fr-HT",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            );

            return (
              <div
                key={cert.id}
                className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ok-tint border border-ok/20 text-ok text-[11px] font-heading font-bold uppercase tracking-wider">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Vérifié ● Officiel</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-navy-deep bg-bg border border-line px-2.5 py-0.5 rounded">
                      {cert.code}
                    </span>
                  </div>

                  <h3 className="text-base font-heading font-bold text-navy-deep line-clamp-2 leading-snug">
                    {courseTitle}
                  </h3>

                  <p className="text-xs text-muted-faro font-sans">
                    {t("issued", { date: issuedDate })}
                  </p>
                </div>

                <div className="pt-4 border-t border-line flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={`/api/certificates/${cert.code}/pdf`}
                    download
                    className="flex-1 py-2.5 px-4 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold transition-all flex items-center justify-center gap-2 shadow-orange"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>{t("download")}</span>
                  </a>

                  <Link
                    href={`/verifier/${cert.code}`}
                    className="py-2.5 px-4 rounded-xl border border-line bg-surface hover:bg-bg text-xs font-heading font-semibold text-navy transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>{t("verify")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
