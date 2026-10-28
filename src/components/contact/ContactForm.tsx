"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { contactSchema } from "@/lib/validators/contact";

export function ContactForm() {
  const t = useTranslations("contactPage.form");

  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    message: "",
    hp: "", // Honeypot field
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for that field when typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // 1. Client-side Zod validation
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]?.toString() || "form";
        fieldErrors[field] = t(`errors.${issue.message}` as any);
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "rateLimit") {
          setServerError(t("errors.rateLimit"));
        } else if (data.error === "validation" && data.fieldErrors) {
          const mapped: Record<string, string> = {};
          Object.entries(data.fieldErrors).forEach(([k, v]) => {
            mapped[k] = t(`errors.${v}` as any);
          });
          setErrors(mapped);
        } else {
          setServerError(t("errors.serverError"));
        }
        return;
      }

      // Success
      setSuccess(true);
      setFormData({ name: "", contact: "", message: "", hp: "" });
    } catch {
      setServerError(t("errors.serverError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[20px] border border-line bg-surface p-8 sm:p-12 text-center space-y-5 shadow-card"
      >
        <div className="w-16 h-16 rounded-full bg-ok-tint text-ok border border-ok/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="font-heading font-bold text-xl sm:text-2xl text-ink">
            {t("successTitle")}
          </h2>
          <p className="text-sm text-muted-faro max-w-md mx-auto leading-relaxed font-sans">
            {t("successMessage")}
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="px-5 py-2.5 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink hover:bg-bg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {t("sendAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[20px] border border-line bg-surface p-7 sm:p-9 space-y-6 shadow-card"
    >
      <div className="border-b border-line pb-4">
        <h2 className="font-heading font-bold text-xl text-ink">{t("title")}</h2>
        <p className="mt-1 text-xs sm:text-sm text-muted-faro font-sans">{t("subtitle")}</p>
      </div>

      {serverError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl border border-red/30 bg-red-tint text-xs text-red font-medium flex items-start gap-2.5"
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      {/* Honeypot field (hidden from real users, filled by bots) */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="_hp_field">Ne pas remplir si vous êtes humain</label>
        <input
          id="_hp_field"
          type="text"
          name="hp"
          value={formData.hp}
          onChange={handleChange}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* 1. Name */}
      <div className="space-y-1.5">
        <label htmlFor="contact_name" className="text-xs font-heading font-semibold text-ink flex items-center justify-between">
          <span>{t("nameLabel")}</span>
          <span className="text-red font-bold" aria-hidden="true">*</span>
        </label>
        <input
          id="contact_name"
          type="text"
          name="name"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "contact_name_error" : undefined}
          value={formData.name}
          onChange={handleChange}
          placeholder={t("namePlaceholder")}
          className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:ring-2 transition-all ${
            errors.name
              ? "border-red focus:border-red focus:ring-red/20"
              : "border-line focus:border-blue focus:ring-blue/20"
          }`}
        />
        {errors.name && (
          <p id="contact_name_error" role="alert" aria-live="polite" className="text-xs text-red font-medium flex items-center gap-1.5 mt-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errors.name}</span>
          </p>
        )}
      </div>

      {/* 2. Contact info (Email or Phone) */}
      <div className="space-y-1.5">
        <label htmlFor="contact_info" className="text-xs font-heading font-semibold text-ink flex items-center justify-between">
          <span>{t("contactLabel")}</span>
          <span className="text-red font-bold" aria-hidden="true">*</span>
        </label>
        <input
          id="contact_info"
          type="text"
          name="contact"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.contact)}
          aria-describedby={errors.contact ? "contact_info_error" : undefined}
          value={formData.contact}
          onChange={handleChange}
          placeholder={t("contactPlaceholder")}
          className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:ring-2 transition-all ${
            errors.contact
              ? "border-red focus:border-red focus:ring-red/20"
              : "border-line focus:border-blue focus:ring-blue/20"
          }`}
        />
        {errors.contact && (
          <p id="contact_info_error" role="alert" aria-live="polite" className="text-xs text-red font-medium flex items-center gap-1.5 mt-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errors.contact}</span>
          </p>
        )}
      </div>

      {/* 3. Message */}
      <div className="space-y-1.5">
        <label htmlFor="contact_msg" className="text-xs font-heading font-semibold text-ink flex items-center justify-between">
          <span>{t("messageLabel")}</span>
          <span className="text-red font-bold" aria-hidden="true">*</span>
        </label>
        <textarea
          id="contact_msg"
          name="message"
          rows={4}
          required
          aria-required="true"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact_msg_error" : undefined}
          value={formData.message}
          onChange={handleChange}
          placeholder={t("messagePlaceholder")}
          className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:ring-2 resize-y transition-all ${
            errors.message
              ? "border-red focus:border-red focus:ring-red/20"
              : "border-line focus:border-blue focus:ring-blue/20"
          }`}
        />
        {errors.message && (
          <p id="contact_msg_error" role="alert" aria-live="polite" className="text-xs text-red font-medium flex items-center gap-1.5 mt-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errors.message}</span>
          </p>
        )}
      </div>

      {/* Full-Width Blue Send Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-6 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
        >
          {submitting && (
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          )}
          <span>{submitting ? t("submitting") : t("submit")}</span>
        </button>
      </div>
    </form>
  );
}
