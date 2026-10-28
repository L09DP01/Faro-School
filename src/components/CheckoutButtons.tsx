"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface CheckoutButtonsProps {
  courseId: string;
  courseTitle: string;
  amountHtg: number;
}

export function CheckoutButtons({
  courseId,
  courseTitle,
  amountHtg,
}: CheckoutButtonsProps) {
  const tPayments = useTranslations("payments");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async (provider: "moncash" | "natcash") => {
    try {
      setLoadingProvider(provider);
      setErrorMessage(null);

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          provider,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "Impossible d'initialiser le paiement");
      }

      // Redirect user directly to Kobara's provider checkout screen (MonCash or NatCash)
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur de connexion");
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* MonCash via Kobara */}
        <button
          type="button"
          onClick={() => handleCheckout("moncash")}
          disabled={loadingProvider !== null}
          className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border hover:border-red-600 bg-card hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all text-left group disabled:opacity-50"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="font-bold text-sm text-foreground group-hover:text-red-600 transition-colors">
              {tPayments("moncash")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground text-center">
            {loadingProvider === "moncash"
              ? "Redirection vers MonCash..."
              : "Payer directement avec votre compte MonCash"}
          </span>
        </button>

        {/* NatCash via Kobara */}
        <button
          type="button"
          onClick={() => handleCheckout("natcash")}
          disabled={loadingProvider !== null}
          className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-border hover:border-sky-600 bg-card hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-all text-left group disabled:opacity-50"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
            <span className="font-bold text-sm text-foreground group-hover:text-sky-600 transition-colors">
              {tPayments("natcash")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground text-center">
            {loadingProvider === "natcash"
              ? "Redirection vers NatCash..."
              : "Payer directement avec votre compte NatCash"}
          </span>
        </button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground pt-1">
        Paiements sécurisés propulsés par <strong>Kobara.app</strong>
      </p>
    </div>
  );
}
