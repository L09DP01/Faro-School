-- Migration: Update handle_payment_validation trigger to atomically increment coupons.used_count
-- only when a payment status becomes 'validated'.

CREATE OR REPLACE FUNCTION public.handle_payment_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_course_id UUID;
  v_coupon_id UUID;
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    -- 1. Mark order as paid
    UPDATE public.orders
    SET status = 'paid'
    WHERE id = NEW.order_id
    RETURNING user_id, course_id, coupon_id INTO v_user_id, v_course_id, v_coupon_id;

    -- 2. Create enrollment for student (idempotent via ON CONFLICT)
    IF v_user_id IS NOT NULL AND v_course_id IS NOT NULL THEN
      INSERT INTO public.enrollments (user_id, course_id)
      VALUES (v_user_id, v_course_id)
      ON CONFLICT (user_id, course_id) DO NOTHING;
    END IF;

    -- 3. Increment coupon usage count only upon validated payment
    IF v_coupon_id IS NOT NULL THEN
      UPDATE public.coupons
      SET used_count = used_count + 1
      WHERE id = v_coupon_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
