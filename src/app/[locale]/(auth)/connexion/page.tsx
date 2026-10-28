import { getCurrentUser } from "@/lib/auth";
import { sanitizeRedirectUrl } from "@/lib/validators/auth";
import { LoginForm } from "@/components/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: `${t("loginTitle")} — Faro School`,
    description: t("loginSubtitle"),
  };
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  // 1. Logged-in users are redirected away
  const user = await getCurrentUser();
  if (user) {
    const dest = sanitizeRedirectUrl(sp.next, `/${locale}/dashboard`);
    redirect(dest);
  }

  return <LoginForm nextParam={sp.next} />;
}
