"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  CreditCard,
  User,
  MessageCircle,
  MessageSquare,
  BookOpen,
  Users,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Star,
} from "lucide-react";

interface StudentDashboardShellProps {
  children: ReactNode;
  user: {
    fullName: string;
    email: string | null;
    role: string;
    avatarUrl?: string | null;
  };
  locale: string;
}

export function StudentDashboardShell({
  children,
  user,
  locale,
}: StudentDashboardShellProps) {
  const pathname = usePathname();
  const tNav = useTranslations("dashboard.nav");
  const tMessages=useTranslations("messagingFlow");
  const [unread,setUnread]=useState({community:0,messages:0,notifications:0});
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=async()=>{if(document.hidden)return;try{
      const response=await fetch('/api/dashboard/unread',{cache:'no-store',signal:controller.signal});
      if(!response.ok){setUnread({community:0,messages:0,notifications:0});return;}
      const data=await response.json(),count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
      if(!controller.signal.aborted)setUnread({community:count(data.community),messages:count(data.messages),notifications:count(data.notifications)});
    }catch{/* Keep the last confirmed counts on transient disconnection. */}};
    void refresh();const timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[pathname]);


  // If in lesson player, render without sidebar / mobile tab bar
  if (pathname.includes("/dashboard/learn/")) {
    return <>{children}</>;
  }

  // Feature flags for optional menu items
  const showApprentissage = false;
  const showFavoris = false;

  const primaryNavItems = [
    {
      href: "/dashboard" as const,
      exact: true,
      label: tNav("home") || "Tableau de bord",
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
      badge: null,
    },
    {
      href: "/dashboard/formations" as const,
      exact: false,
      label: tNav("courses") || "Mes formations",
      icon: <BookOpen className="w-5 h-5 shrink-0" />,
      badge: null,
    },
    ...(showApprentissage
      ? [
          {
            href: "/dashboard/formations" as const,
            exact: false,
            label: "Apprentissage",
            icon: <GraduationCap className="w-5 h-5 shrink-0" />,
            badge: null,
          },
        ]
      : []),
    {
      href: "/dashboard/communaute" as const,
      exact: false,
      label: "Communauté",
      icon: <Users className="w-5 h-5 shrink-0" />,
      badge: pathname.includes("/communaute")?0:unread.community,
    },
    {
      href: "/dashboard/messages" as const,
      exact: false,
      label: tMessages("inbox"),
      icon: <MessageSquare className="w-5 h-5 shrink-0" />,
      badge: unread.messages,
    },
    {
      href: "/certificats" as const,
      exact: false,
      label: tNav("certificates") || "Certificats",
      icon: <Award className="w-5 h-5 shrink-0" />,
      badge: null,
    },
    ...(showFavoris
      ? [
          {
            href: "/dashboard/formations" as const,
            exact: false,
            label: "Favoris",
            icon: <Star className="w-5 h-5 shrink-0" />,
            badge: null,
          },
        ]
      : []),
  ];

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "+509 36 00 00 00";
  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    `Bonjour Faro School, je vous contacte depuis mon espace apprenant (${user.email || user.fullName}).`
  )}`;

  const accountNavItems = [
    {
      href: "/dashboard/profil" as const,
      exact: false,
      label: "Profil",
      icon: <User className="w-5 h-5 shrink-0" />,
    },
    {
      href: "/dashboard/profil" as const,
      exact: false,
      label: "Paramètres",
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
    {
      href: whatsappUrl,
      isExternal: true,
      label: "Aide",
      icon: <HelpCircle className="w-5 h-5 shrink-0" />,
    },
  ];

  // 5 Spec Mobile Bottom Navigation Tabs (Accueil, Formations, Communauté, Messages, Profil)
  const mobileNavTabs = [
    {
      href: "/dashboard" as const,
      exact: true,
      label: locale === "ht" ? "Akèy" : "Accueil",
      icon: <LayoutDashboard className="w-6 h-6 shrink-0" />,
      badge: null,
    },
    {
      href: "/dashboard/formations" as const,
      exact: false,
      label: locale === "ht" ? "Fòmasyon" : "Formations",
      icon: <BookOpen className="w-6 h-6 shrink-0" />,
      badge: null,
    },
    {
      href: "/dashboard/communaute" as const,
      exact: false,
      label: locale === "ht" ? "Kominote" : "Communauté",
      icon: <Users className="w-6 h-6 shrink-0" />,
      badge: pathname.includes("/communaute")?0:unread.community,
    },
    {
      href: "/dashboard/messages" as const,
      exact: false,
      label: locale === "ht" ? "Mesaj" : "Messages",
      icon: <MessageSquare className="w-6 h-6 shrink-0" />,
      badge: unread.messages,
    },
    {
      href: "/dashboard/profil" as const,
      exact: false,
      label: locale === "ht" ? "Pwofil" : "Profil",
      icon: <User className="w-6 h-6 shrink-0" />,
      badge: null,
    },
  ];

  const checkIsActive = (href: string, exact: boolean = false) => {
    const localizedHref = `/${locale}${href}`;
    if (exact) {
      return pathname === localizedHref || pathname === `${localizedHref}/`;
    }
    return pathname.startsWith(localizedHref);
  };

  const isFullHeightPage =
    pathname.includes("/dashboard/communaute") ||
    pathname.includes("/dashboard/messages");

  // Get user's first name for friendly greeting
  const firstName = user.fullName.split(" ")[0] || "Apprenant";

  return (
    <div className="pwa-app-shell h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-bg flex flex-col md:flex-row">
      {/* ========================================================= */}
      {/* 1. DESKTOP SIDEBAR (285px Fixed Navy-Deep Sidebar)        */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col justify-between w-[285px] h-full shrink-0 bg-navy-deep text-white p-4 z-30 shadow-card select-none">
        {/* Top: Logo & Role Label */}
        <div className="shrink-0 pt-1 pb-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:rounded-xl"
            aria-label="Faro School Dashboard"
          >
            <Logo variant="on-dark" width={145} height={40} priority />
          </Link>
          <span className="block mt-3 px-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-white/50">
            Étudiant
          </span>
        </div>

        {/* Center: Scrollable Navigation Menu */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-6 pr-1 focus-visible:outline-none">
          {/* Main Items */}
          <nav className="space-y-1.5" aria-label="Menu principal">
            {primaryNavItems.map((item) => {
              const active = checkIsActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading transition-all ${
                    active
                      ? "bg-orange text-white font-bold shadow-orange"
                      : "text-white/75 hover:text-white hover:bg-white/10 font-semibold"
                  }`}
                >
                  <span className={active ? "text-white" : "text-white/70"}>
                    {item.icon}
                  </span>
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold shadow-subtle shrink-0 ${
                        active
                          ? "bg-white text-orange"
                          : "bg-orange text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Group: Mon compte */}
          <div className="space-y-2 pt-4 border-t border-white/10">
            <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-white/40 px-3.5">
              Mon compte
            </span>
            <nav className="space-y-1.5" aria-label="Menu compte">
              {accountNavItems.map((item, idx) => {
                if (item.isExternal) {
                  return (
                    <a
                      key={idx}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading text-white/75 hover:text-white hover:bg-white/10 font-semibold transition-all"
                    >
                      <span className="text-white/70">{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  );
                }
                const active = checkIsActive(item.href, item.exact);
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading transition-all ${
                      active
                        ? "bg-orange text-white font-bold shadow-orange"
                        : "text-white/75 hover:text-white hover:bg-white/10 font-semibold"
                    }`}
                  >
                    <span className={active ? "text-white" : "text-white/70"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Sign out item */}
              <LogoutButton
                locale={locale}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading text-white/60 hover:text-red-300 hover:bg-white/5 font-semibold transition-all"
              >
                <LogOut className="w-5 h-5 shrink-0 text-white/60" />
                <span>{locale === "ht" ? "Dekonekte" : "Déconnexion"}</span>
              </LogoutButton>
            </nav>
          </div>
        </div>

        {/* Bottom: Subtle Version / Help */}
        <div className="shrink-0 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between px-2 text-[10px] text-white/40">
            <span>Faro School v1.0</span>
            <span className="inline-flex items-center gap-1 text-ok">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              Système actif
            </span>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA WITH STICKY TOP BAR                   */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden">
        {/* Top Bar: On mobile shows only notification bell and one avatar */}
        <header className="pwa-app-header shrink-0 h-14 md:h-16 px-4 md:px-8 bg-bg flex items-center justify-end md:justify-between z-20">
          {/* Left area: Hidden on mobile so greeting only appears in page title */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
              Espace d&apos;apprentissage
            </span>
          </div>

          {/* Right: Language switch (tablet/desktop), Notifications Bell & Single User Profile Avatar */}
          <div className="flex items-center gap-3">
            {/* Language Switcher (FR / KR) */}
            <Link
              href={pathname.replace(/^\/(fr|ht)/, "") || "/dashboard"}
              locale={locale === "fr" ? "ht" : "fr"}
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border border-line bg-surface text-[11px] font-heading font-semibold text-navy hover:border-orange hover:text-orange-strong transition-colors shadow-xs"
              title="Changer de langue"
            >
              {locale === "fr" ? "🇭🇹 Kreyòl" : "🇫🇷 Français"}
            </Link>

            {/* Bell button with orange unread dot */}
            <Link
              href="/dashboard/messages"
              className="relative p-2.5 rounded-full bg-white border border-line shadow-xs text-ink hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-ink" />
              {unread.notifications>0&&<span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange ring-2 ring-white" />}
            </Link>

            {/* User chip with single standardized Avatar */}
            <Link
              href="/dashboard/profil"
              className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-full bg-white border border-line shadow-xs hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
            >
              <UserAvatar fullName={user.fullName} size="md" />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-heading font-bold text-ink leading-tight truncate max-w-[120px]">
                  {user.fullName}
                </span>
                <span className="text-[10px] text-muted-faro leading-tight">
                  Étudiant
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-faro hidden sm:block ml-0.5" />
            </Link>
          </div>
        </header>

        {/* Inner Content Area */}
        <main
          className={`flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col ${
            isFullHeightPage
              ? "p-1 sm:p-2 md:p-6 md:pt-1"
              : "overflow-y-auto px-4 py-4 sm:p-6 lg:p-8 pb-10"
          }`}
        >
          <div
            className={`w-full mx-auto min-h-0 flex flex-col ${
              isFullHeightPage ? "h-full flex-1 max-w-[1560px]" : "shrink-0 max-w-7xl"
            }`}
          >
            {children}
          </div>
        </main>

        {/* ========================================================= */}
        {/* 3. MOBILE BOTTOM TAB BAR (< 768px)                       */}
        {/* Spec: Solid white, 64px high + safe area, 1px border,    */}
        {/* soft shadow, 5 tabs, AA contrast, 3px active top orange  */}
        {/* indicator bar, orange-tint bg, red unread circle badge.  */}
        {/* ========================================================= */}
        {(
          <nav
            aria-label="Barre d'onglets mobile"
            className="pwa-bottom-nav md:hidden shrink-0 h-[64px] pb-[env(safe-area-inset-bottom)] bg-white border-t border-line/80 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-around z-40 select-none"
          >
            {mobileNavTabs.map((tab) => {
              const active = checkIsActive(tab.href, tab.exact);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex-1 min-h-[48px] min-w-[48px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active
                      ? "bg-orange-tint/60 text-navy-deep font-semibold"
                      : "text-muted-faro hover:text-navy-deep font-medium"
                  }`}
                >
                  {/* 3px active top orange indicator bar */}
                  {active && (
                    <span className="absolute top-0 inset-x-2 h-[3px] bg-orange rounded-full" />
                  )}

                  {/* Tab icon (24px) */}
                  <div className="relative">
                    <span className={active ? "text-navy-deep" : "text-muted-faro"}>
                      {tab.icon}
                    </span>

                    {/* Red circle unread badge (99+ maximum) */}
                    {tab.badge && tab.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-xs">
                        {tab.badge > 99 ? "99+" : tab.badge}
                      </span>
                    ) : null}
                  </div>

                  {/* Tab label (11px-12px semibold, fits at 320px) */}
                  <span
                    className={`w-full px-0.5 text-[11px] sm:text-[12px] leading-tight tracking-tight text-center truncate ${
                      active ? "text-navy-deep font-semibold" : "text-muted-faro"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
