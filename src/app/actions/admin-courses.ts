"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { can } from "@/lib/permissions";
import {
  adminCourseZodSchema,
  validateCourseForPublish,
  type AdminCourseFormData,
} from "@/lib/admin/course-types";
import { revalidatePath } from "next/cache";

/**
 * Asserts that the current user has permission to manage courses.
 */
async function assertCourseManager() {
  const user = await getCurrentUser();
  if (!user || !can(user, "course.manage")) {
    throw new Error("Accès refusé : rôle formateur ou administrateur requis.");
  }
  return user;
}

/**
 * Saves a course (either as draft or published).
 */
export async function saveCourseAction(
  rawFormData: AdminCourseFormData,
  publish: boolean = false
): Promise<{ success: boolean; courseId?: string; slug?: string; error?: string }> {
  try {
    const user = await assertCourseManager();

    const parseResult = adminCourseZodSchema.safeParse(rawFormData);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Données invalides.";
      return { success: false, error: firstError };
    }

    const data = parseResult.data;
    const supabase = await createClient();

    let courseId = data.id;
    let existingInstructorId: string | null = null;

    if (courseId) {
      const { data: existingCourse } = await supabase
        .from("courses")
        .select("id, instructor_id")
        .eq("id", courseId)
        .single();

      if (existingCourse) {
        existingInstructorId = existingCourse.instructor_id;
        if (!can(user, "course.manage", { instructor_id: existingInstructorId })) {
          return { success: false, error: "Vous ne pouvez pas modifier la formation d'un autre formateur." };
        }
      }
    }

    // If publishing, enforce strict publication checklist and ownership check
    if (publish) {
      const pubCheck = validateCourseForPublish(data);
      if (!pubCheck.valid) {
        return {
          success: false,
          error: pubCheck.errors.join(" "),
        };
      }

      const targetInstructorId = courseId
        ? existingInstructorId
        : (user.role === "instructor" ? user.id : (data.instructorId || user.id));

      if (!can(user, "course.publish", { instructor_id: targetInstructorId })) {
        return {
          success: false,
          error: "Vous ne possédez pas les droits nécessaires pour publier ce cours.",
        };
      }
      data.status = "published";
    }

    // Determine final instructor_id
    let finalInstructorId = existingInstructorId;
    if (user.role === "admin") {
      if (data.instructorId !== undefined) {
        finalInstructorId = data.instructorId;
      } else if (!courseId) {
        finalInstructorId = user.id;
      }
    } else if (user.role === "instructor") {
      finalInstructorId = user.id;
    }

    // Certificate thresholds are an administrator decision. Preserve them for instructors.
    let certificateFields: Record<string, unknown> = {};
    if (can(user, "certificates.manage")) certificateFields={certificate_enabled:data.certificateEnabled,certificate_min_progress:data.certificateMinProgress};

    // 1. Upsert Course
    if (courseId) {
      // Update
      const { error: courseErr } = await supabase
        .from("courses")
        .update({
          slug: data.slug,
          title_fr: data.titleFr,
          title_ht: data.titleHt || "",
          description_fr: data.descriptionFr || "",
          description_ht: data.descriptionHt || "",
          price_htg: data.priceHtg,
          compare_price_htg: data.comparePriceHtg,
          level: data.level,
          category: data.category,
          cover_url: data.coverUrl || null,
          status: data.status,
          options: data.options,
          ...certificateFields,
          instructor_id: finalInstructorId,
        })
        .eq("id", courseId);

      if (courseErr) {
        if (courseErr.code === "23505") {
          return { success: false, error: "Cet identifiant URL (slug) est déjà utilisé par une autre formation." };
        }
        return { success: false, error: courseErr.message };
      }
    } else {
      // Insert
      const { data: newCourse, error: insertErr } = await supabase
        .from("courses")
        .insert({
          slug: data.slug,
          title_fr: data.titleFr,
          title_ht: data.titleHt || "",
          description_fr: data.descriptionFr || "",
          description_ht: data.descriptionHt || "",
          price_htg: data.priceHtg,
          compare_price_htg: data.comparePriceHtg,
          level: data.level,
          category: data.category,
          cover_url: data.coverUrl || null,
          status: data.status,
          options: data.options,
          ...certificateFields,
          instructor_id: finalInstructorId,
        })
        .select("id")
        .single();

      if (insertErr || !newCourse) {
        if (insertErr?.code === "23505") {
          return { success: false, error: "Cet identifiant URL (slug) est déjà utilisé par une autre formation." };
        }
        return { success: false, error: insertErr?.message || "Impossible de créer la formation." };
      }
      courseId = newCourse.id;
    }

    // 2. Sync Modules and Lessons
    // Get existing modules to delete removed ones
    const { data: existingModules } = await supabase
      .from("modules")
      .select("id, lessons(id, lesson_resources(id))")
      .eq("course_id", courseId);

    const incomingModuleIds = new Set(data.modules.filter((m) => m.id).map((m) => m.id));
    const modulesToDelete = (existingModules || []).filter((m) => !incomingModuleIds.has(m.id));

    if (modulesToDelete.length > 0) {
      await supabase.from("modules").delete().in("id", modulesToDelete.map((m) => m.id));
    }

    // Save each incoming module
    for (let mIdx = 0; mIdx < data.modules.length; mIdx++) {
      const mod = data.modules[mIdx];
      let modId = mod.id;

      if (modId) {
        await supabase
          .from("modules")
          .update({
            title_fr: mod.titleFr,
            title_ht: mod.titleHt || "",
            position: mIdx + 1,
          })
          .eq("id", modId);
      } else {
        const { data: newMod } = await supabase
          .from("modules")
          .insert({
            course_id: courseId,
            title_fr: mod.titleFr,
            title_ht: mod.titleHt || "",
            position: mIdx + 1,
          })
          .select("id")
          .single();
        modId = newMod?.id;
      }

      if (!modId) continue;

      // Lessons for this module
      const existingMod = (existingModules || []).find((em) => em.id === modId);
      const incomingLessonIds = new Set(mod.lessons.filter((l) => l.id).map((l) => l.id));
      const lessonsToDelete = (existingMod?.lessons || []).filter((el: any) => !incomingLessonIds.has(el.id));

      if (lessonsToDelete.length > 0) {
        await supabase.from("lessons").delete().in("id", lessonsToDelete.map((el: any) => el.id));
      }

      for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
        const les = mod.lessons[lIdx];
        let lesId = les.id;

        if (lesId) {
          await supabase
            .from("lessons")
            .update({
              title_fr: les.titleFr,
              title_ht: les.titleHt || "",
              description_fr: les.descriptionFr || "",
              description_ht: les.descriptionHt || "",
              position: lIdx + 1,
              video_id: les.videoId || null,
              duration_sec: les.durationSec || 0,
              is_free_preview: les.isFreePreview,
            })
            .eq("id", lesId);
        } else {
          const { data: newLes } = await supabase
            .from("lessons")
            .insert({
              module_id: modId,
              title_fr: les.titleFr,
              title_ht: les.titleHt || "",
              description_fr: les.descriptionFr || "",
              description_ht: les.descriptionHt || "",
              position: lIdx + 1,
              video_id: les.videoId || null,
              duration_sec: les.durationSec || 0,
              is_free_preview: les.isFreePreview,
            })
            .select("id")
            .single();
          lesId = newLes?.id;
        }

        if (!lesId) continue;

        // Resources
        if (les.resources && les.resources.length > 0) {
          // Delete existing resources for this lesson and re-insert
          await supabase.from("lesson_resources").delete().eq("lesson_id", lesId);
          await supabase.from("lesson_resources").insert(
            les.resources.map((r) => ({
              lesson_id: lesId,
              name: r.name,
              file_url: r.fileUrl,
            }))
          );
        }
      }
    }

    revalidatePath("/admin/formations");
    revalidatePath(`/formations/${data.slug}`);
    revalidatePath("/formations");

    return { success: true, courseId, slug: data.slug };
  } catch (err: any) {
    return { success: false, error: err.message || "Une erreur inattendue est survenue." };
  }
}

