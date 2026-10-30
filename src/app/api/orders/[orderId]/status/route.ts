import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // 1. Guard: Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    // 2. Fetch order
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id,
        reference,
        amount_htg,
        status,
        user_id,
        payments (
          id,
          provider,
          status
        )
      `)
      .eq("id", orderId)
      .maybeSingle();

    // Guard: Order ownership check
    if (error || !order || order.user_id !== user.id) {
      return NextResponse.json(
        { error: "Commande introuvable" },
        { status: 404 }
      );
    }

    const paymentsList = Array.isArray(order.payments) ? order.payments : [];
    const hasValidatedPayment = paymentsList.some(
      (p) => p.status === "validated"
    );
    const hasAwaitingPayment = paymentsList.some(
      (p) => p.status === "awaiting_validation"
    );
    const hasFailedPayment = paymentsList.some(
      (p) => p.status === "failed"
    );

    const isPaid = order.status === "paid" || hasValidatedPayment;
    const isAwaiting = !isPaid && (hasAwaitingPayment || order.status === "pending");
    const isFailed = !isPaid && !isAwaiting && (order.status === "failed" || order.status === "cancelled" || hasFailedPayment);

    return NextResponse.json({
      orderId: order.id,
      reference: order.reference,
      orderStatus: order.status,
      isPaid,
      isAwaiting,
      isFailed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}
