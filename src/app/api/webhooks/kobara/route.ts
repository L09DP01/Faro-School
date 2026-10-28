import { NextRequest, NextResponse } from "next/server";
import { KobaraProvider } from "@/lib/payments/kobara";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-kobara-signature") || "";

    const kobara = new KobaraProvider();
    const isValid = await kobara.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event || event.type;
    const paymentData = event.data || event.payload || event;

    const supabaseAdmin = createAdminClient();

    if (eventType === "payment.succeeded" || eventType === "payment.validated") {
      const orderId =
        paymentData.metadata?.order_id ||
        paymentData.order_id ||
        paymentData.reference;
      const paymentId = paymentData.id || paymentData.payment_id;

      let query = supabaseAdmin.from("payments").select("id, order_id");

      if (orderId) {
        query = query.eq("order_id", orderId);
      } else if (paymentId) {
        query = query.eq("provider_txn_id", paymentId);
      }

      const { data: payments } = await query
        .order("created_at", { ascending: false })
        .limit(1);

      const targetPayment = payments?.[0];

      if (targetPayment) {
        // Updating to 'validated' activates PostgreSQL trigger to enroll student
        await supabaseAdmin
          .from("payments")
          .update({
            status: "validated",
            provider_txn_id: paymentId,
            raw: {
              webhook_received_at: new Date().toISOString(),
              event: eventType,
              payload: paymentData,
            },
          })
          .eq("id", targetPayment.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Webhook processing error", message: error?.message },
      { status: 400 }
    );
  }
}
