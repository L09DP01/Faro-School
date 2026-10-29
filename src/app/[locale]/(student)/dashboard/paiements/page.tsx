import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localized } from "@/lib/i18n/localized";
import { CreditCard, Download, ArrowRight } from "lucide-react";

interface PaymentsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PaymentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.payments" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StudentPaymentsPage({ params }: PaymentsPageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: "dashboard.payments" });

  if (!user) return null;

  const supabase = await createClient();

  // Fetch orders and associated payments belonging to this user
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      reference,
      amount_htg,
      status,
      created_at,
      courses (
        title_fr,
        title_ht
      ),
      payments (
        provider,
        status,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const orderList: any[] = orders || [];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-heading font-bold text-navy-deep leading-tight">
          {t("title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro font-sans mt-1">
          {t("subtitle")}
        </p>
      </div>

      {!orderList || orderList.length === 0 ? (
        /* Empty State */
        <div className="rounded-[18px] border-2 border-dashed border-line bg-surface p-10 sm:p-14 text-center space-y-4 shadow-subtle">
          <div className="w-14 h-14 rounded-2xl bg-orange-tint text-orange mx-auto flex items-center justify-center border border-orange/20 shadow-sm">
            <CreditCard className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base font-heading font-bold text-navy-deep">
              Aucune transaction enregistrée
            </h3>
            <p className="text-xs sm:text-sm text-muted-faro font-sans leading-relaxed">
              {t("empty")}
            </p>
          </div>
          <Link
            href="/formations"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-orange"
          >
            <span>Explorer le catalogue</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </Link>
        </div>
      ) : (
        /* Orders & Payments Table */
        <div className="rounded-[18px] border border-line bg-surface overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg border-b border-line text-muted-faro uppercase text-[10px] tracking-wider font-heading font-bold">
                <tr>
                  <th className="py-4 px-5">{t("ref")}</th>
                  <th className="py-4 px-5">{t("course")}</th>
                  <th className="py-4 px-5">{t("amount")}</th>
                  <th className="py-4 px-5">{t("method")}</th>
                  <th className="py-4 px-5">{t("status")}</th>
                  <th className="py-4 px-5">{t("date")}</th>
                  <th className="py-4 px-5 text-right">{t("receipt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink font-sans">
                {orderList.map((order) => {
                  const courseData = order.courses as any;
                  const courseTitle = courseData
                    ? localized(courseData, "title", locale as "fr" | "ht")
                    : "Formation";

                  const paymentsList = Array.isArray(order.payments) ? order.payments : [];
                  const latestPayment = paymentsList.length > 0 ? paymentsList[paymentsList.length - 1] : null;

                  const isPaid = order.status === "paid" || latestPayment?.status === "validated";
                  const isAwaiting = !isPaid && (latestPayment?.status === "awaiting_validation" || order.status === "pending");

                  const formattedDate = new Date(order.created_at).toLocaleDateString(
                    locale === "ht" ? "ht-HT" : "fr-HT",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }
                  );

                  const providerName = latestPayment?.provider || "moncash";

                  return (
                    <tr key={order.id} className="hover:bg-bg/60 transition-colors">
                      <td className="py-4 px-5 font-mono font-semibold text-navy-deep whitespace-nowrap">
                        {order.reference}
                      </td>
                      <td className="py-4 px-5 font-heading font-bold text-navy-deep max-w-[220px] truncate">
                        {courseTitle}
                      </td>
                      <td className="py-4 px-5 font-heading font-bold text-navy-deep whitespace-nowrap text-sm">
                        {order.amount_htg.toLocaleString("fr-HT")} HTG
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 capitalize font-medium text-ink">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              providerName.toLowerCase().includes("natcash")
                                ? "bg-orange"
                                : "bg-red"
                            }`}
                          />
                          <span>{providerName}</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-bold text-ok bg-ok-tint border border-ok/20 px-2.5 py-0.5 rounded-full">
                            ● Validé
                          </span>
                        ) : isAwaiting ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-bold text-orange-strong bg-orange-tint border border-orange/20 px-2.5 py-0.5 rounded-full">
                            ⏳ En attente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-bold text-red bg-red-tint border border-red/20 px-2.5 py-0.5 rounded-full">
                            ✕ Échoué
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap text-muted-faro text-xs">
                        {formattedDate}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        {isPaid ? (
                          <a
                            href={`/api/orders/${order.id}/receipt`}
                            download
                            className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-blue hover:text-navy-deep hover:underline transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Reçu PDF</span>
                          </a>
                        ) : (
                          <span className="text-muted-faro/40 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
