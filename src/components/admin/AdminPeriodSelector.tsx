"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PeriodType } from "@/lib/admin/dashboard";

interface AdminPeriodSelectorProps {
  currentPeriod: PeriodType;
}

export function AdminPeriodSelector({ currentPeriod }: AdminPeriodSelectorProps) {
  const t = useTranslations("admin.dashboard.period");

  const periods: Array<{ id: PeriodType; label: string }> = [
    { id: "this_month", label: t("this_month") || "Ce mois" },
    { id: "last_30_days", label: t("last_30_days") || "30 derniers jours" },
    { id: "this_year", label: t("this_year") || "Cette année" },
  ];

  return (
    <div
      role="group"
      aria-label="Période statistique"
      className="inline-flex items-center p-1 bg-surface rounded-xl border border-line text-xs font-heading font-semibold shadow-subtle"
    >
      {periods.map((p) => {
        const isActive = currentPeriod === p.id;
        return (
          <Link
            key={p.id}
            href={`/admin?period=${p.id}`}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              isActive
                ? "bg-blue-tint text-blue font-bold shadow-subtle border border-blue/20"
                : "text-muted-faro hover:text-navy hover:bg-bg"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
