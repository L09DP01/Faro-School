import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Minimal Header: logo left and a muted "secure payment" note right; no main navigation */}
      <header className="border-b border-line bg-surface py-4 px-6 md:px-12 sticky top-0 z-30 shadow-subtle">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <Logo variant="on-light" width={140} height={40} priority />
          </Link>
          <div className="flex items-center gap-2 text-xs font-heading font-semibold text-muted-faro">
            <Lock className="w-4 h-4 text-ok" />
            <span>Paiement 100% sécurisé</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Minimal Footer */}
      <footer className="border-t border-line bg-surface py-6 px-6 text-center text-xs text-muted-faro font-sans">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Faro School. Tous droits réservés.</span>
          <div className="flex items-center gap-4">
            <Link href="/cgu" className="hover:text-ink hover:underline">Conditions Générales</Link>
            <Link href="/confidentialite" className="hover:text-ink hover:underline">Confidentialité</Link>
            <Link href="/remboursement" className="hover:text-ink hover:underline">Remboursement</Link>
          </div>
          <span>🇭🇹 Fait en Haïti</span>
        </div>
      </footer>
    </div>
  );
}
