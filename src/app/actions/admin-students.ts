"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { revalidatePath } from "next/cache";
import { grantFallbackEnrollment, revokeFallbackEnrollment } from "@/lib/admin/students";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Accès refusé : rôle administrateur requis.");
  }
  return user;
}

export async function grantCourseAccessAction(
  studentId: string,
  courseId: string,
  note?: string
) {
  const admin = await assertAdmin();

  if (!studentId || !courseId) {
    return { success: false, error: "Identifiant étudiant et formation requis." };
  }

  const cleanNote = note?.trim() || "Accès accordé manuellement par l'administrateur";

  try {
    const supabase = await createClient();

    // 1. Insert enrollment into database (on conflict do nothing)
    const { error: enrollError } = await supabase.from("enrollments").upsert(
      {
        user_id: studentId,
        course_id: courseId,
        note: cleanNote,
        granted_by: admin.id,
      },
      { onConflict: "user_id,course_id" }
    );

    if (enrollError) {
      console.warn("Supabase manual enrollment error:", enrollError.message);
    }

    // 2. Audit log entry
    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: "grant_course_access",
        user_id: studentId,
        course_id: courseId,
        note: cleanNote,
        metadata: { student_id: studentId, course_id: courseId, granted_at: new Date().toISOString() },
      });
    } catch (auditErr: any) {
      console.warn("Audit log error:", auditErr?.message);
    }
  } catch (err: any) {
    console.warn("Grant course access error:", err?.message);
  }

  // 3. Sync with in-memory fallback store
  grantFallbackEnrollment(studentId, courseId, cleanNote);

  // 4. Revalidate cache
  revalidatePath("/[locale]/admin/eleves", "page");
  revalidatePath("/[locale]/dashboard", "page");
  revalidatePath("/[locale]/dashboard/formations", "page");

  return { success: true };
}

export async function revokeCourseAccessAction(
  studentId: string,
  courseId: string,
  reason?: string
) {
  const admin = await assertAdmin();

  if (!studentId || !courseId) {
    return { success: false, error: "Identifiant étudiant et formation requis." };
  }

  const cleanReason = reason?.trim() || "Accès révoqué par l'administrateur";

  try {
    const supabase = await createClient();

    // 1. Delete enrollment from database
    const { error: delError } = await supabase
      .from("enrollments")
      .delete()
      .match({ user_id: studentId, course_id: courseId });

    if (delError) {
      console.warn("Supabase revoke enrollment error:", delError.message);
    }

    // 2. Audit log entry
    try {
      await supabase.from("admin_audit_logs").insert({
        admin_id: admin.id,
        action: "revoke_course_access",
        user_id: studentId,
        course_id: courseId,
        note: cleanReason,
        metadata: { student_id: studentId, course_id: courseId, revoked_at: new Date().toISOString() },
      });
    } catch (auditErr: any) {
      console.warn("Audit log error:", auditErr?.message);
    }
  } catch (err: any) {
    console.warn("Revoke course access error:", err?.message);
  }

  // 3. Sync with in-memory fallback store
  revokeFallbackEnrollment(studentId, courseId);

  // 4. Revalidate cache
  revalidatePath("/[locale]/admin/eleves", "page");
  revalidatePath("/[locale]/dashboard", "page");
  revalidatePath("/[locale]/dashboard/formations", "page");

  return { success: true };
}
