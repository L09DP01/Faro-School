import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-bg">
      <Container className="max-w-md text-center space-y-6">
        {/* Friendly Icon Square */}
        <div className="w-20 h-20 rounded-2xl bg-orange-tint text-orange border border-orange/20 mx-auto flex items-center justify-center shadow-card">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-faro">
            Erreur 404
          </span>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-ink tracking-tight">
            Page introuvable
          </h1>
          <p className="text-sm text-muted-faro font-sans leading-relaxed">
            Désolé, la page que vous recherchez n&apos;existe pas ou a été déplacée. Faro School vous guide vers le bon chemin.
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
