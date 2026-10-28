import { getTranslations } from "next-intl/server";
import { LegalPage, type LegalSection } from "@/components/legal";
import type { Metadata } from "next";

interface LegalRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LegalRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.remboursement" });

  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default async function RemboursementPage({ params }: LegalRouteProps) {
  const { locale } = await params;
  const tLegal = await getTranslations({ locale, namespace: "legal" });
  const tRef = await getTranslations({ locale, namespace: "legal.remboursement" });

  const rawSections = tRef.raw("sections") as LegalSection[];

  return (
    <LegalPage
      locale={locale}
      activeSlug="remboursement"
      title={tRef("title")}
      subtitle={tRef("subtitle")}
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
