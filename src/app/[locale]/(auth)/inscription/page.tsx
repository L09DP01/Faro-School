import { getCurrentUser } from "@/lib/auth";
import { sanitizeRedirectUrl } from "@/lib/validators/auth";
import { RegisterForm } from "@/components/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: `${t("registerTitle")} — Faro School`,
    description: t("registerSubtitle"),
  };
}

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  // 1. Logged-in users are redirected away
  const user = await getCurrentUser();
  if (user) {
    const dest = sanitizeRedirectUrl(sp.next, `/${locale}/dashboard`);
    redirect(dest);
  }

  return <RegisterForm nextParam={sp.next} />;
}
