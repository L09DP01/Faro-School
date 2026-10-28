"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { validateAndFormatHaitianPhone } from "@/lib/validators/auth";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Loader2,
  ShoppingBag,
  Tag,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckoutFormProps {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  basePriceHtg: number;
  comparePriceHtg?: number | null;
  coverUrl?: string | null;
  defaultPhone?: string | null;
  merchantNatcashPhone?: string;
  locale: string;
  whatsappNumber: string;
}

interface AppliedCoupon {
  code: string;
  discountHtg: number;
  newTotalHtg: number;
}

export function CheckoutForm({
  courseId,
  courseSlug,
  courseTitle,
  basePriceHtg,
  comparePriceHtg,
  coverUrl,
  defaultPhone,
  merchantNatcashPhone = "40 00 00 00",
  locale,
  whatsappNumber,
}: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");

  // Payment method
  const [activeMethod, setActiveMethod] = useState<"moncash" | "natcash">("moncash");

  // Mobile order summary accordion
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Form fields
  const [moncashPhone, setMoncashPhone] = useState(defaultPhone || "");
  const [natcashSenderPhone, setNatcashSenderPhone] = useState(defaultPhone || "");
  const [natcashTxnId, setNatcashTxnId] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Computed total
  const currentTotal = appliedCoupon ? appliedCoupon.newTotalHtg : basePriceHtg;

  // Compare price discount amount
  const compareDiscountHtg =
    comparePriceHtg && comparePriceHtg > basePriceHtg
      ? comparePriceHtg - basePriceHtg
      : 0;

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Coupon application handler
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim(),
          courseId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        if (data.error === "expiredCoupon") {
          setCouponError(t("coupon.errors.expired"));
        } else if (data.error === "maxUsesReached") {
          setCouponError(t("coupon.errors.maxUses"));
        } else {
          setCouponError(t("coupon.errors.invalid"));
        }
        return;
      }

      setAppliedCoupon({
        code: data.code,
        discountHtg: data.discountHtg,
        newTotalHtg: data.newTotalHtg,
      });
      setCouponError(null);
    } catch {
      setCouponError(t("coupon.errors.general"));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  // Payment submission
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const targetPhone = activeMethod === "moncash" ? moncashPhone : natcashSenderPhone;
    const phoneValidation = validateAndFormatHaitianPhone(targetPhone);

    if (!phoneValidation.isValid) {
      setFieldErrors({
        phone: t("errors.invalidPhone"),
      });
      return;
    }

    if (activeMethod === "natcash" && !natcashTxnId.trim()) {
      setFieldErrors({
        txnId: "Veuillez renseigner l'ID de transaction reçu par SMS.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          provider: activeMethod,
          payerPhone: phoneValidation.formatted,
          providerTxnId: activeMethod === "natcash" ? natcashTxnId.trim() : undefined,
          couponCode: appliedCoupon?.code,
          locale,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "alreadyEnrolled") {
          setSubmitError(t("errors.alreadyEnrolled"));
          setTimeout(() => {
            window.location.href = `/${locale}/dashboard`;
          }, 1500);
          return;
        }
        throw new Error(data.message || data.error || t("errors.serverError"));
      }

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error(t("errors.serverError"));
      }
    } catch (err: any) {
      setSubmitError(err.message || t("errors.serverError"));
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-28 lg:pb-0">
      {/* MOBILE COLLAPSIBLE ORDER SUMMARY BAR (< 1024px) */}
      <div className="lg:hidden mb-6 rounded-2xl border border-line bg-surface shadow-subtle overflow-hidden">
        <button
          type="button"
          onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
          className="w-full p-4 flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange/40 bg-surface hover:bg-bg/60 transition-colors"
          aria-expanded={isMobileSummaryOpen}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-tint text-orange">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="font-heading text-xs font-bold text-ink">
                Récapitulatif de la commande
              </p>
              <p className="font-sans text-[11px] text-muted-faro flex items-center gap-1">
                <span>{isMobileSummaryOpen ? "Masquer les détails" : "Afficher les détails"}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isMobileSummaryOpen && "rotate-180")} />
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-heading text-base font-black text-navy-deep">
              {currentTotal.toLocaleString()} HTG
            </span>
          </div>
        </button>

        {isMobileSummaryOpen && (
          <div className="p-4 pt-0 border-t border-line space-y-4 bg-bg/30">
            {/* Course row */}
            <div className="flex items-center gap-3 pt-3">
              {coverUrl && (
                <div className="relative w-16 h-11 rounded-lg overflow-hidden border border-line shrink-0">
                  <Image src={coverUrl} alt={courseTitle} fill className="object-cover" sizes="64px" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-heading font-bold text-xs text-ink line-clamp-1">{courseTitle}</p>
                <p className="font-sans text-[11px] text-muted-faro">Accès illimité • Certificat inclus</p>
              </div>
            </div>

            {/* Price lines */}
            <div className="space-y-1.5 text-xs font-sans border-t border-line pt-3">
              <div className="flex justify-between text-muted-faro">
                <span>Prix régulier</span>
                <span>{(comparePriceHtg || basePriceHtg).toLocaleString()} HTG</span>
              </div>
              {compareDiscountHtg > 0 && (
                <div className="flex justify-between text-ok font-medium">
                  <span>Remise catalogue</span>
                  <span>-{compareDiscountHtg.toLocaleString()} HTG</span>
                </div>
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-ok font-medium">
                  <span>Code promo ({appliedCoupon.code})</span>
                  <span>-{appliedCoupon.discountHtg.toLocaleString()} HTG</span>
                </div>
              )}
            </div>

            {/* Mobile Coupon Field */}
            <div className="border-t border-line pt-3">
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ok-tint text-ok text-xs font-medium">
                  <span>Code {appliedCoupon.code} appliqué</span>
                  <button type="button" onClick={handleRemoveCoupon} className="underline text-muted-faro hover:text-red">
                    Retirer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="CODE PROMO"
                    className="flex-1 h-10 px-3 rounded-xl border border-line bg-surface text-xs font-mono uppercase focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponInput.trim()}
                    className="px-4 h-10 rounded-xl border border-line bg-surface text-xs font-heading font-semibold hover:bg-bg disabled:opacity-50"
                  >
                    {couponLoading ? "..." : "Appliquer"}
                  </button>
                </form>
              )}
              {couponError && <p className="text-[11px] text-red mt-1">{couponError}</p>}
            </div>
          </div>
        )}
      </div>

      {/* TWO COLUMNS LAYOUT: LEFT PAYMENT CARD + RIGHT SUMMARY CARD */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* LEFT COLUMN: Large white payment card (radius 18px, 34px padding) */}
        <div className="flex-1 w-full rounded-[18px] border border-line bg-surface p-6 sm:p-8 lg:p-[34px] shadow-card space-y-8 min-w-0">
          {/* Header */}
          <div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight text-ink">
              {t("methods.title")}
            </h2>
            <p className="font-sans text-xs sm:text-sm text-muted-faro mt-1">
              Sélectionnez votre moyen de paiement en Gourdes (HTG) pour valider votre commande.
            </p>
          </div>

          {/* Payment method selector: Two large tiles side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tile 1: MonCash */}
            <div
              onClick={() => {
                setActiveMethod("moncash");
                setSubmitError(null);
                setFieldErrors({});
              }}
              className={cn(
                "p-5 rounded-2xl cursor-pointer text-left transition-all duration-150 select-none",
                activeMethod === "moncash"
                  ? "border-2 border-blue bg-blue-tint shadow-subtle"
                  : "border-2 border-line bg-surface hover:border-line/80 hover:bg-bg/40"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full bg-red shrink-0" title="Digicel MonCash" />
                  <span className="font-heading font-black text-[20px] text-ink leading-tight">
                    MonCash
                  </span>
                </div>
                {/* Radio button */}
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    activeMethod === "moncash" ? "border-blue bg-surface" : "border-line bg-surface"
                  )}
                >
                  {activeMethod === "moncash" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue" />
                  )}
                </div>
              </div>
              <p className="font-sans text-xs text-muted-faro pl-5 leading-snug">
                Paiement direct sécurisé Digicel MonCash
              </p>
            </div>

            {/* Tile 2: NatCash */}
            <div
              onClick={() => {
                setActiveMethod("natcash");
                setSubmitError(null);
                setFieldErrors({});
              }}
              className={cn(
                "p-5 rounded-2xl cursor-pointer text-left transition-all duration-150 select-none",
                activeMethod === "natcash"
                  ? "border-2 border-blue bg-blue-tint shadow-subtle"
                  : "border-2 border-line bg-surface hover:border-line/80 hover:bg-bg/40"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full bg-orange shrink-0" title="Natcom NatCash" />
                  <span className="font-heading font-black text-[20px] text-ink leading-tight">
                    NatCash
                  </span>
                </div>
                {/* Radio button */}
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    activeMethod === "natcash" ? "border-blue bg-surface" : "border-line bg-surface"
                  )}
                >
                  {activeMethod === "natcash" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue" />
                  )}
                </div>
              </div>
              <p className="font-sans text-xs text-muted-faro pl-5 leading-snug">
                Paiement direct sécurisé Natcom NatCash
              </p>
            </div>
          </div>

          {/* Provider / Server Error Banner */}
          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-red/30 bg-red-tint text-xs text-red font-sans font-medium flex items-start gap-3 leading-relaxed"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-red mt-0.5" />
              <div className="flex-1">
                <p className="font-bold font-heading text-sm">Une erreur est survenue</p>
                <p className="mt-0.5">{submitError}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="underline hover:no-underline font-heading font-semibold"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* MODE 1: MONCASH */}
          {activeMethod === "moncash" && (
            <form onSubmit={handleSubmitPayment} className="space-y-6">
              {/* Phone field */}
              <div className="space-y-1.5">
                <label htmlFor="moncash-phone" className="font-heading font-semibold text-xs text-ink block">
                  {t("moncash.phoneLabel")} <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-xs font-heading font-bold text-muted-faro">
                    🇭🇹 +509
                  </span>
                  <input
                    id="moncash-phone"
                    type="tel"
                    value={moncashPhone}
                    onChange={(e) => setMoncashPhone(e.target.value)}
                    placeholder="34 00 00 00"
                    disabled={submitting}
                    className={cn(
                      "w-full h-12 pl-20 pr-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all",
                      fieldErrors.phone
                        ? "border-red focus:border-red focus:ring-red/15"
                        : "border-line focus:border-blue focus:ring-blue/15"
                    )}
                    required
                  />
                </div>
                {fieldErrors.phone ? (
                  <div role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.phone}</span>
                  </div>
                ) : (
                  <p className="text-[11px] font-sans text-muted-faro mt-1">
                    {t("moncash.phoneHelp")}
                  </p>
                )}
              </div>

              {/* Amber-tint "How it works" box with 3 numbered steps in dark amber */}
              <div className="rounded-2xl border border-orange/20 bg-orange-tint p-5 space-y-3.5 shadow-subtle">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white text-[11px] font-bold">
                    ?
                  </span>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-orange-strong">
                    Comment fonctionne le paiement MonCash ?
                  </h4>
                </div>
                <ol className="space-y-2.5 font-sans text-xs text-orange-strong leading-relaxed pl-1">
                  <li className="flex items-start gap-2.5">
                    <span className="font-heading font-bold text-orange">1.</span>
                    <span>Entrez votre numéro de téléphone MonCash Digicel ci-dessus.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-heading font-bold text-orange">2.</span>
                    <span>Cliquez sur le bouton pour être redirigé vers l&apos;interface de paiement sécurisée.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-heading font-bold text-orange">3.</span>
                    <span>Saisissez votre code PIN secret sur l&apos;écran MonCash pour valider l&apos;opération.</span>
                  </li>
                </ol>
              </div>

              {/* Submit Button & Sticky on Mobile */}
              <div className="lg:static fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md p-4 lg:p-0 border-t border-line lg:border-none shadow-lift lg:shadow-none">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full p-[18px] text-[18px] rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold shadow-orange flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Validation du paiement...</span>
                    </>
                  ) : (
                    <span>Payer {currentTotal.toLocaleString()} HTG →</span>
                  )}
                </button>
              </div>

              {/* Muted guarantee line below */}
              <p className="text-center font-sans text-xs text-muted-faro flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-ok" />
                <span>Garantie de remboursement de 7 jours • Accès immédiat et illimité</span>
              </p>
            </form>
          )}

          {/* MODE 2: NATCASH MANUAL / AUTO MODE */}
          {activeMethod === "natcash" && (
            <form onSubmit={handleSubmitPayment} className="space-y-6">
              {/* Blue-tint box: Merchant number & exact amount with copy buttons */}
              <div className="rounded-2xl border border-blue/20 bg-blue-tint p-5 space-y-4 shadow-subtle">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-blue">
                  Instructions de transfert NatCash
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Merchant Number */}
                  <div className="p-3.5 rounded-xl bg-surface border border-line flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-heading font-semibold text-muted-faro uppercase">
                        Numéro Marchand NatCash
                      </p>
                      <p className="font-heading font-bold text-sm text-ink tracking-wide">
                        {merchantNatcashPhone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(merchantNatcashPhone, "phone")}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-bg text-ink text-xs font-heading font-semibold hover:bg-surface flex items-center gap-1.5 transition-colors"
                    >
                      {copiedField === "phone" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-ok" />
                          <span className="text-ok">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-muted-faro" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Exact Amount */}
                  <div className="p-3.5 rounded-xl bg-surface border border-line flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-heading font-semibold text-muted-faro uppercase">
                        Montant exact à transférer
                      </p>
                      <p className="font-heading font-bold text-sm text-ink">
                        {currentTotal.toLocaleString()} HTG
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentTotal.toString(), "amount")}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-bg text-ink text-xs font-heading font-semibold hover:bg-surface flex items-center gap-1.5 transition-colors"
                    >
                      {copiedField === "amount" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-ok" />
                          <span className="text-ok">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-muted-faro" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <ol className="space-y-2 font-sans text-xs text-ink/80 leading-relaxed pl-1 pt-1">
                  <li className="flex items-start gap-2">
                    <span className="font-heading font-bold text-blue">1.</span>
                    <span>Ouvrez l&apos;application NatCash ou composez *202# sur votre mobile Natcom.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-heading font-bold text-blue">2.</span>
                    <span>Transférez exactement <strong>{currentTotal.toLocaleString()} HTG</strong> au numéro marchand ci-dessus.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-heading font-bold text-blue">3.</span>
                    <span>Renseignez ci-dessous votre numéro de téléphone et le code de transaction reçu par SMS.</span>
                  </li>
                </ol>
              </div>

              {/* Sender Phone Field */}
              <div className="space-y-1.5">
                <label htmlFor="natcash-phone" className="font-heading font-semibold text-xs text-ink block">
                  Numéro expéditeur NatCash <span className="text-red">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-xs font-heading font-bold text-muted-faro">
                    🇭🇹 +509
                  </span>
                  <input
                    id="natcash-phone"
                    type="tel"
                    value={natcashSenderPhone}
                    onChange={(e) => setNatcashSenderPhone(e.target.value)}
                    placeholder="40 00 00 00"
                    disabled={submitting}
                    className={cn(
                      "w-full h-12 pl-20 pr-4 text-sm font-sans rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all",
                      fieldErrors.phone
                        ? "border-red focus:border-red focus:ring-red/15"
                        : "border-line focus:border-blue focus:ring-blue/15"
                    )}
                    required
                  />
                </div>
                {fieldErrors.phone && (
                  <div role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.phone}</span>
                  </div>
                )}
              </div>

              {/* Transaction ID Field */}
              <div className="space-y-1.5">
                <label htmlFor="natcash-txnid" className="font-heading font-semibold text-xs text-ink block">
                  ID de transaction NatCash (reçu par SMS) <span className="text-red">*</span>
                </label>
                <input
                  id="natcash-txnid"
                  type="text"
                  value={natcashTxnId}
                  onChange={(e) => setNatcashTxnId(e.target.value)}
                  placeholder="ex: NC-98765432"
                  disabled={submitting}
                  className={cn(
                    "w-full h-12 px-4 text-sm font-mono uppercase rounded-xl border bg-surface text-ink placeholder:text-muted-faro/60 focus:outline-none focus:ring-2 shadow-subtle transition-all",
                    fieldErrors.txnId
                      ? "border-red focus:border-red focus:ring-red/15"
                      : "border-line focus:border-blue focus:ring-blue/15"
                  )}
                  required
                />
                {fieldErrors.txnId && (
                  <div role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.txnId}</span>
                  </div>
                )}
              </div>

              {/* Submit Button & Sticky on Mobile */}
              <div className="lg:static fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md p-4 lg:p-0 border-t border-line lg:border-none shadow-lift lg:shadow-none">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full p-[18px] text-[18px] rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold shadow-orange flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>Confirmation en cours...</span>
                    </>
                  ) : (
                    <span>Confirmer le paiement de {currentTotal.toLocaleString()} HTG →</span>
                  )}
                </button>
              </div>

              {/* Muted guarantee line below */}
              <p className="text-center font-sans text-xs text-muted-faro flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-ok" />
                <span>Validation rapide sous 15 minutes • Garantie 7 jours</span>
              </p>
            </form>
          )}

          {/* WhatsApp Support Box */}
          <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-faro">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-ok animate-pulse" />
              <span>Besoin d&apos;assistance pour payer ? Contactez-nous sur WhatsApp</span>
            </div>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `Bonjour Faro School, j'ai besoin d'aide pour régler la formation "${courseTitle}".`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-heading font-semibold text-xs text-blue hover:underline"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>WhatsApp Support ({whatsappNumber}) →</span>
            </a>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Order Summary Card (480px) on Desktop */}
        <aside className="hidden lg:block w-full lg:w-[480px] shrink-0 sticky top-24 space-y-6">
          <div className="rounded-[18px] border border-line bg-surface p-6 sm:p-7 shadow-card space-y-5">
            <h3 className="font-heading font-black text-lg text-ink border-b border-line pb-3">
              {t("summaryTitle")}
            </h3>

            {/* Course card miniature */}
            <div className="flex gap-4 items-center">
              {coverUrl ? (
                <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-line shrink-0 shadow-subtle">
                  <Image
                    src={coverUrl}
                    alt={courseTitle}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="w-24 h-16 rounded-xl bg-orange-tint border border-line flex items-center justify-center shrink-0 text-orange font-heading font-bold text-xs">
                  Faro
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-heading text-[10px] uppercase font-bold text-muted-faro tracking-wider mb-0.5">
                  Formation vidéo
                </p>
                <h4 className="font-heading font-bold text-sm text-ink line-clamp-2 leading-snug">
                  {courseTitle}
                </h4>
                <p className="font-sans text-[11px] text-muted-faro mt-1 flex items-center gap-1.5">
                  <span className="text-ok font-bold">✓</span>
                  <span>Accès à vie • Certificat inclus</span>
                </p>
              </div>
            </div>

            {/* Pricing details */}
            <div className="border-t border-line pt-4 space-y-2.5 font-sans text-xs">
              {/* Regular price */}
              <div className="flex items-center justify-between text-muted-faro">
                <span>Prix régulier</span>
                <span className="font-medium text-ink">
                  {(comparePriceHtg || basePriceHtg).toLocaleString()} HTG
                </span>
              </div>

              {/* Promotional discount */}
              {compareDiscountHtg > 0 && (
                <div className="flex items-center justify-between text-ok font-medium">
                  <span>Remise catalogue</span>
                  <span>-{compareDiscountHtg.toLocaleString()} HTG</span>
                </div>
              )}

              {/* Coupon discount line */}
              {appliedCoupon && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-ok-tint border border-ok/20 text-ok font-heading font-semibold text-xs">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Code promo ({appliedCoupon.code})</span>
                  </div>
                  <span>-{appliedCoupon.discountHtg.toLocaleString()} HTG</span>
                </div>
              )}

              {/* Large bold total row */}
              <div className="border-t border-line pt-4 flex items-baseline justify-between">
                <span className="font-heading font-bold text-sm text-ink">Total à régler</span>
                <div className="text-right">
                  <span className="font-heading text-3xl font-black text-navy-deep leading-tight">
                    {currentTotal.toLocaleString()}
                  </span>
                  <span className="font-heading font-bold text-sm text-muted-faro ml-1.5">
                    HTG
                  </span>
                </div>
              </div>
            </div>

            {/* Coupon input field with ghost Apply button */}
            <div className="border-t border-line pt-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between text-xs font-sans text-muted-faro">
                  <span>Code promo actif : <strong className="text-ink font-mono">{appliedCoupon.code}</strong></span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-semibold text-red hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <label htmlFor="desk-coupon" className="font-heading font-semibold text-xs text-ink block">
                    {t("coupon.label")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="desk-coupon"
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="CODE PROMO"
                      disabled={couponLoading}
                      className="flex-1 h-11 px-3.5 rounded-xl border border-line bg-surface text-ink text-xs font-mono uppercase tracking-wider focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/15 shadow-subtle transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-4 h-11 rounded-xl border border-line bg-surface hover:bg-bg text-ink font-heading font-semibold text-xs shadow-subtle transition-colors disabled:opacity-50"
                    >
                      {couponLoading ? "..." : t("coupon.apply")}
                    </button>
                  </div>
                  {couponError && (
                    <div role="alert" className="flex items-center gap-1.5 mt-1 text-xs text-red font-sans font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{couponError}</span>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Security assurance */}
            <div className="pt-2 border-t border-line/60 flex items-center justify-center gap-2 text-[11px] font-sans text-muted-faro">
              <Lock className="w-3.5 h-3.5 text-ok" />
              <span>Chiffrement sécurisé SSL • Aucune coordonnée bancaire stockée</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
