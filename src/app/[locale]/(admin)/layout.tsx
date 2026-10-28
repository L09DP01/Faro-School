import { requireStaff } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import type { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireStaff(locale);

  return (
    <AdminLayoutClient admin={user} locale={locale}>
      {children}
    </AdminLayoutClient>
  );
}
