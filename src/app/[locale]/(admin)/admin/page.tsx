import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminDashboardData,
  type PeriodType,
} from "@/lib/admin/dashboard";
import {
  AdminPeriodSelector,
  AdminKpiCards,
  AdminRevenueChart,
  AdminTopCourses,
  AdminRecentPaymentsTable,
} from "@/components/admin";
import { Plus } from "lucide-react";

interface AdminDashboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({
  params,
}: AdminDashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: AdminDashboardPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;

  // Strict Admin Guard
  const admin = await requireAdmin(locale);

  // Validate period parameter
  const validPeriods: PeriodType[] = ["this_month", "last_30_days", "this_year"];
  const period: PeriodType = validPeriods.includes(
    resolvedSearchParams.period as PeriodType
  )
    ? (resolvedSearchParams.period as PeriodType)
    : "this_month";

  // Fetch aggregated data via RPC
  const data = await getAdminDashboardData(period);
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });

  const initials = admin.fullName
    ? admin.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <div className="space-y-8">
      {/* ========================================================= */}
      {/* 1. HEADER ROW: TITLE, PERIOD SELECT, + NEW COURSE, AVATAR */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-[30px] font-heading font-bold text-navy-deep leading-tight">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-faro font-sans mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Ghost Period Selector */}
          <AdminPeriodSelector currentPeriod={period} />

          {/* Blue "+ Nouvelle formation" Button */}
          <Link
            href="/admin/formations/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-subtle shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Nouvelle formation</span>
          </Link>

          {/* Round amber-to-orange avatar */}
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange text-white font-heading font-bold flex items-center justify-center text-xs shadow-subtle border-2 border-surface shrink-0"
            title={admin.fullName || "Admin"}
            aria-label="Profil administrateur"
          >
            {initials}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. FOUR KPI CARDS (Delta line green / red)                */}
      {/* ========================================================= */}
      <AdminKpiCards kpis={data.kpis} locale={locale} />

      {/* ========================================================= */}
      {/* 3. MIDDLE ROW: 12-MONTH REVENUE CHART (~2/3) + TOP COURSES */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Revenue Chart (8 cols ~ 2/3 width) */}
        <div className="lg:col-span-8">
          <AdminRevenueChart data={data.revenue12Months} locale={locale} />
        </div>

        {/* Top Courses (4 cols ~ 1/3 width) */}
        <div className="lg:col-span-4">
          <AdminTopCourses courses={data.topCourses} locale={locale} />
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. BOTTOM ROW: LATEST PAYMENTS TABLE                     */}
      {/* ========================================================= */}
      <AdminRecentPaymentsTable payments={data.recentPayments} locale={locale} />
    </div>
  );
}
