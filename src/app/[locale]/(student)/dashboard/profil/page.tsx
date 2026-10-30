import { LogoutButton } from "@/components/auth/LogoutButton";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { PwaInstallButton } from "@/components/pwa/PwaInstallButton";
import {
  Award,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.profile" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: "dashboard.profile" });

  if (!user) return null;

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+509 36 00 00 00";
  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    `Bonjour Faro School, je vous contacte depuis mon espace apprenant (${user.email || user.fullName}).`
  )}`;

  const quickLinks = [
    {
      href: "/dashboard/certificats" as const,
      label: locale === "ht" ? "Sètifika mwen yo" : "Mes certificats",
      description: locale === "ht" ? "Telechaje sètifika ou te reyisi" : "Consultez et téléchargez vos attestations de réussite",
      icon: <Award className="w-5 h-5 text-orange" />,
    },
    {
      href: "/dashboard/paiements" as const,
      label: locale === "ht" ? "Istorik peman mwen" : "Historique des paiements",
      description: locale === "ht" ? "Resi ak peman MonCash / NatCash" : "Reçus officiels et transactions MonCash / NatCash",
      icon: <CreditCard className="w-5 h-5 text-orange" />,
    },
    {
      href: "#parametres",
      label: locale === "ht" ? "Paramèt & Sekirite" : "Paramètres & Sécurité",
      description: locale === "ht" ? "Modpas ak preferans lang" : "Modifier votre mot de passe et vos préférences",
      icon: <Settings className="w-5 h-5 text-orange" />,
    },
    {
      href: whatsappUrl,
      isExternal: true,
      label: locale === "ht" ? "Èd & Sipò WhatsApp" : "Aide & Support WhatsApp",
      description: locale === "ht" ? "Nou la pou ede w 7j/7" : "Notre équipe d'assistance répond à vos questions",
      icon: <HelpCircle className="w-5 h-5 text-orange" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Quick Navigation Cards List (Spec: Certificates, payments, settings, help and sign-out live inside Profil screen) */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-card space-y-3">
        <h2 className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro px-1">
          {locale === "ht" ? "Aksè rapid" : "Services & Compte"}
        </h2>
        <div className="divide-y divide-line/60">
          {quickLinks.map((item, idx) => {
            if (item.isExternal) {
              return (
                <a
                  key={idx}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-tint flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-heading font-semibold text-ink group-hover:text-orange transition-colors">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-faro">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-faro group-hover:text-ink transition-colors" />
                </a>
              );
            }
            return (
              <Link
                key={idx}
                href={item.href}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-tint flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-heading font-semibold text-ink group-hover:text-orange transition-colors">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-faro">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-faro group-hover:text-ink transition-colors" />
              </Link>
            );
          })}

          {/* PWA Mobile App Install Action */}
          <PwaInstallButton locale={locale} />

          {/* Sign Out Action */}
          <LogoutButton
            locale={locale}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50 text-red transition-colors group min-h-[48px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-tint flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5 text-red" />
              </div>
              <div>
                <p className="text-sm font-heading font-semibold text-red">
                  {locale === "ht" ? "Dekonekte" : "Déconnexion"}
                </p>
                <p className="text-xs text-muted-faro">
                  {locale === "ht" ? "Kite sesyon ou an" : "Fermer votre session en toute sécurité"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-red/60 group-hover:text-red transition-colors" />
          </LogoutButton>
        </div>
      </div>

      <div id="parametres">
        <ProfileForm user={user} currentLocale={locale} />
      </div>
    </div>
  );
}
