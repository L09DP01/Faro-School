import { Container } from "@/components";
import { ContactCards } from "@/components/contact/ContactCards";
import { ContactForm } from "@/components/contact/ContactForm";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface ContactPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage.meta" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";

  return {
    title: `${t("title")} | Faro School`,
    description: t("description"),
    alternates: {
      canonical: `${appUrl}/${locale}/contact`,
      languages: {
        fr: `${appUrl}/fr/contact`,
        ht: `${appUrl}/ht/contact`,
      },
    },
    openGraph: {
      title: `${t("title")} | Faro School`,
      description: t("description"),
      url: `${appUrl}/${locale}/contact`,
      siteName: "Faro School",
      locale: locale === "ht" ? "ht_HT" : "fr_FR",
      type: "website",
    },
  };
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });

  return (
    <div className="py-12 sm:py-16 md:py-20 bg-bg">
      <Container>
        {/* Two Columns Grid: Left Info Cards & Right Form (Mobile: single column with form below) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: 36px Title, Muted Line, Three Small Info Cards */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-heading font-semibold bg-blue-tint text-blue border border-blue/20">
                {t("badge")}
              </span>
              <h1 className="font-heading font-bold text-2xl sm:text-[36px] leading-tight text-ink">
                {t("title")}
              </h1>
              <p className="text-sm sm:text-base text-muted-faro leading-relaxed font-sans">
                {t("subtitle")}
              </p>
            </div>

            {/* Three Info Cards (WhatsApp, Email, Address) */}
            <ContactCards />
          </div>

          {/* Right Column: White Form Card with Labeled Fields & Full-Width Blue Send Button */}
          <div className="lg:col-span-7">
            <ContactForm />
          </div>
        </div>
      </Container>
    </div>
  );
}
