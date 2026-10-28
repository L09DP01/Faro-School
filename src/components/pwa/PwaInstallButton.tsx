"use client";

import { usePwa } from "@/lib/pwa/use-pwa";
import { Smartphone, CheckCircle2, ChevronRight, Download } from "lucide-react";

export function PwaInstallButton({ locale = "fr" }: { locale?: string }) {
  const { isStandalone, triggerInstallPrompt } = usePwa();
  const isHt = locale === "ht";

  if (isStandalone) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-ok-tint/40 border border-ok/20 min-h-[48px] select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ok flex items-center justify-center text-white shrink-0 shadow-2xs">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-heading font-semibold text-ink">
              {isHt ? "Aplikasyon enstale ✓" : "Application installée ✓"}
            </p>
            <p className="text-xs text-muted-faro">
              {isHt
                ? "W ap itilize aplikasyon Faro School la"
                : "Vous utilisez la version installée de Faro School"}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-ok px-2 py-0.5 rounded-full bg-white border border-ok/30">
          Actif
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => triggerInstallPrompt()}
      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-orange-tint/40 transition-colors group min-h-[48px] text-left border border-transparent hover:border-orange/20"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-tint text-orange flex items-center justify-center shrink-0 group-hover:bg-orange group-hover:text-white transition-colors">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-heading font-semibold text-ink group-hover:text-orange transition-colors">
            {isHt ? "Enstale aplikasyon an" : "Installer l'application"}
          </p>
          <p className="text-xs text-muted-faro">
            {isHt
              ? "Mete Faro School sou ekran telefòn ou pou aksè rapid"
              : "Ajoutez Faro School sur votre écran d'accueil"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs font-bold text-orange px-2 py-0.5 rounded-full bg-orange-tint">
          {isHt ? "Gratis" : "Gratuit"}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-faro group-hover:text-orange transition-colors" />
      </div>
    </button>
  );
}
