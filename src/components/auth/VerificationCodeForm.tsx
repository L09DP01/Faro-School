"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { sanitizeRedirectUrl } from "@/lib/validators/auth";
import { signIn } from "next-auth/react";

interface VerificationCodeFormProps {
  email: string;
  nextParam?: string;
  password?: string; // Optional: auto-login after verification if available
  onCancel?: () => void;
}

export function VerificationCodeForm({
  email,
  nextParam,
  password,
  onCancel,
}: VerificationCodeFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // 60-second cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError(
        locale === "ht"
          ? "Kòd la dwe gen 6 chif."
          : "Le code de vérification doit comporter exactement 6 chiffres."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Code invalide.");
        setLoading(false);
        return;
      }

      // If password is available (from immediate sign-up flow), sign in automatically
      if (password) {
        const signInRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInRes?.ok) {
          const dest = sanitizeRedirectUrl(nextParam, `/${locale}/dashboard`);
          window.location.href = dest;
          return;
        }
      }

      // Otherwise redirect to connexion with success message
      window.location.href = `/${locale}/connexion?verified=true`;
    } catch {
      setError(
        locale === "ht"
          ? "Gen yon erè ki pase. Tanpri eseye ankò."
          : "Une erreur réseau est survenue. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'envoyer le code.");
        if (data.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
        }
      } else {
        setResendSuccess(true);
        setCooldown(60);
      }
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setResending(false);
    }
  };

  const isHt = locale === "ht";

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="font-heading font-black text-2xl text-ink">
          {isHt ? "Verifye adrès imèl ou" : "Vérifiez votre adresse e-mail"}
        </h2>
        <p className="font-sans text-sm text-muted-faro max-w-sm mx-auto">
          {isHt
            ? "Si adrès sa a ka resevwa yon kont, yon kòd ap rive nan kèk minit. Verifye dosye endezirab ou tou."
            : "Si cette adresse peut recevoir un compte, un code arrive dans quelques minutes. Vérifiez aussi vos courriers indésirables."}
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

      {resendSuccess && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs sm:text-sm flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isHt
              ? "Si adrès sa a ka resevwa yon kont, yon kòd ap rive nan kèk minit. Verifye dosye endezirab ou tou."
              : "Si cette adresse peut recevoir un compte, un code arrive dans quelques minutes. Vérifiez aussi vos courriers indésirables."}
          </span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2 text-center">
            {isHt ? "Kòd verifikasyon (6 chif)" : "Code de vérification (6 chiffres)"}
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 rounded-xl border border-border-faro bg-background text-ink font-bold focus:outline-none focus:ring-2 focus:ring-accent-faro"
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length !== 6}
          className="w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink/90 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isHt ? "Konfime kont mwen" : "Confirmer mon compte"}</span>
        </button>
      </form>

      <div className="pt-2 text-center space-y-2 border-t border-border-faro">
        <p className="text-xs text-muted-faro">
          {isHt ? "Ou pa resevwa kòd la ?" : "Vous n'avez pas reçu le code ?"}
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-faro hover:underline disabled:text-muted-faro disabled:no-underline"
        >
          {resending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {!resending && <RefreshCw className="w-3.5 h-3.5" />}
          <span>
            {cooldown > 0
              ? `${isHt ? "Renvoye kòd la nan" : "Renvoyer le code dans"} ${cooldown}s`
              : isHt
              ? "Renvoye yon nouvo kòd"
              : "Renvoyer un nouveau code"}
          </span>
        </button>

        {onCancel && (
          <div>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-faro hover:underline"
            >
              {isHt ? "Retounen" : "Revenir en arrière"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
