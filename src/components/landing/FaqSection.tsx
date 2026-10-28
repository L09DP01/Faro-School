"use client";

import { Container } from "@/components";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function FaqSection() {
  const t = useTranslations("landing.faq");
  const [openIndex, setOpenIndex] = useState<number | null>(0); // first item open by default

  const faqItems = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
    { q: t("q5"), a: t("a5") },
  ];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-12 md:py-16 border-b border-border bg-muted/20">
      <Container className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-border bg-card transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-expanded={isOpen}
                >
                  <span className="pr-4">{item.q}</span>
                  <span className={cn("shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}>
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
