-- Migration: Transactional Payment Validation RPC & Idempotency Constraints
-- Enforces:
-- 1. Partial unique index on (provider, provider_txn_id) for validated payments
-- 2. Single transactional RPC: validate_payment_transactional()
--    - Row locking with FOR UPDATE on payments and orders
--    - Exact amount_htg check
--    - Valid state transition check (pending/awaiting_validation -> validated)
--    - Atomic order marking (status = 'paid')
--    - Atomic enrollment insertion (ON CONFLICT DO NOTHING)
--    - Atomic coupon counter increment
--    - Audit log entry into admin_audit_logs

-- 1. Create partial unique index to guarantee uniqueness of provider_txn_id per provider for validated payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_txn_validated_unique
ON public.payments (provider, provider_txn_id)
WHERE provider_txn_id IS NOT NULL AND provider_txn_id <> '' AND status = 'validated';

-- 2. Transactional RPC for validating payments atomically
CREATE OR REPLACE FUNCTION public.validate_payment_transactional(
  p_payment_id UUID,
  p_provider_txn_id TEXT DEFAULT NULL,
  p_expected_amount_htg INT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_order RECORD;
  v_clean_txn_id TEXT;
  v_conflict_id UUID;
BEGIN
  v_clean_txn_id := NULLIF(TRIM(p_provider_txn_id), '');

  -- A. Lock the payment row to serialize concurrent webhooks or validation attempts
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: %', p_payment_id;
  END IF;

  -- B. Idempotency guard: If already validated, return success immediately
  IF v_payment.status = 'validated' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_validated', true,
      'payment_id', v_payment.id,
      'order_id', v_payment.order_id
    );
  END IF;

  -- C. Allowed transition guard: only 'pending' or 'awaiting_validation' can transition to 'validated'
  IF v_payment.status NOT IN ('pending', 'awaiting_validation') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: current status is %', v_payment.status;
  END IF;

  -- D. Lock the corresponding order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', v_payment.order_id;
  END IF;

  -- E. Exact amount check (in HTG)
  IF p_expected_amount_htg IS NOT NULL AND v_order.amount_htg <> p_expected_amount_htg THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH: expected % HTG, order amount is % HTG',
      p_expected_amount_htg, v_order.amount_htg;
  END IF;

  -- F. Duplicate transaction ID check
  IF v_clean_txn_id IS NOT NULL THEN
    SELECT id INTO v_conflict_id
    FROM public.payments
    WHERE provider = v_payment.provider
      AND provider_txn_id = v_clean_txn_id
      AND status = 'validated'
      AND id <> p_payment_id
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_TRANSACTION_ID: % already used on payment %',
        v_clean_txn_id, v_conflict_id;
    END IF;
  END IF;

  -- G. Atomically update payment row
  UPDATE public.payments
  SET
    status = 'validated',
    provider_txn_id = COALESCE(v_clean_txn_id, provider_txn_id),
    validated_at = NOW(),
    validated_by = p_admin_id,
    raw = CASE
      WHEN p_metadata IS NOT NULL AND p_metadata <> '{}'::jsonb
      THEN COALESCE(raw, '{}'::jsonb) || p_metadata
      ELSE raw
    END
  WHERE id = p_payment_id;

  -- H. Atomically mark order as paid
  UPDATE public.orders
  SET status = 'paid'
  WHERE id = v_order.id;

  -- I. Atomically insert enrollment (idempotent via ON CONFLICT)
  IF v_order.user_id IS NOT NULL AND v_order.course_id IS NOT NULL THEN
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (v_order.user_id, v_order.course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- J. Atomically increment coupon usage if a coupon was used
  IF v_order.coupon_id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = v_order.coupon_id;
  END IF;

  -- K. Record audit log
  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    payment_id,
    note,
    metadata
  )
  VALUES (
    p_admin_id,
    'payment_validated',
    p_payment_id,
    COALESCE(p_note, CASE WHEN p_admin_id IS NULL THEN 'Webhook Kobara automatique' ELSE 'Validation manuelle' END),
    jsonb_build_object(
      'provider', v_payment.provider,
      'provider_txn_id', COALESCE(v_clean_txn_id, v_payment.provider_txn_id),
      'amount_htg', v_order.amount_htg,
      'order_reference', v_order.reference,
      'automated', (p_admin_id IS NULL)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_validated', false,
    'payment_id', p_payment_id,
    'order_id', v_order.id,
    'order_reference', v_order.reference,
    'amount_htg', v_order.amount_htg
  );
END;
$$;
