import {courseProgress} from "./progress";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/config";
export * from "./student-types";
import type { StudentItem, AdminCourseOption } from "./student-types";

declare global {
  // eslint-disable-next-line no-var
  var __mockStudentsStore: StudentItem[] | undefined;
  // eslint-disable-next-line no-var
  var __mockCoursesOptions: AdminCourseOption[] | undefined;
}

const defaultCourses: AdminCourseOption[] = [
  { id: "c-marketing", slug: "marketing-digital", titleFr: "Marketing Digital & Vente en Ligne", titleHt: "Maketing Dijital ak Komès sou Entènèt", priceHtg: 3500 },
  { id: "c-excel", slug: "excel-pour-entreprise", titleFr: "Excel Pratique pour Entreprises", titleHt: "Excel Pratik pou Antrepriz", priceHtg: 4200 },
  { id: "c-comptabilite", slug: "comptabilite-pratique", titleFr: "Comptabilité et Gestion Financière", titleHt: "Kontablite ak Jesyon Finansyè", priceHtg: 4500 },
  { id: "c-video", slug: "creer-du-contenu-video", titleFr: "Création de Contenu Vidéo sur Smartphone", titleHt: "Kreye Kontni Videyo ak Telefòn Ou", priceHtg: 2900 },
  { id: "c-entrepreneuriat", slug: "entrepreneuriat-haiti", titleFr: "Lancer et Gérer son Entreprise en Haïti", titleHt: "Lanse epi Jere Biznis Ou an Ayiti", priceHtg: 5000 },
  { id: "c-anglais", slug: "anglais-des-affaires", titleFr: "Anglais des Affaires pour Professionnels", titleHt: "Angle Biznis pou Pwofesyonèl", priceHtg: 3800 },
];

