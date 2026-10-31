"use server";

import {createClient} from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {hashPassword} from "@/lib/auth/password";
import {queueAuthEmail} from "@/lib/email/outbox";
import {randomToken} from "@/lib/auth/tokens";

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
  locale?: "fr"|"ht";
}

/**
 * Creates a real user via user_credentials and creates an invitation token,
 * uses the generated UUID for profiles.id, assigns instructor role,
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
      .select("id, role, locale")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      createdId = existingProfile.id;
    } else {
      // Create user profile directly in profiles table (Decoupled Auth.js architecture)
      const { data: newProfile, error: profileErr } = await adminDb
        .from("profiles")
        .insert({
          email,
          full_name: name,
          role: "instructor",
          locale: input.locale === "ht" ? "ht" : "fr",
          email_verified_at: null, // Verified upon setting initial password
        })
        .select("id")
        .single();

      if (profileErr || !newProfile) {
        return {
          success: false,
          error: "profile_creation_unavailable",
        };
      }
      createdId = newProfile.id;
    }

    if(existingProfile?.role==='admin')return{success:false,error:'cannot_invite_admin'};
    if(existingProfile&&existingProfile.role!=='instructor'){
      const scoped=await createClient();
      const {error}=await scoped.rpc('set_user_role',{target_user_id:createdId,new_role:'instructor'});
      if(error)return{success:false,error:'role_assignment_unavailable'};
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
        error: 'instructor_profile_unavailable',
      };
    }

    // New accounts receive an unusable random credential until the invitation is consumed.
    const {error:credentialError}=await adminDb.from('user_credentials').upsert({user_id:createdId,password_hash:await hashPassword(randomToken()),token_version:0},{onConflict:'user_id',ignoreDuplicates:true});
    if(credentialError)return{success:false,error:'credentials_unavailable'};
    const invitation=await queueAuthEmail(email,'invitation',existingProfile?.locale??input.locale??'fr',createdId);
    if(invitation.status!=='accepted')return{success:false,instructorId:createdId,error:'invitation_pending:'+invitation.correlationId};

    // 5. Record audit log entry
    const { error: auditErr } = await adminDb.from("admin_audit_logs").insert({
      admin_id: admin.id,
      action: "instructor_created",
      note: "Création du formateur",
      metadata: {
        instructor_id: createdId,
        title,
      },
    });

    if (auditErr) {
      console.error("[email] invitation_audit_unavailable");
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

    if(typeof targetActive!=="boolean")return{success:false,error:"invalid_data"};
    const { data:updatedInstructor,error: updateErr } = await adminDb
      .from("instructors")
      .update({
        is_active: targetActive,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", instructorId).select("profile_id").single();

    if (updateErr||!updatedInstructor) {
      return {
        success: false,
        error: `Échec de mise à jour du statut formateur : ${updateErr?.message||"Formateur introuvable"}`,
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

    const {data:profile,error}=await adminDb.from('profiles').select('email,locale,role').eq('id',instructorId).maybeSingle();
    if(error||!profile||profile.role!=='instructor')return{success:false,error:'Formateur introuvable.'};
    const result=await queueAuthEmail(profile.email,'invitation',profile.locale||'fr',instructorId);
    if(result.status!=='accepted')return{success:false,error:'invitation_pending'};
    await adminDb.from('admin_audit_logs').insert({admin_id:admin.id,action:'instructor_invitation_sent',metadata:{instructor_id:instructorId}});
    return{success:true};
  } catch (err: any) {
    return { success: false, error: err.message || "Impossible d'envoyer l'invitation." };
  }
}
