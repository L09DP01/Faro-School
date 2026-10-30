"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { updatePasswordSchema } from "@/lib/validators/auth";
import {
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

export function ResetPasswordForm() {
  const t = useTranslations("auth");

  const [status, setStatus] = useState<"checking" | "ready" | "expired" | "success">("checking");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const urlToken = url.searchParams.get("token");

      if (!urlToken || urlToken.trim().length === 0) {
        setStatus("expired");
        return;
      }

      setToken(urlToken.trim());
      history.replaceState(null,"",location.pathname);
      setStatus("ready");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setStatus("expired");
      return;
    }

    const result = updatePasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const issue = result.error.issues[0];
      if (issue.message === "passwordsDoNotMatch") {
        setError(t("errors.passwordsDoNotMatch"));
      } else if (issue.message === "passwordTooShort") {
        setError(t("errors.passwordTooShort"));
      } else {
        setError(issue.message);
      }
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(t("errors.serverError"));
        if (data.error === "invalid_or_expired") {
          setStatus("expired");
        }
        return;
      }

      setStatus("success");
    } catch {
      setError(t("errors.serverError"));
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue" />
        <p className="font-sans text-xs sm:text-sm text-muted-faro">
          {t("resetPasswordSubtitle")}
        </p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="w-full space-y-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl text-ink">
            {t("recoveryExpiredTitle")}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-muted-faro max-w-sm mx-auto">
            {t("recoveryExpiredSubtitle")}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/mot-de-passe-oublie"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink/90 text-white font-bold text-sm transition-all"
          >
            {t("requestNewResetLink")}
          </Link>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full space-y-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl text-ink">
            {t("passwordUpdatedTitle")}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-muted-faro max-w-sm mx-auto">
            {t("passwordUpdatedSubtitle")}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink/90 text-white font-bold text-sm transition-all shadow-sm"
          >
            {t("loginTitle")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading font-black text-2xl sm:text-[30px] tracking-tight text-ink leading-tight">
          {t("resetPasswordTitle")}
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro">
          {t("resetPasswordSubtitle")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
            {t("newPassword")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full py-2.5 px-3.5 pr-10 rounded-xl border border-border-faro bg-background text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent-faro"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-faro hover:text-ink"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
            {t("confirmPassword")}
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full py-2.5 px-3.5 rounded-xl border border-border-faro bg-background text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent-faro"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink/90 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{t("updatePasswordButton")}</span>
        </button>
      </form>

      <div className="text-center pt-2">
        <Link
          href="/connexion"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-faro hover:text-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("backToLogin")}</span>
        </Link>
      </div>
    </div>
  );
}
