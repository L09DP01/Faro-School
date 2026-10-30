import "@/styles/globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { PwaClientRoot } from "@/components/pwa/PwaClientRoot";

export const viewport: Viewport = {
  themeColor: "#031047",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://faro.school"),
  title: {
    default: "Faro School | Plateforme de formation en ligne en Haïti",
    template: "%s | Faro School",
  },
  description: "Apprenez des compétences recherchées en Haïti et payez facilement par MonCash et NatCash.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Faro School",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    title: "Faro School",
    description: "Formations en ligne en Haïti - Payez par MonCash & NatCash",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col bg-bg text-ink font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PwaClientRoot locale={locale}>
            {children}
          </PwaClientRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
