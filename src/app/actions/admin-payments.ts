"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { maskSensitiveData } from "@/lib/payments/mask";
import { revalidatePath } from "next/cache";

/**
 * Asserts that the current user has the 'admin' role.
 */
async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Accès refusé : rôle administrateur requis.");
  }
  return user;
}

/**
 * Optional notification dispatch stub.
 * Sends email or SMS behind an env flag without breaking if unconfigured.
 */
async function notifyStudent(studentPhone: string, studentEmail: string, message: string) {
  if (process.env.ENABLE_NOTIFICATION_DISPATCH === "true") {
    console.log(`[Notification Hook] Dispatching alert to ${studentPhone || studentEmail}: ${message}`);
  }
}

/**
 * Validates an awaiting payment manually.
 * Enforces:
 * 1. Admin permission check.
 * 2. Idempotency (validating twice never creates duplicate enrollments).
 * 3. Duplicate transaction ID check across validated payments.
 * 4. Audit log entry generation.
 * 5. Automatic order completion and enrollment via DB trigger.
 */
export async function validatePaymentAction(
  paymentId: string,
  internalNote?: string
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();

    const adminDb = createAdminClient();

    // 1. Fetch current payment details
    const { data: payment, error: fetchErr } = await adminDb
      .from("payments")
      .select(`
        id,
        order_id,
        provider,
        provider_txn_id,
        payer_phone,
        status,
        orders (
          id,
          reference,
          amount_htg,
          status,
          user_id,
          course_id,
          profiles (
            full_name,
            phone,
            email
          )
        )
      `)
      .eq("id", paymentId)
      .single();

    if (fetchErr || !payment) {
      return { success: false, error: "Paiement introuvable." };
    }

    const order = payment.orders as any;
    if (!order) {
      return { success: false, error: "Commande associée introuvable." };
    }

    // Idempotency: If already validated or order already paid
    if (payment.status === "validated" || order.status === "paid") {
      return { success: true };
    }

    // Check duplicate transaction ID beforehand to provide user-friendly error
    if (payment.provider_txn_id && payment.provider_txn_id.trim() !== "") {
      const { data: conflict } = await adminDb
        .from("payments")
        .select("id, order_id, orders(reference)")
        .eq("provider_txn_id", payment.provider_txn_id.trim())
        .eq("status", "validated")
        .neq("id", paymentId)
        .maybeSingle();

      if (conflict) {
        const orderRef = (conflict.orders as any)?.reference || conflict.order_id;
        return {
          success: false,
          duplicate: true,
          error: `Opération bloquée : ce code de transaction (${payment.provider_txn_id}) est déjà associé à la commande validée #${orderRef}.`,
        };
      }
    }

    // Call atomic transactional RPC
    const sanitizedMetadata = maskSensitiveData({
      validated_manually: true,
      admin_id: admin.id,
      admin_email: admin.email,
      validated_at: new Date().toISOString(),
    });

    const { data: rpcResult, error: rpcErr } = await adminDb.rpc(
      "validate_payment_transactional",
      {
        p_payment_id: paymentId,
        p_provider_txn_id: payment.provider_txn_id,
        p_expected_amount_htg: order.amount_htg,
        p_admin_id: admin.id,
        p_note: internalNote?.trim() || "Validation manuelle administrateur",
        p_metadata: sanitizedMetadata,
      }
    );

    if (rpcErr) {
      if (rpcErr.message.includes("DUPLICATE_TRANSACTION_ID")) {
        return {
          success: false,
          duplicate: true,
          error: `Opération bloquée : ce code de transaction est déjà utilisé sur une autre commande.`,
        };
      }
      return { success: false, error: rpcErr.message };
    }

    // Optional notification dispatch
    const studentProfile = order.profiles;
    await notifyStudent(
      studentProfile?.phone || payment.payer_phone,
      studentProfile?.email,
      `Votre paiement pour la commande ${order.reference} a été validé.`
    );

    revalidatePath("/admin/paiements");
    revalidatePath("/admin");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de validation." };
  }
}

/**
 * Rejects an awaiting payment with a mandatory reason.
 */
export async function rejectPaymentAction(
  paymentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: "Un motif de rejet d'au moins 3 caractères est obligatoire." };
    }

    const supabase = await createClient();
    const adminDb = createAdminClient();

    const { data: payment, error: fetchErr } = await supabase
      .from("payments")
      .select("id, order_id, orders(reference, profiles(phone, email))")
      .eq("id", paymentId)
      .single();

    if (fetchErr || !payment) {
      return { success: false, error: "Paiement introuvable." };
    }

    // 1. Update payment status to 'failed' with rejection reason
    const { error: updateErr } = await adminDb
      .from("payments")
      .update({
        status: "failed",
        rejection_reason: reason.trim(),
      })
      .eq("id", paymentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Also mark order as failed
    await adminDb
      .from("orders")
      .update({ status: "failed" })
      .eq("id", payment.order_id);

    // 2. Write audit log entry
    await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "payment_rejected",
      payment_id: paymentId,
      note: reason.trim(),
      metadata: maskSensitiveData({
        reason: reason.trim(),
        order_reference: (payment.orders as any)?.reference,
        admin_email: admin.email,
        rejected_at: new Date().toISOString(),
      }),
    });

    // 3. Notify student
    const studentProfile = (payment.orders as any)?.profiles;
    await notifyStudent(
      studentProfile?.phone,
      studentProfile?.email,
      `Votre paiement a été rejeté. Motif : ${reason.trim()}`
    );

    revalidatePath("/admin/paiements");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors du rejet." };
  }
}

/**
 * Checks if a transaction ID conflicts with an already validated payment.
 */
export async function checkDuplicateTxnAction(
  providerTxnId: string,
  currentPaymentId: string
): Promise<{ isDuplicate: boolean; conflictingOrderRef?: string }> {
  try {
    await assertAdmin();

    if (!providerTxnId || providerTxnId.trim() === "") {
      return { isDuplicate: false };
    }

    const supabase = await createClient();
    const { data: conflict } = await supabase
      .from("payments")
      .select("id, order_id, orders(reference)")
      .eq("provider_txn_id", providerTxnId.trim())
      .eq("status", "validated")
      .neq("id", currentPaymentId)
      .maybeSingle();

    if (conflict) {
      return {
        isDuplicate: true,
        conflictingOrderRef: (conflict.orders as any)?.reference || conflict.order_id,
      };
    }

    return { isDuplicate: false };
  } catch {
    return { isDuplicate: false };
  }
}