/**
 * Toggles a course between 'published' and 'draft'.
 */
export async function toggleCoursePublishAction(
  courseId: string,
  targetStatus: "published" | "draft"
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await assertCourseManager();
    const supabase = await createClient();

    const { data: course, error } = await supabase
      .from("courses")
      .select(`
        id,
        title_fr,
        price_htg,
        cover_url,
        instructor_id,
        modules (
          id,
          lessons (id)
        )
      `)
      .eq("id", courseId)
      .single();

    if (error || !course) {
      return { success: false, error: "Formation introuvable." };
    }

    if (targetStatus === "published") {
      if (!can(user, "course.publish", { instructor_id: course.instructor_id })) {
        return {
          success: false,
          error: "Vous ne possédez pas les autorisations nécessaires pour publier ce cours.",
        };
      }

      if (!course.title_fr || course.title_fr.trim().length < 3) {
        return { success: false, error: "Le titre de la formation en français est requis." };
      }

      if (typeof course.price_htg !== "number" || course.price_htg <= 0) {
        return { success: false, error: "Le prix de vente doit être supérieur à 0 HTG pour être publié." };
      }

      if (!course.cover_url) {
        return { success: false, error: "Une image de couverture est requise pour publier la formation." };
      }

      let lessonsCount = 0;
      if (Array.isArray(course.modules)) {
        for (const m of course.modules) {
          if (Array.isArray(m.lessons)) {
            lessonsCount += m.lessons.length;
          }
        }
      }

      if (lessonsCount === 0) {
        return {
          success: false,
          error: "La formation doit contenir au moins un module et une leçon avant d'être publiée.",
        };
      }
    } else {
      if (!can(user, "course.manage", { instructor_id: course.instructor_id })) {
        return {
          success: false,
          error: "Vous ne possédez pas les autorisations nécessaires pour modifier le statut de ce cours.",
        };
      }
    }

    const { error: updateErr } = await supabase
      .from("courses")
      .update({ status: targetStatus })
      .eq("id", courseId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath("/admin/formations");
    revalidatePath("/formations");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Action refusée." };
  }
}

