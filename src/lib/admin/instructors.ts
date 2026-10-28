import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";

export interface InstructorCourseItem {
  id: string;
  titleFr: string;
  slug: string;
}

export interface InstructorItem {
  id: string; // profile_id
  email: string;
  fullName: string;
  title: string;
  bio: string;
  escalationEmail: string | null;
  isActive: boolean;
  createdAt: string;
  coursesCount: number;
  courses: InstructorCourseItem[];
  lastSeenAt?: string | null;
}

function getDemoInstructors(): InstructorItem[] {
  return [
    {
      id: "mock-admin-id",
      email: "admin@faroschool.com",
      fullName: "Professeur Faro",
      title: "Directeur Pédagogique & Fondateur",
      bio: "Expert en gestion de projet et technologies appliquées, accompagnant les étudiants haïtiens.",
      escalationEmail: "direction@faroschool.com",
      isActive: true,
      createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
      coursesCount: 3,
      courses: [
        { id: "c-excel", titleFr: "Excel Pratique pour Entreprises", slug: "excel-pour-entreprise" },
        { id: "c-comptabilite", titleFr: "Comptabilité et Gestion Financière", slug: "comptabilite-pratique" },
        { id: "c-entrepreneuriat", titleFr: "Lancer et Gérer son Entreprise en Haïti", slug: "entrepreneuriat-haiti" },
      ],
      lastSeenAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-instructor-id",
      email: "instructor@faroschool.com",
      fullName: "Jean-Baptiste Formateur",
      title: "Spécialiste Marketing & Médias Numériques",
      bio: "Formateur certifié en stratégies d'acquisition digitale et création de contenu multimédia.",
      escalationEmail: "jb.escalade@faroschool.com",
      isActive: true,
      createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
      coursesCount: 2,
      courses: [
        { id: "c-marketing", titleFr: "Marketing Digital & Vente en Ligne", slug: "marketing-digital" },
        { id: "c-video", titleFr: "Création de Contenu Vidéo sur Smartphone", slug: "creer-du-contenu-video" },
      ],
      lastSeenAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
  ];
}

/**
 * Fetches the list of instructors for admin management.
 * In production: strictly queries real database; returns empty list if no instructors exist.
 * Never silently displays fake instructors in production.
 */
export async function getAdminInstructorsList(): Promise<InstructorItem[]> {
  try {
    const supabase = await createClient();

    // Query instructors with profiles and assigned courses
    const { data: instructors, error } = await supabase
      .from("instructors")
      .select(`
        profile_id,
        title,
        bio,
        escalation_email,
        is_active,
        created_at,
        profiles (
          id,
          full_name,
          email,
          last_seen_at
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && instructors && instructors.length > 0) {
      // Query courses for all instructors
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title_fr, slug, instructor_id");

      const coursesMap = new Map<string, InstructorCourseItem[]>();
      if (courses) {
        for (const c of courses) {
          if (c.instructor_id) {
            const list = coursesMap.get(c.instructor_id) || [];
            list.push({ id: c.id, titleFr: c.title_fr, slug: c.slug });
            coursesMap.set(c.instructor_id, list);
          }
        }
      }

      return instructors.map((inst: any) => {
        const assignedCourses = coursesMap.get(inst.profile_id) || [];
        return {
          id: inst.profile_id,
          email: inst.profiles?.email || "",
          fullName: inst.profiles?.full_name || "Formateur Limyè",
          title: inst.title || "",
          bio: inst.bio || "",
          escalationEmail: inst.escalation_email || null,
          isActive: Boolean(inst.is_active),
          createdAt: inst.created_at,
          coursesCount: assignedCourses.length,
          courses: assignedCourses,
          lastSeenAt: inst.profiles?.last_seen_at || null,
        };
      });
    }

    if (!error && instructors && instructors.length === 0) {
      return [];
    }
  } catch (err) {
    console.error("[Instructors] Error fetching instructors from database:", err);
  }

  if (isDemoMode()) {
    return getDemoInstructors();
  }

  return [];
}
