import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maintenance en cours | Faro School",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-bg">
      <Container className="max-w-md text-center space-y-6">
        {/* Friendly Maintenance Icon Square */}
        <div className="w-20 h-20 rounded-2xl bg-blue-tint text-blue border border-blue/20 mx-auto flex items-center justify-center shadow-card">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-faro">
            Amélioration continue
          </span>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-ink tracking-tight">
            Plateforme en maintenance
          </h1>
          <p className="text-sm text-muted-faro font-sans leading-relaxed">
            Nous effectuons une courte mise à jour pour optimiser la rapidité et la sécurité de vos formations en Haïti. Nous serons de retour dans quelques instants.
          </p>
        </div>

        {/* One clear button back home */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold text-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </Container>
    </div>
  );
}
