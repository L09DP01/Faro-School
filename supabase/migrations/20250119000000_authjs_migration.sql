-- Migration: Replace Supabase Auth with Auth.js v5 (NextAuth)
-- Profiles becomes the primary user identity table.
-- RLS continues to work via minted user JWTs where auth.uid() = sub.

-- 1. Profiles Table Decoupling from auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

-- Ensure email is unique (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (LOWER(email));

-- Remove auth.users trigger & auto-creation function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. User Credentials Table (Service-Role Only)
CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS with zero policies (strict service-role only access)
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;

-- 3. Email Verification Tokens Table
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

-- 4. Password Reset Tokens Table
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

-- 5. Rate Limiting & Abuse Prevention Table (Auth Attempts)
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

-- 6. RPC Helper for Atomic Profile and Credentials Creation
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
  -- Insert into profiles
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
    TRIM(p_full_name),
    p_phone,
    p_role,
    COALESCE(p_locale, 'fr'),
    p_email_verified_at,
    NOW(),
    NOW()
  );

  -- Insert into credentials
  INSERT INTO public.user_credentials (
    user_id,
    password_hash,
    token_version,
    failed_count,
    locked_until,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_password_hash,
    0,
    0,
    NULL,
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_with_credentials FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_with_credentials TO service_role;
