import { Container } from "@/components";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage.meta" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";

  return {
    title: `${t("title")} | Faro School`,
    description: t("description"),
    alternates: {
      canonical: `${appUrl}/${locale}/a-propos`,
      languages: {
        fr: `${appUrl}/fr/a-propos`,
        ht: `${appUrl}/ht/a-propos`,
      },
    },
    openGraph: {
      title: `${t("title")} | Faro School`,
      description: t("description"),
      url: `${appUrl}/${locale}/a-propos`,
      siteName: "Faro School",
      locale: locale === "ht" ? "ht_HT" : "fr_FR",
      type: "website",
    },
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });

  const values = [
    {
      title: t("values.v1Title"),
      desc: t("values.v1Desc"),
      tintClass: "bg-blue-tint text-blue",
      borderHover: "hover:border-blue/40",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: t("values.v2Title"),
      desc: t("values.v2Desc"),
      tintClass: "bg-orange-tint text-orange",
      borderHover: "hover:border-orange/40",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: t("values.v3Title"),
      desc: t("values.v3Desc"),
      tintClass: "bg-ok-tint text-ok",
      borderHover: "hover:border-ok/40",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
    },
  ];

  const numbers = [
    { val: t("numbers.n1Val"), label: t("numbers.n1Label") },
    { val: t("numbers.n2Val"), label: t("numbers.n2Label") },
    { val: t("numbers.n3Val"), label: t("numbers.n3Label") },
    { val: t("numbers.n4Val"), label: t("numbers.n4Label") },
  ];

  return (
    <div className="py-12 sm:py-16 md:py-20 space-y-16 sm:space-y-24 bg-bg">
      {/* 1. About Hero in Two Columns */}
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Tag, 52px Headline, Muted text */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-heading font-semibold bg-blue-tint text-blue border border-blue/20">
                À propos
              </span>
            </div>
            <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-[52px] leading-[1.12] tracking-tight text-ink">
              {t("title")}
            </h1>
            <p className="text-base sm:text-lg text-muted-faro leading-relaxed max-w-xl font-sans">
              {t("subtitle")}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href="/formations"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold text-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
              >
                Explorer nos formations →
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-line bg-surface text-ink hover:bg-bg font-heading font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                Nous contacter
              </Link>
            </div>
          </div>

          {/* Right Column: Large Rounded (28px) Gradient Art Block */}
          <div className="lg:col-span-5">
            <div className="rounded-[28px] overflow-hidden relative shadow-card aspect-[4/3] bg-gradient-to-tr from-navy-deep via-navy to-blue p-8 sm:p-10 flex flex-col justify-between text-white border border-line/20">
              {/* Background Ambient Glow */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue/30 blur-3xl pointer-events-none"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-orange/20 blur-3xl pointer-events-none"
                aria-hidden="true"
              />

              <div className="relative z-10 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 backdrop-blur-md text-white border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-ok" />
                  100% Adapté à Haïti
                </span>
                <span className="text-white/40 font-mono text-xs">Faro School</span>
              </div>

              <div className="relative z-10 space-y-2 mt-auto">
                <p className="text-xs uppercase tracking-wider text-orange font-semibold">
                  {t("mission.badge")}
                </p>
                <p className="text-lg sm:text-xl font-heading font-bold text-white leading-snug">
                  « La lumière du savoir accessible à tous, sans barrière géographique ou bancaire. »
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* 2. Mission Statement */}
      <Container>
        <div className="rounded-[24px] border border-line bg-surface p-8 sm:p-12 shadow-card space-y-6 max-w-4xl mx-auto">
          <div className="space-y-2">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-orange">
              {t("mission.badge")}
            </span>
            <h2 className="font-heading font-bold text-2xl sm:text-3xl text-ink">
              {t("mission.title")}
            </h2>
          </div>
          <p className="text-sm sm:text-base text-muted-faro leading-relaxed font-sans">
            {t("mission.text1")}
          </p>
          <div className="p-5 rounded-2xl bg-blue-tint/50 border border-blue/20">
            <p className="text-sm sm:text-base text-ink font-medium leading-relaxed font-sans">
              {t("mission.text2")}
            </p>
          </div>
        </div>
      </Container>

      {/* 3. Three Value Cards (each with tinted rounded icon square & 22px title) */}
      <Container className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            {t("values.title")}
          </h2>
          <p className="text-sm text-muted-faro font-sans">
            {t("values.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {values.map((val, idx) => (
            <div
              key={idx}
              className={`rounded-[20px] border border-line bg-surface p-7 sm:p-8 space-y-4 shadow-card ${val.borderHover} transition-all`}
            >
              {/* Tinted Rounded Icon Square */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${val.tintClass} shadow-sm shrink-0`}>
                {val.icon}
              </div>
              <h3 className="font-heading font-bold text-[22px] text-ink leading-snug">
                {val.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed font-sans">
                {val.desc}
              </p>
            </div>
          ))}
        </div>
      </Container>

      {/* 4. Instructor Story */}
      <Container>
        <div className="max-w-4xl mx-auto rounded-[24px] border border-line bg-surface p-8 sm:p-12 shadow-card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative shrink-0">
              <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full border-4 border-surface bg-navy-deep flex items-center justify-center text-white shadow-card">
                <svg className="w-16 h-16 text-white/70" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <span className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-ok border-2 border-surface" aria-hidden="true" />
            </div>

            <div className="space-y-4 text-center md:text-left">
              <div>
                <span className="text-xs font-heading font-semibold uppercase tracking-wider text-orange">
                  {t("story.badge")}
                </span>
                <h2 className="font-heading font-bold text-xl sm:text-2xl text-ink mt-0.5">
                  {t("story.title")}
                </h2>
                <p className="text-sm font-heading font-semibold text-ink mt-1">
                  {t("story.instructorName")}
                </p>
                <p className="text-xs text-muted-faro font-sans">
                  {t("story.instructorRole")}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed italic font-sans">
                &ldquo;{t("story.p1")}&rdquo;
              </p>
              <p className="text-xs sm:text-sm text-muted-faro leading-relaxed font-sans">
                {t("story.p2")}
              </p>
            </div>
          </div>
        </div>
      </Container>

      {/* 5. Numbers Grid */}
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {numbers.map((num, idx) => (
            <div
              key={idx}
              className="p-6 rounded-[18px] border border-line bg-surface text-center space-y-1.5 shadow-card"
            >
              <p className="text-2xl sm:text-3xl font-heading font-bold text-ink tracking-tight">
                {num.val}
              </p>
              <p className="text-xs text-muted-faro font-medium font-sans">{num.label}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* 6. Closing CTA */}
      <Container>
        <div className="max-w-3xl mx-auto rounded-[24px] border border-line bg-surface p-8 sm:p-12 text-center space-y-6 shadow-card">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            {t("cta.title")}
          </h2>
          <p className="text-xs sm:text-sm text-muted-faro leading-relaxed max-w-lg mx-auto font-sans">
            {t("cta.subtitle")}
          </p>
          <div className="pt-2">
            <Link
              href="/formations"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs sm:text-sm font-heading font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            >
              {t("cta.btn")} →
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
