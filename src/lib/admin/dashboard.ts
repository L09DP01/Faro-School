import { createClient } from "@/lib/supabase/server";

export type PeriodType = "this_month" | "last_30_days" | "this_year";

export interface AdminKPIs {
  period: PeriodType;
  revenue: number;
  prevRevenue: number;
  revenueChangePct: number;
  newStudents: number;
  prevNewStudents: number;
  studentsChangePct: number;
  awaitingValidation: number;
  completionRate: number;
  prevCompletionRate: number;
  completionChangePct: number;
}

export interface RevenueMonth {
  monthKey: string;
  monthLabelFr: string;
  monthLabelHt: string;
  moncashAmount: number;
  natcashAmount: number;
  totalAmount: number;
}

export interface TopCourse {
  courseId: string;
  slug: string;
  titleFr: string;
  titleHt: string;
  studentCount: number;
  totalStudents: number;
  percentage: number;
}

export interface RecentPayment {
  id: string;
  orderReference: string;
  studentName: string;
  studentPhone: string;
  courseTitleFr: string;
  courseTitleHt: string;
  provider: "moncash" | "natcash" | "kobara";
  amountHtg: number;
  status: "pending" | "awaiting_validation" | "validated" | "failed";
  createdAt: string;
}

export interface AdminDashboardData {
  kpis: AdminKPIs;
  revenue12Months: RevenueMonth[];
  topCourses: TopCourse[];
  recentPayments: RecentPayment[];
}

/**
 * Fallback seed data matching seed_admin_data.sql for offline / mock testing.
 */
