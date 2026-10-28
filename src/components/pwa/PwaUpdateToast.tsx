"use client";

import { usePwa } from "@/lib/pwa/use-pwa";
import { Sparkles, RefreshCw } from "lucide-react";

export function PwaUpdateToast({ locale = "fr" }: { locale?: string }) {
  const { hasUpdate, applyUpdate } = usePwa();

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="p-4 rounded-2xl bg-navy-deep text-white shadow-card border border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-orange flex items-center justify-center shrink-0 shadow-orange">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-heading font-bold text-white truncate">
              {locale === "ht"
                ? "Nouvo vèsyon disponib !"
                : "Nouvelle version disponible !"}
            </p>
            <p className="text-[11px] text-white/70 truncate">
              {locale === "ht"
                ? "Klike pou mete aplikasyon an ajou."
                : "Cliquez pour actualiser l'application."}
            </p>
          </div>
        </div>

        <button
          onClick={applyUpdate}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold flex items-center gap-1.5 shadow-subtle transition-transform active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{locale === "ht" ? "Mete ajou" : "Actualiser"}</span>
        </button>
      </div>
    </div>
  );
}
