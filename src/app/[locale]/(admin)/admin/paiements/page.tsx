import {AdminDataUnavailable} from "@/components/admin/AdminDataUnavailable";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAdminPaymentsKPIs, getAdminPaymentsList } from "@/lib/admin/payments";
import { AdminPaymentsClient } from "@/components/admin/payments";

interface AdminPaymentsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AdminPaymentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.payments" });

  return {
    title: `${t("title")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminPaymentsPage({ params }: AdminPaymentsPageProps) {
  const { locale } = await params;
  await requireAdmin(locale);

  try {
  const [kpis, payments] = await Promise.all([
    getAdminPaymentsKPIs(),
    getAdminPaymentsList(),
  ]);

  return (
    <AdminPaymentsClient
      initialPayments={payments}
      kpis={kpis}
      locale={locale}
    />
  );
  } catch {return <AdminDataUnavailable locale={locale}/>;}
}
