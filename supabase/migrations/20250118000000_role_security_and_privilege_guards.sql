-- Migration: 20250118000000_role_security_and_privilege_guards.sql
-- Description: Absolute protection of user roles, handle_new_user hardening, admin-only RPC set_user_role, and table grants review.

-- 1. Helper function: verify if the caller is an active administrator
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN (v_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Redefine handle_new_user: new profiles ALWAYS get role 'student'
-- raw_user_meta_data.role is strictly ignored.
-- Safe fields (full_name, phone, locale) are sanitized and length-limited.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_locale TEXT;
BEGIN
  v_full_name := SUBSTRING(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')) FROM 1 FOR 100);
  v_phone := SUBSTRING(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')) FROM 1 FOR 25);
  v_locale := CASE 
    WHEN NEW.raw_user_meta_data->>'locale' = 'ht' THEN 'ht' 
    ELSE 'fr' 
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    phone,
    role,
    locale,
    email,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    NULLIF(v_phone, ''),
    'student', -- HARD RULE: Always student, never from raw_user_meta_data
    v_locale,
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    updated_at = NOW()
  WHERE profiles.email IS NULL OR profiles.email = '';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger on auth.users if not already attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Protect profiles.role and privileged columns with a BEFORE UPDATE trigger
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Check role modification
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_current_user_admin() THEN
      RAISE EXCEPTION 'SECURITY ERROR: Unauthorized attempt to change role from "%" to "%". Only administrators can modify roles.', OLD.role, NEW.role;
    END IF;
  END IF;

  -- Check moderation status modifications (banned_at, muted_until)
  IF (NEW.banned_at IS DISTINCT FROM OLD.banned_at OR NEW.muted_until IS DISTINCT FROM OLD.muted_until) THEN
    IF NOT public.is_current_user_admin() THEN
      RAISE EXCEPTION 'SECURITY ERROR: Unauthorized attempt to modify moderation status. Admin only.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Revoke column-level UPDATE on role from authenticated and anon
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- Hardened RLS Policy for own profile update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

-- 4. Admin-only RPC: set_user_role
CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_old_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Verify admin authorization
  IF v_caller_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION '403 Forbidden: Only administrators can modify user roles.';
  END IF;

  -- Validate new role value
  IF new_role NOT IN ('student', 'instructor', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: "%". Must be student, instructor, or admin.', new_role;
  END IF;

  -- Fetch existing role
  SELECT role INTO v_old_role FROM public.profiles WHERE id = target_user_id;
  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'User profile not found for ID %', target_user_id;
  END IF;

  -- Perform role change
  UPDATE public.profiles
  SET role = new_role, updated_at = NOW()
  WHERE id = target_user_id;

  -- Record audit log
  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    user_id,
    metadata
  ) VALUES (
    v_caller_id,
    'change_user_role',
    target_user_id,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', new_role,
      'changed_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', target_user_id,
    'old_role', v_old_role,
    'new_role', new_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;

-- 5. Strict Table Grants Review
-- Anon has ZERO write access to any table in public schema
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- Revoke TRUNCATE on all tables from authenticated
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Revoke direct mutations on sensitive administrative logs
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.coupons FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.platform_settings FROM authenticated, anon;
