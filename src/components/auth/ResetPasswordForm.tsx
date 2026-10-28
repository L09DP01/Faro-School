"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { updatePasswordSchema } from "@/lib/validators/auth";
import { createClient } from "@/lib/supabase/client";
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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // Check URL parameters for errors or codes
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const hash = window.location.hash;
      const hasError =
        url.searchParams.get("error") ||
        hash.includes("error=") ||
        hash.includes("error_code=");

      if (hasError) {
        setStatus("expired");
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ data, error }) => {
            if (!mounted) return;
            if (error || !data.session) {
              setStatus("expired");
            } else {
              setStatus("ready");
            }
          })
          .catch(() => {
            if (mounted) setStatus("expired");
          });
        return;
      }
    }

    // Subscribe to auth state changes for PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setStatus("ready");
      }
    });

    // Check existing session
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!mounted) return;
      if (session && !sessionError) {
        setStatus("ready");
      } else {
        // Allow a small grace period for hash parsing, otherwise mark expired
        const timer = setTimeout(() => {
          if (mounted && status === "checking") {
            setStatus("expired");
          }
        }, 1200);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        if (
          updateError.message.toLowerCase().includes("session") ||
          updateError.message.toLowerCase().includes("expired")
        ) {
          setError(t("errors.recoverySessionExpired"));
          setStatus("expired");
        } else {
          setError(updateError.message || t("errors.serverError"));
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
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-orange/10 text-orange shadow-subtle mx-auto">
          <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl sm:text-[30px] tracking-tight text-ink">
            {t("expiredLinkTitle")}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-muted-faro max-w-sm mx-auto leading-relaxed">
            {t("expiredLinkDesc")}
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/mot-de-passe-oublie"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm shadow-subtle transition-all"
          >
            <span>{t("requestNewLink")}</span>
          </Link>
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-transparent hover:bg-navy-deep/5 text-muted-faro hover:text-ink font-heading text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("backToLogin")}</span>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full space-y-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-tint text-ok shadow-subtle mx-auto">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl sm:text-[30px] tracking-tight text-ink">
            {t("resetSuccessTitle")}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-muted-faro max-w-sm mx-auto leading-relaxed">
            {t("resetSuccessDesc")}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/connexion"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm shadow-subtle transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("loginSubmit")}</span>
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
          {t("resetPasswordTitle")}
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro leading-relaxed">
          {t("resetPasswordSubtitle")}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="new-password"
            className="block font-heading text-xs font-semibold text-ink"
          >
            {t("newPasswordLabel")}
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="w-full h-12 px-3.5 pr-10 rounded-xl border border-divider bg-white font-sans text-sm text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-faro hover:text-ink transition-colors"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="confirm-password"
            className="block font-heading text-xs font-semibold text-ink"
          >
            {t("confirmPasswordLabel")}
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              className="w-full h-12 px-3.5 pr-10 rounded-xl border border-divider bg-white font-sans text-sm text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 focus:ring-blue focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-blue hover:bg-blue/90 disabled:opacity-50 text-white font-heading font-semibold text-sm shadow-subtle transition-all flex items-center justify-center gap-2 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("updatePasswordSubmit")}...</span>
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              <span>{t("updatePasswordSubmit")}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
