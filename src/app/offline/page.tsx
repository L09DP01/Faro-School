"use client";

import { WifiOff, RotateCcw } from "lucide-react";
import Image from "next/image";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-ink text-center select-none">
      <div className="max-w-md w-full p-8 rounded-3xl bg-surface border border-line shadow-card flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95">
        {/* Logo */}
        <div className="relative w-40 h-12">
          <Image
            src="/brand/logo-on-light.png"
            alt="Faro School"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Offline Icon */}
        <div className="w-16 h-16 rounded-full bg-orange-tint flex items-center justify-center text-orange shadow-subtle">
          <WifiOff className="w-8 h-8" />
        </div>

        {/* Bilingual Message (FR & KR) */}
        <div className="space-y-3">
          <h1 className="text-xl font-heading font-bold text-navy-deep">
            Vous êtes hors ligne
          </h1>
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-orange">
            Ou pa konekte sou entènèt
          </p>

          <p className="text-sm text-muted-faro leading-relaxed">
            Veuillez vérifier votre connexion Internet ou Wi-Fi pour continuer à
            utiliser Faro School.
          </p>
          <p className="text-xs text-muted-faro/80 italic leading-relaxed">
            Tanpri verifye si w gen entènèt oswa Wi-Fi pou w ka kontinye sèvi ak
            Faro School.
          </p>
        </div>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          className="w-full py-3.5 px-6 rounded-2xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-sm flex items-center justify-center gap-2 shadow-orange transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Réessayer / Re-eseye</span>
        </button>
      </div>

      <p className="mt-8 text-xs text-muted-faro font-medium">
        Faro School &bull; Éducation en ligne pour Haïti
      </p>
    </div>
  );
}
