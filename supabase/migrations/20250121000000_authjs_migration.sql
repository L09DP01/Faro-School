-- Migration: 20250121000000_authjs_migration.sql
-- Description: Complete database migration for Auth.js v5 (NextAuth) migration.
-- 1. Decouple profiles from auth.users (gen_random_uuid default, email_verified_at)
-- 2. Drop auth.users trigger and handle_new_user function
-- 3. Create security tables: user_credentials, email_verification_tokens, password_reset_tokens, auth_attempts
-- 4. Review and enforce RLS policies compatible with minted JWT sub (auth.uid())
-- 5. Explicit table privilege grants (GRANT to authenticated what each table needs, GRANT to anon ONLY for public catalog data)

-- ============================================================================
-- 1. PROFILES TABLE DECOUPLING FROM auth.users
-- ============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

-- Ensure email is unique (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (LOWER(email));

-- Remove auth.users trigger & auto-creation function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================================
-- 2. NEW SECURITY TABLES (SERVICE-ROLE ONLY)
-- ============================================================================

-- 2.1 User Credentials Table (Service-Role Only)
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;

-- 2.2 Email Verification Tokens Table
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verification_tokens FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON public.email_verification_tokens(LOWER(email), expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON public.email_verification_tokens(token_hash);

-- 2.3 Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON public.password_reset_tokens(token_hash, expires_at);

-- 2.4 Rate Limiting & Abuse Prevention Table (Auth Attempts)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or email
  attempt_type TEXT NOT NULL, -- 'login', 'verification_email', 'reset_email'
  attempts INT NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NULL
);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_attempts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup ON public.auth_attempts(identifier, attempt_type);

-- ============================================================================
-- 3. RPC HELPER FOR ATOMIC USER CREATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_user_with_credentials(
  p_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_locale TEXT,
  p_password_hash TEXT,
  p_email_verified_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_email TEXT := LOWER(TRIM(p_email));
  v_user_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    locale,
    email_verified_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_norm_email,
    p_full_name,
    NULLIF(TRIM(p_phone), ''),
    COALESCE(NULLIF(p_role, ''), 'student'),
    CASE WHEN p_locale = 'ht' THEN 'ht' ELSE 'fr' END,
    p_email_verified_at,
    NOW(),
    NOW()
  );

  -- Insert credentials
  INSERT INTO public.user_credentials (
    user_id,
    password_hash,
    token_version,
    failed_count,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_password_hash,
    0,
    0,
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'email', v_norm_email,
    'role', COALESCE(NULLIF(p_role, ''), 'student'),
    'email_verified', (p_email_verified_at IS NOT NULL)
  );
END;
$$;

-- Revoke public execution on internal RPC
REVOKE ALL ON FUNCTION public.create_user_with_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_with_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- 4. REVIEW RLS POLICIES FOR MINTED JWT SUB (auth.uid())
-- ============================================================================

-- Ensure profiles UPDATE policy prevents privilege escalation on role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Ensure profiles SELECT policy allows authenticated users to view own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_current_user_admin()
    OR id IN (
      SELECT c.instructor_id
      FROM public.courses c
      JOIN public.enrollments e ON e.course_id = c.id
      WHERE e.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. EXPLICIT PRIVILEGE GRANTS (Fail-Closed Architecture)
-- Note: 'Automatically expose new tables' = OFF, 'Enable automatic RLS' = ON
-- ============================================================================

-- 5.1 Revoke broad default privileges
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoke all table privileges from PUBLIC
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- 5.2 Public Catalog Tables: Read-Only for anon & authenticated
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT SELECT ON public.modules TO anon, authenticated;
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.certificates TO anon, authenticated;
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT SELECT ON public.instructors TO anon, authenticated;
GRANT SELECT ON public.platform_settings TO anon, authenticated;

-- 5.3 Public Submission Tables: Insert-Only for anon & authenticated
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;

-- 5.4 Authenticated Student & User Data (Strictly authenticated, NEVER anon)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.lesson_resources TO authenticated;
GRANT SELECT ON public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playback_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_rules_accepted TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, UPDATE ON public.escalations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.moderation_flags TO authenticated;
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;

-- 5.5 Instructor & Administrator Specific Tables (authenticated role, RLS gated)
GRANT UPDATE ON public.instructors TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.instructor_ai_versions TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.private_conversation_access_logs TO authenticated;

-- 5.6 Internal & Service-Role Tables: ZERO grants to anon or authenticated
REVOKE ALL ON public.user_credentials FROM anon, authenticated;
REVOKE ALL ON public.email_verification_tokens FROM anon, authenticated;
REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;
REVOKE ALL ON public.auth_attempts FROM anon, authenticated;

-- Grant all to service_role for system operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
