"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AdminPaymentItem, AdminPaymentsKPIs, PaymentStatusFilter } from "@/lib/admin/payment-types";
import {
  validatePaymentAction,
  rejectPaymentAction,
  checkDuplicateTxnAction,
} from "@/app/actions/admin-payments";

interface AdminPaymentsClientProps {
  initialPayments: AdminPaymentItem[];
  kpis: AdminPaymentsKPIs;
  locale: string;
}

const ITEMS_PER_PAGE = 10;

export function AdminPaymentsClient({
  initialPayments,
  kpis: initialKpis,
  locale,
}: AdminPaymentsClientProps) {
  const t = useTranslations("admin.payments");
  const [payments, setPayments] = useState<AdminPaymentItem[]>(initialPayments);
  const [kpis, setKpis] = useState<AdminPaymentsKPIs>(initialKpis);

  const [activeTab, setActiveTab] = useState<PaymentStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [validateTarget, setValidateTarget] = useState<AdminPaymentItem | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [validating, setValidating] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<AdminPaymentItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [detailsTarget, setDetailsTarget] = useState<AdminPaymentItem | null>(null);

  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal ref for focus trap
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key handler and focus trapping
  useEffect(() => {
    const isDialogOpen = Boolean(validateTarget || rejectTarget || detailsTarget);
    if (!isDialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setValidateTarget(null);
        setRejectTarget(null);
        setDetailsTarget(null);
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Initial focus on the modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector<HTMLElement>(
          'button, input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [validateTarget, rejectTarget, detailsTarget]);

  const formatHtg = (amount: number) => {
    return (
      new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(amount) + " HTG"
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "awaiting_validation" && p.status === "awaiting_validation") ||
        (activeTab === "validated" && p.status === "validated") ||
        (activeTab === "failed" && (p.status === "failed" || (p.status as any) === "cancelled"));

      const s = search.toLowerCase().trim();
      const matchesSearch =
        !s ||
        p.studentName.toLowerCase().includes(s) ||
        p.studentPhone.toLowerCase().includes(s) ||
        p.providerTxnId.toLowerCase().includes(s) ||
        p.orderReference.toLowerCase().includes(s) ||
        p.courseTitleFr.toLowerCase().includes(s);

      return matchesTab && matchesSearch;
    });
  }, [payments, activeTab, search]);

  // Counts for each tab
  const counts = useMemo(() => {
    return {
      all: payments.length,
      awaiting: payments.filter((p) => p.status === "awaiting_validation").length,
      validated: payments.filter((p) => p.status === "validated").length,
      failed: payments.filter((p) => p.status === "failed" || (p.status as any) === "cancelled").length,
    };
  }, [payments]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / ITEMS_PER_PAGE));
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPayments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPayments, currentPage]);

  // Open Validate Dialog with duplicate check
  const handleOpenValidate = async (payment: AdminPaymentItem) => {
    setValidateTarget(payment);
    setInternalNote("");
    setDuplicateWarning(null);

    if (payment.providerTxnId) {
      const check = await checkDuplicateTxnAction(payment.providerTxnId, payment.id);
      if (check.isDuplicate) {
        setDuplicateWarning(
          t("validateDialog.duplicateWarning", {
            txnId: payment.providerTxnId,
            orderRef: check.conflictingOrderRef || "inconnue",
          })
        );
      }
    }
  };

  // Submit Validation
  const handleConfirmValidate = async () => {
    if (!validateTarget) return;
    setValidating(true);
    setAlert(null);

    const res = await validatePaymentAction(validateTarget.id, internalNote);
    setValidating(false);

    if (res.success) {
      const targetId = validateTarget.id;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === targetId
            ? { ...p, status: "validated", validatedAt: new Date().toISOString() }
            : p
        )
      );
      setKpis((prev) => ({
        ...prev,
        totalValidated: prev.totalValidated + validateTarget.amountHtg,
        awaitingCount: Math.max(0, prev.awaitingCount - 1),
        natcashTotal:
          validateTarget.provider === "natcash"
            ? prev.natcashTotal + validateTarget.amountHtg
            : prev.natcashTotal,
        moncashTotal:
          validateTarget.provider === "moncash"
            ? prev.moncashTotal + validateTarget.amountHtg
            : prev.moncashTotal,
      }));
      setValidateTarget(null);
      setAlert({ type: "success", message: "Paiement validé avec succès !" });
    } else {
      setAlert({
        type: "error",
        message: res.error || "Impossible de valider le paiement.",
      });
    }
  };

  // Open Reject Dialog
  const handleOpenReject = (payment: AdminPaymentItem) => {
    setRejectTarget(payment);
    setRejectReason("");
  };

  // Submit Rejection
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    setAlert(null);

    const res = await rejectPaymentAction(rejectTarget.id, rejectReason);
    setRejecting(false);

    if (res.success) {
      const targetId = rejectTarget.id;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === targetId
            ? { ...p, status: "failed", rejectionReason: rejectReason }
            : p
        )
      );
      setKpis((prev) => ({
        ...prev,
        awaitingCount: Math.max(0, prev.awaitingCount - 1),
      }));
      setRejectTarget(null);
      setAlert({ type: "success", message: "Paiement rejeté." });
    } else {
      setAlert({
        type: "error",
        message: res.error || "Impossible de rejeter le paiement.",
      });
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Reference",
      "Eleve",
      "Telephone",
      "Formation",
      "Moyen",
      "ID_Transaction",
      "Montant_HTG",
      "Statut",
      "Date",
    ];

    const rows = filteredPayments.map((p) => [
      `"${p.orderReference}"`,
      `"${p.studentName.replace(/"/g, '""')}"`,
      `"${p.studentPhone || p.payerPhone}"`,
      `"${(locale === "ht" && p.courseTitleHt ? p.courseTitleHt : p.courseTitleFr).replace(/"/g, '""')}"`,
      `"${p.provider.toUpperCase()}"`,
      `"${p.providerTxnId}"`,
      p.amountHtg,
      `"${p.status}"`,
      `"${new Date(p.createdAt).toISOString()}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paiements-faro-school-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStatusBadge = (status: AdminPaymentItem["status"]) => {
    switch (status) {
      case "validated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-ok-tint text-ok border border-ok/30">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            Validé
          </span>
        );
      case "awaiting_validation":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-tint text-orange border border-orange/30">
            <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
            À valider
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-tint text-red border border-red/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            Échoué
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-bg text-muted-faro border border-line">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-faro" />
            En attente
          </span>
        );
    }
  };

  const renderMethodTag = (provider: AdminPaymentItem["provider"]) => {
    const isMoncash = provider === "moncash";
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-xs text-ink">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isMoncash ? "bg-red" : "bg-orange"}`}
          aria-hidden="true"
        />
        <span>{isMoncash ? "MonCash" : "NatCash"}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Ghost "Exporter CSV" Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1.5">
            <span>Administration</span>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">Paiements</span>
          </nav>
          <h1 className="font-heading font-bold text-2xl sm:text-[30px] leading-tight text-ink">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-faro mt-1 font-sans">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink hover:bg-bg transition-colors shadow-sm self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <svg className="w-4 h-4 text-muted-faro" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{t("exportCsv")}</span>
        </button>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          role="status"
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border ${
            alert.type === "success"
              ? "bg-ok-tint text-ok border-ok/30"
              : "bg-red-tint text-red border-red/30"
          }`}
        >
          <span className="font-medium">{alert.message}</span>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="text-xs font-bold hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded p-0.5"
            aria-label="Fermer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Four KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Validated */}
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-faro uppercase tracking-wider font-heading">
              {t("kpiValidated")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-ok-tint text-ok flex items-center justify-center font-bold text-xs">
              ✓
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {formatHtg(kpis.totalValidated)}
          </div>
          <p className="text-xs text-muted-faro">{t("kpiValidatedSub")}</p>
        </div>

        {/* KPI 2: Awaiting Validation */}
        <div
          className={`rounded-[18px] border p-6 shadow-card space-y-2 transition-all ${
            kpis.awaitingCount > 0
              ? "border-orange/30 bg-orange-tint/50"
              : "border-line bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-faro uppercase tracking-wider font-heading">
              {t("kpiAwaiting")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-tint text-orange flex items-center justify-center font-bold text-xs">
              ⏳
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink flex items-center gap-2">
            <span>{kpis.awaitingCount}</span>
            {kpis.awaitingCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-tint text-orange border border-orange/30">
                Action requise
              </span>
            )}
          </div>
          <p className="text-xs text-muted-faro">{t("kpiAwaitingSub")}</p>
        </div>

        {/* KPI 3: MonCash Total */}
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-faro uppercase tracking-wider font-heading">
              {t("kpiMoncash")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-tint text-red flex items-center justify-center font-bold text-xs">
              MC
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {formatHtg(kpis.moncashTotal)}
          </div>
          <p className="text-xs text-muted-faro">{t("kpiMoncashSub")}</p>
        </div>

        {/* KPI 4: NatCash Total */}
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-faro uppercase tracking-wider font-heading">
              {t("kpiNatcash")}
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-tint text-orange flex items-center justify-center font-bold text-xs">
              NC
            </div>
          </div>
          <div className="text-2xl font-heading font-bold text-ink">
            {formatHtg(kpis.natcashTotal)}
          </div>
          <p className="text-xs text-muted-faro">{t("kpiNatcashSub")}</p>
        </div>
      </div>

      {/* 2. One Large White Card containing Filter Pills, Search, and Table */}
      <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden">
        {/* Card Header: Filter Pills (left) & Search (right) */}
        <div className="p-5 border-b border-line flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Filter Pills with Counts */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Pill: Tous */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("all");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                activeTab === "all"
                  ? "bg-surface text-ink border border-line shadow-sm"
                  : "bg-bg text-muted-faro hover:text-ink"
              }`}
            >
              {t("tabAll")} ({counts.all})
            </button>

            {/* Pill: En attente in amber */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("awaiting_validation");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange ${
                activeTab === "awaiting_validation"
                  ? "bg-orange-tint text-orange border border-orange/40 shadow-sm"
                  : "bg-orange-tint/40 text-orange/80 hover:text-orange"
              }`}
            >
              {t("tabAwaiting")} ({counts.awaiting})
            </button>

            {/* Pill: Validés in green */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("validated");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok ${
                activeTab === "validated"
                  ? "bg-ok-tint text-ok border border-ok/40 shadow-sm"
                  : "bg-ok-tint/40 text-ok/80 hover:text-ok"
              }`}
            >
              {t("tabValidated")} ({counts.validated})
            </button>

            {/* Pill: Échoués in red */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("failed");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red ${
                activeTab === "failed"
                  ? "bg-red-tint text-red border border-red/40 shadow-sm"
                  : "bg-red-tint/40 text-red/80 hover:text-red"
              }`}
            >
              {t("tabFailed")} ({counts.failed})
            </button>
          </div>

          {/* Search Field at the Right */}
          <div className="relative w-full md:w-72">
            <svg
              className="w-4 h-4 text-muted-faro absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
            />
          </div>
        </div>

        {/* 3. Table (Desktop & Tablet >= 768px) */}
        {filteredPayments.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <p className="text-sm font-medium text-ink">{t("empty")}</p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs font-semibold text-blue hover:underline"
              >
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-muted-faro font-heading font-semibold">
                    <th scope="col" className="py-3.5 px-4">{t("colStudent")}</th>
                    <th scope="col" className="py-3.5 px-4">{t("colCourse")}</th>
                    <th scope="col" className="py-3.5 px-4">{t("colMethod")}</th>
                    <th scope="col" className="py-3.5 px-4">{t("colTxnId")}</th>
                    <th scope="col" className="py-3.5 px-4 text-right">{t("colAmount")}</th>
                    <th scope="col" className="py-3.5 px-4 text-center">{t("colStatus")}</th>
                    <th scope="col" className="py-3.5 px-4 text-right">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {paginatedPayments.map((p) => {
                    const courseTitle =
                      locale === "ht" && p.courseTitleHt ? p.courseTitleHt : p.courseTitleFr;
                    const isAwaiting = p.status === "awaiting_validation";

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isAwaiting
                            ? "bg-orange-tint/40 hover:bg-orange-tint/60"
                            : "hover:bg-bg/40"
                        }`}
                      >
                        {/* Student (bold) & Phone */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-heading font-bold text-ink text-xs">{p.studentName}</div>
                          <div className="text-[11px] text-muted-faro font-mono mt-0.5">
                            {p.studentPhone || p.payerPhone || "—"}
                          </div>
                        </td>

                        {/* Course Title & Order Reference */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span className="font-medium text-ink block truncate" title={courseTitle}>
                            {courseTitle}
                          </span>
                          <span className="text-[10px] text-muted-faro font-mono">
                            #{p.orderReference}
                          </span>
                        </td>

                        {/* Method with Colored Brand Dot */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderMethodTag(p.provider)}
                        </td>

                        {/* Transaction ID in Monospace Font */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                          {p.providerTxnId ? (
                            <span className="bg-bg border border-line px-2 py-0.5 rounded text-[11px]">
                              {p.providerTxnId}
                            </span>
                          ) : (
                            <span className="text-muted-faro">—</span>
                          )}
                        </td>

                        {/* Amount (bold) */}
                        <td className="py-3.5 px-4 text-right font-heading font-bold text-ink text-sm whitespace-nowrap">
                          {formatHtg(p.amountHtg)}
                        </td>

                        {/* Status Tag */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {renderStatusBadge(p.status)}
                        </td>

                        {/* Actions: Small blue "Valider" or muted "Voir" */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isAwaiting ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenValidate(p)}
                                className="px-2.5 py-1 text-xs font-heading font-semibold rounded-lg bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                              >
                                {t("actionValidate")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReject(p)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-line text-red hover:bg-red-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
                              >
                                {t("actionReject")}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDetailsTarget(p)}
                              className="text-xs font-medium text-muted-faro hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded px-1 py-0.5"
                            >
                              Voir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Fallback: Stacked Cards (< 768px) */}
            <div className="md:hidden divide-y divide-line">
              {paginatedPayments.map((p) => {
                const courseTitle =
                  locale === "ht" && p.courseTitleHt ? p.courseTitleHt : p.courseTitleFr;
                const isAwaiting = p.status === "awaiting_validation";

                return (
                  <div
                    key={p.id}
                    className={`p-4 space-y-3 transition-colors ${
                      isAwaiting ? "bg-orange-tint/40" : "bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-heading font-bold text-ink text-sm">{p.studentName}</div>
                        <div className="text-[11px] text-muted-faro font-mono mt-0.5">
                          {p.studentPhone || p.payerPhone || "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-heading font-bold text-ink text-sm">
                          {formatHtg(p.amountHtg)}
                        </div>
                        <div className="mt-1">{renderStatusBadge(p.status)}</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-faro space-y-1">
                      <div className="font-medium text-ink line-clamp-1">{courseTitle}</div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {renderMethodTag(p.provider)}
                          <span className="font-mono text-muted-faro">#{p.orderReference}</span>
                        </div>
                        {p.providerTxnId && (
                          <span className="font-mono font-semibold bg-bg border border-line px-1.5 py-0.5 rounded text-[10px] text-ink">
                            {p.providerTxnId}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line/60">
                      <span className="text-[11px] text-muted-faro">{formatDate(p.createdAt)}</span>
                      <div>
                        {isAwaiting ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenValidate(p)}
                              className="px-3 py-1.5 text-xs font-heading font-semibold rounded-lg bg-blue text-white hover:bg-blue/90 shadow-sm"
                            >
                              {t("actionValidate")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReject(p)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-line text-red hover:bg-red-tint"
                            >
                              {t("actionReject")}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDetailsTarget(p)}
                            className="text-xs font-semibold text-blue hover:underline"
                          >
                            Voir les détails →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 4. Pagination */}
        {filteredPayments.length > ITEMS_PER_PAGE && (
          <div className="px-5 py-3.5 border-t border-line flex items-center justify-between text-xs text-muted-faro bg-surface">
            <span>
              {t("pagination.pageInfo", {
                current: currentPage,
                total: totalPages,
                count: filteredPayments.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-line hover:bg-bg disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue font-semibold text-ink"
              >
                {t("pagination.prev")}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-line hover:bg-bg disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue font-semibold text-ink"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Validate Dialog: Centered Modal, radius 18px */}
      {validateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="validate-dialog-title"
            tabIndex={-1}
            className="bg-surface border border-line rounded-[18px] shadow-2xl max-w-lg w-full p-7 space-y-5 focus:outline-none"
          >
            <div className="flex items-center gap-3 text-ok">
              <div className="w-10 h-10 rounded-full bg-ok-tint border border-ok/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 id="validate-dialog-title" className="font-heading font-bold text-base text-ink">
                  {t("validateDialog.title")}
                </h2>
                <p className="text-xs text-muted-faro mt-0.5">
                  {t("validateDialog.desc")}
                </p>
              </div>
            </div>

            {/* Duplicate Transaction Warning (amber-tint alert) */}
            {duplicateWarning && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-orange-tint border border-orange/30 text-ink text-xs flex items-start gap-2.5"
              >
                <svg className="w-4 h-4 text-orange shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{duplicateWarning}</span>
              </div>
            )}

            {/* Payment Details as Label/Value Rows */}
            <div className="p-4 rounded-xl bg-bg border border-line text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">{t("validateDialog.student")}</span>
                <span className="font-heading font-semibold text-ink">{validateTarget.studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">{t("validateDialog.course")}</span>
                <span className="font-medium text-ink max-w-[260px] truncate">{validateTarget.courseTitleFr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">{t("validateDialog.amount")}</span>
                <span className="font-heading font-bold text-ink text-sm">{formatHtg(validateTarget.amountHtg)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">{t("validateDialog.senderPhone")}</span>
                <span className="font-mono text-ink">{validateTarget.payerPhone || validateTarget.studentPhone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">{t("validateDialog.txnId")}</span>
                <span className="font-mono font-bold text-ink bg-surface border border-line px-2 py-0.5 rounded">
                  {validateTarget.providerTxnId}
                </span>
              </div>
            </div>

            {/* Internal Note Field (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="validate-internal-note" className="text-xs font-semibold text-ink">
                {t("validateDialog.internalNoteLabel")}
              </label>
              <textarea
                id="validate-internal-note"
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder={t("validateDialog.internalNotePlaceholder")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
              />
            </div>

            {/* Actions: Green Confirm Button & Ghost Cancel */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={validating}
                onClick={() => setValidateTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                {t("validateDialog.cancelBtn")}
              </button>
              <button
                type="button"
                disabled={validating}
                onClick={handleConfirmValidate}
                className="px-5 py-2 text-xs font-heading font-semibold rounded-xl bg-ok text-white hover:bg-ok/90 transition-colors disabled:opacity-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok"
              >
                {validating ? t("validateDialog.validating") : t("validateDialog.confirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog: Centered Modal, radius 18px */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            tabIndex={-1}
            className="bg-surface border border-line rounded-[18px] shadow-2xl max-w-md w-full p-7 space-y-5 focus:outline-none"
          >
            <div className="flex items-center gap-3 text-red">
              <div className="w-10 h-10 rounded-full bg-red-tint border border-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 id="reject-dialog-title" className="font-heading font-bold text-base text-ink">
                  {t("rejectDialog.title")}
                </h2>
                <p className="text-xs text-muted-faro mt-0.5">
                  {t("rejectDialog.desc")}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-bg rounded-xl border border-line text-xs space-y-1">
              <div><strong className="text-ink">Élève :</strong> <span className="text-muted-faro">{rejectTarget.studentName}</span></div>
              <div><strong className="text-ink">Transaction :</strong> <span className="font-mono text-muted-faro">#{rejectTarget.orderReference} ({rejectTarget.providerTxnId})</span></div>
            </div>

            {/* Reason Input (Mandatory) */}
            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="text-xs font-semibold text-ink">
                {t("rejectDialog.reasonLabel")}
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("rejectDialog.reasonPlaceholder")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-red focus:ring-2 focus:ring-red/20 transition-all"
              />
            </div>

            {/* Actions: Red Confirm Button & Ghost Cancel */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={rejecting}
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                {t("rejectDialog.cancelBtn")}
              </button>
              <button
                type="button"
                disabled={rejecting || !rejectReason.trim()}
                onClick={handleConfirmReject}
                className="px-5 py-2 text-xs font-heading font-semibold rounded-xl bg-red text-white hover:bg-red/90 transition-colors disabled:opacity-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
              >
                {rejecting ? t("rejectDialog.rejecting") : t("rejectDialog.confirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details ("Voir") Dialog: Centered Modal, radius 18px */}
      {detailsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-dialog-title"
            tabIndex={-1}
            className="bg-surface border border-line rounded-[18px] shadow-2xl max-w-lg w-full p-7 space-y-5 focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="details-dialog-title" className="font-heading font-bold text-base text-ink">
                  Détails de la transaction
                </h2>
                <p className="text-xs text-muted-faro font-mono mt-0.5">
                  #{detailsTarget.orderReference}
                </p>
              </div>
              <div>{renderStatusBadge(detailsTarget.status)}</div>
            </div>

            {/* Details Table */}
            <div className="p-4 rounded-xl bg-bg border border-line text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Élève :</span>
                <span className="font-heading font-semibold text-ink">{detailsTarget.studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Téléphone :</span>
                <span className="font-mono text-ink">{detailsTarget.studentPhone || detailsTarget.payerPhone || "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Formation :</span>
                <span className="font-medium text-ink max-w-[260px] truncate">{detailsTarget.courseTitleFr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Moyen de paiement :</span>
                <span>{renderMethodTag(detailsTarget.provider)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">ID Transaction / SMS :</span>
                <span className="font-mono font-bold text-ink bg-surface border border-line px-2 py-0.5 rounded">
                  {detailsTarget.providerTxnId || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Montant :</span>
                <span className="font-heading font-bold text-ink text-sm">{formatHtg(detailsTarget.amountHtg)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-faro">Date de création :</span>
                <span className="text-muted-faro">{formatDate(detailsTarget.createdAt)}</span>
              </div>
              {detailsTarget.validatedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-faro">Validé le :</span>
                  <span className="text-ok font-medium">{formatDate(detailsTarget.validatedAt)}</span>
                </div>
              )}
              {detailsTarget.rejectionReason && (
                <div className="pt-2 border-t border-line">
                  <span className="text-red font-semibold block mb-0.5">Motif du rejet :</span>
                  <p className="text-muted-faro bg-surface p-2 rounded-lg border border-line">{detailsTarget.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsTarget(null)}
                className="px-5 py-2 text-xs font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