function initializeMockStudents(): StudentItem[] {
  if (!globalThis.__mockStudentsStore) {
    globalThis.__mockStudentsStore = [
      {
        id: "10000000-0000-0000-0000-000000000001",
        fullName: "Marie Dieudonné",
        email: "marie.dieudonne@gmail.com",
        phone: "+50936112233",
        role: "student",
        locale: "fr",
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        coursesCount: 1,
        progressPercent: 68,
        lastActivityAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        enrollments: [
          {
            id: "enr-1",
            courseId: "c-marketing",
            slug: "marketing-digital",
            titleFr: "Marketing Digital & Vente en Ligne",
            titleHt: "Maketing Dijital ak Komès sou Entènèt",
            enrolledAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
            note: "Paiement validé MonCash (TX_MC_1001)",
          },
        ],
        payments: [
          {
            id: "pay-1",
            orderId: "ord-1",
            orderReference: "ORD-MC-001",
            courseTitle: "Marketing Digital & Vente en Ligne",
            amountHtg: 3500,
            provider: "moncash",
            status: "validated",
            createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "10000000-0000-0000-0000-000000000002",
        fullName: "Pierre-Louis Jean",
        email: "pierrelouis.jean@yahoo.com",
        phone: "+50937223344",
        role: "student",
        locale: "ht",
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        coursesCount: 1,
        progressPercent: 68,
        lastActivityAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        enrollments: [
          {
            id: "enr-2",
            courseId: "c-excel",
            slug: "excel-pour-entreprise",
            titleFr: "Excel Pratique pour Entreprises",
            titleHt: "Excel Pratik pou Antrepriz",
            enrolledAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
            note: "Validation virement NatCash",
          },
        ],
        payments: [
          {
            id: "pay-2",
            orderId: "ord-2",
            orderReference: "ORD-NAT-002",
            courseTitle: "Excel Pratique pour Entreprises",
            amountHtg: 4200,
            provider: "natcash",
            status: "validated",
            createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "10000000-0000-0000-0000-000000000003",
        fullName: "Esther Moïse",
        email: "esther.moise@outlook.com",
        phone: "+50940334455",
        role: "student",
        locale: "ht",
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        coursesCount: 0,
        enrollments: [],
        payments: [
          {
            id: "pay-3",
            orderId: "ord-3",
            orderReference: "ORD-WAIT-001",
            courseTitle: "Lancer et Gérer son Entreprise en Haïti",
            amountHtg: 5000,
            provider: "natcash",
            status: "awaiting_validation",
            createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "10000000-0000-0000-0000-000000000004",
        fullName: "Jean-Baptiste Dorval",
        email: "dorval.jb@gmail.com",
        phone: "+50941445566",
        role: "student",
        locale: "fr",
        createdAt: new Date(Date.now() - 70 * 24 * 3600 * 1000).toISOString(),
        coursesCount: 0,
        enrollments: [],
        payments: [
          {
            id: "pay-4",
            orderId: "ord-4",
            orderReference: "ORD-WAIT-002",
            courseTitle: "Anglais des Affaires pour Professionnels",
            amountHtg: 3800,
            provider: "natcash",
            status: "awaiting_validation",
            createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "10000000-0000-0000-0000-000000000005",
        fullName: "Wideline Saintil",
        email: "wideline.s@gmail.com",
        phone: "+50938556677",
        role: "student",
        locale: "fr",
        createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
        coursesCount: 2,
        enrollments: [
          {
            id: "enr-5a",
            courseId: "c-excel",
            slug: "excel-pour-entreprise",
            titleFr: "Excel Pratique pour Entreprises",
            titleHt: "Excel Pratik pou Antrepriz",
            enrolledAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
          },
          {
            id: "enr-5b",
            courseId: "c-marketing",
            slug: "marketing-digital",
            titleFr: "Marketing Digital & Vente en Ligne",
            titleHt: "Maketing Dijital ak Komès sou Entènèt",
            enrolledAt: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
          },
        ],
        payments: [
          {
            id: "pay-5a",
            orderId: "ord-5a",
            orderReference: "ORD-MC-005A",
            courseTitle: "Excel Pratique pour Entreprises",
            amountHtg: 4200,
            provider: "moncash",
            status: "validated",
            createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
          },
          {
            id: "pay-5b",
            orderId: "ord-5b",
            orderReference: "ORD-MC-005B",
            courseTitle: "Marketing Digital & Vente en Ligne",
            amountHtg: 3500,
            provider: "moncash",
            status: "validated",
            createdAt: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
          },
        ],
      },
    ];
  }
  return globalThis.__mockStudentsStore;
}

export function grantFallbackEnrollment(studentId: string, courseId: string, note?: string): void {
  const store = initializeMockStudents();
  const student = store.find((s) => s.id === studentId);
  const course = defaultCourses.find((c) => c.id === courseId);
  if (student && course) {
    const existing = student.enrollments.find((e) => e.courseId === courseId);
    if (!existing) {
      student.enrollments.unshift({
        id: `enr-manual-${Date.now()}`,
        courseId: course.id,
        slug: course.slug,
        titleFr: course.titleFr,
        titleHt: course.titleHt,
        enrolledAt: new Date().toISOString(),
        note: note || "Accès accordé manuellement par l'administration",
      });
      student.coursesCount = student.enrollments.length;
    }
  }
}

export function revokeFallbackEnrollment(studentId: string, courseId: string): void {
  const store = initializeMockStudents();
  const student = store.find((s) => s.id === studentId);
  if (student) {
    student.enrollments = student.enrollments.filter((e) => e.courseId !== courseId);
    student.coursesCount = student.enrollments.length;
  }
}

export async function getAllAvailableCourses(instructorId?: string): Promise<AdminCourseOption[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("courses")
      .select("id, slug, title_fr, title_ht, price_htg, instructor_id")
      .order("created_at", { ascending: false });

    if (instructorId) {
      query = query.eq("instructor_id", instructorId);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        titleFr: c.title_fr,
        titleHt: c.title_ht || "",
        priceHtg: Number(c.price_htg || 0),
      }));
    }
  } catch (err) {
    console.error("[Students] Error fetching courses for admin selector:", err);
  }

  if (isDemoMode()) {
    if (instructorId) {
      return defaultCourses.slice(0, 2);
    }
    return defaultCourses;
  }

  return [];
}

export async function getAdminStudentsList(instructorId?: string): Promise<StudentItem[]> {
  try {
    const supabase = await createClient();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        ${instructorId ? "" : "email,phone,"}
        role,
        locale,
        created_at,
        enrollments!user_id (
          id,
          course_id,
          created_at,
          note,
          revoked_at,
          granted_by,
          courses (
            id,
            slug,
            title_fr,
            title_ht,
            instructor_id
          )
        )
        ${instructorId ? "" : `,orders!user_id (
          id,
          reference,
          amount_htg,
          status,
          created_at,
          courses (
            title_fr
          ),
          payments (
            id,
            provider,
            status,
            created_at
          )
        )`}
      `)
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (!error && profiles && profiles.length > 0) {
      const courseIds=Array.from(new Set<string>(profiles.flatMap((p:any)=>(p.enrollments||[]).filter((e:any)=>!e.revoked_at&&(!instructorId||e.courses?.instructor_id===instructorId)).map((e:any)=>e.course_id))));
      const progress=await courseProgress(courseIds,profiles.map((p:any)=>p.id)).catch(()=>null);const totals=progress?.totals||new Map<string,number>(),done=progress?.done||new Map<string,number>();
      const list = profiles.map((p: any) => {
        const rawEnrollments = (p.enrollments || []).filter((e:any)=>!e.revoked_at&&(!instructorId||e.courses?.instructor_id===instructorId));
        const enrollments: any[] = rawEnrollments.map((e: any) => ({
          id: e.id,
          courseId: e.course_id,
          slug: e.courses?.slug || "",
          titleFr: e.courses?.title_fr || "Formation",
          titleHt: e.courses?.title_ht || "",
          enrolledAt: e.created_at,
          note: e.note || null,
          grantedBy: e.granted_by || null,
          instructorId: e.courses?.instructor_id,
        }));

        const payments: any[] = [];
        if (p.orders && Array.isArray(p.orders)) {
          for (const ord of p.orders) {
            const pay = ord.payments && ord.payments[0];
            if(!pay)continue;
            payments.push({
              id: pay.id,
              orderId: ord.id,
              orderReference: ord.reference,
              courseTitle: ord.courses?.title_fr || "Formation",
              amountHtg: Number(ord.amount_htg || 0),
              provider: pay?.provider || "natcash",
              status: pay?.status || ord.status || "pending",
              createdAt: ord.created_at,
            });
          }
        }

        return {
          id: p.id,
          fullName: p.full_name || "Apprenant",
          email: p.email || "",
          phone: p.phone || "",
          role: p.role || "student",
          locale: p.locale || "fr",
          createdAt: p.created_at,
          coursesCount: enrollments.length,
          progressPercent: !progress?undefined:enrollments.length?Math.round(enrollments.reduce((sum:number,e:any)=>sum+(totals.get(e.courseId)?Math.min(100,(done.get(p.id+':'+e.courseId)||0)/totals.get(e.courseId)!*100):0),0)/enrollments.length):0,
          lastActivityAt: p.created_at,
          enrollments,
          payments,
        };
      });

      if (instructorId) {
        // Privacy rule: Instructors NEVER receive student email, phone, or financial/payment data.
        return list
          .filter((student) =>
            student.enrollments.some(
              (e: any) => e.instructorId === instructorId
            )
          )
          .map((student) => ({
            ...student,
            email: "",
            phone: "",
            payments: [],
          }));
      }

      return list;
    }
    if(error)throw Error("students_unavailable");
    if (!error && profiles && profiles.length === 0) {
      return [];
    }
  } catch (err) {
    if(!isDemoMode())throw Error("students_unavailable");
  }

  if (isDemoMode()) {
    const mock = initializeMockStudents();
    if (instructorId) {
      // Privacy rule: Scrub email, phone, and payments for instructors in mock fallback
      return mock
        .filter((s) =>
          s.enrollments.some((e) => e.courseId === "c-marketing")
        )
        .map((s) => ({
          ...s,
          email: "",
          phone: "",
          payments: [],
        }));
    }
    return mock;
  }

  return [];
}
