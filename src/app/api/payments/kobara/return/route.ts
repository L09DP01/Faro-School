import { NextRequest, NextResponse } from "next/server";
import { KobaraProvider } from "@/lib/payments/kobara";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get("orderId") || searchParams.get("order_id");
  const reference = searchParams.get("reference") || "";
  const paymentId = searchParams.get("paymentId") || searchParams.get("payment_id") || "";
  const statusParam = searchParams.get("status");

  if (!orderId && !reference) {
    return NextResponse.redirect(
      new URL("/fr?error=missing_payment_ref", request.url)
    );
  }

  const supabaseAdmin = createAdminClient();

  // If user cancelled on Kobara
  if (statusParam === "cancelled") {
    return NextResponse.redirect(
      new URL(`/fr/confirmation/${orderId}?status=cancelled`, request.url)
    );
  }

  // If simulation or provider reports failure
  if (statusParam === "failed") {
    if (orderId) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("order_id", orderId);
      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", orderId);
    }
    return NextResponse.redirect(
      new URL(`/fr/confirmation/${orderId}?status=failed`, request.url)
    );
  }

  // Verify payment status with Kobara
  const kobara = new KobaraProvider();
  const verifiedStatus = await kobara.verifyPayment(paymentId || reference);

  if (verifiedStatus === "validated") {
    // Find payment record
    let paymentQuery = supabaseAdmin.from("payments").select("id, order_id");

    if (orderId) {
      paymentQuery = paymentQuery.eq("order_id", orderId);
    }

    const { data: payments } = await paymentQuery
      .order("created_at", { ascending: false })
      .limit(1);

    const targetPayment = payments?.[0];

    if (targetPayment) {
      // Setting status = 'validated' executes the PostgreSQL trigger
      // which auto-enrolls the student and marks order.status = 'paid'
      await supabaseAdmin
        .from("payments")
        .update({
          status: "validated",
          provider_txn_id: paymentId || `kbr_${Date.now()}`,
          raw: {
            verified_at: new Date().toISOString(),
            gateway: "kobara",
            payment_id: paymentId,
            reference,
            is_mock: kobara.isMock,
          },
        })
        .eq("id", targetPayment.id);
    }

    const confirmedOrderId = targetPayment?.order_id || orderId;
    return NextResponse.redirect(
      new URL(
        `/fr/confirmation/${confirmedOrderId}?status=success`,
        request.url
      )
    );
  }

  return NextResponse.redirect(
    new URL(`/fr/confirmation/${orderId}?status=failed`, request.url)
  );
}
