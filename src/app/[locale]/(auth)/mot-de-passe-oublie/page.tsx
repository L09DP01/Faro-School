import { ForgotPasswordForm } from "@/components/auth";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: `${t("forgotPasswordTitle")} — Faro School`,
    description: t("forgotPasswordSubtitle"),
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
