"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LessonPreviewModal } from "./LessonPreviewModal";
import { Play, Check, ShieldCheck } from "lucide-react";

interface StickyPurchaseCardProps {
  courseSlug: string;
  priceHtg: number;
  comparePriceHtg?: number | null;
  coverUrl?: string | null;
  title: string;
  isEnrolled: boolean;
  onPreviewClick?: () => void;
  firstPreviewLessonId?: string | null;
}

export function StickyPurchaseCard({
  courseSlug,
  priceHtg,
  comparePriceHtg,
  coverUrl,
  title,
  isEnrolled,
  onPreviewClick,
  firstPreviewLessonId,
}: StickyPurchaseCardProps) {
  const t = useTranslations("courseDetail.priceCard");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const percentSaved =
    comparePriceHtg && comparePriceHtg > priceHtg
      ? Math.round(((comparePriceHtg - priceHtg) / comparePriceHtg) * 100)
      : null;

  const handleOpenPreview = () => {
    if (onPreviewClick) {
      onPreviewClick();
    } else if (firstPreviewLessonId) {
      setIsPreviewOpen(true);
    }
  };

  return (
    <>
      {/* 1. Desktop Sticky Card (Right column: 400px wide, sticky) */}
      <div className="hidden lg:block w-full max-w-[400px] sticky top-24 rounded-[18px] border border-line bg-surface overflow-hidden shadow-card">
        {/* Course image preview with large "Aperçu" play label */}
        <div
          onClick={handleOpenPreview}
          className="group relative aspect-video w-full overflow-hidden bg-bg cursor-pointer"
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={title}
              width={400}
              height={225}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-tint text-orange font-bold text-sm">
              <span>{title}</span>
            </div>
          )}

          {/* Large "Aperçu" Play Overlay Label */}
          <div className="absolute inset-0 bg-navy-deep/40 flex items-center justify-center transition-colors group-hover:bg-navy-deep/50">
            <div className="flex items-center gap-2.5 bg-surface/95 backdrop-blur px-4 py-2 rounded-full shadow-card text-ink font-heading font-semibold text-xs group-hover:scale-105 transition-transform">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange text-white">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
              <span>Aperçu de la formation</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Price at 36px bold navy, struck compare price, red discount tag */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="font-heading text-3xl md:text-[36px] font-black text-navy-deep leading-none">
                {priceHtg.toLocaleString()} HTG
              </span>
              {comparePriceHtg && comparePriceHtg > priceHtg && (
                <span className="font-sans text-base font-normal text-muted-faro line-through">
                  {comparePriceHtg.toLocaleString()} HTG
                </span>
              )}
              {percentSaved && (
                <span className="px-2 py-0.5 rounded-md bg-red-tint text-red border border-red/20 font-heading text-xs font-bold">
                  -{percentSaved}%
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-muted-faro pt-1">
              Paiement unique • Accès immédiat et illimité
            </p>
          </div>

          {/* Action buttons: Full-width amber Buy button + ghost preview button */}
          <div className="space-y-2.5">
            {isEnrolled ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-ok-tint border border-ok/20 font-sans text-xs text-ok font-medium flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ok" />
                  <span>{t("enrolledAlert")}</span>
                </div>
                <Link
                  href="/dashboard"
                  className="w-full h-12 flex items-center justify-center rounded-xl bg-orange text-white font-heading font-semibold text-base hover:bg-orange-strong shadow-orange transition-all"
                >
                  {t("continueLearning")} →
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href={`/checkout/${courseSlug}`}
                  className="w-full h-12 flex items-center justify-center rounded-xl bg-orange text-white font-heading font-semibold text-base hover:bg-orange-strong shadow-orange transition-all text-center"
                >
                  {t("enrollNow")} →
                </Link>
                {(onPreviewClick || firstPreviewLessonId) && (
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface hover:bg-bg text-navy font-heading font-semibold text-xs sm:text-sm transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-blue" />
                    <span>{t("freePreview")}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* MonCash and NatCash pills */}
          <div className="pt-3 border-t border-line space-y-2">
            <p className="font-heading text-[11px] font-bold text-muted-faro text-center uppercase tracking-wider">
              {t("moncashNatcash")}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="px-3.5 py-1 rounded-full border border-line bg-bg font-heading text-xs font-bold text-ink">
                MonCash
              </span>
              <span className="px-3.5 py-1 rounded-full border border-line bg-bg font-heading text-xs font-bold text-ink">
                NatCash
              </span>
            </div>
            <p className="font-sans text-[11px] text-muted-faro text-center">
              Paiement 100% sécurisé en Gourdes (HTG)
            </p>
          </div>

          {/* Benefit lines with check marks */}
          <div className="pt-3 border-t border-line space-y-3">
            <p className="font-heading text-xs font-bold text-ink uppercase tracking-wide">
              {t("benefitsTitle")}
            </p>
            <ul className="space-y-2.5 font-sans text-xs text-ink/80">
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-ok-tint text-ok mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{t("benefit1")}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-ok-tint text-ok mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{t("benefit2")}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-ok-tint text-ok mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{t("benefit3")}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-ok-tint text-ok mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{t("benefit4")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Mobile Fixed Bottom Bar (< 1024px, 390px compliant) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md px-4 py-3 shadow-lift">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-lg sm:text-xl font-bold text-navy-deep leading-tight">
                {priceHtg.toLocaleString()} HTG
              </span>
              {percentSaved && (
                <span className="px-1.5 py-0.5 rounded bg-red-tint text-red text-[10px] font-heading font-bold">
                  -{percentSaved}%
                </span>
              )}
            </div>
            <p className="font-sans text-[10px] text-muted-faro">MonCash / NatCash</p>
          </div>

          <div>
            {isEnrolled ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange text-white font-heading font-semibold text-xs shadow-orange hover:bg-orange-strong"
              >
                {t("continueLearning")} →
              </Link>
            ) : (
              <Link
                href={`/checkout/${courseSlug}`}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange text-white font-heading font-semibold text-xs shadow-orange hover:bg-orange-strong"
              >
                {t("enrollNow")} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal for Desktop click */}
      {firstPreviewLessonId && (
        <LessonPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          lessonId={firstPreviewLessonId}
          lessonTitle={`Aperçu : ${title}`}
          courseSlug={courseSlug}
        />
      )}
    </>
  );
}
