"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || !can(user, "instructors.manage")) {
    throw new Error("Accès refusé : privilèges administrateur requis pour gérer les formateurs.");
  }
  return user;
}

export interface CreateInstructorInput {
  fullName: string;
  email: string;
  title: string;
  bio: string;
  escalationEmail?: string;
}

/**
 * Creates a real user in Supabase Auth via auth.admin.createUser(),
 * uses the returned UUID for profiles.id, assigns instructor role via set_user_role RPC,
 * and records the action into admin_audit_logs.
 * Never falls back to simulated data.
 */
export async function createInstructorAction(
  input: CreateInstructorInput
): Promise<{ success: boolean; instructorId?: string; error?: string }> {
  try {
    const admin = await assertAdmin();

    const name = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const title = input.title.trim();
    const bio = input.bio.trim();
    const escalationEmail = input.escalationEmail?.trim() || null;

    if (!name || name.length < 2) {
      return { success: false, error: "Le nom complet du formateur est requis." };
    }
    if (!email || !email.includes("@")) {
      return { success: false, error: "Une adresse email valide est requise." };
    }
    if (!title) {
      return { success: false, error: "Le titre ou domaine d'expertise est requis." };
    }

    const adminDb = createAdminClient();
    let createdId = "";

    // 1. Check if user already exists in profiles
    const { data: existingProfile } = await adminDb
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      createdId = existingProfile.id;
    } else {
      // Create real user in Supabase Auth
      const { data: authData, error: authErr } = await adminDb.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

      if (authErr || !authData?.user) {
        return {
          success: false,
          error: `Échec de création du compte d'authentification : ${authErr?.message || "Erreur inconnue"}`,
        };
      }
      createdId = authData.user.id;
    }

    // 2. Assign instructor role via transactional set_user_role RPC
    const { error: roleErr } = await adminDb.rpc("set_user_role", {
      target_user_id: createdId,
      new_role: "instructor",
    });

    if (roleErr) {
      return {
        success: false,
        error: `Échec d'attribution du rôle de formateur : ${roleErr.message}`,
      };
    }

    // 3. Upsert instructor details into instructors table
    const { error: instErr } = await adminDb
      .from("instructors")
      .upsert({
        profile_id: createdId,
        title,
        bio,
        escalation_email: escalationEmail,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (instErr) {
      return {
        success: false,
        error: `Échec d'enregistrement du profil formateur : ${instErr.message}`,
      };
    }

    // 4. Record audit log entry
    const { error: auditErr } = await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "instructor_created",
      note: `Création du formateur ${name} (${email})`,
      metadata: {
        instructor_id: createdId,
        email,
        title,
        escalation_email: escalationEmail,
      },
    });

    if (auditErr) {
      console.error("[Instructors] Audit log insertion error:", auditErr);
    }

    revalidatePath("/admin/formateurs");
    revalidatePath("/admin/formations");

    return { success: true, instructorId: createdId };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de création du formateur." };
  }
}

/**
 * Toggles an instructor's active state (suspend/reactivate) and logs to audit.
 */
export async function toggleInstructorActiveAction(
  instructorId: string,
  targetActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();
    const adminDb = createAdminClient();

    const { error: updateErr } = await adminDb
      .from("instructors")
      .update({
        is_active: targetActive,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", instructorId);

    if (updateErr) {
      return {
        success: false,
        error: `Échec de mise à jour du statut formateur : ${updateErr.message}`,
      };
    }

    await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: targetActive ? "instructor_reactivated" : "instructor_suspended",
      note: `Statut formateur ${instructorId} modifié: ${targetActive ? "Actif" : "Suspendu"}`,
      metadata: { instructor_id: instructorId, is_active: targetActive },
    });

    revalidatePath("/admin/formateurs");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible de modifier le statut du formateur." };
  }
}

/**
 * Assigns or reassigns a course to an instructor and logs to audit logs.
 */
export async function reassignCourseInstructorAction(
  courseId: string,
  newInstructorId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await assertAdmin();
    const adminDb = createAdminClient();

    const { error: updateErr } = await adminDb
      .from("courses")
      .update({ instructor_id: newInstructorId })
      .eq("id", courseId);

    if (updateErr) {
      return {
        success: false,
        error: `Échec de réassignation du formateur : ${updateErr.message}`,
      };
    }

    await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "course_instructor_reassigned",
      note: note?.trim() || `Cours ${courseId} réassigné au formateur ${newInstructorId}`,
      metadata: { course_id: courseId, new_instructor_id: newInstructorId },
    });

    revalidatePath("/admin/formateurs");
    revalidatePath("/admin/formations");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible de réassigner le formateur." };
  }
}

/**
 * Sends or generates an invitation link with set-password instructions for an instructor.
 */
export async function sendInstructorInvitationAction(
  instructorId: string
): Promise<{ success: boolean; invitationUrl?: string; error?: string }> {
  try {
    const admin = await assertAdmin();
    const adminDb = createAdminClient();

    // Check that target exists
    const { data: profile } = await adminDb
      .from("profiles")
      .select("email")
      .eq("id", instructorId)
      .maybeSingle();

    if (!profile) {
      return { success: false, error: "Formateur introuvable." };
    }

    await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "instructor_invitation_sent",
      note: `Lien d'invitation généré pour le formateur ${instructorId}`,
      metadata: { instructor_id: instructorId, email: profile.email },
    });

    const resetToken = Buffer.from(`${instructorId}-${Date.now()}`).toString("base64");
    const invitationUrl = `/fr/reinitialiser-mot-de-passe?token=${resetToken}&mode=invite`;

    return {
      success: true,
      invitationUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible d'envoyer l'invitation." };
  }
}
