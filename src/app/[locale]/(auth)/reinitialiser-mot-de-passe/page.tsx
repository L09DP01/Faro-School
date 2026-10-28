import { ResetPasswordForm } from "@/components/auth";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface ResetPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ResetPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: `${t("resetPasswordTitle")} — Faro School`,
    description: t("resetPasswordSubtitle"),
  };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
