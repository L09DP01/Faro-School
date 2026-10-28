-- Migration: Admin Dashboard Aggregations
-- Adds high-performance RPC functions for KPI aggregation, 12-month revenue chart,
-- top courses, and recent payments, preventing whole-table scans.

-- 1. KPI Aggregation Function
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis(p_period TEXT DEFAULT 'this_month')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ := NOW();
  v_prev_start_date TIMESTAMPTZ;
  v_prev_end_date TIMESTAMPTZ;
  
  v_revenue INT := 0;
  v_prev_revenue INT := 0;
  v_revenue_change NUMERIC := 0;
  
  v_new_students INT := 0;
  v_prev_new_students INT := 0;
  v_students_change NUMERIC := 0;
  
  v_awaiting_validation INT := 0;
  
  v_completion_rate NUMERIC := 0;
  v_prev_completion_rate NUMERIC := 0;
  v_completion_change NUMERIC := 0;

  v_curr_certs INT := 0;
  v_curr_enrollments INT := 0;
  v_prev_certs INT := 0;
  v_prev_enrollments INT := 0;
BEGIN
  -- Determine period windows
  IF p_period = 'last_30_days' THEN
    v_start_date := NOW() - INTERVAL '30 days';
    v_prev_end_date := v_start_date;
    v_prev_start_date := v_start_date - INTERVAL '30 days';
  ELSIF p_period = 'this_year' THEN
    v_start_date := date_trunc('year', NOW());
    v_prev_start_date := date_trunc('year', NOW() - INTERVAL '1 year');
    v_prev_end_date := date_trunc('year', NOW()) - INTERVAL '1 second';
  ELSE -- 'this_month' (default)
    v_start_date := date_trunc('month', NOW());
    v_prev_start_date := date_trunc('month', NOW() - INTERVAL '1 month');
    v_prev_end_date := date_trunc('month', NOW()) - INTERVAL '1 second';
  END IF;

  -- 1. Revenue: Validated payments in current period
  SELECT COALESCE(SUM(o.amount_htg), 0)::INT
  INTO v_revenue
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  WHERE p.status = 'validated'
    AND p.created_at >= v_start_date
    AND p.created_at <= v_end_date;

  -- Revenue: Previous period
  SELECT COALESCE(SUM(o.amount_htg), 0)::INT
  INTO v_prev_revenue
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  WHERE p.status = 'validated'
    AND p.created_at >= v_prev_start_date
    AND p.created_at <= v_prev_end_date;

  IF v_prev_revenue > 0 THEN
    v_revenue_change := ROUND(((v_revenue - v_prev_revenue)::NUMERIC / v_prev_revenue::NUMERIC) * 100, 1);
  ELSIF v_revenue > 0 THEN
    v_revenue_change := 100.0;
  ELSE
    v_revenue_change := 0.0;
  END IF;

  -- 2. New students
  SELECT COUNT(*)::INT
  INTO v_new_students
  FROM public.profiles
  WHERE role = 'student'
    AND created_at >= v_start_date
    AND created_at <= v_end_date;

  SELECT COUNT(*)::INT
  INTO v_prev_new_students
  FROM public.profiles
  WHERE role = 'student'
    AND created_at >= v_prev_start_date
    AND created_at <= v_prev_end_date;

  IF v_prev_new_students > 0 THEN
    v_students_change := ROUND(((v_new_students - v_prev_new_students)::NUMERIC / v_prev_new_students::NUMERIC) * 100, 1);
  ELSIF v_new_students > 0 THEN
    v_students_change := 100.0;
  ELSE
    v_students_change := 0.0;
  END IF;

  -- 3. Payments awaiting validation (all time pending verification)
  SELECT COUNT(*)::INT
  INTO v_awaiting_validation
  FROM public.payments
  WHERE status = 'awaiting_validation';

  -- 4. Completion rate: certificates / enrollments ratio
  SELECT COUNT(*)::INT INTO v_curr_certs
  FROM public.certificates
  WHERE issued_at >= v_start_date AND issued_at <= v_end_date;

  SELECT COUNT(*)::INT INTO v_curr_enrollments
  FROM public.enrollments
  WHERE created_at >= v_start_date AND created_at <= v_end_date;

  IF v_curr_enrollments > 0 THEN
    v_completion_rate := ROUND((v_curr_certs::NUMERIC / v_curr_enrollments::NUMERIC) * 100, 1);
  ELSE
    -- All-time fallback if 0 enrollments in current window
    SELECT COUNT(*)::INT INTO v_curr_certs FROM public.certificates;
    SELECT COUNT(*)::INT INTO v_curr_enrollments FROM public.enrollments;
    IF v_curr_enrollments > 0 THEN
      v_completion_rate := ROUND((v_curr_certs::NUMERIC / v_curr_enrollments::NUMERIC) * 100, 1);
    ELSE
      v_completion_rate := 0.0;
    END IF;
  END IF;

  SELECT COUNT(*)::INT INTO v_prev_certs
  FROM public.certificates
  WHERE issued_at >= v_prev_start_date AND issued_at <= v_prev_end_date;

  SELECT COUNT(*)::INT INTO v_prev_enrollments
  FROM public.enrollments
  WHERE created_at >= v_prev_start_date AND created_at <= v_prev_end_date;

  IF v_prev_enrollments > 0 THEN
    v_prev_completion_rate := ROUND((v_prev_certs::NUMERIC / v_prev_enrollments::NUMERIC) * 100, 1);
  ELSE
    v_prev_completion_rate := 0.0;
  END IF;

  IF v_prev_completion_rate > 0 THEN
    v_completion_change := ROUND(v_completion_rate - v_prev_completion_rate, 1);
  ELSE
    v_completion_change := 0.0;
  END IF;

  RETURN jsonb_build_object(
    'period', p_period,
    'revenue', v_revenue,
    'prev_revenue', v_prev_revenue,
    'revenue_change_pct', v_revenue_change,
    'new_students', v_new_students,
    'prev_new_students', v_prev_new_students,
    'students_change_pct', v_students_change,
    'awaiting_validation', v_awaiting_validation,
    'completion_rate', v_completion_rate,
    'prev_completion_rate', v_prev_completion_rate,
    'completion_change_pct', v_completion_change
  );
