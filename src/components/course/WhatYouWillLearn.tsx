import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

interface WhatYouWillLearnProps {
  points: string[];
}

export function WhatYouWillLearn({ points }: WhatYouWillLearnProps) {
  const t = useTranslations("courseDetail.whatYouLearn");

  if (!points || points.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-5 shadow-card">
      <div>
        <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink">
          {t("title")}
        </h2>
        <p className="mt-1 font-sans text-xs sm:text-sm text-muted-faro">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {points.map((point, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-ok-tint text-ok mt-0.5">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            <span className="font-sans text-sm text-ink leading-relaxed">
              {point}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
