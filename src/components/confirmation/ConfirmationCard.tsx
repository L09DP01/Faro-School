"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, X, Loader2, ArrowRight, Download, MessageCircle, ShieldCheck } from "lucide-react";

interface ConfirmationCardProps {
  orderId: string;
  reference: string;
  initialState: "success" | "pending" | "failed";
  courseTitle: string;
  courseSlug: string;
  firstLessonUrl: string;
  paymentMethod: string;
  amountHtg: number;
  formattedDate: string;
  whatsappNumber: string;
  locale: string;
}

export function ConfirmationCard({
  orderId,
  reference,
  initialState,
  courseTitle,
  courseSlug,
  firstLessonUrl,
  paymentMethod,
  amountHtg,
  formattedDate,
  whatsappNumber,
  locale,
}: ConfirmationCardProps) {
  const t = useTranslations("confirmation");
  const [currentState, setCurrentState] = useState<"success" | "pending" | "failed">(
    initialState
  );
  const [isFading, setIsFading] = useState(false);

  // Status Polling: Checks status every 10 seconds if in pending state
  useEffect(() => {
    if (currentState !== "pending") return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        if (!res.ok) return;

        const data = await res.json();
        if (!isMounted) return;

        if (data.isPaid) {
          // Trigger gentle fade before switching
          setIsFading(true);
          setTimeout(() => {
            setCurrentState("success");
            setIsFading(false);
          }, 250);
          clearInterval(interval);
        } else if (data.isFailed) {
          setIsFading(true);
          setTimeout(() => {
            setCurrentState("failed");
            setIsFading(false);
          }, 250);
          clearInterval(interval);
        }
      } catch {
        // Silently continue polling on network hiccups
      }
    }, 10000); // 10 seconds polling

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId, currentState]);

  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    `Bonjour Faro School, je vous contacte concernant ma commande ${reference} (${courseTitle}).`
  )}`;

  return (
    <div
      className={`w-full max-w-[720px] mx-auto text-center transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* ========================================================= */}
      {/* 1. STATE: SUCCESS                                         */}
      {/* ========================================================= */}
      {currentState === "success" && (
        <div className="flex flex-col items-center">
          {/* 96px Green-tint Circle with Large Green Check */}
          <div
            className="w-24 h-24 rounded-full bg-ok-tint border border-ok/20 flex items-center justify-center text-ok shadow-sm"
            aria-label="Succès"
          >
            <Check className="w-12 h-12 text-ok stroke-[3]" />
          </div>

          {/* 46px Title */}
          <h1 className="mt-6 text-3xl sm:text-4xl md:text-[46px] font-heading font-bold text-navy-deep leading-tight tracking-tight">
            {locale === "ht"
              ? "Felisitasyon ! Enskripsyon ou valide"
              : "Félicitations ! Votre inscription est validée"}
          </h1>

          {/* Creole subtitle in muted text */}
          <p className="mt-3 text-sm sm:text-base text-muted-faro font-sans max-w-lg leading-relaxed">
            {locale === "ht"
              ? "Peman ou an pase avèk siksè. Tout leson yo pare pou ou, kòmanse kounye a !"
              : "Peman ou an pase avèk siksè — Tout leson yo pare pou ou, commence dès maintenant !"}
          </p>

          {/* White Details Card */}
          <div className="w-full mt-8 rounded-[18px] border border-line bg-surface p-6 sm:p-8 shadow-card text-left">
            {/* Header: Course Title & Accès activé badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-line">
              <div className="min-w-0">
                <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-faro block mb-1">
                  {t("course")}
                </span>
                <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep truncate">
                  {courseTitle}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ok-tint border border-ok/20 text-ok text-xs font-heading font-semibold self-start sm:self-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Accès activé</span>
              </span>
            </div>

            {/* Label / Value Rows */}
            <div className="pt-4 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("orderRef")}</span>
                <span className="font-mono font-semibold text-navy-deep bg-bg px-2.5 py-0.5 rounded border border-line">
                  {reference}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("method")}</span>
                <span className="font-heading font-semibold text-ink capitalize flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      paymentMethod.toLowerCase().includes("natcash")
                        ? "bg-orange"
                        : "bg-red"
                    }`}
                  />
                  {paymentMethod}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("amount")}</span>
                <span className="font-heading font-bold text-navy-deep text-base sm:text-lg">
                  {amountHtg.toLocaleString("fr-HT")} HTG
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("date")}</span>
                <span className="font-sans text-ink font-medium">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="w-full mt-7 flex flex-col items-center gap-3">
            {/* Large Amber CTA Button */}
            <Link
              href={firstLessonUrl}
              className="w-full py-4 px-6 text-base sm:text-lg font-heading font-bold rounded-xl bg-orange hover:bg-orange-strong text-white transition-all shadow-orange flex items-center justify-center gap-2"
            >
              <span>{t("startCourse")}</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </Link>

            {/* Blue Text Link for PDF Receipt */}
            <a
              href={`/api/orders/${orderId}/receipt`}
              download
              className="mt-2 text-blue hover:text-navy-deep hover:underline font-sans text-sm inline-flex items-center gap-2 transition-colors py-1"
            >
              <Download className="w-4 h-4" />
              <span>{t("downloadReceipt")}</span>
            </a>

            {/* Secondary Back to Catalog Link */}
            <Link
              href="/formations"
              className="text-muted-faro hover:text-ink text-xs font-sans mt-1 transition-colors"
            >
              {t("backToCatalog")}
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. STATE: PENDING                                         */}
      {/* ========================================================= */}
      {currentState === "pending" && (
        <div className="flex flex-col items-center">
          {/* 96px Amber-tint Circle with Calm Animated Spinner */}
          <div
            className="w-24 h-24 rounded-full bg-orange-tint border border-orange/20 flex items-center justify-center text-orange shadow-sm"
            aria-label="En cours de vérification"
          >
            <Loader2
              className="w-12 h-12 text-orange motion-safe:animate-spin motion-reduce:animate-none"
              strokeWidth={2.5}
            />
          </div>

          {/* Title */}
          <h1 className="mt-6 text-2xl sm:text-3xl md:text-[38px] font-heading font-bold text-navy-deep leading-tight tracking-tight">
            Paiement en cours de vérification
          </h1>

          {/* Reference */}
          <div className="mt-2 font-mono text-xs sm:text-sm font-semibold text-muted-faro bg-surface border border-line px-3 py-1 rounded-full inline-block">
            Réf: {reference}
          </div>

          {/* Muted line explaining the wait */}
          <p className="mt-3 text-sm sm:text-base text-muted-faro font-sans max-w-lg leading-relaxed">
            {locale === "ht"
              ? "Validasyon an pran ant 5 ak 15 minit an jeneral. Ou ka kite paj sa a ouvri, sistèm nan ap verifye otomatikman."
              : "La validation prend généralement entre 5 et 15 minutes. Vous pouvez laisser cette page ouverte, la mise à jour est automatique."}
          </p>

          {/* Calm Polling Live Indicator */}
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-tint/70 border border-orange/20 text-xs font-heading font-semibold text-orange-strong">
            <span className="w-2 h-2 rounded-full bg-orange motion-safe:animate-ping motion-reduce:animate-none shrink-0" />
            <span>{t("checkingStatus")}</span>
          </div>

          {/* White Details Card */}
          <div className="w-full mt-8 rounded-[18px] border border-line bg-surface p-6 sm:p-8 shadow-card text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-line">
              <div className="min-w-0">
                <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-faro block mb-1">
                  {t("course")}
                </span>
                <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep truncate">
                  {courseTitle}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-tint border border-orange/20 text-orange-strong text-xs font-heading font-semibold self-start sm:self-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-orange motion-safe:animate-pulse" />
                <span>En attente de validation</span>
              </span>
            </div>

            <div className="pt-4 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("method")}</span>
                <span className="font-heading font-semibold text-ink capitalize flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      paymentMethod.toLowerCase().includes("natcash")
                        ? "bg-orange"
                        : "bg-red"
                    }`}
                  />
                  {paymentMethod}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("amount")}</span>
                <span className="font-heading font-bold text-navy-deep text-base sm:text-lg">
                  {amountHtg.toLocaleString("fr-HT")} HTG
                </span>
              </div>
            </div>
          </div>

          {/* WhatsApp Support Button */}
          <div className="w-full mt-7 flex flex-col items-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-surface border-2 border-line hover:border-ok text-ink hover:text-ok font-heading font-semibold text-sm transition-all shadow-subtle"
            >
              <MessageCircle className="w-4 h-4 text-ok" />
              <span>Contacter l&apos;assistance WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. STATE: FAILED                                          */}
      {/* ========================================================= */}
      {currentState === "failed" && (
        <div className="flex flex-col items-center">
          {/* 96px Red-tint Circle with an X */}
          <div
            className="w-24 h-24 rounded-full bg-red-tint border border-red/20 flex items-center justify-center text-red shadow-sm"
            aria-label="Paiement échoué"
          >
            <X className="w-12 h-12 text-red stroke-[3]" />
          </div>

          {/* Title */}
          <h1 className="mt-6 text-2xl sm:text-3xl md:text-[38px] font-heading font-bold text-navy-deep leading-tight tracking-tight">
            {t("failedTitle")}
          </h1>

          {/* Reference */}
          <div className="mt-2 font-mono text-xs sm:text-sm font-semibold text-muted-faro bg-surface border border-line px-3 py-1 rounded-full inline-block">
            Réf: {reference}
          </div>

          {/* Clear Explanation */}
          <p className="mt-3 text-sm sm:text-base text-muted-faro font-sans max-w-lg leading-relaxed">
            {locale === "ht"
              ? "Peman an pa t ka abouti oswa li te anile. Yo pa retire okenn lajan sou kont ou."
              : "Le paiement n'a pas pu aboutir ou a été interrompu. Aucun débit n'a été effectué sur votre compte."}
          </p>

          {/* White Details Card */}
          <div className="w-full mt-8 rounded-[18px] border border-line bg-surface p-6 sm:p-8 shadow-card text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-line">
              <div className="min-w-0">
                <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-muted-faro block mb-1">
                  {t("course")}
                </span>
                <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep truncate">
                  {courseTitle}
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-tint border border-red/20 text-red text-xs font-heading font-semibold self-start sm:self-center shrink-0">
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Paiement non validé</span>
              </span>
            </div>

            <div className="pt-4 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("method")}</span>
                <span className="font-heading font-semibold text-ink capitalize flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      paymentMethod.toLowerCase().includes("natcash")
                        ? "bg-orange"
                        : "bg-red"
                    }`}
                  />
                  {paymentMethod}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-faro font-sans">{t("amount")}</span>
                <span className="font-heading font-bold text-navy-deep text-base sm:text-lg">
                  {amountHtg.toLocaleString("fr-HT")} HTG
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="w-full mt-7 flex flex-col items-center gap-3">
            {/* Primary "Réessayer" Button */}
            <Link
              href={`/checkout/${courseSlug}`}
              className="w-full py-4 px-6 text-base sm:text-lg font-heading font-bold rounded-xl bg-orange hover:bg-orange-strong text-white transition-all shadow-orange flex items-center justify-center gap-2"
            >
              <span>{t("retry")}</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </Link>

            {/* Support Link */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-blue hover:text-navy-deep hover:underline font-sans text-sm inline-flex items-center gap-2 transition-colors py-1"
            >
              <MessageCircle className="w-4 h-4 text-ok" />
              <span>Besoin d&apos;aide ? Écrivez-nous sur WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* Security reassurance footer note */}
      <div className="mt-8 pt-4 flex items-center justify-center gap-2 text-xs font-heading font-semibold text-muted-faro">
        <ShieldCheck className="w-4 h-4 text-ok" />
        <span>Garantie de satisfaction et sécurité Faro School</span>
      </div>
    </div>
  );
}
