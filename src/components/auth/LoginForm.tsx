"use client";

import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { loginSchema } from "@/lib/validators/auth";
import { AuthSegmentedControl } from "./AuthSegmentedControl";
import { VerificationCodeForm } from "./VerificationCodeForm";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { signIn } from "next-auth/react";
import { sanitizeRedirectUrl } from "@/lib/validators/auth";

interface LoginFormProps {
  nextParam?: string;
}

export function LoginForm({ nextParam }: LoginFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const enableGoogleAuth =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});

    // Client-side validation
    const result = loginSchema.safeParse({ email, password, rememberMe });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]?.toString() || "form";
        errors[field] = t(`errors.${issue.message}` as any);
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        if (
          signInRes.error === "EMAIL_NOT_VERIFIED" ||
          signInRes.error.includes("EMAIL_NOT_VERIFIED")
        ) {
          setUnverifiedEmail(email);
          return;
        } else if (
          signInRes.error === "ACCOUNT_LOCKED" ||
          signInRes.error.includes("ACCOUNT_LOCKED")
        ) {
          setGlobalError(t("errors.rateLimit"));
        } else {
          setGlobalError(t("errors.invalidCredentials"));
        }
        return;
      }

      if (signInRes?.ok) {
        // Successful login -> redirect to destination
        const destination = sanitizeRedirectUrl(nextParam, `/${locale}/dashboard`);
        window.location.href = destination;
      }
    } catch {
      setGlobalError(t("errors.serverError"));
    } finally {
      setLoading(false);
    }
  };

  if (unverifiedEmail) {
    return (
      <div className="w-full space-y-6">
        <PwaInstallBanner locale={locale} />
        <AuthSegmentedControl activeTab="login" nextParam={nextParam} />
        <VerificationCodeForm
          email={unverifiedEmail}
          nextParam={nextParam}
          password={password}
          onCancel={() => setUnverifiedEmail(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* PWA Install Banner (Android / Desktop Chrome / iOS) */}
      <PwaInstallBanner locale={locale} />

      {/* 1. Segmented Control */}
      <AuthSegmentedControl activeTab="login" nextParam={nextParam} />

      {/* 2. Welcome Title with single subtitle (FR + KR) */}
      <div className="space-y-1">
        <h2 className="font-heading font-black text-2xl sm:text-[30px] tracking-tight text-ink leading-tight">
          {t("loginTitle")}
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro">
          {t("loginSubtitle")} • Byenvini ankò
        </p>
      </div>

      {/* Global Error Alert */}
      {globalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-xl border border-red/30 bg-red-tint text-xs text-red font-sans font-medium flex items-center gap-2.5 leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Optional Google Auth */}
      {enableGoogleAuth && (
        <div className="space-y-4">
          <button
            type="button"
            className="w-full h-12 flex items-center justify-center gap-3 px-4 rounded-xl border border-line bg-surface text-ink text-xs sm:text-sm font-heading font-semibold hover:bg-bg transition-colors shadow-subtle"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{t("googleContinue")}</span>
          </button>
          <div className="relative flex items-center justify-center">
            <span className="w-full border-t border-line" />
            <span className="bg-surface px-3 text-xs uppercase text-muted-faro font-heading font-semibold tracking-wider">
              ou
            </span>
          </div>
        </div>
      )}

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="login_email" className="font-heading font-semibold text-xs text-ink block">
            {t("emailLabel")} <span className="text-red">*</span>
          </label>
          <input
            id="login_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login_email_err" : undefined}
            className={`w-full h-12 px-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
              fieldErrors.email
                ? "border-red focus:border-red focus:ring-red/15"
                : "border-line focus:border-orange focus:ring-orange/15"
            }`}
          />
          {fieldErrors.email && (
            <div id="login_email_err" role="alert" className="flex items-center gap-1.5 mt-1.5 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.email}</span>
            </div>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login_password" className="font-heading font-semibold text-xs text-ink block">
              {t("passwordLabel")} <span className="text-red">*</span>
            </label>
            <Link
              href="/mot-de-passe-oublie"
              className="font-heading text-xs text-orange hover:underline font-medium"
            >
              {t("forgotPasswordLink")}
            </Link>
          </div>
          <div className="relative">
            <input
              id="login_password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login_password_err" : "login_password_hint"}
              className={`w-full h-12 pl-4 pr-11 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
                fieldErrors.password
                  ? "border-red focus:border-red focus:ring-red/15"
                  : "border-line focus:border-orange focus:ring-orange/15"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-faro hover:text-ink transition-colors"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-muted-faro" />
              ) : (
                <Eye className="w-4 h-4 text-muted-faro" />
              )}
            </button>
          </div>
          <p id="login_password_hint" className="text-[11px] text-muted-faro mt-1">
            Au moins 8 caractères • Omwen 8 karaktè
          </p>
          {fieldErrors.password && (
            <div id="login_password_err" role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.password}</span>
            </div>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="login_remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-line text-orange accent-orange focus:ring-orange"
          />
          <label htmlFor="login_remember" className="font-sans text-xs text-muted-faro cursor-pointer select-none">
            {t("rememberMe")}
          </label>
        </div>

        {/* Full-width orange brand button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-orange hover:bg-orange-hover active:bg-orange-strong text-white font-heading font-bold text-sm sm:text-base shadow-orange flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            )}
            <span>{loading ? t("redirecting") : t("loginSubmit")}</span>
          </button>
        </div>
      </form>

      {/* Legal Note */}
      <p className="text-[11px] font-sans text-muted-faro text-center leading-relaxed pt-3 border-t border-line/60">
        En vous connectant, vous acceptez nos{" "}
        <Link href="/cgu" className="text-orange hover:underline font-medium">
          Conditions d&apos;Utilisation
        </Link>{" "}
        et notre{" "}
        <Link href="/confidentialite" className="text-orange hover:underline font-medium">
          Politique de Confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
