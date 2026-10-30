import { createClient } from "@/lib/supabase/server";
export * from "./course-types";
import type { AdminCourseListItem, AdminCourseFormData } from "./course-types";

/**
 * Fetches all courses with statistics for the admin table.
 */
export async function getAdminCoursesList(instructorId?: string): Promise<AdminCourseListItem[]> {
  try {
    const supabase = await createClient();

    // If no instructorId filter, try RPC first
    if (!instructorId) {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_admin_courses_list");

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        return rpcData.map((c: any) => ({
          id: c.id,
          slug: c.slug,
          titleFr: c.title_fr,
          titleHt: c.title_ht || "",
          descriptionFr: c.description_fr || "",
          descriptionHt: c.description_ht || "",
          priceHtg: Math.round(Number(c.price_htg || 0)),
          comparePriceHtg: c.compare_price_htg ? Math.round(Number(c.compare_price_htg)) : null,
          level: c.level || "tous niveaux",
          category: c.category || "general",
          coverUrl: c.cover_url || null,
          status: (c.status as "draft" | "published") || "draft",
          createdAt: c.created_at,
          studentsCount: Number(c.students_count || 0),
          revenueHtg: Math.round(Number(c.revenue_htg || 0)),
          modulesCount: Number(c.modules_count || 0),
          lessonsCount: Number(c.lessons_count || 0),
          instructorId: c.instructor_id || null,
        }));
      }
    }

    // Direct table query
    let query = supabase
      .from("courses")
      .select(`
        id,
        slug,
        title_fr,
        title_ht,
        description_fr,
        description_ht,
        price_htg,
        compare_price_htg,
        level,
        category,
        cover_url,
        status,
        created_at,
        instructor_id,
        enrollments (id),
        orders (
          amount_htg,
          payments (status)
        ),
        modules (
          id,
          lessons (id)
        )
      `)
      .order("created_at", { ascending: false });

    if (instructorId) {
      query = query.eq("instructor_id", instructorId);
    }

    const { data: courses, error: coursesError } = await query;

    if (coursesError || !courses) {
      return [];
    }

    return courses.map((c: any) => {
      const studentsCount = Array.isArray(c.enrollments) ? c.enrollments.length : 0;
      let revenueHtg = 0;
      if (Array.isArray(c.orders)) {
        for (const o of c.orders) {
          const validated = o.payments?.some((p: any) => p.status === "validated");
          if (validated) {
            revenueHtg += Number(o.amount_htg || 0);
          }
        }
      }

      let lessonsCount = 0;
      if (Array.isArray(c.modules)) {
        for (const m of c.modules) {
          if (Array.isArray(m.lessons)) {
            lessonsCount += m.lessons.length;
          }
        }
      }

      return {
        id: c.id,
        slug: c.slug,
        titleFr: c.title_fr,
        titleHt: c.title_ht || "",
        descriptionFr: c.description_fr || "",
        descriptionHt: c.description_ht || "",
        priceHtg: Math.round(Number(c.price_htg || 0)),
        comparePriceHtg: c.compare_price_htg ? Math.round(Number(c.compare_price_htg)) : null,
        level: c.level || "tous niveaux",
        category: c.category || "general",
        coverUrl: c.cover_url || null,
        status: (c.status as "draft" | "published") || "draft",
        createdAt: c.created_at,
        studentsCount,
        revenueHtg,
        modulesCount: Array.isArray(c.modules) ? c.modules.length : 0,
        lessonsCount,
        instructorId: c.instructor_id || null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetches a full course with all modules, lessons, and resources for the admin form.
 */
export async function getAdminCourseById(id: string): Promise<AdminCourseFormData | null> {
  try {
    const supabase = await createClient();

    const { data: course, error } = await supabase
      .from("courses")
      .select(`
        id,
        slug,
        title_fr,
        title_ht,
        description_fr,
        description_ht,
        price_htg,
        compare_price_htg,
        level,
        category,
        cover_url,
        status,
        options,
        certificate_enabled,
        certificate_min_progress,
        instructor_id,
        modules (
          id,
          position,
          title_fr,
          title_ht,
          lessons (
            id,
            position,
            title_fr,
            title_ht,
            video_id,
            duration_sec,
            is_free_preview,
            description_fr,
            description_ht,
            lesson_resources (
              id,
              name,
              file_url
            )
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !course) {
      return null;
    }

    const modules = (course.modules || [])
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
      .map((m: any) => ({
        id: m.id,
        titleFr: m.title_fr,
        titleHt: m.title_ht || "",
        position: m.position || 0,
        lessons: (m.lessons || [])
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          .map((l: any) => ({
            id: l.id,
            titleFr: l.title_fr,
            titleHt: l.title_ht || "",
            descriptionFr: l.description_fr || "",
            descriptionHt: l.description_ht || "",
            position: l.position || 0,
            videoId: l.video_id || "",
            durationSec: l.duration_sec || 0,
            isFreePreview: Boolean(l.is_free_preview),
            resources: (l.lesson_resources || []).map((r: any) => ({
              id: r.id,
              name: r.name,
              fileUrl: r.file_url,
            })),
          })),
      }));

    return {
      id: course.id,
      slug: course.slug,
      titleFr: course.title_fr,
      titleHt: course.title_ht || "",
      descriptionFr: course.description_fr || "",
      descriptionHt: course.description_ht || "",
      priceHtg: Number(course.price_htg || 0),
      comparePriceHtg: course.compare_price_htg ? Number(course.compare_price_htg) : null,
      level: course.level || "tous niveaux",
      category: course.category || "general",
      coverUrl: course.cover_url || "",
      status: (course.status as "draft" | "published") || "draft",
      certificateEnabled: course.certificate_enabled,
      certificateMinProgress: Number(course.certificate_min_progress??100),
      options: course.options || {
        certificate: true,
        lifetimeAccess: true,
        guaranteeDays: 7,
        moncashEnabled: true,
        natcashEnabled: true,
      },
      instructorId: course.instructor_id || null,
      modules,
    };
  } catch {
    return null;
  }
}
