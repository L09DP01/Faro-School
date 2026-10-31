"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RevenueMonth } from "@/lib/admin/dashboard";

interface AdminRevenueChartProps {
  data: RevenueMonth[];
  locale: string;
}

export function AdminRevenueChart({ data, locale }: AdminRevenueChartProps) {
  const t = useTranslations("admin.dashboard.chart");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatHtg = (amount: number) => {
    return (
      new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(amount) + " HTG"
    );
  };

  const totalMonCash = data.reduce((acc, m) => acc + m.moncashAmount, 0);
  const totalNatCash = data.reduce((acc, m) => acc + m.natcashAmount, 0);
  const totalOverall = totalMonCash + totalNatCash;

  const moncashPctSplit =
    totalOverall > 0 ? Math.round((totalMonCash / totalOverall) * 100) : 0;
  const natcashPctSplit = totalOverall > 0 ? 100 - moncashPctSplit : 0;

  // Find max monthly total to calculate relative bar heights
  const maxTotal = Math.max(...data.map((m) => m.totalAmount), 1);

  // Accessible text alternative for screen readers
  const accessibleChartSummary = data
    .map((m) => `${m.monthLabelFr}: ${m.totalAmount} HTG`)
    .join(", ");

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-7 shadow-card space-y-5">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-faro font-sans mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        {/* Green Pill showing MonCash and NatCash Split */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ok-tint border border-ok/20 text-ok text-xs font-heading font-semibold self-start sm:self-center">
          <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
          <span>
            MonCash {moncashPctSplit}% · NatCash {natcashPctSplit}%
          </span>
        </div>
      </div>

      {/* Screen-reader accessible alternative table */}
      <div className="sr-only" aria-live="polite">
        <h3>Revenus mensuels détaillés (12 mois)</h3>
        <p>{accessibleChartSummary}</p>
      </div>

      {/* Lightweight CSS Bar Chart Canvas */}
      <div
        role="img"
        aria-label={`Graphique en barres des revenus sur 12 mois. Total cumulé: ${formatHtg(totalOverall)}. ${accessibleChartSummary}`}
        className="pt-6 pb-2"
      >
        <div className="h-56 flex items-end gap-2 sm:gap-3.5 border-b border-line px-1">
          {data.map((m, idx) => {
            const isCurrentMonth = idx === data.length - 1;
            const barHeightPct = Math.max(
              (m.totalAmount / maxTotal) * 100,
              m.totalAmount > 0 ? 6 : 2
            );
            const isHovered = hoveredIndex === idx;

            const label = locale === "ht" ? m.monthLabelHt : m.monthLabelFr;
            const monthInitial = (label || "M").charAt(0).toUpperCase();

            return (
              <div
                key={m.monthKey}
                tabIndex={0}
                aria-label={`${label}: ${formatHtg(m.totalAmount)} (MonCash: ${formatHtg(m.moncashAmount)}, NatCash: ${formatHtg(m.natcashAmount)})`}
                className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer focus:outline-none"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(idx)}
                onBlur={() => setHoveredIndex(null)}
              >
                {/* Floating Tooltip */}
                {isHovered && (
                  <div className="absolute -top-20 z-30 pointer-events-none bg-navy-deep text-white rounded-xl shadow-card px-3.5 py-2 text-[11px] whitespace-nowrap space-y-1 font-sans border border-white/10 animate-fade-in">
                    <p className="font-heading font-bold text-xs text-orange">
                      {label} {isCurrentMonth && "● (En cours)"}
                    </p>
                    <div className="flex items-center justify-between gap-4 text-white/80">
                      <span>MonCash :</span>
                      <span className="font-mono font-semibold text-white">
                        {formatHtg(m.moncashAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-white/80">
                      <span>NatCash :</span>
                      <span className="font-mono font-semibold text-white">
                        {formatHtg(m.natcashAmount)}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-white/20 flex items-center justify-between gap-4 font-bold text-white">
                      <span>Total :</span>
                      <span className="font-mono font-bold text-ok">
                        {formatHtg(m.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bar Element: Solid Blue for current month, light blue for previous */}
                <div className="w-full max-w-[36px] flex flex-col justify-end rounded-t-lg overflow-hidden transition-all duration-300">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isCurrentMonth
                        ? "bg-blue shadow-subtle group-hover:bg-blue/90"
                        : "bg-blue-light hover:bg-blue/40"
                    }`}
                  />
                </div>

                {/* Month Initial Under the Bar */}
                <span
                  className={`mt-2 text-xs font-heading font-bold transition-colors select-none ${
                    isCurrentMonth ? "text-blue" : "text-muted-faro"
                  }`}
                  title={label}
                >
                  {monthInitial}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chart Footer summary */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-faro font-sans px-1">
          <div>
            <span>Total cumulé : </span>
            <strong className="text-navy-deep font-heading font-bold">
              {formatHtg(totalOverall)}
            </strong>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-heading font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue inline-block" />
              <span className="text-navy-deep">Mois en cours</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-light inline-block" />
              <span className="text-muted-faro">Mois précédents</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
