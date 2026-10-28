"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(t("errors.invalidEmail"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "rateLimit") {
          setError(t("errors.rateLimit"));
        } else {
          setError(t("errors.serverError"));
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("errors.serverError"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full space-y-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-tint text-ok shadow-subtle mx-auto">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl sm:text-[30px] tracking-tight text-ink">
            {t("forgotSuccessTitle")}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-muted-faro max-w-sm mx-auto leading-relaxed">
            {t("forgotSuccessDesc")}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm shadow-subtle transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("backToLogin")}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Back to Login link */}
      <div>
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 font-heading text-xs font-semibold text-blue hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("backToLogin")}</span>
        </Link>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <h2 className="font-heading font-black text-2xl sm:text-[34px] tracking-tight text-ink leading-tight">
          {t("forgotPasswordTitle")}
          <span className="block text-xs sm:text-sm font-sans font-normal text-muted-faro mt-1">
            Reyajiste modpas ou
          </span>
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro">
          {t("forgotPasswordSubtitle")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-xl border border-red/30 bg-red-tint text-xs text-red font-sans font-medium flex items-center gap-2.5 leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="forgot_email" className="font-heading font-semibold text-xs text-ink block">
            {t("emailLabel")} <span className="text-red">*</span>
          </label>
          <input
            id="forgot_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={Boolean(error)}
            className="w-full h-12 px-4 text-sm font-sans rounded-xl border border-line bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/15 shadow-subtle transition-all"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm sm:text-base shadow-subtle flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            )}
            <span>{loading ? t("redirecting") : t("resetSubmit")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
