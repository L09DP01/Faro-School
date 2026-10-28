import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";

export interface LegalSection {
  title: string;
  paragraphs: string[];
  list?: string[];
}

interface LegalPageProps {
  locale: string;
  activeSlug: "cgu" | "confidentialite" | "remboursement";
  title: string;
  subtitle: string;
  lastUpdated: string;
  draftNoticeTitle: string;
  draftNoticeDesc: string;
  sections: LegalSection[];
  navTerms: string;
  navPrivacy: string;
  navRefund: string;
  contactTitle: string;
  contactDesc: string;
  contactBtn: string;
}

export function LegalPage({
  activeSlug,
  title,
  subtitle,
  lastUpdated,
  draftNoticeTitle,
  draftNoticeDesc,
  sections,
  navTerms,
  navPrivacy,
  navRefund,
  contactTitle,
  contactDesc,
  contactBtn,
}: LegalPageProps) {
  const navTabs = [
    { slug: "cgu", href: "/cgu", label: navTerms },
    { slug: "confidentialite", href: "/confidentialite", label: navPrivacy },
    { slug: "remboursement", href: "/remboursement", label: navRefund },
  ];

  return (
    <div className="py-12 sm:py-16 md:py-20 bg-bg">
      <Container>
        {/* 720px Readable Column */}
        <div className="max-w-[720px] mx-auto space-y-8">
          {/* Top Navigation Pill Tabs */}
          <div className="flex justify-center sm:justify-start">
            <nav aria-label="Navigation légale" className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
              {navTabs.map((tab) => {
                const isActive = activeSlug === tab.slug;
                return (
                  <Link
                    key={tab.slug}
                    href={tab.href}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-heading font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                      isActive
                        ? "bg-blue text-white shadow-sm"
                        : "text-muted-faro hover:bg-bg hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 40px Title & Subtitle */}
          <div className="space-y-2">
            <h1 className="font-heading font-bold text-3xl sm:text-[40px] leading-tight tracking-tight text-ink">
              {title}
            </h1>
            <p className="text-base text-muted-faro font-sans">{subtitle}</p>
            <p className="text-xs font-mono font-medium text-muted-faro/80 pt-1">{lastUpdated}</p>
          </div>

          {/* Amber-Tint Draft Disclaimer Alert */}
          <div
            role="alert"
            className="rounded-[18px] border border-orange/30 bg-orange-tint p-5 text-ink shadow-sm space-y-1.5"
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 shrink-0 text-orange mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="space-y-1">
                <h2 className="font-heading font-bold text-sm text-ink">
                  {draftNoticeTitle}
                </h2>
                <p className="text-xs leading-relaxed text-muted-faro font-sans">
                  {draftNoticeDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Table of Contents on Desktop */}
          {sections.length > 0 && (
            <nav
              aria-label="Sommaire du document"
              className="p-5 rounded-[18px] border border-line bg-surface shadow-card space-y-3"
            >
              <div className="font-heading font-bold text-xs uppercase tracking-wider text-muted-faro">
                Sommaire du document
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink font-sans">
                {sections.map((sec, idx) => (
                  <li key={idx} className="flex items-baseline gap-2">
                    <span className="text-blue font-mono font-semibold text-[11px]">
                      {(idx + 1).toString().padStart(2, "0")}.
                    </span>
                    <a
                      href={`#section-${idx + 1}`}
                      className="hover:text-blue hover:underline transition-colors truncate"
                    >
                      {sec.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Legal Document Sections Card with Comfortable 17px Body Text */}
          <div className="rounded-[20px] border border-line bg-surface p-7 sm:p-10 shadow-card space-y-8">
            {sections.map((sec, idx) => (
              <section
                key={idx}
                id={`section-${idx + 1}`}
                className="space-y-3 pb-8 border-b border-line/60 last:border-b-0 last:pb-0 scroll-mt-24"
              >
                <h2 className="font-heading font-bold text-xl text-ink flex items-baseline gap-2.5">
                  <span className="text-blue text-sm font-mono font-bold">
                    {idx + 1}.
                  </span>
                  <span>{sec.title}</span>
                </h2>

                {sec.paragraphs.map((p, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-[17px] leading-[1.75] text-ink/85 font-sans"
                  >
                    {p}
                  </p>
                ))}

                {sec.list && sec.list.length > 0 && (
                  <ul className="list-disc pl-5 space-y-2 text-[17px] leading-[1.75] text-ink/85 font-sans pt-1">
                    {sec.list.map((item, lIdx) => (
                      <li key={lIdx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Bottom Support Banner */}
          <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-sm text-ink">{contactTitle}</h3>
              <p className="mt-0.5 text-xs text-muted-faro leading-relaxed font-sans">{contactDesc}</p>
            </div>
            <Link
              href="/contact"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue px-4 py-2 text-xs font-heading font-semibold text-white shadow-sm hover:bg-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              {contactBtn}
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
