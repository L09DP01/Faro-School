import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentId } = await params;

    // 1. Verify requesting user is admin
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé. Authentification administrateur requise." },
        { status: 401 }
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Accès refusé. Rôle administrateur requis." },
        { status: 403 }
      );
    }

    // 2. Fetch payment and order info
    const adminDb = createAdminClient();
    const { data: payment, error: fetchErr } = await adminDb
      .from("payments")
      .select(`
        id,
        order_id,
        provider,
        provider_txn_id,
        status,
        orders (
          id,
          reference,
          amount_htg,
          user_id,
          course_id
        )
      `)
      .eq("id", paymentId)
      .single();

    if (fetchErr || !payment) {
      return NextResponse.json(
        { error: "Enregistrement de paiement introuvable." },
        { status: 404 }
      );
    }

    // Idempotency check: If already validated, return success immediately
    if (payment.status === "validated") {
      return NextResponse.json({
        success: true,
        message: "Paiement déjà validé.",
        paymentId,
      });
    }

    // 3. Duplicate Transaction ID Guard
    if (payment.provider_txn_id && payment.provider_txn_id.trim() !== "") {
      const { data: conflict } = await adminDb
        .from("payments")
        .select("id, order_id, orders(reference)")
        .eq("provider_txn_id", payment.provider_txn_id.trim())
        .eq("status", "validated")
        .neq("id", paymentId)
        .maybeSingle();

      if (conflict) {
        const conflictingRef = (conflict.orders as any)?.reference || conflict.order_id;
        return NextResponse.json(
          {
            error: "Transaction en double détectée.",
            message: `Ce code de transaction (${payment.provider_txn_id}) a déjà été validé pour la commande #${conflictingRef}.`,
            duplicate: true,
          },
          { status: 409 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const internalNote = body.note || null;
    const now = new Date().toISOString();

    // 4. Update payment record to 'validated'
    // Note: The database trigger `handle_payment_validation` automatically
    // marks orders.status = 'paid' and creates the enrollment idempotently!
    const { data: updatedPayment, error: updateError } = await adminDb
      .from("payments")
      .update({
        status: "validated",
        validated_by: user.id,
        validated_at: now,
      })
      .eq("id", paymentId)
      .select("id, order_id, status, provider, validated_by, validated_at")
      .single();

    if (updateError || !updatedPayment) {
      return NextResponse.json(
        { error: "Impossible de valider le paiement.", details: updateError?.message },
        { status: 500 }
      );
    }

    // 5. Write audit log entry
    await adminDb.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "payment_validated",
      payment_id: paymentId,
      note: internalNote,
      metadata: {
        provider: payment.provider,
        provider_txn_id: payment.provider_txn_id,
        amount_htg: (payment.orders as any)?.amount_htg,
        order_reference: (payment.orders as any)?.reference,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Paiement validé avec succès. Déclencheur d'inscription exécuté.",
      payment: updatedPayment,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erreur serveur lors de la validation.", message: error?.message },
      { status: 500 }
    );
  }
}
