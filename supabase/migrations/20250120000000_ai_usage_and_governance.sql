-- Migration: AI Usage Tracking, Atomic Rate Limits, and Persisted Settings
-- 1. Extend public.ai_usage with user_id and cost_usd
-- 2. Add functions: check_ai_limits() and record_ai_usage()
-- 3. Initialize default platform_settings for key 'ai_global_settings'

-- 1. Columns for user attribution and cost tracking
ALTER TABLE public.ai_usage
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON public.ai_usage(created_at DESC);

-- 2. Function to check rate limits, quotas, and cost cap atomically
CREATE OR REPLACE FUNCTION public.check_ai_limits(
  p_student_id UUID,
  p_daily_limit INT DEFAULT 30,
  p_daily_cost_cap_usd NUMERIC DEFAULT 15.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_call TIMESTAMPTZ;
  v_today_count INT := 0;
  v_today_platform_cost NUMERIC := 0;
BEGIN
  -- A. Check 2-second cooldown per student
  SELECT created_at INTO v_last_call
  FROM public.ai_usage
  WHERE user_id = p_student_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_call IS NOT NULL AND (NOW() - v_last_call) < INTERVAL '2 seconds' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Veuillez patienter 2 secondes entre deux questions à l''IA.'
    );
  END IF;

  -- B. Check per-student daily count
  SELECT COUNT(*)::INT INTO v_today_count
  FROM public.ai_usage
  WHERE user_id = p_student_id
    AND created_at >= (NOW() AT TIME ZONE 'UTC')::DATE;

  IF v_today_count >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Quota quotidien de %s réponses IA atteint pour aujourd''hui.', p_daily_limit)
    );
  END IF;

  -- C. Check platform daily cost cap
  SELECT COALESCE(SUM(cost_usd), 0)::NUMERIC INTO v_today_platform_cost
  FROM public.ai_usage
  WHERE created_at >= (NOW() AT TIME ZONE 'UTC')::DATE;

  IF v_today_platform_cost >= p_daily_cost_cap_usd THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Plafond de coût quotidien IA ($%s) atteint pour la plateforme. Escalade automatique.', p_daily_cost_cap_usd)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'today_count', v_today_count,
    'today_platform_cost', v_today_platform_cost
  );
END;
$$;

-- 3. Function to atomically record AI usage and cost
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_conversation_id UUID,
  p_student_id UUID,
  p_model TEXT,
  p_input_tokens INT,
  p_output_tokens INT,
  p_cost_usd NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.ai_usage (
    conversation_id,
    user_id,
    model,
    input_tokens,
    output_tokens,
    cost_usd
  )
  VALUES (
    p_conversation_id,
    p_student_id,
    p_model,
    COALESCE(p_input_tokens, 0),
    COALESCE(p_output_tokens, 0),
    COALESCE(p_cost_usd, 0)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Seed default ai_global_settings into platform_settings if not present
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'ai_global_settings',
  jsonb_build_object(
    'default_model', 'claude-3-haiku-20240307',
    'default_confidence_threshold', 0.75,
    'daily_cost_cap_usd', 15.0,
    'student_daily_limit', 30,
    'kill_switch', false
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
