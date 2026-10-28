"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ProfileFormProps {
  user: {
    fullName: string;
    phone: string | null;
    email: string | null;
    locale: "fr" | "ht";
  };
  currentLocale: string;
}

export function ProfileForm({ user, currentLocale }: ProfileFormProps) {
  const t = useTranslations("dashboard.profile");
  const router = useRouter();

  // Personal Info State
  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [localePref, setLocalePref] = useState<"fr" | "ht">(user.locale || "fr");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalLoading(true);
    setPersonalError(null);
    setPersonalSuccess(false);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          locale: localePref,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur de mise à jour");
      }

      setPersonalSuccess(true);
      router.refresh();
      setTimeout(() => setPersonalSuccess(false), 4000);
    } catch (err: any) {
      setPersonalError(err.message || "Impossible de mettre à jour le profil");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit comporter au moins 8 caractères");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur de modification du mot de passe");
      }

      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || "Échec du changement de mot de passe");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* 1. Personal Information Form */}
      <form
        onSubmit={handleUpdatePersonal}
        className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 shadow-card space-y-5"
      >
        <h2 className="text-base font-heading font-bold text-navy-deep border-b border-line pb-3">
          {t("personalSection")}
        </h2>

        {personalSuccess && (
          <div className="p-3.5 rounded-xl bg-ok-tint border border-ok/20 text-ok text-xs font-heading font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t("personalSuccess")}</span>
          </div>
        )}

        {personalError && (
          <div className="p-3.5 rounded-xl bg-red-tint border border-red/20 text-red text-xs font-heading font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{personalError}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="profile-name"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("fullName")}
          </label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={personalLoading}
            className="w-full h-11 px-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all disabled:opacity-50"
            required
          />
        </div>

        <div>
          <label
            htmlFor="profile-phone"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("phone")}
          </label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+509 36 00 00 00"
            disabled={personalLoading}
            className="w-full h-11 px-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="profile-email"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("email")}
          </label>
          <input
            id="profile-email"
            type="email"
            value={user.email || ""}
            disabled
            className="w-full h-11 px-4 rounded-xl border border-line bg-bg text-muted-faro text-sm cursor-not-allowed"
          />
          <span className="text-[11px] text-muted-faro font-sans mt-1 block">
            L&apos;adresse email ne peut pas être modifiée directement.
          </span>
        </div>

        <div>
          <label
            htmlFor="profile-locale"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("locale")}
          </label>
          <select
            id="profile-locale"
            value={localePref}
            onChange={(e) => setLocalePref(e.target.value as "fr" | "ht")}
            disabled={personalLoading}
            className="w-full h-11 px-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all disabled:opacity-50"
          >
            <option value="fr">Français (FR)</option>
            <option value="ht">Kreyòl Ayisyen (KR)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={personalLoading}
          className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-sm transition-all shadow-orange disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {personalLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enregistrement...</span>
            </>
          ) : (
            <span>{t("savePersonal")}</span>
          )}
        </button>
      </form>

      {/* 2. Password Change Form */}
      <form
        onSubmit={handleUpdatePassword}
        className="rounded-[18px] border border-line bg-surface p-6 sm:p-8 shadow-card space-y-5"
      >
        <h2 className="text-base font-heading font-bold text-navy-deep border-b border-line pb-3">
          {t("securitySection")}
        </h2>

        {passwordSuccess && (
          <div className="p-3.5 rounded-xl bg-ok-tint border border-ok/20 text-ok text-xs font-heading font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t("passwordSuccess")}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-red-tint border border-red/20 text-red text-xs font-heading font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="new-pwd"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("newPassword")}
          </label>
          <input
            id="new-pwd"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={passwordLoading}
            placeholder="•••••••• (8 caractères min)"
            className="w-full h-11 px-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all disabled:opacity-50"
            required
          />
        </div>

        <div>
          <label
            htmlFor="confirm-pwd"
            className="block text-xs font-heading font-semibold text-ink mb-1.5"
          >
            {t("confirmPassword")}
          </label>
          <input
            id="confirm-pwd"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={passwordLoading}
            placeholder="••••••••"
            className="w-full h-11 px-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all disabled:opacity-50"
            required
          />
        </div>

        <button
          type="submit"
          disabled={passwordLoading || !newPassword}
          className="px-6 py-3 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-sm transition-all shadow-orange disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {passwordLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Modification...</span>
            </>
          ) : (
            <span>{t("savePassword")}</span>
          )}
        </button>
      </form>
    </div>
  );
}
