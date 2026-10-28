import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider, type PaymentMethod } from "@/lib/payments";
import { validateAndFormatHaitianPhone } from "@/lib/validators/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "edge";

const createPaymentSchema = z.object({
  courseId: z.string().uuid("Identifiant de formation invalide"),
  provider: z.enum(["moncash", "natcash", "kobara"] as const),
  payerPhone: z.string().optional(),
  couponCode: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Rate limit: 10 payment initiation attempts per 10 minutes per IP
    const rateLimit = checkRateLimit(`checkout:${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit", message: "Trop de tentatives de paiement. Veuillez patienter avant de réessayer." },
        { status: 429 }
      );
    }

    const json = await request.json();
    const result = createPaymentSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Requête invalide", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { courseId, provider, payerPhone, couponCode, locale = "fr" } =
      result.data;

    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise pour effectuer un achat" },
        { status: 401 }
      );
    }

    // 2. Fetch course price from database (CRITICAL: never trust client amount)
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title_fr, title_ht, price_htg, status")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { error: "Formation introuvable" },
        { status: 404 }
      );
    }

    if (course.status !== "published") {
      return NextResponse.json(
        { error: "Cette formation n'est pas disponible actuellement" },
        { status: 400 }
      );
    }

    // 3. Verify user is not already enrolled
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "alreadyEnrolled", message: "Vous êtes déjà inscrit à cette formation" },
        { status: 400 }
      );
    }

    // 4. Compute final amount and validate coupon
    let finalAmountHtg = course.price_htg;
    let couponId: string | null = null;

    if (couponCode && couponCode.trim().length > 0) {
      const cleanCode = couponCode.trim().toUpperCase();
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id, code, percent_off, amount_off_htg, max_uses, used_count, expires_at")
        .eq("code", cleanCode)
        .maybeSingle();

      if (coupon) {
        const notExpired =
          !coupon.expires_at || new Date(coupon.expires_at) > new Date();
        const usesAvailable =
          coupon.max_uses === null || coupon.used_count < coupon.max_uses;

        if (notExpired && usesAvailable) {
          couponId = coupon.id;
          if (coupon.percent_off) {
            const discount = Math.round(
              (finalAmountHtg * coupon.percent_off) / 100
            );
            finalAmountHtg = Math.max(0, finalAmountHtg - discount);
          } else if (coupon.amount_off_htg) {
            finalAmountHtg = Math.max(0, finalAmountHtg - coupon.amount_off_htg);
          }
        } else {
          return NextResponse.json(
            { error: "couponInvalid", message: "Code coupon expiré ou limite d'utilisations atteinte." },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "couponInvalid", message: "Code coupon introuvable." },
          { status: 400 }
        );
      }
    }

    // 5. Order Idempotency: Reuse pending order if one exists for this user and course
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, reference, amount_htg, status")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let order: { id: string; reference: string; amount_htg: number; status: string };

    if (existingOrder) {
      // Update amount & coupon on existing pending order
      await supabase
        .from("orders")
        .update({
          amount_htg: finalAmountHtg,
          coupon_id: couponId,
        })
        .eq("id", existingOrder.id);
      order = {
        ...existingOrder,
        amount_htg: finalAmountHtg,
      };
    } else {
      // Create new unique order reference
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const reference = `LA-${timestamp}-${randomSuffix}`;

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          course_id: course.id,
          amount_htg: finalAmountHtg,
          coupon_id: couponId,
          status: "pending",
          reference,
        })
        .select("id, reference, amount_htg, status")
        .single();

      if (orderError || !newOrder) {
        return NextResponse.json(
          { error: "Échec de création de la commande", details: orderError?.message },
          { status: 500 }
        );
      }
      order = newOrder;
    }

    // Normalize phone number if supplied
    let formattedPhone = payerPhone || null;
    if (payerPhone) {
      const checkPhone = validateAndFormatHaitianPhone(payerPhone);
      if (checkPhone.isValid) {
        formattedPhone = checkPhone.formatted;
      }
    }

    // =========================================================================
    // Automated Flow via Kobara Gateway (MonCash & NatCash)
    // =========================================================================
    const paymentMethod: PaymentMethod =
      provider === "natcash" ? "natcash" : "moncash";

    // Initialize payment entry in pending state
    const { data: paymentRecord, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider: paymentMethod,
        payer_phone: formattedPhone,
        status: "pending",
        raw: {
          gateway: "kobara",
          selected_provider: paymentMethod,
          initiated_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (paymentError || !paymentRecord) {
      return NextResponse.json(
        { error: "Échec d'initialisation du paiement", details: paymentError?.message },
        { status: 500 }
      );
    }

    // Profile for customer metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    // Call Kobara provider with chosen channel (MonCash or NatCash)
    const kobara = getPaymentProvider();
    const resultPayment = await kobara.createPayment(
      {
        orderId: order.id,
        reference: order.reference,
        amountHtg: order.amount_htg,
        courseId: course.id,
        courseTitle: course.title_fr,
        userId: user.id,
        customerName: profile?.full_name || user.email?.split("@")[0] || "Étudiant",
        customerEmail: user.email || undefined,
        payerPhone: formattedPhone || profile?.phone || undefined,
      },
      paymentMethod
    );

    // Update payment record with provider payment ID
    if (resultPayment.kobaraPaymentId) {
      await supabase
        .from("payments")
        .update({
          provider_txn_id: resultPayment.kobaraPaymentId,
        })
        .eq("id", paymentRecord.id);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: paymentRecord.id,
      reference: order.reference,
      provider: paymentMethod,
      status: "pending",
      redirectUrl: resultPayment.redirectUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Traitement du paiement échoué", message: error?.message || "Erreur inconnue" },
      { status: 500 }
    );
  }
}
