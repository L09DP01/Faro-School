"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { StaffAvailabilityToggle } from "@/components/messaging/StaffAvailabilityToggle";
import type { CurrentUser } from "@/lib/auth";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Users,
  CreditCard,
  Tag,
  MessageSquare,
  Settings,
  ArrowLeft,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

interface AdminLayoutClientProps {
  children: ReactNode;
  admin: CurrentUser;
  locale: string;
}

export function AdminLayoutClient({
  children,
  admin,
  locale,
}: AdminLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("admin.sidebar");
  const isHt = locale === "ht";
  const isInstructor = admin.role === "instructor";

  interface NavItem {
    href: string;
    exact: boolean;
    label: string;
    icon: ReactNode;
    badge?: number | null;
  }

  const primaryNavItems: NavItem[] = isInstructor
    ? [
        {
          href: "/admin/tableau-de-bord",
          exact: true,
          label: isHt ? "Tablo bò fòmatè" : "Tableau de bord",
          icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/formations",
          exact: false,
          label: isHt ? "Fòmasyon m yo" : "Mes formations",
          icon: <BookOpen className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/eleves",
          exact: false,
          label: isHt ? "Etidyan m yo" : "Mes élèves",
          icon: <Users className="w-5 h-5 shrink-0" />,
        },
      ]
    : [
        {
          href: "/admin",
          exact: true,
          label: t("dashboard") || "Tableau de bord",
          icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/formations",
          exact: false,
          label: t("courses") || "Formations",
          icon: <BookOpen className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/eleves",
          exact: false,
          label: t("students") || "Élèves",
          icon: <Users className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/paiements",
          exact: false,
          label: t("payments") || "Paiements",
          icon: <CreditCard className="w-5 h-5 shrink-0" />,
        },
      ];

  const contentNavItems: NavItem[] = isInstructor
    ? [
        {
          href: "/admin/certificats",
          exact: false,
          label: isHt ? "Sètifika" : "Certificats",
          icon: <GraduationCap className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/communaute",
          exact: false,
          label: isHt ? "Kominote" : "Communauté",
          icon: <Users className="w-5 h-5 shrink-0" />,
          badge: 12,
        },
        {
          href: "/admin/messages",
          exact: false,
          label: isHt ? "Mesaj" : "Messages",
          icon: <MessageSquare className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/assistant-ia",
          exact: false,
          label: isHt ? "Asistan IA" : "Assistant IA",
          icon: <Sparkles className="w-5 h-5 shrink-0 text-amber-300" />,
        },
      ]
    : [
        {
          href: "/admin/communaute",
          exact: false,
          label: isHt ? "Kominote" : "Communauté",
          icon: <Users className="w-5 h-5 shrink-0" />,
          badge: 12,
        },
        {
          href: "/admin/promotions",
          exact: false,
          label: t("promotions") || "Promotions",
          icon: <Tag className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/moderation",
          exact: false,
          label: isHt ? "Moderasyon" : "Modération",
          icon: <ShieldAlert className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/messagerie",
          exact: false,
          label: isHt ? "Sipèvizyon IA" : "Supervision IA",
          icon: <Sparkles className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/messages",
          exact: false,
          label: t("messages") || "Messages",
          icon: <MessageSquare className="w-5 h-5 shrink-0" />,
        },
      ];

  if (!isInstructor) contentNavItems.push({href:"/admin/certificats",exact:false,label:isHt?"Sètifika":"Certificats",icon:<GraduationCap className="w-5 h-5 shrink-0"/>});

  if (!isInstructor) contentNavItems.push({href:"/admin/emails",exact:false,label:isHt?"Imèl":"Emails",icon:<MessageSquare className="w-5 h-5 shrink-0"/>});

  const systemNavItems: NavItem[] = isInstructor
    ? []
    : [
        {
          href: "/admin/formateurs",
          exact: false,
          label: isHt ? "Fòmatè" : "Formateurs",
          icon: <UserCheck className="w-5 h-5 shrink-0" />,
        },
        {
          href: "/admin/parametres",
          exact: false,
          label: t("settings") || "Paramètres",
          icon: <Settings className="w-5 h-5 shrink-0" />,
        },
      ];

  const checkIsActive = (href: string, exact: boolean) => {
    const localizedHref = `/${locale}${href}`;
    if (exact) {
      return pathname === localizedHref || pathname === `${localizedHref}/`;
    }
    return pathname.startsWith(localizedHref);
  };

  const initials = admin.fullName
    ? admin.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  const renderNavGroup = (
    items: NavItem[],
    onItemClick?: () => void
  ) => (
    <div className="space-y-1">
      {items.map((item) => {
        const active = checkIsActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href as any}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading transition-all ${
              active
                ? "bg-white/15 text-white font-bold shadow-subtle border-l-4 border-orange pl-3"
                : "text-white/70 hover:text-white hover:bg-white/10 font-semibold"
            }`}
          >
            <span className={active ? "text-orange" : "text-white/70"}>
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold shadow-subtle shrink-0">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="pwa-admin-shell min-h-screen md:h-screen md:h-[100dvh] md:overflow-hidden bg-bg flex flex-col md:flex-row font-sans">
      {/* ========================================================= */}
      {/* 1. PERSISTENT 260px NAVY SIDEBAR (Fixed 100dvh on Desktop)*/}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col justify-between w-[260px] h-full shrink-0 bg-navy-deep text-white p-6 z-30 shadow-card select-none">
        {/* Top: Logo & Role Tag (Fixed) */}
        <div className="shrink-0 flex items-center justify-between pt-1 pb-4">
          <Link
            href={isInstructor ? "/admin/tableau-de-bord" : "/admin"}
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:rounded-xl"
          >
            <Logo variant="on-dark" width={140} height={38} priority />
          </Link>
          <span
            className={`text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isInstructor
                ? "bg-amber-400/20 text-amber-300 border-amber-400/30"
                : "bg-orange/20 text-orange border-orange/30"
            }`}
          >
            {isInstructor ? (isHt ? "Fòmatè" : "Formateur") : "Admin"}
          </span>
        </div>

        {/* Center: Internal Scrollable Navigation Area */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-6 pr-1 focus-visible:outline-none">
          {/* Primary Nav Items */}
          <nav aria-label="Menu principal" className="space-y-1">
            {renderNavGroup(primaryNavItems)}
          </nav>

          {/* Section: CONTENU / WORKSPACE */}
          <div className="space-y-1.5 pt-3 border-t border-white/10">
            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 px-3.5">
              {isInstructor ? (isHt ? "Kominikasyon & IA" : "Collaboration & IA") : "Contenu"}
            </span>
            <nav aria-label="Menu contenu">
              {renderNavGroup(contentNavItems)}
            </nav>
          </div>

          {/* Section: SYSTÈME (Admin only) */}
          {systemNavItems.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-white/10">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 px-3.5">
                Système
              </span>
              <nav aria-label="Menu système">
                {renderNavGroup(systemNavItems)}
              </nav>
            </div>
          )}
        </div>

        {/* Bottom: Sidebar Footer (Profile & public site link) (Fixed) */}
        <div className="shrink-0 pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-xs shadow-subtle border-2 border-surface shrink-0 ${
                isInstructor
                  ? "bg-gradient-to-br from-sky-400 to-indigo-600 text-white"
                  : "bg-gradient-to-br from-amber-400 to-orange text-white"
              }`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-heading font-bold text-white truncate">
                {admin.fullName || admin.email || (isInstructor ? "Formateur" : "Admin")}
              </p>
              <p className="text-[11px] text-white/50 font-sans truncate">
                {isInstructor
                  ? (isHt ? "Fòmatè Limyè" : "Formateur certifié")
                  : "Directeur pédagogique"}
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-heading">
            <Link
              href="/"
              className="text-white/70 hover:text-orange inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voir le site</span>
            </Link>

            <Link
              href={isInstructor ? "/admin/tableau-de-bord" : "/admin"}
              locale={locale === "fr" ? "ht" : "fr"}
              className="text-[11px] text-white/60 hover:text-white px-2 py-0.5 rounded bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
            >
              {locale === "fr" ? "KR" : "FR"}
            </Link>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE HEADER & DRAWER (< 768px)                      */}
      {/* ========================================================= */}
      <div className="pwa-admin-header md:hidden sticky top-0 z-40 bg-navy-deep border-b border-white/10 px-4 h-16 flex items-center justify-between shadow-subtle">
        <Link
          href={isInstructor ? "/admin/tableau-de-bord" : "/admin"}
          className="flex items-center gap-2"
        >
          <Logo variant="on-dark" width={120} height={32} />
          <span
            className={`text-[10px] font-heading font-bold uppercase px-1.5 py-0.5 rounded-full border ${
              isInstructor
                ? "bg-amber-400/20 text-amber-300 border-amber-400/30"
                : "bg-orange/20 text-orange border-orange/30"
            }`}
          >
            {isInstructor ? (isHt ? "Fòmatè" : "Formateur") : "Admin"}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="scale-90 origin-right">
            <StaffAvailabilityToggle locale={locale} />
          </div>

          <Link
            href={isInstructor ? "/admin/tableau-de-bord" : "/admin"}
            locale={locale === "fr" ? "ht" : "fr"}
            className="text-xs text-white/80 font-heading font-semibold px-2 py-1 rounded bg-white/10"
          >
            {locale === "fr" ? "KR" : "FR"}
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
            aria-label="Menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-navy-deep/95 backdrop-blur-md flex flex-col p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <Logo variant="on-dark" width={130} height={36} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-white hover:bg-white/10 rounded-xl"
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5">
            <div className="space-y-1">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 px-3.5">
                Principal
              </span>
              {renderNavGroup(primaryNavItems, () => setMobileMenuOpen(false))}
            </div>

            <div className="space-y-1 pt-2 border-t border-white/10">
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 px-3.5">
                {isInstructor ? (isHt ? "Kominikasyon & IA" : "Collaboration & IA") : "Contenu"}
              </span>
              {renderNavGroup(contentNavItems, () => setMobileMenuOpen(false))}
            </div>

            {systemNavItems.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-white/10">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 px-3.5">
                  Système
                </span>
                {renderNavGroup(systemNavItems, () => setMobileMenuOpen(false))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/20 text-white font-heading font-semibold text-xs hover:bg-white/10"
            >
              <span>Voir le site public</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MAIN CONTENT AREA (Scrolls Independently)              */}
      {/* ========================================================= */}
      <main className="pwa-admin-main flex-1 min-w-0 h-full md:overflow-y-auto overflow-x-hidden flex flex-col">
        {/* Desktop Header: Availability Toggle & Context */}
        <header className="hidden md:flex items-center justify-between border-b border-line bg-surface/80 backdrop-blur-md px-6 lg:px-10 py-3 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-heading font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isInstructor
                  ? "bg-amber-400/15 text-amber-700 border-amber-400/30"
                  : "bg-orange/15 text-orange border-orange/30"
              }`}
            >
              {isInstructor ? (isHt ? "Espas Fòmatè" : "Espace Formateur") : "Administration"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StaffAvailabilityToggle locale={locale} />
          </div>
        </header>

        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 pb-16 md:pb-10 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
