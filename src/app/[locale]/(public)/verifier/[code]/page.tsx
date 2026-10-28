import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { localized } from "@/lib/i18n/localized";

interface VerifierPageProps {
  params: Promise<{
    locale: string;
    code: string;
  }>;
}

export async function generateMetadata({
  params,
}: VerifierPageProps): Promise<Metadata> {
  const { locale, code } = await params;
  return {
    title:
      locale === "ht"
        ? `Verifikasyon sètifika ${code} | Faro School`
        : `Vérification du certificat ${code} | Faro School`,
    description:
      locale === "ht"
        ? `Verifikasyon ofisyèl sou sètifika Faro School #${code}.`
        : `Vérification officielle de l'authenticité du certificat Faro School #${code}.`,
  };
}

export default async function CertificateVerifierPage({
  params,
}: VerifierPageProps) {
  const { locale, code } = await params;
  const cleanCode = code.trim().toUpperCase();

  const supabase = createAdminClient();
  const { data: cert } = await supabase
    .from("certificates")
    .select(`
      id,
      code,
      issued_at,
      profiles (
        full_name,
        email
      ),
      courses (
        title_fr,
        title_ht
      )
    `)
    .eq("code", cleanCode)
    .maybeSingle();

  const t = await getTranslations({ locale, namespace: "dashboard.certificates" });
  const tNav = await getTranslations({ locale, namespace: "nav" });

  const profileData = cert?.profiles as { full_name?: string; email?: string } | null;
  const studentName = profileData?.full_name || profileData?.email?.split("@")[0] || "Étudiant";

  const courseData = cert?.courses as { title_fr?: string; title_ht?: string } | null;
  const courseTitle = courseData ? localized(courseData, "title", locale as "fr" | "ht") : "";

  const issueDate = cert?.issued_at
    ? new Date(cert.issued_at).toLocaleDateString(locale === "ht" ? "ht-HT" : "fr-HT", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="py-12 sm:py-20 bg-background min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <Container className="max-w-xl">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm text-center">
          {cert ? (
            <>
              {/* Official Verified Badge */}
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>

              <span className="inline-block text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mb-3">
                {locale === "ht" ? "Sètifika Otantik & Valide" : "Certificat Authentique & Valide"}
              </span>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {locale === "ht" ? "Verifikasyon Ofisyèl" : "Vérification Officielle"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {locale === "ht"
                  ? "Sètifika sa a te emèt pa Faro School apre etidyan an fin reyisi 100% nan fòmasyon an."
                  : "Ce document officiel atteste que l'apprenant a complété avec succès l'ensemble du programme de formation."}
              </p>

              {/* Certificate Information Details */}
              <div className="mt-8 rounded-xl bg-muted/40 border border-border p-5 text-left text-xs space-y-3.5">
                <div className="flex justify-between items-center border-b border-border pb-2.5">
                  <span className="text-muted-foreground">{locale === "ht" ? "Nimewo seri :" : "Numéro de série :"}</span>
                  <span className="font-mono font-bold text-foreground text-sm tracking-wider">
                    {cert.code}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{locale === "ht" ? "Moun ki gen sètifika a :" : "Titulaire du certificat :"}</span>
                  <span className="font-semibold text-foreground text-sm">
                    {studentName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{locale === "ht" ? "Fòmasyon ki valide a :" : "Formation certifiée :"}</span>
                  <span className="font-semibold text-foreground text-right truncate max-w-[220px]">
                    {courseTitle}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{locale === "ht" ? "Dat li fini kou a :" : "Date d'obtention :"}</span>
                  <span className="text-foreground">{issueDate}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{locale === "ht" ? "Òganizasyon ki bay li a :" : "Organisme émetteur :"}</span>
                  <span className="font-medium text-foreground">Faro School (Haïti)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={`/api/certificates/${cert.code}/pdf`}
                  download
                  className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{locale === "ht" ? "Telechaje resi PDF" : "Télécharger le PDF officiel"}</span>
                </a>

                <Link
                  href="/formations"
                  className="px-6 py-2.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors flex items-center justify-center"
                >
                  {tNav("courses")}
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Not Found State */}
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {locale === "ht" ? "Sètifika Envalid oswa Enkoni" : "Certificat Introuvable ou Invalide"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {locale === "ht"
                  ? `Nou pa jwenn okenn sètifika ki gen nimewo "${cleanCode}". Tanpri verifye kòd la.`
                  : `Aucun certificat ne correspond au code "${cleanCode}". Veuillez vérifier le numéro de série.`}
              </p>

              <div className="mt-8 flex justify-center">
                <Link
                  href="/"
                  className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {locale === "ht" ? "Retounen nan Akèy" : "Retour à l'accueil"}
                </Link>
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
