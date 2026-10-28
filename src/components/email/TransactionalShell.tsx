import React from "react";
import Image from "next/image";

export interface TransactionalEmailProps {
  previewText?: string;
  headline: string;
  studentName: string;
  bodyParagraphs: string[];
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  orderReference?: string;
  amountHtg?: number;
}

/**
 * Transactional Email Visual Shell:
 * Matches the Faro School design system: Logo, white card with radius 18px on the --bg (#F8FAFC) background,
 * and one amber primary button (#FF7F0E).
 */
export function TransactionalEmailShell({
  headline,
  studentName,
  bodyParagraphs,
  ctaText = "Accéder à ma formation",
  ctaUrl = "https://faroschool.com/dashboard",
  footerNote = "Si vous rencontrez la moindre difficulté, contactez notre équipe sur WhatsApp au +509 36 00 00 00.",
  orderReference,
  amountHtg,
}: TransactionalEmailProps) {
  return (
    <div className="bg-bg py-10 px-4 font-sans text-ink min-h-[600px] flex flex-col items-center justify-center">
      <div className="max-w-[560px] w-full space-y-6">
        {/* Logo at Top */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2">
            <Image
              src="/brand/logo-on-light.png"
              alt="Faro School"
              width={160}
              height={44}
              className="h-9 w-auto mx-auto object-contain"
              unoptimized
            />
          </div>
        </div>

        {/* White Card on --bg Color */}
        <div className="bg-surface rounded-[18px] border border-line p-7 sm:p-9 shadow-card space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-heading font-semibold uppercase tracking-wider text-orange">
              Faro School
            </span>
            <h1 className="font-heading font-bold text-2xl text-ink leading-tight">
              {headline}
            </h1>
          </div>

          <p className="text-sm font-semibold text-ink">
            Bonjour {studentName},
          </p>

          <div className="space-y-3 text-sm text-muted-faro leading-relaxed font-sans">
            {bodyParagraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          {/* Optional Order Summary Box */}
          {(orderReference || amountHtg) && (
            <div className="p-4 rounded-xl bg-bg border border-line text-xs space-y-1.5">
              {orderReference && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-faro">Référence de commande :</span>
                  <span className="font-mono font-bold text-ink">#{orderReference}</span>
                </div>
              )}
              {amountHtg && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-faro">Montant réglé :</span>
                  <span className="font-heading font-bold text-ink text-sm">
                    {amountHtg.toLocaleString()} HTG
                  </span>
                </div>
              )}
            </div>
          )}

          {/* One Amber Primary Button */}
          {ctaText && ctaUrl && (
            <div className="pt-2 text-center">
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full sm:w-auto px-8 py-3.5 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold text-sm transition-colors shadow-sm text-center"
              >
                {ctaText} →
              </a>
            </div>
          )}

          {/* Footer Note */}
          {footerNote && (
            <div className="pt-4 border-t border-line text-[11px] text-muted-faro leading-relaxed">
              {footerNote}
            </div>
          )}
        </div>

        {/* Bottom Legal Copyright */}
        <div className="text-center text-xs text-muted-faro/80 space-y-1">
          <p>© {new Date().getFullYear()} Faro School. Tous droits réservés.</p>
          <p>Port-au-Prince, Haïti • Paiements sécurisés MonCash & NatCash</p>
        </div>
      </div>
    </div>
  );
}

/**
 * SMS Wording Shell & Templates for Local Notifications in Haiti
 */
export const SMS_TEMPLATES = {
  paymentConfirmed: (studentName: string, courseTitle: string, ref: string) =>
    `Faro School: Bonjou ${studentName}, peman ${ref} ou an valide avèk siksè ! Aksè ou nan "${courseTitle}" aktif kounye a sou: faroschool.com/dashboard`,

  awaitingNatcashVerification: (studentName: string, ref: string) =>
    `Faro School: Bonjou ${studentName}, nou resevwa demann peman NatCash ${ref} ou a. N ap verifye transfè a nan mwens pase 15 minit. Mèsi pou pasyans ou.`,

  courseAccessGranted: (studentName: string, courseTitle: string) =>
    `Faro School: Bonjou ${studentName}, responsab la akòde w aksè nan fòmasyon "${courseTitle}". Konekte sou kont ou pou kòmanse gade videyo yo: faroschool.com/dashboard`,
};
