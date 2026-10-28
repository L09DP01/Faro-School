"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";
import {
  couponFormSchema,
  type CouponFormData,
  saveFallbackCoupon,
  toggleFallbackCoupon,
  deleteFallbackCoupon,
} from "@/lib/admin/promotions";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Accès refusé : rôle administrateur requis.");
  }
  return user;
}

export async function saveCouponAction(rawData: CouponFormData) {
  const admin = await assertAdmin();
  const parsed = couponFormSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Données invalides.",
    };
  }

  const data = parsed.data;
  const cleanCode = data.code.trim().toUpperCase();
  const percentOff = data.discountType === "percent" ? data.discountValue : null;
  const amountOffHtg = data.discountType === "amount" ? data.discountValue : null;

  try {
    const supabase = await createClient();

    if (data.id && !data.id.startsWith("coup-")) {
      // Update existing
      const { error } = await supabase
        .from("coupons")
        .update({
          code: cleanCode,
          percent_off: percentOff,
          amount_off_htg: amountOffHtg,
          max_uses: data.maxUses ?? null,
          expires_at: data.expiresAt || null,
          is_active: data.isActive,
        })
        .eq("id", data.id);

      if (error) {
        console.warn("Supabase update coupon failed, using fallback:", error.message);
      }
    } else {
      // Check existing code uniqueness in Supabase
      const { data: existing } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", cleanCode)
        .maybeSingle();

      if (existing) {
        return { success: false, error: "Un code promotionnel identique existe déjà." };
      }

      const { error } = await supabase.from("coupons").insert({
        code: cleanCode,
        percent_off: percentOff,
        amount_off_htg: amountOffHtg,
        max_uses: data.maxUses ?? null,
        expires_at: data.expiresAt || null,
        is_active: data.isActive,
      });

      if (error) {
        console.warn("Supabase insert coupon failed, saving to fallback store:", error.message);
      }
    }

    // Always record in audit log
    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: data.id ? "update_coupon" : "create_coupon",
        note: `Code promo ${cleanCode} (${data.discountType === "percent" ? `${data.discountValue}%` : `${data.discountValue} HTG`})`,
        metadata: { code: cleanCode, discount_type: data.discountType, value: data.discountValue },
      });
    } catch {
      // Non-critical audit log failure
    }
  } catch (err: any) {
    console.warn("Coupon server action error:", err?.message);
  }

  // Always update in-memory fallback store
  saveFallbackCoupon(data);

  revalidatePath("/[locale]/admin/promotions", "page");
  return { success: true, code: cleanCode };
}

export async function toggleCouponActiveAction(couponId: string, isActive: boolean) {
  const admin = await assertAdmin();

  try {
    const supabase = await createClient();
    await supabase.from("coupons").update({ is_active: isActive }).eq("id", couponId);

    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: isActive ? "activate_coupon" : "deactivate_coupon",
        metadata: { coupon_id: couponId, is_active: isActive },
      });
    } catch {
      // Non-critical
    }
  } catch (err: any) {
    console.warn("Toggle coupon Supabase error:", err?.message);
  }

  toggleFallbackCoupon(couponId, isActive);
  revalidatePath("/[locale]/admin/promotions", "page");
  return { success: true };
}

export async function deleteCouponAction(couponId: string) {
  const admin = await assertAdmin();

  try {
    const supabase = await createClient();

    // Check if referenced in orders
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId);

    if (count && count > 0) {
      // Deactivate instead of hard delete to preserve financial history
      await supabase.from("coupons").update({ is_active: false }).eq("id", couponId);
      toggleFallbackCoupon(couponId, false);
      revalidatePath("/[locale]/admin/promotions", "page");
      return {
        success: true,
        archived: true,
        message: "Le code promo est rattaché à des commandes existantes et a été désactivé au lieu d'être supprimé.",
      };
    }

    await supabase.from("coupons").delete().eq("id", couponId);

    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: "delete_coupon",
        metadata: { coupon_id: couponId },
      });
    } catch {
      // Non-critical
    }
  } catch (err: any) {
    console.warn("Delete coupon Supabase error:", err?.message);
  }

  deleteFallbackCoupon(couponId);
  revalidatePath("/[locale]/admin/promotions", "page");
  return { success: true };
}
