import {processOutbox} from "@/lib/email/outbox";
import { NextRequest, NextResponse } from "next/server";
import { KobaraProvider } from "@/lib/payments/kobara";
import { createAdminClient } from "@/lib/supabase/admin";
import { maskSensitiveData } from "@/lib/payments/mask";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("kobara-signature") ||
      request.headers.get("x-kobara-signature") ||
      request.headers.get("x-signature") ||
      "";
    const timestamp =
      request.headers.get("kobara-timestamp") ||
      request.headers.get("x-kobara-timestamp") ||
      request.headers.get("x-timestamp") ||
      null;

    const kobara = new KobaraProvider();

    // 1. Verify signature on RAW body before any JSON parsing
    let isValid = false;
    try {
      isValid = await kobara.verifyWebhookSignature(rawBody, signature, timestamp);
    } catch (err: any) {
      console.error("[Kobara Webhook] Verification error:", err?.message);
      return NextResponse.json(
        { error: "Webhook verification rejected", message: err?.message },
        { status: 500 }
      );
    }

    if (!isValid) {
      console.warn("[Kobara Webhook] Invalid signature received.");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // 2. Parse JSON only after signature has been verified
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const eventType = event.event_type || event.event || event.type || "";
    const paymentData = event.data || event.payload || event;
    const environment=request.headers.get('kobara-environment');
    if(environment!==(process.env.KOBARA_MODE||'live')||event.environment!==environment||paymentData.environment!==environment)
      return NextResponse.json({error:'environment_mismatch'},{status:400});
    if(request.headers.get('kobara-event')&&request.headers.get('kobara-event')!==eventType)return NextResponse.json({error:'event_mismatch'},{status:400});


    const providerTxnId =
      paymentData.id || paymentData.payment_id || paymentData.transaction_id;
    const orderReference =
      paymentData.metadata?.order_id ||
      paymentData.metadata?.reference ||
      paymentData.order_id ||
      paymentData.reference;

    // 3. Strict rejection of events missing provider_transaction_id or order_reference
    if (!providerTxnId) {
      console.error("[Kobara Webhook] Rejected: Missing required identifiers", {
        hasProviderTxnId: Boolean(providerTxnId),
        hasOrderReference: Boolean(orderReference),
      });
      return NextResponse.json(
        {
          error:
            "Missing required provider_transaction_id or order_reference in webhook payload",
        },
        { status: 400 }
      );
    }

    const currency = String(paymentData.currency || "").toUpperCase();
    if (currency !== "HTG") {
      console.error(`[Kobara Webhook] Rejected: Unsupported currency ${currency}`);
      return NextResponse.json(
        { error: "Invalid currency. Only HTG is supported." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Bind the provider transaction to the persisted payment first. Kobara's public
    // reference is not our order reference; metadata may be absent in a webhook.
    const {data:binding,error:bindingError}=await supabaseAdmin.from('payments').select('id,order_id,provider,status,provider_txn_id').eq('provider_txn_id',String(providerTxnId)).maybeSingle();
    if(bindingError||!binding)return NextResponse.json({error:'payment_not_bound'},{status:404});
    const orderQuery=supabaseAdmin.from('orders').select('id, reference, amount_htg, status, user_id, course_id').eq('id',binding.order_id);

    const { data: order, error: orderErr } = await orderQuery.maybeSingle();

    if (orderErr || !order) {
      console.error(
        `[Kobara Webhook] Order not found for reference: ${orderReference}`
      );
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // 5. Find target payment for this specific order
    const { data: payments, error: paymentErr } = await supabaseAdmin
      .from("payments")
      .select("id, status, provider, provider_txn_id")
      .eq("order_id", order.id);

    if (paymentErr || !payments || payments.length === 0) {
      console.error(
        `[Kobara Webhook] No payment found for order: ${order.id}`
      );
      return NextResponse.json(
        { error: "Payment record not found for order" },
        { status: 404 }
      );
    }

    const targetPayment=payments.find(p=>p.id===binding.id && p.provider_txn_id===String(providerTxnId));
    if(!targetPayment || paymentData.provider!==binding.provider)return NextResponse.json({error:'payment_mismatch'},{status:400});
    if(paymentData.metadata?.order_id && paymentData.metadata.order_id!==order.id)return NextResponse.json({error:'order_mismatch'},{status:400});

    // 6. Idempotency: If already validated, return 200 immediately
    if (targetPayment.status === "validated" || order.status === "paid") {
      return NextResponse.json({
        received: true,
        already_processed: true,
        orderId: order.id,
      });
    }

    // 7. Process payment events
    if (
      eventType === "payment.succeeded" ||
      eventType === "payment.validated" ||
      eventType === "charge.success"
    ) {
      const expectedAmount=Number(paymentData.amount ?? paymentData.amount_htg);
      if(!Number.isSafeInteger(expectedAmount)||expectedAmount!==Number(order.amount_htg))return NextResponse.json({error:'amount_mismatch'},{status:400});

      // Mask sensitive metadata (remove tokens, mask phone numbers)
      const sanitizedMetadata = maskSensitiveData({
        webhook_received_at: new Date().toISOString(),
        event: eventType,
        provider_txn_id: String(providerTxnId),
        order_reference: order.reference,
        amount_htg: expectedAmount,
        currency,
      });

      // Execute single transactional RPC
      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
        "validate_payment_transactional",
        {
          p_payment_id: targetPayment.id,
          p_provider_txn_id: String(providerTxnId),
          p_expected_amount_htg: expectedAmount,
          p_admin_id: null,
          p_note: "Kobara Webhook validation",
          p_metadata: sanitizedMetadata,
        }
      );

      if (rpcError) {
        console.error(
          "[Kobara Webhook] Transactional RPC execution failed:",
          rpcError
        );
        return NextResponse.json(
          { error: "Payment validation failed", message: rpcError.message },
          { status: 500 }
        );
      }

      const mail=await processOutbox().catch(()=>[]);
      if(mail.some(r=>r.status!=="accepted"))console.warn("[email] payment_notification_pending");
      return NextResponse.json({
        received: true,
        validated: true,
        orderId: order.id,
      });
    }

    if (
      eventType === "payment.failed" ||
      eventType === "payment.cancelled" ||
      eventType === "charge.failed"
    ) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          rejection_reason: `Provider event: ${eventType}`,
          raw: maskSensitiveData({
            event: eventType,
            failed_at: new Date().toISOString(),
          }),
        })
        .eq("id", targetPayment.id);

      await supabaseAdmin
        .from("orders")
        .update({ status: "failed" })
        .eq("id", order.id);

      return NextResponse.json({
        received: true,
        status: "failed",
        orderId: order.id,
      });
    }

    // Acknowledged unhandled event
    return NextResponse.json({ received: true, unhandled: eventType });
  } catch (error: any) {
    console.error("[Kobara Webhook] Processing error:", error?.message);
    return NextResponse.json(
      { error: "Webhook processing error", message: error?.message },
      { status: 400 }
    );
  }
}
