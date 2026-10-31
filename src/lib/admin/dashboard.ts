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
 * Fetches all admin dashboard metrics using aggregated RPC functions.
 */
export async function getAdminDashboardData(
  period: PeriodType = "this_month"
): Promise<AdminDashboardData> {


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
    if (kpiError || revError || courseError || paymentError || !kpiData) throw new Error("dashboard_unavailable");
    let kpis: AdminKPIs = {} as AdminKPIs;
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

    let revenue12Months: RevenueMonth[] = [];
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

    let topCourses: TopCourse[] = [];
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

    let recentPayments: RecentPayment[] = [];
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
    throw new Error("dashboard_unavailable");
  }
}
