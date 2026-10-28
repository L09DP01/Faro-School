import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminKPIs } from "@/lib/admin/dashboard";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Award,
  ArrowRight,
} from "lucide-react";

interface AdminKpiCardsProps {
  kpis: AdminKPIs;
  locale: string;
}

export function AdminKpiCards({ kpis, locale }: AdminKpiCardsProps) {
  const t = useTranslations("admin.dashboard.kpis");

  const formatHtg = (amount: number) => {
    return (
      new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(amount) + " HTG"
    );
  };

  const renderDeltaBadge = (pct: number, isDirectDifference = false) => {
    const isPositive = pct > 0;
    const isZero = pct === 0;

    let text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
    if (isDirectDifference) {
      text = `${pct > 0 ? "+" : ""}${pct.toFixed(1)} pts`;
    }

    if (isZero) {
      return (
        <span className="inline-flex items-center text-xs font-heading font-semibold text-muted-faro bg-bg border border-line px-2 py-0.5 rounded-full">
          0.0% vs période préc.
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-heading font-semibold px-2.5 py-0.5 rounded-full border ${
          isPositive
            ? "text-ok bg-ok-tint border-ok/20"
            : "text-red bg-red-tint border-red/20"
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
        )}
        <span>{text}</span>
        <span className="font-sans font-normal opacity-70">vs période préc.</span>
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Revenue Card */}
      <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-muted-faro uppercase tracking-wider">
            {t("revenue")}
          </span>
          <div className="w-9 h-9 rounded-xl bg-orange-tint text-orange flex items-center justify-center border border-orange/20">
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        <div>
          <div className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-none">
            {formatHtg(kpis.revenue)}
          </div>
          <p className="text-xs text-muted-faro font-sans mt-1">
            {t("revenueSub")}
          </p>
        </div>

        <div className="pt-2 border-t border-line">
          {renderDeltaBadge(kpis.revenueChangePct)}
        </div>
      </div>

      {/* 2. New Students Card */}
      <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-muted-faro uppercase tracking-wider">
            {t("students")}
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-tint text-blue flex items-center justify-center border border-blue/20">
            <Users className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        <div>
          <div className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-none">
            {kpis.newStudents}
          </div>
          <p className="text-xs text-muted-faro font-sans mt-1">
            {t("studentsSub")}
          </p>
        </div>

        <div className="pt-2 border-t border-line">
          {renderDeltaBadge(kpis.studentsChangePct)}
        </div>
      </div>

      {/* 3. Payments Awaiting Validation Card */}
      <Link
        href="/admin/paiements"
        className={`rounded-[18px] border p-6 shadow-card space-y-3 transition-all block group ${
          kpis.awaitingValidation > 0
            ? "border-orange/30 bg-orange-tint/40 hover:border-orange hover:shadow-orange"
            : "border-line bg-surface hover:border-blue/30"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-muted-faro uppercase tracking-wider">
            {t("awaiting")}
          </span>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              kpis.awaitingValidation > 0
                ? "bg-orange-tint text-orange-strong border border-orange/30"
                : "bg-bg text-muted-faro border border-line"
            }`}
          >
            <Clock className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        <div>
          <div className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-none flex items-center gap-2">
            <span>{kpis.awaitingValidation}</span>
            {kpis.awaitingValidation > 0 && (
              <span className="text-[11px] font-heading font-bold px-2.5 py-0.5 rounded-full bg-orange text-white shadow-sm">
                Action requise
              </span>
            )}
          </div>
          <p className="text-xs text-muted-faro font-sans mt-1">
            {t("awaitingSub")}
          </p>
        </div>

        <div className="pt-2 border-t border-line flex items-center justify-between text-xs font-heading font-bold text-orange-strong group-hover:underline">
          <span>{t("viewAwaiting")}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      {/* 4. Completion Rate Card */}
      <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-muted-faro uppercase tracking-wider">
            {t("completion")}
          </span>
          <div className="w-9 h-9 rounded-xl bg-ok-tint text-ok flex items-center justify-center border border-ok/20">
            <Award className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        <div>
          <div className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-none">
            {kpis.completionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-faro font-sans mt-1">
            {t("completionSub")}
          </p>
        </div>

        <div className="pt-2 border-t border-line">
          {renderDeltaBadge(kpis.completionChangePct, true)}
        </div>
      </div>
    </div>
  );
}
