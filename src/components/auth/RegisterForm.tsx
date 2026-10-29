"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { signupSchema } from "@/lib/validators/auth";
import { AuthSegmentedControl } from "./AuthSegmentedControl";
import { VerificationCodeForm } from "./VerificationCodeForm";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

interface RegisterFormProps {
  nextParam?: string;
}

export function RegisterForm({ nextParam }: RegisterFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

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
    const result = signupSchema.safeParse({
      fullName,
      phone,
      email,
      password,
      acceptTerms,
    });

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          password,
          acceptTerms,
          locale,
          next: nextParam,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "rateLimit") {
          setGlobalError(t("errors.rateLimit"));
        } else if (data.error === "validation" && data.fieldErrors) {
          const mapped: Record<string, string> = {};
          Object.entries(data.fieldErrors).forEach(([k, v]) => {
            mapped[k] = t(`errors.${v}` as any);
          });
          setFieldErrors(mapped);
        } else {
          setGlobalError(data.message || t("errors.serverError"));
        }
        return;
      }

      if (data.requireVerification) {
        setUnverifiedEmail(email);
        return;
      }

      // Successful registration -> redirect to destination
      const destination = data.redirectUrl || `/${locale}/dashboard`;
      window.location.href = destination;
    } catch {
      setGlobalError(t("errors.serverError"));
    } finally {
      setLoading(false);
    }
  };

  if (unverifiedEmail) {
    return (
      <div className="w-full space-y-6">
        <AuthSegmentedControl activeTab="register" nextParam={nextParam} />
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
      {/* 1. Segmented Control */}
      <AuthSegmentedControl activeTab="register" nextParam={nextParam} />

      {/* 2. Welcome Title (34px with Creole) */}
      <div className="space-y-1">
        <h2 className="font-heading font-black text-2xl sm:text-[34px] tracking-tight text-ink leading-tight">
          {t("registerTitle")}
          <span className="block text-xs sm:text-sm font-sans font-normal text-muted-faro mt-1">
            Kreye kont ou gratis
          </span>
        </h2>
        <p className="font-sans text-xs sm:text-sm text-muted-faro">
          {t("registerSubtitle")}
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

      {/* Main Register Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg_name" className="font-heading font-semibold text-xs text-ink block">
            {t("fullNameLabel")} <span className="text-red">*</span>
          </label>
          <input
            id="reg_name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby={fieldErrors.fullName ? "reg_name_err" : undefined}
            className={`w-full h-12 px-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
              fieldErrors.fullName
                ? "border-red focus:border-red focus:ring-red/15"
                : "border-line focus:border-blue focus:ring-blue/15"
            }`}
          />
          {fieldErrors.fullName && (
            <div id="reg_name_err" role="alert" className="flex items-center gap-1.5 mt-1.5 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.fullName}</span>
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label htmlFor="reg_phone" className="font-heading font-semibold text-xs text-ink block">
            {t("phoneLabel")} <span className="text-red">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-semibold text-muted-faro">
              🇭🇹 +509
            </span>
            <input
              id="reg_phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? "reg_phone_err" : undefined}
              className={`w-full h-12 pl-20 pr-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
                fieldErrors.phone
                  ? "border-red focus:border-red focus:ring-red/15"
                  : "border-line focus:border-blue focus:ring-blue/15"
              }`}
            />
          </div>
          {fieldErrors.phone && (
            <div id="reg_phone_err" role="alert" className="flex items-center gap-1.5 mt-1.5 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.phone}</span>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="reg_email" className="font-heading font-semibold text-xs text-ink block">
            {t("emailLabel")} <span className="text-red">*</span>
          </label>
          <input
            id="reg_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "reg_email_err" : undefined}
            className={`w-full h-12 px-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
              fieldErrors.email
                ? "border-red focus:border-red focus:ring-red/15"
                : "border-line focus:border-blue focus:ring-blue/15"
            }`}
          />
          {fieldErrors.email && (
            <div id="reg_email_err" role="alert" className="flex items-center gap-1.5 mt-1.5 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.email}</span>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="reg_password" className="font-heading font-semibold text-xs text-ink block">
            {t("passwordLabel")} <span className="text-red">*</span>
          </label>
          <div className="relative">
            <input
              id="reg_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "reg_password_err" : undefined}
              className={`w-full h-12 pl-4 pr-11 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all ${
                fieldErrors.password
                  ? "border-red focus:border-red focus:ring-red/15"
                  : "border-line focus:border-blue focus:ring-blue/15"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-faro hover:text-ink transition-colors"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-muted-faro" />
              ) : (
                <Eye className="w-4 h-4 text-muted-faro" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <div id="reg_password_err" role="alert" className="flex items-center gap-1.5 mt-1.5 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.password}</span>
            </div>
          )}
        </div>

        {/* Terms acceptance checkbox */}
        <div className="space-y-1 pt-1">
          <div className="flex items-start gap-2.5">
            <input
              id="reg_terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              aria-invalid={Boolean(fieldErrors.acceptTerms)}
              aria-describedby={fieldErrors.acceptTerms ? "reg_terms_err" : undefined}
              className="h-4 w-4 rounded border-line text-blue accent-blue focus:ring-blue mt-0.5"
            />
            <label htmlFor="reg_terms" className="font-sans text-xs text-muted-faro leading-relaxed cursor-pointer select-none">
              {t("acceptTermsPrefix")}{" "}
              <Link href="/cgu" className="text-blue hover:underline font-semibold" target="_blank">
                {t("termsOfService")}
              </Link>{" "}
              {t("and")}{" "}
              <Link href="/confidentialite" className="text-blue hover:underline font-semibold" target="_blank">
                {t("privacyPolicy")}
              </Link>
              .
            </label>
          </div>
          {fieldErrors.acceptTerms && (
            <div id="reg_terms_err" role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{fieldErrors.acceptTerms}</span>
            </div>
          )}
        </div>

        {/* Full-width blue primary button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm sm:text-base shadow-subtle flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            )}
            <span>{loading ? t("redirecting") : t("registerSubmit")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
