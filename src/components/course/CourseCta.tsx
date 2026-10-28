import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface CourseCtaProps {
  courseSlug: string;
  priceHtg: number;
  comparePriceHtg?: number | null;
  isEnrolled: boolean;
}

export function CourseCta({
  courseSlug,
  priceHtg,
  comparePriceHtg,
  isEnrolled,
}: CourseCtaProps) {
  const t = useTranslations("courseDetail.cta");
  const tCard = useTranslations("courseDetail.priceCard");

  const percentSaved =
    comparePriceHtg && comparePriceHtg > priceHtg
      ? Math.round(((comparePriceHtg - priceHtg) / comparePriceHtg) * 100)
      : null;

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-10 shadow-card text-center space-y-6">
      <div className="max-w-xl mx-auto space-y-2">
        <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-ink">
          {t("title")}
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-heading text-3xl font-black text-navy-deep leading-none">
            {priceHtg.toLocaleString()} HTG
          </span>
          {comparePriceHtg && comparePriceHtg > priceHtg && (
            <span className="font-sans text-base text-muted-faro line-through">
              {comparePriceHtg.toLocaleString()} HTG
            </span>
          )}
          {percentSaved && (
            <span className="px-2 py-0.5 rounded-md bg-red-tint text-red border border-red/20 font-heading text-xs font-bold">
              -{percentSaved}%
            </span>
          )}
        </div>

        {isEnrolled ? (
          <Link
            href="/dashboard"
            className="w-full sm:w-auto h-12 px-7 flex items-center justify-center rounded-xl bg-orange text-white font-heading font-semibold text-sm hover:bg-orange-strong shadow-orange transition-all"
          >
            {tCard("continueLearning")} →
          </Link>
        ) : (
          <Link
            href={`/checkout/${courseSlug}`}
            className="w-full sm:w-auto h-12 px-8 flex items-center justify-center rounded-xl bg-orange text-white font-heading font-semibold text-base hover:bg-orange-strong shadow-orange transition-all"
          >
            {tCard("enrollNow")} →
          </Link>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="px-3 py-1 rounded-full border border-line bg-bg font-heading text-xs font-bold text-ink">
          MonCash
        </span>
        <span className="px-3 py-1 rounded-full border border-line bg-bg font-heading text-xs font-bold text-ink">
          NatCash
        </span>
        <span className="font-sans text-xs text-muted-faro ml-2">
          Paiement 100% sécurisé
        </span>
      </div>
    </div>
  );
}