function getMockDashboardData(period: PeriodType): AdminDashboardData {
  const isMonth = period === "this_month";
  const is30Days = period === "last_30_days";

  const kpis: AdminKPIs = {
    period,
    revenue: isMonth ? 11000 : is30Days ? 14500 : 38000,
    prevRevenue: isMonth ? 7500 : is30Days ? 11000 : 25000,
    revenueChangePct: isMonth ? 46.7 : is30Days ? 31.8 : 52.0,
    newStudents: isMonth ? 3 : is30Days ? 4 : 8,
    prevNewStudents: isMonth ? 2 : is30Days ? 3 : 5,
    studentsChangePct: isMonth ? 50.0 : is30Days ? 33.3 : 60.0,
    awaitingValidation: 2,
    completionRate: 20.0,
    prevCompletionRate: 15.0,
    completionChangePct: 5.0,
  };

  const revenue12Months: RevenueMonth[] = [
    { monthKey: "2024-11", monthLabelFr: "Nov 2024", monthLabelHt: "Nov 2024", moncashAmount: 3000, natcashAmount: 0, totalAmount: 3000 },
    { monthKey: "2024-12", monthLabelFr: "Déc 2024", monthLabelHt: "Des 2024", moncashAmount: 4500, natcashAmount: 0, totalAmount: 4500 },
    { monthKey: "2025-01", monthLabelFr: "Janv 2025", monthLabelHt: "Jan 2025", moncashAmount: 0, natcashAmount: 4500, totalAmount: 4500 },
    { monthKey: "2025-02", monthLabelFr: "Févr 2025", monthLabelHt: "Fev 2025", moncashAmount: 4000, natcashAmount: 0, totalAmount: 4000 },
    { monthKey: "2025-03", monthLabelFr: "Mars 2025", monthLabelHt: "Mas 2025", moncashAmount: 0, natcashAmount: 0, totalAmount: 0 },
    { monthKey: "2025-04", monthLabelFr: "Avr 2025", monthLabelHt: "Avr 2025", moncashAmount: 3500, natcashAmount: 0, totalAmount: 3500 },
    { monthKey: "2025-05", monthLabelFr: "Mai 2025", monthLabelHt: "Me 2025", moncashAmount: 0, natcashAmount: 3500, totalAmount: 3500 },
    { monthKey: "2025-06", monthLabelFr: "Juin 2025", monthLabelHt: "Jen 2025", moncashAmount: 4000, natcashAmount: 0, totalAmount: 4000 },
    { monthKey: "2025-07", monthLabelFr: "Juil 2025", monthLabelHt: "Jiy 2025", moncashAmount: 0, natcashAmount: 0, totalAmount: 0 },
    { monthKey: "2025-08", monthLabelFr: "Août 2025", monthLabelHt: "Out 2025", moncashAmount: 0, natcashAmount: 4000, totalAmount: 4000 },
    { monthKey: "2025-09", monthLabelFr: "Sept 2025", monthLabelHt: "Sep 2025", moncashAmount: 3500, natcashAmount: 4000, totalAmount: 7500 },
    { monthKey: "2025-10", monthLabelFr: "Oct 2025", monthLabelHt: "Okt 2025", moncashAmount: 7500, natcashAmount: 3500, totalAmount: 11000 },
  ];

  const topCourses: TopCourse[] = [
    {
      courseId: "1",
      slug: "marketing-digital",
      titleFr: "Marketing Digital pour Entreprises en Haïti",
      titleHt: "Maketing Dijital pou Biznis an Ayiti",
      studentCount: 4,
      totalStudents: 10,
      percentage: 100.0,
    },
    {
      courseId: "2",
      slug: "excel-pour-entreprise",
      titleFr: "Excel pour Entreprise : de Zéro à Avancé",
      titleHt: "Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse",
      studentCount: 3,
      totalStudents: 10,
      percentage: 75.0,
    },
    {
      courseId: "3",
      slug: "comptabilite-pratique",
      titleFr: "Comptabilité Pratique pour PME et Indépendants",
      titleHt: "Kontablite Pratik pou Ti Biznis ak Travayè Endepandan",
      studentCount: 2,
      totalStudents: 10,
      percentage: 50.0,
    },
    {
      courseId: "4",
      slug: "creer-du-contenu-video",
      titleFr: "Créer du Contenu Vidéo avec son Smartphone",
      titleHt: "Kreye Kontni Videyo ak Telefòn Ou",
      studentCount: 1,
      totalStudents: 10,
      percentage: 25.0,
    },
    {
      courseId: "5",
      slug: "entrepreneuriat-haiti",
      titleFr: "Lancer et Gérer son Entreprise en Haïti",
      titleHt: "Lanse epi Jere Biznis Ou an Ayiti",
      studentCount: 0,
      totalStudents: 10,
      percentage: 0.0,
    },
  ];

  const recentPayments: RecentPayment[] = [
    {
      id: "p-wait-2",
      orderReference: "ORD-WAIT-002",
      studentName: "Jean-Baptiste Dorval",
      studentPhone: "+50941445566",
      courseTitleFr: "Anglais des Affaires pour Professionnels",
      courseTitleHt: "Angle Biznis pou Pwofesyonèl",
      provider: "natcash",
      amountHtg: 3800,
      status: "awaiting_validation",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "p-wait-1",
      orderReference: "ORD-WAIT-001",
      studentName: "Esther Moïse",
      studentPhone: "+50940334455",
      courseTitleFr: "Lancer et Gérer son Entreprise en Haïti",
      courseTitleHt: "Lanse epi Jere Biznis Ou an Ayiti",
      provider: "natcash",
      amountHtg: 5000,
      status: "awaiting_validation",
      createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    },
    {
      id: "p-val-3",
      orderReference: "ORD-MC-003",
      studentName: "Wideline Saintil",
      studentPhone: "+50938556677",
      courseTitleFr: "Excel pour Entreprise : de Zéro à Avancé",
      courseTitleHt: "Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse",
      provider: "moncash",
      amountHtg: 4000,
      status: "validated",
      createdAt: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-fail-1",
      orderReference: "ORD-FAIL-001",
      studentName: "Samuel Toussaint",
      studentPhone: "+50943889900",
      courseTitleFr: "Marketing Digital pour Entreprises en Haïti",
      courseTitleHt: "Maketing Dijital pou Biznis an Ayiti",
      provider: "moncash",
      amountHtg: 3500,
      status: "failed",
      createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-2",
      orderReference: "ORD-NC-002",
      studentName: "Pierre-Louis Jean",
      studentPhone: "+50937223344",
      courseTitleFr: "Marketing Digital pour Entreprises en Haïti",
      courseTitleHt: "Maketing Dijital pou Biznis an Ayiti",
      provider: "natcash",
      amountHtg: 3500,
      status: "validated",
      createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-1",
      orderReference: "ORD-MC-001",
      studentName: "Marie Dieudonné",
      studentPhone: "+50936112233",
      courseTitleFr: "Marketing Digital pour Entreprises en Haïti",
      courseTitleHt: "Maketing Dijital pou Biznis an Ayiti",
      provider: "moncash",
      amountHtg: 3500,
      status: "validated",
      createdAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-6",
      orderReference: "ORD-NC-005",
      studentName: "Frantz Voltaire",
      studentPhone: "+50942667788",
      courseTitleFr: "Excel pour Entreprise : de Zéro à Avancé",
      courseTitleHt: "Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse",
      provider: "natcash",
      amountHtg: 4000,
      status: "validated",
      createdAt: new Date(Date.now() - 25 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-4",
      orderReference: "ORD-MC-004",
      studentName: "Esther Moïse",
      studentPhone: "+50940334455",
      courseTitleFr: "Marketing Digital pour Entreprises en Haïti",
      courseTitleHt: "Maketing Dijital pou Biznis an Ayiti",
      provider: "moncash",
      amountHtg: 3500,
      status: "validated",
      createdAt: new Date(Date.now() - 28 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-7",
      orderReference: "ORD-MC-006",
      studentName: "Marie Dieudonné",
      studentPhone: "+50936112233",
      courseTitleFr: "Excel pour Entreprise : de Zéro à Avancé",
      courseTitleHt: "Excel pou Biznis : Depi nan Kòmansman rive nan Nivo Avanse",
      provider: "moncash",
      amountHtg: 4000,
      status: "validated",
      createdAt: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
    },
    {
      id: "p-val-8",
      orderReference: "ORD-NC-007",
      studentName: "Nadège Célestin",
      studentPhone: "+50939778899",
      courseTitleFr: "Comptabilité Pratique pour PME et Indépendants",
      courseTitleHt: "Kontablite Pratik pou Ti Biznis ak Travayè Endepandan",
      provider: "natcash",
      amountHtg: 4500,
      status: "validated",
      createdAt: new Date(Date.now() - 90 * 86400 * 1000).toISOString(),
    },
  ];

  return { kpis, revenue12Months, topCourses, recentPayments };
}

/**
 * Fetches all admin dashboard metrics using aggregated RPC functions.
 */
export async function getAdminDashboardData(
  period: PeriodType = "this_month"
): Promise<AdminDashboardData> {
  const mockFallback = getMockDashboardData(period);

  try {
    const supabase = await createClient();

    // 1. Fetch KPIs via RPC
    const { data: kpiData, error: kpiError } = await supabase.rpc(
      "get_admin_dashboard_kpis",
      { p_period: period }
    );

    // 2. Fetch 12-Month Revenue via RPC
    const { data: revData, error: revError } = await supabase.rpc(
      "get_admin_revenue_12months"
    );

    // 3. Fetch Top Courses via RPC
    const { data: courseData, error: courseError } = await supabase.rpc(
      "get_admin_top_courses",
      { p_limit: 5 }
    );

    // 4. Fetch Recent Payments via RPC
    const { data: paymentData, error: paymentError } = await supabase.rpc(
      "get_admin_recent_payments",
      { p_limit: 10 }
    );

    // If RPCs succeeded and returned valid data, map them
    let kpis = mockFallback.kpis;
    if (!kpiError && kpiData) {
      kpis = {
        period,
        revenue: Math.round(Number(kpiData.revenue || 0)),
        prevRevenue: Math.round(Number(kpiData.prev_revenue || 0)),
        revenueChangePct: Number(kpiData.revenue_change_pct || 0),
        newStudents: Number(kpiData.new_students || 0),
        prevNewStudents: Number(kpiData.prev_new_students || 0),
        studentsChangePct: Number(kpiData.students_change_pct || 0),
        awaitingValidation: Number(kpiData.awaiting_validation || 0),
        completionRate: Number(kpiData.completion_rate || 0),
        prevCompletionRate: Number(kpiData.prev_completion_rate || 0),
        completionChangePct: Number(kpiData.completion_change_pct || 0),
      };
    }

    let revenue12Months = mockFallback.revenue12Months;
    if (!revError && revData && Array.isArray(revData) && revData.length > 0) {
      revenue12Months = revData.map((r: any) => ({
        monthKey: r.month_key,
        monthLabelFr: r.month_label_fr,
        monthLabelHt: r.month_label_ht,
        moncashAmount: Math.round(Number(r.moncash_amount || 0)),
        natcashAmount: Math.round(Number(r.natcash_amount || 0)),
        totalAmount: Math.round(Number(r.total_amount || 0)),
      }));
    }

    let topCourses = mockFallback.topCourses;
    if (!courseError && courseData && Array.isArray(courseData) && courseData.length > 0) {
      topCourses = courseData.map((c: any) => ({
        courseId: c.course_id,
        slug: c.slug,
        titleFr: c.title_fr,
        titleHt: c.title_ht,
        studentCount: Number(c.student_count || 0),
        totalStudents: Number(c.total_students || 0),
        percentage: Number(c.percentage || 0),
      }));
    }

    let recentPayments = mockFallback.recentPayments;
    if (!paymentError && paymentData && Array.isArray(paymentData) && paymentData.length > 0) {
      recentPayments = paymentData.map((p: any) => ({
        id: p.id,
        orderReference: p.order_reference,
        studentName: p.student_name,
        studentPhone: p.student_phone,
        courseTitleFr: p.course_title_fr,
        courseTitleHt: p.course_title_ht,
        provider: p.provider,
        amountHtg: Math.round(Number(p.amount_htg || 0)),
        status: p.status,
        createdAt: p.created_at,
      }));
    }

    return {
      kpis,
      revenue12Months,
      topCourses,
      recentPayments,
    };
  } catch {
    return mockFallback;
  }
}
