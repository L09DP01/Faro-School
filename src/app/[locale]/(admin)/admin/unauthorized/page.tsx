import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShieldAlert, ArrowLeft, BookOpen, LayoutDashboard } from "lucide-react";

interface UnauthorizedPageProps {
  params: Promise<{ locale: string }>;
}

export default async function UnauthorizedPage({
  params,
}: UnauthorizedPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHt = locale === "ht";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-line rounded-[24px] p-8 md:p-10 shadow-card text-center space-y-6">
        {/* Amber/Red Warning Badge */}
        <div className="w-16 h-16 rounded-2xl bg-red/10 text-red border border-red/20 mx-auto flex items-center justify-center shadow-subtle">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-heading font-bold uppercase tracking-wider bg-red/10 text-red border border-red/20">
            {isHt ? "Erè 403 — Aksè Entèdi" : "Erreur 403 — Accès Refusé"}
          </span>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-navy-deep tracking-tight">
            {isHt ? "Pèmisyon Ensifizan" : "Permissions Insuffisantes"}
          </h1>
          <p className="text-sm font-sans text-muted leading-relaxed">
            {isHt
              ? "Ou pa gen dwa nesesè pou w konsilte seksyon sa a. Paj sa a rezève sèlman pou administratè Limyè Akademi."
              : "Vous ne possédez pas les autorisations nécessaires pour accéder à cette section. Cet espace est strictement réservé aux administrateurs de la plateforme."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/admin/formations"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange text-white font-heading font-bold text-sm shadow-subtle hover:bg-orange/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          >
            <BookOpen className="w-4 h-4" />
            <span>{isHt ? "Ale nan Fòmasyon m yo" : "Gérer mes formations"}</span>
          </Link>

          <Link
            href="/admin/tableau-de-bord"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface-subtle text-navy-deep border border-line font-heading font-semibold text-sm hover:bg-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-deep/20"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isHt ? "Tablo bò fòmatè" : "Tableau de bord formateur"}</span>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-sans text-muted hover:text-navy-deep transition-colors pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isHt ? "Retounen nan espas etidyan" : "Retour à l'espace membre"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
