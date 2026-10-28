import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
export * from "./promotion-types";
import type { CouponItem, CouponFormData } from "./promotion-types";

// Global fallback in-memory store for coupons to support mock/dev/offline runs
declare global {
  // eslint-disable-next-line no-var
  var __mockCouponsStore: CouponItem[] | undefined;
}

function initializeFallbackStore(): CouponItem[] {
  if (!globalThis.__mockCouponsStore) {
    globalThis.__mockCouponsStore = [
      {
        id: "coup-1",
        code: "FARO20",
        discountType: "percent",
        discountValue: 20,
        percentOff: 20,
        amountOffHtg: null,
        maxUses: 100,
        usedCount: 24,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        isActive: true,
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: "coup-2",
        code: "BIENVENUE500",
        discountType: "amount",
        discountValue: 500,
        percentOff: null,
        amountOffHtg: 500,
        maxUses: 50,
        usedCount: 18,
        expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
        isActive: true,
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: "coup-3",
        code: "SPECIAL50",
        discountType: "percent",
        discountValue: 50,
        percentOff: 50,
        amountOffHtg: null,
        maxUses: 10,
        usedCount: 10,
        expiresAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        isActive: false,
        createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      },
    ];
  }
  return globalThis.__mockCouponsStore;
}

export function getFallbackCoupon(code: string): CouponItem | null {
  const store = initializeFallbackStore();
  const clean = code.trim().toUpperCase();
  return store.find((c) => c.code.toUpperCase() === clean) || null;
}

export function saveFallbackCoupon(data: CouponFormData): CouponItem {
  const store = initializeFallbackStore();
  const cleanCode = data.code.trim().toUpperCase();
  const existingIdx = data.id
    ? store.findIndex((c) => c.id === data.id)
    : store.findIndex((c) => c.code === cleanCode);

  const percentOff = data.discountType === "percent" ? data.discountValue : null;
  const amountOffHtg = data.discountType === "amount" ? data.discountValue : null;

  if (existingIdx >= 0) {
    const updated: CouponItem = {
      ...store[existingIdx],
      code: cleanCode,
      discountType: data.discountType,
      discountValue: data.discountValue,
      percentOff,
      amountOffHtg,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt || null,
      isActive: data.isActive,
    };
    store[existingIdx] = updated;
    return updated;
  } else {
    const created: CouponItem = {
      id: data.id || `coup-${Date.now()}`,
      code: cleanCode,
      discountType: data.discountType,
      discountValue: data.discountValue,
      percentOff,
      amountOffHtg,
      maxUses: data.maxUses ?? null,
      usedCount: 0,
      expiresAt: data.expiresAt || null,
      isActive: data.isActive,
      createdAt: new Date().toISOString(),
    };
    store.unshift(created);
    return created;
  }
}

export function toggleFallbackCoupon(id: string, isActive: boolean): void {
  const store = initializeFallbackStore();
  const c = store.find((item) => item.id === id);
  if (c) {
    c.isActive = isActive;
  }
}

export function deleteFallbackCoupon(id: string): void {
  const store = initializeFallbackStore();
  const idx = store.findIndex((item) => item.id === id);
  if (idx >= 0) {
    store.splice(idx, 1);
  }
}

/**
 * Fetches all coupons from Supabase or fallback store.
 */
export async function getAdminCouponsList(): Promise<CouponItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, percent_off, amount_off_htg, max_uses, used_count, expires_at, is_active, created_at")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        code: c.code,
        discountType: c.percent_off ? "percent" : "amount",
        discountValue: c.percent_off ? Number(c.percent_off) : Number(c.amount_off_htg || 0),
        percentOff: c.percent_off ? Number(c.percent_off) : null,
        amountOffHtg: c.amount_off_htg ? Number(c.amount_off_htg) : null,
        maxUses: c.max_uses !== null ? Number(c.max_uses) : null,
        usedCount: Number(c.used_count || 0),
        expiresAt: c.expires_at || null,
        isActive: c.is_active !== false,
        createdAt: c.created_at || new Date().toISOString(),
      }));
    }
    if (!error && data && data.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Promotions] Error fetching coupons from database:", err);
  }

  if (isDemoMode()) {
    return initializeFallbackStore();
  }

  return [];
}
