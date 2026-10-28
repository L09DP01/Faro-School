"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/Container";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log client error to console or monitoring
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-bg">
      <Container className="max-w-md text-center space-y-6">
        {/* Friendly Error Icon Square */}
        <div className="w-20 h-20 rounded-2xl bg-red-tint text-red border border-red/20 mx-auto flex items-center justify-center shadow-card">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-faro">
            Une erreur est survenue
          </span>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-ink tracking-tight">
            Oups ! Quelque chose a bloqué
          </h1>
          <p className="text-sm text-muted-faro font-sans leading-relaxed">
            Nous n&apos;avons pas pu charger cette page. Pas d&apos;inquiétude, vos cours et paiements sont bien en sécurité.
          </p>
        </div>

        {/* Action Buttons: Retry and One Clear Button Back Home */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-line bg-surface text-ink hover:bg-bg font-heading font-semibold text-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold text-sm transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </Container>
    </div>
  );
}
