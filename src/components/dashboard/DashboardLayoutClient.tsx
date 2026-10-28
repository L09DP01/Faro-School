"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { cn } from "@/lib/utils";

interface DashboardLayoutClientProps {
  children: ReactNode;
  user: {
    fullName: string;
    email: string | null;
    role: string;
  };
  locale: string;
}

export function DashboardLayoutClient({
  children,
  user,
  locale,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");
  const tNav = useTranslations("nav");

  // If in lesson player, render clean without sidebar
  if (pathname.includes("/dashboard/learn/")) {
    return <>{children}</>;
  }

  const navItems = [
    {
      href: "/dashboard" as const,
      exact: true,
      label: t("home"),
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/dashboard/formations" as const,
      exact: false,
      label: t("courses"),
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      href: "/dashboard/certificats" as const,
      exact: false,
      label: t("certificates"),
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/paiements" as const,
      exact: false,
      label: t("payments"),
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/profil" as const,
      exact: false,
      label: t("profile"),
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const checkIsActive = (item: (typeof navItems)[0]) => {
    const localizedHref = `/${locale}${item.href}`;
    if (item.exact) {
      return pathname === localizedHref || pathname === `${localizedHref}/`;
    }
    return pathname.startsWith(localizedHref);
  };

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ET";

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-bg pb-20 md:pb-12">
      <Container className="pt-6 sm:pt-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 sticky top-24">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-subtle space-y-6">
              {/* User Identity Header */}
              <div className="flex items-center gap-3 border-b border-line pb-5">
                <div className="w-11 h-11 rounded-xl bg-orange-tint text-orange font-bold flex items-center justify-center shrink-0 text-sm border border-orange/20">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-ink truncate">
                    {user.fullName || "Étudiant"}
                  </h3>
                  <p className="text-xs text-muted-faro truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const active = checkIsActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                        active
                          ? "bg-orange-tint text-orange-strong font-bold shadow-subtle border-l-4 border-orange"
                          : "text-muted-faro hover:text-ink hover:bg-bg"
                      )}
                    >
                      <span className={active ? "text-orange-strong" : "text-muted-faro"}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Catalog CTA link */}
              <div className="pt-4 border-t border-line">
                <Link
                  href="/formations"
                  className="block text-center py-2.5 px-3 rounded-xl bg-bg text-ink text-xs font-bold hover:bg-orange-tint hover:text-orange-strong transition-all border border-line"
                >
                  + {tNav("courses")}
                </Link>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="md:col-span-8 lg:col-span-9 w-full">
            {children}
          </main>
        </div>
      </Container>
    </div>
  );
}
