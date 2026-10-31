import { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell min-h-[100dvh] flex flex-col lg:flex-row bg-surface">
      {/* 1. Mobile Compact Top Banner (< 1024px) */}
      <div className="auth-mobile-header lg:hidden bg-gradient-to-r from-navy-deep via-navy to-blue px-6 py-4 text-white flex items-center justify-between shadow-md">
        <Link href="/" className="inline-flex items-center">
          <Logo variant="on-dark" width={130} height={38} priority />
        </Link>
        <span className="text-xs text-blue-tint/90 font-sans font-medium">
          Votre savoir, votre avenir.
        </span>
      </div>

      {/* 2. Desktop Left Brand Panel (50% split screen) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 xl:p-16 text-white overflow-hidden bg-gradient-to-br from-navy-deep via-navy to-blue">
        {/* Subtle Watermark Logo Mark (Translucent) */}
        <div
          className="absolute -right-16 -bottom-16 w-96 h-96 opacity-10 pointer-events-none text-white select-none"
          aria-hidden="true"
        >
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
          </svg>
        </div>

        {/* Ambient Glow Circles */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-10 w-96 h-96 rounded-full bg-orange/10 blur-3xl" />

        {/* Brand Panel Top: Logo linking to homepage */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="on-dark" width={180} height={52} priority />
          </Link>
        </div>

        {/* Brand Panel Center: 52px White Headline & Creole subline */}
        <div className="relative z-10 space-y-4 my-auto py-12">
          <h1 className="font-heading font-black text-4xl xl:text-[52px] leading-[1.12] tracking-tight text-white max-w-lg">
            Votre savoir, votre avenir.
          </h1>
          <p className="font-sans text-base xl:text-lg text-blue-tint/90 max-w-md leading-relaxed">
            Konesans ou se kle lavni ou. Aprann konpetans reyèl pou mache Ayiti a ak fòmasyon pratik ki peyab fasilman pa MonCash ak NatCash.
          </p>
        </div>

        {/* Brand Panel Bottom: Small Copyright */}
        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-blue-tint/70 font-sans">
          <span>© {new Date().getFullYear()} Faro School. Tout dwa rezève.</span>
          <span>🇭🇹 Fait en Haïti</span>
        </div>
      </div>

      {/* 3. Right White Panel: Form starting 24px under banner on mobile, centered on desktop */}
      <div className="auth-form-panel w-full lg:w-1/2 flex flex-col justify-start lg:justify-center items-center pt-6 px-4 pb-6 sm:p-8 md:p-12 lg:p-14 xl:p-16 bg-surface min-h-0 lg:min-h-[100dvh] overflow-y-auto">
        <div className="w-full max-w-[440px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