END;
$$;

-- 2. 12-Month Revenue Split Function
CREATE OR REPLACE FUNCTION public.get_admin_revenue_12months()
RETURNS TABLE (
  month_key TEXT,
  month_label_fr TEXT,
  month_label_ht TEXT,
  moncash_amount INT,
  natcash_amount INT,
  total_amount INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH months AS (
    SELECT 
      date_trunc('month', m)::date AS m_date
    FROM generate_series(
      date_trunc('month', NOW() - INTERVAL '11 months'),
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS m
  ),
  monthly_payments AS (
    SELECT
      date_trunc('month', p.created_at)::date AS m_date,
      COALESCE(SUM(CASE WHEN p.provider = 'moncash' THEN o.amount_htg ELSE 0 END), 0)::INT AS moncash_sum,
      COALESCE(SUM(CASE WHEN p.provider = 'natcash' THEN o.amount_htg ELSE 0 END), 0)::INT AS natcash_sum,
      COALESCE(SUM(o.amount_htg), 0)::INT AS total_sum
    FROM public.payments p
    JOIN public.orders o ON p.order_id = o.id
    WHERE p.status = 'validated'
      AND p.created_at >= date_trunc('month', NOW() - INTERVAL '11 months')
    GROUP BY date_trunc('month', p.created_at)::date
  )
  SELECT
    to_char(m.m_date, 'YYYY-MM') AS month_key,
    to_char(m.m_date, 'Mon YYYY') AS month_label_fr,
    to_char(m.m_date, 'Mon YYYY') AS month_label_ht,
    COALESCE(mp.moncash_sum, 0) AS moncash_amount,
    COALESCE(mp.natcash_sum, 0) AS natcash_amount,
    COALESCE(mp.total_sum, 0) AS total_amount
  FROM months m
  LEFT JOIN monthly_payments mp ON m.m_date = mp.m_date
  ORDER BY m.m_date ASC;
$$;

-- 3. Top Courses by Students Function
CREATE OR REPLACE FUNCTION public.get_admin_top_courses(p_limit INT DEFAULT 5)
RETURNS TABLE (
  course_id UUID,
  slug TEXT,
  title_fr TEXT,
  title_ht TEXT,
  student_count INT,
  total_students INT,
  percentage NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH course_counts AS (
    SELECT
      c.id AS course_id,
      c.slug,
      c.title_fr,
      c.title_ht,
      COUNT(e.id)::INT AS student_count
    FROM public.courses c
    LEFT JOIN public.enrollments e ON c.id = e.course_id
    GROUP BY c.id, c.slug, c.title_fr, c.title_ht
  ),
  total AS (
    SELECT COALESCE(MAX(student_count), 0)::INT AS max_count,
           COALESCE(SUM(student_count), 0)::INT AS sum_count
    FROM course_counts
  )
  SELECT
    cc.course_id,
    cc.slug,
    cc.title_fr,
    cc.title_ht,
    cc.student_count,
    t.sum_count AS total_students,
    CASE 
      WHEN t.max_count > 0 THEN ROUND((cc.student_count::NUMERIC / t.max_count::NUMERIC) * 100, 1)
      ELSE 0.0
    END AS percentage
  FROM course_counts cc
  CROSS JOIN total t
  ORDER BY cc.student_count DESC
  LIMIT p_limit;
$$;

-- 4. Recent Payments Table Function
CREATE OR REPLACE FUNCTION public.get_admin_recent_payments(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  order_reference TEXT,
  student_name TEXT,
  student_phone TEXT,
  course_title_fr TEXT,
  course_title_ht TEXT,
  provider TEXT,
  amount_htg INT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    o.reference AS order_reference,
    COALESCE(pr.full_name, 'Apprenant') AS student_name,
    COALESCE(pr.phone, p.payer_phone, '') AS student_phone,
    c.title_fr AS course_title_fr,
    c.title_ht AS course_title_ht,
    p.provider,
    o.amount_htg,
    p.status,
    p.created_at
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  JOIN public.courses c ON o.course_id = c.id
  LEFT JOIN public.profiles pr ON o.user_id = pr.id
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;
