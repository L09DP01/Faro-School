import { getTranslations } from "next-intl/server";
import { LegalPage, type LegalSection } from "@/components/legal";
import type { Metadata } from "next";

interface LegalRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LegalRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.cgu" });

  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function CGUPage({ params }: LegalRouteProps) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });
  const tCgu = await getTranslations({ locale, namespace: "legal.cgu" });

  // Load raw sections array from messages
  const rawSections = tCgu.raw("sections") as LegalSection[];

  return (
    <LegalPage
      locale={locale}
      activeSlug="cgu"
      title={tCgu("title")}
      subtitle={tCgu("subtitle")}
      lastUpdated={tLegal("common.lastUpdated")}
      draftNoticeTitle={tLegal("common.draftNoticeTitle")}
      draftNoticeDesc={tLegal("common.draftNoticeDesc")}
      sections={rawSections}
      navTerms={tLegal("common.navTerms")}
      navPrivacy={tLegal("common.navPrivacy")}
      navRefund={tLegal("common.navRefund")}
      contactTitle={tLegal("common.contactTitle")}
      contactDesc={tLegal("common.contactDesc")}
      contactBtn={tLegal("common.contactBtn")}
    />
  );
}
