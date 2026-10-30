import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFallbackCoupon } from "@/lib/admin/promotions";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Rate limit: 10 attempts per 5 minutes per IP to prevent coupon enumeration
    const rateLimit = await checkRateLimit(`coupon:${ip}`, 10, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { valid: false, error: "rateLimit" },
        { status: 429 }
      );
    }

    const { code, courseId } = await req.json();

    if (!code || typeof code !== "string" || !courseId) {
      return NextResponse.json(
        { valid: false, error: "invalidCoupon" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const supabase = await createClient();

    // 1. Fetch course price from database (with mock fallback)
    let coursePriceHtg = 3500;
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("price_htg")
      .eq("id", courseId)
      .maybeSingle();

    if (!courseError && course && typeof course.price_htg === "number") {
      coursePriceHtg = course.price_htg;
    }

    // 2. Fetch coupon from database or fallback in-memory store
    let coupon: {
      id: string;
      code: string;
      percent_off?: number | null;
      amount_off_htg?: number | null;
      max_uses?: number | null;
      used_count: number;
      expires_at?: string | null;
      is_active?: boolean;
    } | null = null;

    try {
      const { data: dbCoupon, error: couponError } = await supabase
        .from("coupons")
        .select("id, code, percent_off, amount_off_htg, max_uses, used_count, expires_at, is_active")
        .eq("code", cleanCode)
        .maybeSingle();

      if (!couponError && dbCoupon) {
        coupon = dbCoupon;
      }
    } catch {
      // Supabase unavailable, will check fallback
    }

    if (!coupon) {
      const fallback = getFallbackCoupon(cleanCode);
      if (fallback) {
        coupon = {
          id: fallback.id,
          code: fallback.code,
          percent_off: fallback.percentOff,
          amount_off_htg: fallback.amountOffHtg,
          max_uses: fallback.maxUses,
          used_count: fallback.usedCount,
          expires_at: fallback.expiresAt,
          is_active: fallback.isActive,
        };
      }
    }

    if (!coupon) {
      return NextResponse.json(
        { valid: false, error: "invalidCoupon" },
        { status: 404 }
      );
    }

    // Check if active
    if (coupon.is_active === false) {
      return NextResponse.json(
        { valid: false, error: "inactiveCoupon" },
        { status: 400 }
      );
    }

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
      return NextResponse.json(
        { valid: false, error: "expiredCoupon" },
        { status: 400 }
      );
    }

    // Check usage limits
    if (coupon.max_uses !== null && coupon.max_uses !== undefined && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json(
        { valid: false, error: "maxUsesReached" },
        { status: 400 }
      );
    }

    // 3. Compute discount
    let discountHtg = 0;
    if (coupon.percent_off) {
      discountHtg = Math.round((coursePriceHtg * coupon.percent_off) / 100);
    } else if (coupon.amount_off_htg) {
      discountHtg = Math.min(coursePriceHtg, coupon.amount_off_htg);
    }

    const newTotalHtg = Math.max(0, coursePriceHtg - discountHtg);

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      couponId: coupon.id,
      discountHtg,
      newTotalHtg,
      percentOff: coupon.percent_off,
      amountOffHtg: coupon.amount_off_htg,
    });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, error: "serverError" },
      { status: 500 }
    );
  }
}
