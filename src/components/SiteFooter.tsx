"use client";

import { Link } from "@/i18n/navigation";
import { Container } from "./Container";
import { Logo } from "./brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslations } from "next-intl";
import { usePwa } from "@/lib/pwa/use-pwa";
import { siteConfig } from "@/config/site";
import { contactConfig } from "@/config/contact";

export function SiteFooter() {
  const tFooter = useTranslations("footer");
  const tNav = useTranslations("nav");
  const { isStandalone } = usePwa();

  const appStoreUrl = process.env.APP_STORE_URL;
  const playStoreUrl = process.env.PLAY_STORE_URL;
  const whatsappDigits = contactConfig.whatsapp.replace(/\D/g, "");

  // Never render marketing footer inside installed / standalone PWA app
  if (isStandalone) {
    return null;
  }

  return (
    <footer className="w-full bg-navy-deep text-white border-t border-navy-deep mt-auto">
      <Container className="py-12 md:py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Tagline Col (md:col-span-5) */}
          <div className="md:col-span-5 space-y-5">
            <Link href="/" className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:rounded-xl" aria-label="Faro School">
              <Logo variant="on-dark" width={170} height={46} />
            </Link>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              {siteConfig.slogan}
            </p>

            {/* Social Icons */}
            <div className="pt-2 flex items-center gap-3">
              {/* Facebook */}
              <a
                href={siteConfig.links.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-orange hover:text-white transition-all"
                aria-label="Facebook"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href={siteConfig.links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-orange hover:text-white transition-all"
                aria-label="Instagram"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.13-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              {/* WhatsApp */}
              <a
                href={`https://wa.me/${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-ok hover:text-white transition-all"
                aria-label="WhatsApp"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </a>
              {/* YouTube */}
              <a
                href={siteConfig.links.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-red hover:text-white transition-all"
                aria-label="YouTube"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              {/* TikTok */}
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white hover:text-ink transition-all"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
            </div>

            {/* Optional store badges if real env vars set */}
            {(appStoreUrl || playStoreUrl) && (
              <div className="pt-2 flex items-center gap-3">
                {appStoreUrl && (
                  <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <span className="text-xs text-white/80 border border-white/20 rounded-lg px-3 py-1.5 bg-white/5 font-semibold">
                      App Store
                    </span>
                  </a>
                )}
                {playStoreUrl && (
                  <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <span className="text-xs text-white/80 border border-white/20 rounded-lg px-3 py-1.5 bg-white/5 font-semibold">
                      Google Play
                    </span>
                  </a>
                )}
              </div>
            )}

            {/* Payment badges */}
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                {tFooter("paymentMethods")}
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-white/10 text-xs font-bold text-white border border-white/15">
                  MonCash
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-white/10 text-xs font-bold text-white border border-white/15">
                  NatCash
                </span>
              </div>
            </div>
          </div>

          {/* Link Col 1: Formations (md:col-span-2) */}
          <div className="md:col-span-2 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange">
              Formations
            </p>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li>
                <Link href="/formations?category=developpement-web" className="hover:text-white transition-colors">
                  Développement Web
                </Link>
              </li>
              <li>
                <Link href="/formations?category=intelligence-artificielle" className="hover:text-white transition-colors">
                  Intelligence Artificielle
                </Link>
              </li>
              <li>
                <Link href="/formations?category=marketing-digital" className="hover:text-white transition-colors">
                  Marketing Digital
                </Link>
              </li>
              <li>
                <Link href="/formations?category=entrepreneuriat" className="hover:text-white transition-colors">
                  Entrepreneuriat
                </Link>
              </li>
              <li>
                <Link href="/formations" className="hover:text-white transition-colors font-semibold text-orange">
                  Toutes les formations →
                </Link>
              </li>
            </ul>
          </div>

          {/* Link Col 2: À propos (md:col-span-2) */}
          <div className="md:col-span-2 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange">
              À propos
            </p>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li>
                <Link href="/a-propos" className="hover:text-white transition-colors">
                  {tNav("about")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {tNav("contact")}
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="hover:text-white transition-colors">
                  {tFooter("terms")}
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="hover:text-white transition-colors">
                  {tFooter("privacy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Link Col 3: Aide (md:col-span-3) */}
          <div className="md:col-span-3 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-orange">
              Aide & Support
            </p>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li>
                <Link href="/remboursement" className="hover:text-white transition-colors">
                  Garantie & Remboursement
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Support WhatsApp
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
                  <span>Espace Administrateur</span>
                  <span className="text-[10px] bg-white/15 text-white/80 px-1.5 py-0.5 rounded">Admin</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & "Fait en Haïti" & Language select */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <p>{tFooter("copyright")}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-medium text-white/80">
              <span>🇭🇹</span>
              <span>Fait en Haïti</span>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </Container>
    </footer>
  );
}
