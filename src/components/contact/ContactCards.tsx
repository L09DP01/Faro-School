import { useTranslations } from "next-intl";

export function ContactCards() {
  const t = useTranslations("contactPage.cards");

  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+50936000000";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "contact@faroschool.com";
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Port-au-Prince, Haïti";

  // Clean phone number for wa.me URL
  const cleanPhone = supportPhone.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    "Bonjour Faro School, j'aimerais avoir des informations sur vos formations."
  )}`;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* 1. WhatsApp Card */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-4 p-5 rounded-[18px] border border-line bg-surface hover:border-ok/40 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ok-tint text-ok group-hover:scale-105 transition-transform border border-ok/20">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.82 2.791.82 3.181 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.766-5.768-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.748 0-3.385-.45-4.819-1.237l-7.181 1.881 1.914-6.994c-.878-1.488-1.385-3.228-1.385-5.083 0-5.518 4.482-10 10-10s10 4.482 10 10z" />
          </svg>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-heading font-bold text-ink group-hover:text-ok transition-colors">
              {t("whatsappTitle")}
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-ok-tint text-ok border border-ok/20">
              Direct
            </span>
          </div>
          <p className="text-xs text-muted-faro font-sans">{t("whatsappDesc")}</p>
          <p className="text-xs font-mono font-semibold text-ink pt-0.5">{supportPhone}</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok group-hover:underline pt-0.5">
            <span>{t("whatsappBtn")}</span>
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </a>

      {/* 2. Email Card */}
      <a
        href={`mailto:${supportEmail}`}
        className="group flex items-start gap-4 p-5 rounded-[18px] border border-line bg-surface hover:border-blue/40 hover:shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-tint text-blue group-hover:scale-105 transition-transform border border-blue/20">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-heading font-bold text-ink group-hover:text-blue transition-colors">
            {t("emailTitle")}
          </h3>
          <p className="text-xs text-muted-faro font-sans">{t("emailDesc")}</p>
          <p className="text-xs font-mono font-semibold text-ink pt-0.5">{supportEmail}</p>
        </div>
      </a>

      {/* 3. Address Card */}
      <div className="flex items-start gap-4 p-5 rounded-[18px] border border-line bg-surface shadow-card">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg text-muted-faro border border-line">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-heading font-bold text-ink">{t("addressTitle")}</h3>
          <p className="text-xs text-muted-faro font-sans">{t("addressDesc")}</p>
          <p className="text-xs font-semibold text-ink pt-0.5">{companyAddress}</p>
        </div>
      </div>
    </div>
  );
}
