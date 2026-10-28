import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { StudentDashboardShell } from "@/components/dashboard/StudentDashboardShell";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/connexion?next=/${locale}/dashboard`);
  }

  return (
    <StudentDashboardShell
      user={{
        fullName: user.fullName || "Étudiant",
        email: user.email,
        role: user.role,
      }}
      locale={locale}
    >
      {children}
    </StudentDashboardShell>
  );
}