/**
 * Duplicates a course, creating a draft copy with -copie slug.
 */
export async function duplicateCourseAction(
  courseId: string
): Promise<{ success: boolean; newCourseId?: string; error?: string }> {
  try {
    const user = await assertCourseManager();
    const supabase = await createClient();

    const { data: course } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .single();

    if (course && !can(user, "course.manage", { instructor_id: course.instructor_id })) {
      return { success: false, error: "Action non autorisée sur ce cours." };
    }

    // Call RPC duplicate_course
    const { data: newId, error } = await supabase.rpc("duplicate_course", {
      p_course_id: courseId,
    });

    if (error || !newId) {
      return { success: false, error: error?.message || "Impossible de dupliquer la formation." };
    }

    revalidatePath("/admin/formations");
    return { success: true, newCourseId: newId };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de duplication." };
  }
}

/**
 * Deletes a course.
 * Blocked if the course has enrollments!
 */
export async function deleteCourseAction(
  courseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await assertCourseManager();
    const supabase = await createClient();

    const { data: course } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .single();

    if (course && !can(user, "course.manage", { instructor_id: course.instructor_id })) {
      return { success: false, error: "Action non autorisée sur ce cours." };
    }

    // Check enrollments count
    const { count: enrollmentsCount, error: countErr } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);

    if (countErr) {
      return { success: false, error: countErr.message };
    }

    if (enrollmentsCount && enrollmentsCount > 0) {
      return {
        success: false,
        error:
          "Suppression impossible : des élèves sont déjà inscrits à cette formation. Veuillez plutôt la dépublier (passer en brouillon).",
      };
    }

    // Delete course
    const { error: deleteErr } = await supabase.from("courses").delete().eq("id", courseId);

    if (deleteErr) {
      return { success: false, error: deleteErr.message };
    }

    revalidatePath("/admin/formations");
    revalidatePath("/formations");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur de suppression." };
  }
}

/**
 * Persists curriculum reordering (positions of modules and lessons) atomically.
 */
export async function reorderCurriculumAction(
  courseId: string,
  orderedModules: Array<{
    id: string;
    position: number;
    lessons: Array<{ id: string; position: number }>;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await assertCourseManager();
    const supabase = await createClient();

    const { data: course } = await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .single();

    if (course && !can(user, "course.manage", { instructor_id: course.instructor_id })) {
      return { success: false, error: "Action non autorisée sur ce cours." };
    }

    for (const mod of orderedModules) {
      await supabase
        .from("modules")
        .update({ position: mod.position })
        .eq("id", mod.id)
        .eq("course_id", courseId);

      for (const les of mod.lessons) {
        await supabase
          .from("lessons")
          .update({ position: les.position })
          .eq("id", les.id);
      }
    }

    revalidatePath(`/admin/formations/${courseId}/edit`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Erreur lors de la réorganisation." };
  }
}
