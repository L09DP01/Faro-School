-- Migration: Admin Students, Promotions, and Contact Messages extensions

-- 1. Extend profiles with email column if not already present
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update trigger handle_new_user to populate email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, locale, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'fr'),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email
  WHERE profiles.email IS NULL OR profiles.email = '';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Extend coupons table with is_active and created_at
ALTER TABLE public.coupons
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);

-- 3. Extend contact_messages table with read and read_at
ALTER TABLE public.contact_messages
ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_read ON public.contact_messages(read);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);

-- 4. Extend admin_audit_logs with user_id and course_id
ALTER TABLE public.admin_audit_logs
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user ON public.admin_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_course ON public.admin_audit_logs(course_id);

-- 5. Extend enrollments table with note and granted_by
ALTER TABLE public.enrollments
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
