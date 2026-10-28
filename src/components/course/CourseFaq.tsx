"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export function CourseFaq() {
  const t = useTranslations("courseDetail.faq");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqItems = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
  ];

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 space-y-4 shadow-card">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink">
        {t("title")}
      </h2>

      <div className="space-y-3 pt-2">
        {faqItems.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-xl border border-line bg-bg/50 overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between p-4 text-left font-heading text-xs sm:text-sm font-bold text-ink hover:text-blue transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange/40"
                aria-expanded={isOpen}
              >
                <span className="pr-3">{item.q}</span>
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center text-muted-faro transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 font-sans text-xs sm:text-sm text-muted-faro leading-relaxed border-t border-line/60 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
