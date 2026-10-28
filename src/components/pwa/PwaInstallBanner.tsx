"use client";

import { usePwa } from "@/lib/pwa/use-pwa";
import { Download, X, Smartphone } from "lucide-react";

export function PwaInstallBanner({ locale = "fr" }: { locale?: string }) {
  const {
    isStandalone,
    isInstallable,
    visitCount,
    isBannerDismissed,
    triggerInstallPrompt,
    dismissInstallBanner,
  } = usePwa();

  // Rules:
  // 1. Never show if already installed / standalone
  // 2. Only show after the second visit (visitCount >= 2)
  // 3. Hidden for 14 days after dismissal
  // 4. Must be installable (deferredPrompt ready or iOS Safari)
  if (isStandalone || isBannerDismissed || visitCount < 2 || !isInstallable) {
    return null;
  }

  const isHt = locale === "ht";

  return (
    <div className="w-full my-3 p-3.5 sm:p-4 rounded-2xl bg-orange-tint/70 border border-orange/40 shadow-xs flex items-center justify-between gap-3 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-orange flex items-center justify-center text-white shrink-0 shadow-orange">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-heading font-bold text-navy-deep truncate">
            {isHt
              ? "Enstale aplikasyon Faro School la"
              : "Installez l'application Faro School"}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-faro truncate">
            {isHt
              ? "Aksè rapid san w pa louvri navigatè w."
              : "Accès direct et rapide depuis votre écran d'accueil."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => triggerInstallPrompt()}
          className="px-3.5 py-1.5 sm:py-2 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold flex items-center gap-1.5 shadow-subtle transition-transform active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isHt ? "Enstale" : "Installer"}</span>
        </button>

        <button
          onClick={dismissInstallBanner}
          className="p-1.5 rounded-full text-muted-faro hover:text-ink hover:bg-black/5 transition-colors"
          title={isHt ? "Fèmen" : "Masquer pendant 14 jours"}
          aria-label={isHt ? "Fèmen" : "Masquer"}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
