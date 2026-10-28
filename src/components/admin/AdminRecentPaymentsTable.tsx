import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RecentPayment } from "@/lib/admin/dashboard";

interface AdminRecentPaymentsTableProps {
  payments: RecentPayment[];
  locale: string;
}

export function AdminRecentPaymentsTable({
  payments,
  locale,
}: AdminRecentPaymentsTableProps) {
  const t = useTranslations("admin.dashboard.recentPayments");
  const tStatus = useTranslations("admin.dashboard.status");

  const formatHtg = (amount: number) => {
    return (
      new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(amount) + " HTG"
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: RecentPayment["status"]) => {
    switch (status) {
      case "validated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold bg-ok-tint text-ok border border-ok/20">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            <span>{tStatus("validated") || "Validé"}</span>
          </span>
        );
      case "awaiting_validation":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold bg-orange-tint text-orange-strong border border-orange/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            <span>{tStatus("awaiting_validation") || "En attente"}</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold bg-red-tint text-red border border-red/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            <span>{tStatus("failed") || "Échoué"}</span>
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold bg-bg text-muted-faro border border-line">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-faro" />
            <span>{tStatus("pending") || "En cours"}</span>
          </span>
        );
    }
  };

  const renderProviderBadge = (provider: RecentPayment["provider"]) => {
    const isMoncash = provider === "moncash";
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-heading font-medium text-ink capitalize">
        <span
          className={`w-2 h-2 rounded-full ${
            isMoncash ? "bg-red" : "bg-orange"
          }`}
        />
        <span>{provider}</span>
      </span>
    );
  };

  return (
    <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-7 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-heading font-bold text-navy-deep tracking-tight">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-faro font-sans mt-0.5">{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/paiements"
          className="text-xs font-heading font-bold text-blue hover:underline self-start sm:self-auto"
        >
          {t("viewAll")} →
        </Link>
      </div>

      {payments.length === 0 ? (
        <p className="text-xs text-muted-faro py-6 text-center font-sans">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 sm:-mx-7 px-6 sm:px-7">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-line text-muted-faro uppercase font-heading font-bold text-[10px] tracking-wider">
                <th className="pb-3.5 pr-4">{t("colStudent")}</th>
                <th className="pb-3.5 px-4">{t("colCourse")}</th>
                <th className="pb-3.5 px-4">{t("colMethod")}</th>
                <th className="pb-3.5 px-4 text-right">{t("colAmount")}</th>
                <th className="pb-3.5 px-4 text-center">{t("colStatus")}</th>
                <th className="pb-3.5 pl-4 text-right">{t("colDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-ink">
              {payments.map((p) => {
                const courseTitle =
                  locale === "ht" ? p.courseTitleHt : p.courseTitleFr;

                return (
                  <tr key={p.id} className="hover:bg-bg/60 transition-colors">
                    {/* Bold student name */}
                    <td className="py-3.5 pr-4 font-medium">
                      <div className="font-heading font-bold text-navy-deep text-xs sm:text-sm">
                        {p.studentName}
                      </div>
                      {p.studentPhone && (
                        <div className="text-[11px] text-muted-faro font-mono mt-0.5">
                          {p.studentPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-muted-faro max-w-[220px] truncate font-medium">
                      {courseTitle}
                    </td>
                    <td className="py-3.5 px-4">{renderProviderBadge(p.provider)}</td>
                    <td className="py-3.5 px-4 text-right font-heading font-bold text-navy-deep whitespace-nowrap text-xs sm:text-sm">
                      {formatHtg(p.amountHtg)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(p.status)}
                    </td>
                    <td className="py-3.5 pl-4 text-right text-muted-faro whitespace-nowrap text-xs">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
