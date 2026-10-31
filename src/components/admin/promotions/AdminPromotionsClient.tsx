"use client";

import { useState, useTransition, useEffect } from "react";
import type { CouponItem, CouponFormData } from "@/lib/admin/promotion-types";
import { saveCouponAction, toggleCouponActiveAction, deleteCouponAction } from "@/app/actions/admin-promotions";

interface AdminPromotionsClientProps {
  initialCoupons: CouponItem[];
  locale: string;
}

export function AdminPromotionsClient({ initialCoupons, locale }: AdminPromotionsClientProps) {
  const [coupons, setCoupons] = useState<CouponItem[]>(initialCoupons);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percent" | "amount">("percent");
  const [formValue, setFormValue] = useState<string>("20");
  const [formMaxUses, setFormMaxUses] = useState<string>("");
  const [formExpiresAt, setFormExpiresAt] = useState<string>("");
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isHt = locale === "ht";

  const actionError=(code?:string)=>code==='duplicate_code'?(isHt?'Kòd promo sa a egziste deja.':'Ce code promotionnel existe déjà.'):(isHt?'Aksyon an pa disponib. Verifye done yo epi eseye ankò.':'Action indisponible. Vérifiez les données puis réessayez.');
  // Escape key handler
  useEffect(() => {
    if (!isDialogOpen && !deleteTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDialogOpen(false);
        setDeleteTarget(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen, deleteTarget]);

  // Filtered coupons
  const filteredCoupons = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase().trim())
  );

  // Aggregate stats
  const activeCount = coupons.filter((c) => c.isActive).length;
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const openCreateDialog = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormType("percent");
    setFormValue("20");
    setFormMaxUses("");
    setFormExpiresAt("");
    setFormIsActive(true);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (c: CouponItem) => {
    setEditingCoupon(c);
    setFormCode(c.code);
    setFormType(c.discountType);
    setFormValue(c.discountValue.toString());
    setFormMaxUses(c.maxUses !== null ? c.maxUses.toString() : "");
    setFormExpiresAt(c.expiresAt ? c.expiresAt.substring(0, 10) : "");
    setFormIsActive(c.isActive);
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = parseInt(formValue, 10);
    if (isNaN(val) || val <= 0) {
      setFormError(isHt ? "Tanpri mete yon valè rabè ki pozitif." : "Veuillez entrer une valeur de réduction positive.");
      return;
    }
    if (formType === "percent" && (val < 1 || val > 100)) {
      setFormError(isHt ? "Pousantaj la dwe ant 1% ak 100%." : "Le pourcentage doit être compris entre 1% et 100%.");
      return;
    }

    const maxU = formMaxUses ? parseInt(formMaxUses, 10) : null;
    if (formMaxUses && (isNaN(maxU!) || maxU! <= 0)) {
      setFormError(isHt ? "Limit itilizasyon an dwe pozitif." : "La limite d'utilisations doit être un nombre positif.");
      return;
    }

    const payload: CouponFormData = {
      id: editingCoupon?.id,
      code: formCode.trim().toUpperCase(),
      discountType: formType,
      discountValue: val,
      maxUses: maxU,
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      isActive: formIsActive,
    };

    startTransition(async () => {
      const res = await saveCouponAction(payload);
      if (res.success) {
        const item: CouponItem = {
          id: res.id || editingCoupon!.id,
          code: payload.code,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          percentOff: payload.discountType === "percent" ? payload.discountValue : null,
          amountOffHtg: payload.discountType === "amount" ? payload.discountValue : null,
          maxUses: payload.maxUses ?? null,
          usedCount: editingCoupon?.usedCount || 0,
          expiresAt: payload.expiresAt ?? null,
          isActive: payload.isActive,
          createdAt: editingCoupon?.createdAt || new Date().toISOString(),
        };

        if (editingCoupon) {
          setCoupons((prev) => prev.map((c) => (c.id === item.id ? item : c)));
          showNotification(isHt ? "Kòd promo modifye avèk siksè !" : "Code promo mis à jour avec succès !");
        } else {
          setCoupons((prev) => [item, ...prev]);
          showNotification(isHt ? "Nouvo kòd promo kreye avèk siksè !" : "Nouveau code promo créé avec succès !");
        }
        setIsDialogOpen(false);
      } else {
        setFormError(actionError(res.error));
      }
    });
  };

  const handleToggleActive = (c: CouponItem) => {
    const nextState = !c.isActive;
    startTransition(async () => {
      const res = await toggleCouponActiveAction(c.id, nextState);
      if (res.success) {
        setCoupons((prev) =>
          prev.map((item) => (item.id === c.id ? { ...item, isActive: nextState } : item))
        );
        showNotification(
          nextState
            ? (isHt ? `Kòd ${c.code} aktive.` : `Code ${c.code} activé.`)
            : (isHt ? `Kòd ${c.code} dezaktive.` : `Code ${c.code} désactivé.`)
        );
      } else showNotification(actionError(res.error),"error");
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCouponAction(deleteTarget.id);
      if (res.success) {
        setCoupons((prev) => res.archived ? prev.map(item=>item.id===deleteTarget.id?{...item,isActive:false}:item) : prev.filter((item) => item.id !== deleteTarget.id));
        setDeleteTarget(null);
        showNotification(res.archived ? (isHt ? "Kòd promo dezaktive pou konsève kòmand yo." : "Code désactivé pour préserver les commandes.") : (isHt ? "Kòd promo efase." : "Code promo supprimé avec succès."));
      } else showNotification(actionError(res.error),"error");
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold shadow-sm transition-all ${
            notification.type === "success"
              ? "border-ok/30 bg-ok-tint text-ok"
              : "border-red/30 bg-red-tint text-red"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current rounded p-0.5"
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header with Breadcrumb and Create CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1.5">
            <span>Administration</span>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">Promotions</span>
          </nav>
          <h1 className="font-heading font-bold text-2xl sm:text-[30px] leading-tight text-ink">
            {isHt ? "Pwomosyon ak Kòd Rabè" : "Codes Promotionnels & Réductions"}
          </h1>
          <p className="mt-1 text-sm text-muted-faro font-sans">
            {isHt
              ? "Kreye kòd rabè pou etidyan yo ka itilize nan kesye a (pousantaj oswa montan fiks an HTG)."
              : "Gérez les réductions applicables lors du paiement (en pourcentage ou montant fixe en HTG)."}
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue px-5 py-2.5 text-xs font-heading font-semibold text-white shadow-sm hover:bg-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue self-start sm:self-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>{isHt ? "Kreye yon kòd" : "Nouveau code promo"}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Kòd ki aktif" : "Codes actifs"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            {activeCount} <span className="text-xs font-normal text-muted-faro">/ {coupons.length}</span>
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Total itilizasyon" : "Utilisations totales"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            {totalUses} <span className="text-xs font-normal text-muted-faro">{isHt ? "fwa" : "commandes"}</span>
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Tip rabè" : "Types de réductions"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            % <span className="text-sm font-normal text-muted-faro">&</span> HTG
          </p>
        </div>
      </div>

      {/* Unified White Card: Search Bar + Table */}
      <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden">
        {/* Search Bar Top */}
        <div className="p-4 border-b border-line">
          <div className="relative max-w-md">
            <svg
              className="w-4 h-4 text-muted-faro absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isHt ? "Chèche pa kòd promo..." : "Rechercher par code promotionnel..."}
              aria-label={isHt ? "Chèche pa kòd promo" : "Rechercher un code"}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-bg/50 text-muted-faro font-heading font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Kòd" : "Code"}</th>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Rabè" : "Réduction"}</th>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Itilizasyon" : "Utilisations"}</th>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Eksipirasyon" : "Expiration"}</th>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Estati" : "Statut"}</th>
                <th scope="col" className="px-5 py-3.5 text-right">{isHt ? "Aksyon" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-xs text-muted-faro">
                    {isHt ? "Nou pa jwenn okenn kòd promo." : "Aucun code promotionnel trouvé."}
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/40 transition-colors">
                    {/* Code */}
                    <td className="px-5 py-3.5 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold tracking-wider text-ink bg-bg border border-line px-2 py-0.5 rounded">
                          {c.code}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            showNotification(isHt ? "Kòd kopye !" : "Code copié dans le presse-papier !");
                          }}
                          title="Copier le code"
                          className="rounded p-1 text-muted-faro hover:bg-bg hover:text-ink transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Discount Pill */}
                    <td className="px-5 py-3.5">
                      {c.discountType === "percent" ? (
                        <span className="inline-flex items-center rounded-full bg-blue-tint border border-blue/20 px-2.5 py-0.5 text-[11px] font-semibold text-blue">
                          -{c.discountValue}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ok-tint border border-ok/20 px-2.5 py-0.5 text-[11px] font-semibold text-ok">
                          -{c.discountValue} HTG
                        </span>
                      )}
                    </td>

                    {/* Uses */}
                    <td className="px-5 py-3.5 text-muted-faro">
                      <span className="font-semibold text-ink">{c.usedCount}</span>
                      {c.maxUses !== null ? (
                        <span> / {c.maxUses}</span>
                      ) : (
                        <span className="text-[11px] text-muted-faro"> ({isHt ? "san limit" : "illimité"})</span>
                      )}
                    </td>

                    {/* Expiry */}
                    <td className="px-5 py-3.5 text-muted-faro">
                      {c.expiresAt ? (
                        new Date(c.expiresAt).toLocaleDateString(isHt ? "ht-HT" : "fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      ) : (
                        <span>{isHt ? "San ekspirasyon" : "Permanent"}</span>
                      )}
                    </td>

                    {/* Status Pill Toggle */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleActive(c)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          c.isActive
                            ? "bg-ok-tint text-ok border border-ok/30 hover:bg-ok-tint/80"
                            : "bg-bg text-muted-faro border border-line hover:bg-line/40"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${c.isActive ? "bg-ok" : "bg-muted-faro"}`} />
                        <span>{c.isActive ? (isHt ? "Aktif" : "Actif") : isHt ? "Inaktif" : "Inactif"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditDialog(c)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-line bg-surface text-ink hover:bg-bg transition-colors"
                        >
                          {isHt ? "Modifye" : "Modifier"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red/20 text-red hover:bg-red-tint transition-colors"
                        >
                          {isHt ? "Efase" : "Supprimer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog: Centered Modal, radius 18px */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-dialog-title"
            className="w-full max-w-md rounded-[18px] border border-line bg-surface p-7 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 id="promo-dialog-title" className="font-heading font-bold text-base text-ink">
                {editingCoupon
                  ? isHt
                    ? "Modifye kòd promo"
                    : "Modifier le code promo"
                  : isHt
                    ? "Kreye yon kòd promo"
                    : "Créer un code promo"}
              </h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-muted-faro hover:text-ink text-sm p-1"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-red/30 bg-red-tint p-3 text-red font-medium">
                  {formError}
                </div>
              )}

              {/* Code */}
              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink block">
                  {isHt ? "Kòd (lèt majiskil ak chif)" : "Code promo (majuscules et chiffres)"} *
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="EX: PROMO2025"
                  className="w-full font-mono font-bold rounded-xl border border-line bg-bg px-3.5 py-2 text-xs text-ink uppercase placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>

              {/* Discount Type */}
              <div className="space-y-1.5">
                <label className="font-heading font-semibold text-ink block">
                  {isHt ? "Tip rabè" : "Type de réduction"} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("percent");
                      if (parseInt(formValue, 10) > 100) setFormValue("20");
                    }}
                    className={`rounded-xl border py-2 px-3 text-xs font-semibold transition-colors ${
                      formType === "percent"
                        ? "border-blue bg-blue-tint text-blue"
                        : "border-line bg-surface text-muted-faro hover:bg-bg"
                    }`}
                  >
                    {isHt ? "Pousantaj (%)" : "Pourcentage (%)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("amount")}
                    className={`rounded-xl border py-2 px-3 text-xs font-semibold transition-colors ${
                      formType === "amount"
                        ? "border-blue bg-blue-tint text-blue"
                        : "border-line bg-surface text-muted-faro hover:bg-bg"
                    }`}
                  >
                    {isHt ? "Montan fiks (HTG)" : "Montant fixe (HTG)"}
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink block">
                  {formType === "percent"
                    ? isHt
                      ? "Pousantaj rabè (1 - 100%)"
                      : "Valeur du pourcentage (1 - 100%)"
                    : isHt
                      ? "Montan an goud (HTG)"
                      : "Montant de la réduction (HTG)"} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={1}
                    max={formType === "percent" ? 100 : undefined}
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-3.5 py-2 text-xs text-ink font-bold focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-faro">
                    {formType === "percent" ? "%" : "HTG"}
                  </span>
                </div>
              </div>

              {/* Usage Limit & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-heading font-semibold text-ink block">
                    {isHt ? "Limit itilizasyon" : "Limite d'utilisations"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    placeholder={isHt ? "San limit" : "Illimité"}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-xs text-ink focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-heading font-semibold text-ink block">
                    {isHt ? "Dat ekspirasyon" : "Date d'expiration"}
                  </label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-xs text-ink focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="coupon-active-check"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-line text-blue focus:ring-blue"
                />
                <label htmlFor="coupon-active-check" className="text-xs font-medium text-ink cursor-pointer">
                  {isHt ? "Aktive kòd sa a imedyatman" : "Activer ce code promotionnel immédiatement"}
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-bg transition-colors"
                >
                  {isHt ? "Anile" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-blue text-white text-xs font-heading font-semibold hover:bg-blue/90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isPending ? (isHt ? "N ap anrejistre..." : "Enregistrement...") : isHt ? "Anrejistre" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-coupon-title"
            className="w-full max-w-sm rounded-[18px] border border-line bg-surface p-7 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-red">
              <div className="w-10 h-10 rounded-full bg-red-tint border border-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 id="delete-coupon-title" className="font-heading font-bold text-base text-ink">
                {isHt ? "Efase kòd promo sa a ?" : "Supprimer ce code promo ?"}
              </h2>
            </div>

            <p className="text-xs text-muted-faro font-sans leading-relaxed">
              {isHt
                ? `Èske ou si ou vle efase kòd "${deleteTarget.code}" la definitivman ? Aksyon sa a pa ka defèt.`
                : `Êtes-vous sûr de vouloir supprimer définitivement le code "${deleteTarget.code}" ? Cette action est irréversible.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-bg transition-colors"
              >
                {isHt ? "Anile" : "Annuler"}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-red text-white text-xs font-heading font-semibold hover:bg-red/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isPending ? (isHt ? "N ap efase l..." : "Suppression...") : isHt ? "Konfime sipresyon" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
