"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";
import { toggleFallbackMessageRead, deleteFallbackMessage } from "@/lib/admin/messages";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Accès refusé : rôle administrateur requis.");
  }
  return user;
}

export async function toggleMessageReadAction(messageId: string, read: boolean) {
  await assertAdmin();

  try {
    const supabase = await createClient();
    await supabase
      .from("contact_messages")
      .update({
        read,
        read_at: read ? new Date().toISOString() : null,
      })
      .eq("id", messageId);
  } catch (err: any) {
    console.warn("Supabase toggle message read error:", err?.message);
  }

  toggleFallbackMessageRead(messageId, read);
  revalidatePath("/[locale]/admin/messages", "page");
  return { success: true };
}

export async function deleteMessageAction(messageId: string) {
  const admin = await assertAdmin();

  try {
    const supabase = await createClient();
    await supabase.from("contact_messages").delete().eq("id", messageId);

    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: "delete_contact_message",
        metadata: { message_id: messageId },
      });
    } catch {
      // Non-critical
    }
  } catch (err: any) {
    console.warn("Supabase delete message error:", err?.message);
  }

  deleteFallbackMessage(messageId);
  revalidatePath("/[locale]/admin/messages", "page");
  return { success: true };
}
