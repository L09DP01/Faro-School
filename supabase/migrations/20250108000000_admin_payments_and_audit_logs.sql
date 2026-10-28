-- Migration: Admin Payments, Audit Logs, and Payment Management RPCs

-- 1. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and insert audit logs"
ON public.admin_audit_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 2. Add columns to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_provider_txn_id ON public.payments(provider_txn_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 3. Payments KPI Aggregation Function
CREATE OR REPLACE FUNCTION public.get_admin_payments_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_validated INT := 0;
  v_awaiting_count INT := 0;
  v_moncash_total INT := 0;
  v_natcash_total INT := 0;
BEGIN
  -- Total validated revenue in HTG
  SELECT COALESCE(SUM(o.amount_htg), 0)::INT
  INTO v_total_validated
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  WHERE p.status = 'validated';

  -- Payments awaiting validation count
  SELECT COUNT(*)::INT
  INTO v_awaiting_count
  FROM public.payments
  WHERE status = 'awaiting_validation';

  -- MonCash validated total in HTG
  SELECT COALESCE(SUM(o.amount_htg), 0)::INT
  INTO v_moncash_total
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  WHERE p.status = 'validated' AND p.provider = 'moncash';

  -- NatCash validated total in HTG
  SELECT COALESCE(SUM(o.amount_htg), 0)::INT
  INTO v_natcash_total
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  WHERE p.status = 'validated' AND p.provider = 'natcash';

  RETURN jsonb_build_object(
    'total_validated', v_total_validated,
    'awaiting_count', v_awaiting_count,
    'moncash_total', v_moncash_total,
    'natcash_total', v_natcash_total
  );
END;
$$;

-- 4. Payments Listing Function with filtering and search
CREATE OR REPLACE FUNCTION public.get_admin_payments_list(
  p_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  order_reference TEXT,
  student_id UUID,
  student_name TEXT,
  student_email TEXT,
  student_phone TEXT,
  course_id UUID,
  course_title_fr TEXT,
  course_title_ht TEXT,
  provider TEXT,
  provider_txn_id TEXT,
  payer_phone TEXT,
  amount_htg INT,
  status TEXT,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    o.id AS order_id,
    o.reference AS order_reference,
    pr.id AS student_id,
    COALESCE(pr.full_name, 'Apprenant') AS student_name,
    COALESCE(pr.email, '') AS student_email,
    COALESCE(pr.phone, p.payer_phone, '') AS student_phone,
    c.id AS course_id,
    c.title_fr AS course_title_fr,
    c.title_ht AS course_title_ht,
    p.provider,
    COALESCE(p.provider_txn_id, '') AS provider_txn_id,
    COALESCE(p.payer_phone, '') AS payer_phone,
    o.amount_htg,
    p.status,
    p.validated_at,
    p.validated_by,
    p.rejection_reason,
    p.created_at
  FROM public.payments p
  JOIN public.orders o ON p.order_id = o.id
  JOIN public.courses c ON o.course_id = c.id
  LEFT JOIN public.profiles pr ON o.user_id = pr.id
  WHERE (
    p_status = 'all'
    OR (p_status = 'awaiting_validation' AND p.status = 'awaiting_validation')
    OR (p_status = 'validated' AND p.status = 'validated')
    OR (p_status = 'failed' AND (p.status = 'failed' OR p.status = 'cancelled'))
  )
  AND (
    p_search = ''
    OR pr.full_name ILIKE '%' || p_search || '%'
    OR pr.phone ILIKE '%' || p_search || '%'
    OR p.payer_phone ILIKE '%' || p_search || '%'
    OR p.provider_txn_id ILIKE '%' || p_search || '%'
    OR o.reference ILIKE '%' || p_search || '%'
    OR c.title_fr ILIKE '%' || p_search || '%'
  )
  ORDER BY p.created_at DESC;
$$;
