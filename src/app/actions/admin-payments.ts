"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
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

    const supabase = await createClient();
    const adminDb = createAdminClient();

    // 1. Fetch current payment details
    const { data: payment, error: fetchErr } = await supabase
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

    // Idempotency: If already validated, return success immediately
    if (payment.status === "validated") {
      return { success: true };
    }

    // 2. Duplicate Transaction ID Guard
    // Check if the same provider_txn_id was already validated for another order
    if (payment.provider_txn_id && payment.provider_txn_id.trim() !== "") {
      const { data: conflict } = await supabase
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

    const now = new Date().toISOString();

    // 3. Update payment status to 'validated'
    const { error: updateErr } = await adminDb
      .from("payments")
      .update({
        status: "validated",
        validated_by: admin.id,
        validated_at: now,
      })
      .eq("id", paymentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 4. Write audit log entry
    await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "payment_validated",
      payment_id: paymentId,
      note: internalNote?.trim() || null,
      metadata: {
        provider: payment.provider,
        provider_txn_id: payment.provider_txn_id,
        amount_htg: (payment.orders as any)?.amount_htg,
        order_reference: (payment.orders as any)?.reference,
      },
    });

    // 5. Optional notification stub
    const studentProfile = (payment.orders as any)?.profiles;
    await notifyStudent(
      studentProfile?.phone || payment.payer_phone,
      studentProfile?.email,
      `Votre paiement pour la commande ${(payment.orders as any)?.reference} a été validé.`
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
      metadata: {
        reason: reason.trim(),
        order_reference: (payment.orders as any)?.reference,
      },
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
