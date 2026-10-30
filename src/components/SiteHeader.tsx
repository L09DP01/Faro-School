"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { Container } from "./Container";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./brand/Logo";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePwa } from "@/lib/pwa/use-pwa";
import { navigationConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { ArrowLeft } from "lucide-react";

export function SiteHeader() {
  const tNav = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const { isStandalone } = usePwa();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const closeMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        setIsAuthenticated(Boolean(session?.user));
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const handleSignOut = async () => {
    closeMenu();
    try {
      await signOut({ redirect: false });
      setIsAuthenticated(false);
      router.push("/connexion");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const navLinks = [
    ...navigationConfig.links.map((link) => ({
      href: link.href,
      label: tNav(link.key as any),
      exact: link.exact,
    })),
    ...(navigationConfig.features.enableLearningPaths
      ? [{ href: "/parcours" as any, label: "Parcours", exact: false }]
      : []),
    ...(navigationConfig.features.enableBlog
      ? [{ href: "/blog" as any, label: "Blog", exact: false }]
      : []),
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href || pathname === `/fr` || pathname === `/ht`;
    }
    return pathname.includes(href);
  };

  // -------------------------------------------------------------
  // STANDALONE / PWA INSTALLED APP HEADER
  // Simple header with Back button, Logo to /app, LanguageSwitcher,
  // and no marketing navigation or marketing drawers.
  // -------------------------------------------------------------
  if (isStandalone) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/95 backdrop-blur shadow-subtle pt-[env(safe-area-inset-top)] select-none">
        <Container className="flex h-14 items-center justify-between gap-3 py-2">
          {/* Back button + Brand */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-xl text-muted-faro hover:text-ink hover:bg-bg transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Retour"
              title="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <Link
              href="/app"
              className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:rounded-xl"
              aria-label="Faro School"
            >
              <Logo variant="on-light" width={135} height={36} priority />
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 rounded-xl bg-navy-deep text-white text-xs font-heading font-semibold hover:bg-navy transition-colors shadow-2xs"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/connexion"
                className="px-3.5 py-1.5 rounded-xl bg-orange text-white text-xs font-heading font-semibold hover:bg-orange-strong transition-colors shadow-orange"
              >
                Connexion
              </Link>
            )}
          </div>
        </Container>
      </header>
    );
  }

  // -------------------------------------------------------------
  // REGULAR BROWSER MARKETING HEADER
  // -------------------------------------------------------------
  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/95 backdrop-blur shadow-subtle">
      <Container className="flex h-18 items-center justify-between gap-4 py-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:rounded-xl"
            aria-label="Faro School Accueil"
          >
            <Logo variant="on-light" width={160} height={44} priority />
          </Link>

          {/* Desktop Navigation Links with Orange Underline on Active */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-ink">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative py-2 transition-colors hover:text-orange",
                    active
                      ? "text-orange after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-orange after:rounded-full font-bold"
                      : "text-ink/80"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Language Switcher + Auth Buttons */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {/* Desktop Auth Controls */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange px-5 py-2 text-sm font-bold text-white shadow-orange hover:bg-orange-strong transition-all"
                >
                  {tNav("dashboard")}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-bg transition-colors"
                >
                  {tNav("logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-bg transition-colors"
                >
                  {tNav("login")}
                </Link>
                <Link
                  href="/inscription"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange px-4 py-2 text-sm font-bold text-white shadow-orange hover:bg-orange-strong transition-all"
                >
                  {tNav("register")}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger Toggle */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-line p-2 text-ink hover:bg-bg focus:outline-none"
              aria-expanded={mobileMenuOpen}
              aria-label="Basculer le menu"
            >
              <svg className="h-6 w-6 fill-none stroke-current" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </Container>

      {/* Mobile Dropdown Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-line bg-surface px-4 pt-3 pb-6 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-3 font-semibold text-ink">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={cn(
                    "px-3 py-2 rounded-lg text-base transition-colors",
                    active
                      ? "bg-orange-tint text-orange font-bold"
                      : "hover:bg-bg text-ink/90"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-line flex flex-col gap-2.5">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={closeMenu}
                  className="w-full py-3 rounded-xl bg-orange text-center font-bold text-white shadow-orange text-sm"
                >
                  {tNav("dashboard")}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full py-3 rounded-xl border border-line text-center font-semibold text-ink hover:bg-bg text-sm"
                >
                  {tNav("logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/connexion"
                  onClick={closeMenu}
                  className="w-full py-3 rounded-xl border border-line text-center font-semibold text-ink hover:bg-bg text-sm"
                >
                  {tNav("login")}
                </Link>
                <Link
                  href="/inscription"
                  onClick={closeMenu}
                  className="w-full py-3 rounded-xl bg-orange text-center font-bold text-white shadow-orange text-sm"
                >
                  {tNav("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
