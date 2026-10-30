"use client";

import { usePwa } from "@/lib/pwa/use-pwa";
import { Share, PlusSquare, X } from "lucide-react";
import Image from "next/image";

export function IosInstallModal({ locale = "fr" }: { locale?: string }) {
  const { showIosModal, setShowIosModal } = usePwa();

  if (!showIosModal) return null;

  const isHt = locale === "ht";

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto sm:max-w-md bg-surface border-t sm:border border-line rounded-t-3xl sm:rounded-3xl p-6 shadow-card space-y-5 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-line shadow-2xs">
              <Image
                src="/icons/icon-192.png"
                alt="Faro School"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-navy-deep">
                {isHt
                  ? "Enstale Faro School sou iPhone / iPad"
                  : "Installer Faro School sur iPhone / iPad"}
              </h3>
              <p className="text-[11px] text-muted-faro">
                {isHt
                  ? "Aksè rapid san pase pa navigatè a"
                  : "Accès instantané sans ouvrir le navigateur"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowIosModal(false)}
            className="p-1.5 rounded-full text-muted-faro hover:text-ink hover:bg-bg transition-colors"
            aria-label={isHt ? "Fèmen" : "Fermer"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-muted-faro">{isHt ? "Sou iPhone, ouvri faroschool.com nan Safari, epi swiv etap sa yo." : "Sur iPhone, ouvrez faroschool.com dans Safari, puis suivez ces étapes."}</p>
        {/* Steps */}
        <div className="space-y-3.5 text-xs text-ink">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-bg border border-line/60">
            <div className="w-7 h-7 rounded-full bg-orange-tint text-orange font-heading font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-deep">
                {isHt
                  ? "Klike sou bouton Pataje a"
                  : "Appuyez sur le bouton Partager"}
              </p>
              <p className="text-muted-faro mt-0.5">
                {isHt
                  ? "Li anba ekran Safari a (oswa anwo sou iPad)."
                  : "Situé dans la barre d'outils en bas de Safari."}
              </p>
            </div>
            <Share className="w-5 h-5 text-blue shrink-0 mt-0.5" />
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-bg border border-line/60">
            <div className="w-7 h-7 rounded-full bg-orange-tint text-orange font-heading font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-deep">
                {isHt
                  ? "Chwazi 'Sou ekran dakèy'"
                  : "Sélectionnez 'Sur l'écran d'accueil'"}
              </p>
              <p className="text-muted-faro mt-0.5">
                {isHt
                  ? "Desann nan meni an jiskaske w wè opsyon sa a."
                  : "Faites défiler le menu d'actions vers le bas."}
              </p>
            </div>
            <PlusSquare className="w-5 h-5 text-ink shrink-0 mt-0.5" />
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-bg border border-line/60">
            <div className="w-7 h-7 rounded-full bg-orange-tint text-orange font-heading font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-deep">
                {isHt
                  ? "Klike sou 'Ajoute' anwo adwat"
                  : "Appuyez sur 'Ajouter' en haut à droite"}
              </p>
              <p className="text-muted-faro mt-0.5">
                {isHt
                  ? "Faro School ap parèt kounye a sou telefòn ou tankou yon aplikasyon natif."
                  : "L'application Faro School sera installée sur votre écran d'accueil."}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowIosModal(false)}
          className="w-full py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs shadow-orange transition-transform active:scale-95"
        >
          {isHt ? "Mwen konprann" : "J'ai compris"}
        </button>
      </div>
    </div>
  );
}
