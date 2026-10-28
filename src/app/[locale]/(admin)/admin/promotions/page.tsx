import { requireAdmin } from "@/lib/auth";
import { getAdminCouponsList } from "@/lib/admin/promotions";
import { AdminPromotionsClient } from "@/components/admin/promotions/AdminPromotionsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des Promotions | Faro School Admin",
  robots: { index: false, follow: false },
};

interface AdminPromotionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPromotionsPage({ params }: AdminPromotionsPageProps) {
  const { locale } = await params;
  await requireAdmin(locale);

  const coupons = await getAdminCouponsList();

  return <AdminPromotionsClient initialCoupons={coupons} locale={locale} />;
}
