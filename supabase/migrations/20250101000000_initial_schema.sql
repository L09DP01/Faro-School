-- Limyè Akademi Initial Schema & RLS Policies
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
  locale TEXT NOT NULL CHECK (locale IN ('fr', 'ht')) DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_fr TEXT NOT NULL,
  title_ht TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL DEFAULT '',
  description_ht TEXT NOT NULL DEFAULT '',
  price_htg INT NOT NULL CHECK (price_htg >= 0),
  compare_price_htg INT NULL CHECK (compare_price_htg IS NULL OR compare_price_htg >= price_htg),
  level TEXT NOT NULL DEFAULT 'all',
  category TEXT NOT NULL DEFAULT 'general',
  cover_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Modules Table
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title_fr TEXT NOT NULL,
  title_ht TEXT NOT NULL DEFAULT ''
);

-- 4. Lessons Table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  title_fr TEXT NOT NULL,
  title_ht TEXT NOT NULL DEFAULT '',
  video_id TEXT,
  duration_sec INT NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  description_fr TEXT NOT NULL DEFAULT '',
  description_ht TEXT NOT NULL DEFAULT ''
);

-- 5. Lesson Resources Table
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL
);

-- 6. Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  percent_off INT NULL CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off_htg INT NULL CHECK (amount_off_htg IS NULL OR amount_off_htg > 0),
  max_uses INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NULL
);

-- 7. Enrollments Table
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_course UNIQUE(user_id, course_id)
);

-- 8. Lesson Progress Table
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NULL,
  last_position_sec INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

-- 9. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  amount_htg INT NOT NULL CHECK (amount_htg >= 0),
  coupon_id UUID NULL REFERENCES public.coupons(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')) DEFAULT 'pending',
  reference TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('moncash', 'natcash', 'kobara')),
  provider_txn_id TEXT,
  payer_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'awaiting_validation', 'validated', 'failed')) DEFAULT 'pending',
  raw JSONB DEFAULT '{}'::jsonb,
  validated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Contact Messages Table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Playback Sessions Table (Enforces max 2 active devices per student)
CREATE TABLE IF NOT EXISTS public.playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON public.enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders(reference);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_user_active ON public.playback_sessions(user_id) WHERE ended_at IS NULL;

-- Helper function: Check if current authenticated user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger 1: Auto-create profile on Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'fr')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Auto-enroll student & update order when payment is validated
CREATE OR REPLACE FUNCTION public.handle_payment_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_course_id UUID;
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    -- Mark order as paid
    UPDATE public.orders
    SET status = 'paid'
    WHERE id = NEW.order_id
    RETURNING user_id, course_id INTO v_user_id, v_course_id;

    -- Create enrollment
    IF v_user_id IS NOT NULL AND v_course_id IS NOT NULL THEN
      INSERT INTO public.enrollments (user_id, course_id)
      VALUES (v_user_id, v_course_id)
      ON CONFLICT (user_id, course_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_status_validated ON public.payments;
CREATE TRIGGER on_payment_status_validated
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_validation();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playback_sessions ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Profiles
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Courses
CREATE POLICY "Admins have full access to courses"
  ON public.courses FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Public can view published courses"
  ON public.courses FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Modules
CREATE POLICY "Admins have full access to modules"
  ON public.modules FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Public can view modules for published courses"
  ON public.modules FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE courses.id = modules.course_id AND courses.status = 'published'
    )
  );

-- Lessons
CREATE POLICY "Admins have full access to lessons"
  ON public.lessons FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Public can view lesson metadata for published courses"
  ON public.lessons FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id AND courses.status = 'published'
    )
  );

-- Lesson Resources (Enrolled or free preview only)
CREATE POLICY "Admins have full access to lesson resources"
  ON public.lesson_resources FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Enrolled students or free preview can access resources"
  ON public.lesson_resources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      LEFT JOIN public.enrollments e ON e.course_id = m.course_id AND e.user_id = auth.uid()
      WHERE l.id = lesson_resources.lesson_id
        AND (l.is_free_preview = TRUE OR e.id IS NOT NULL)
    )
  );

-- Coupons
CREATE POLICY "Admins have full access to coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Anyone can lookup active coupons"
  ON public.coupons FOR SELECT
  TO anon, authenticated
  USING (expires_at IS NULL OR expires_at > NOW());

-- Enrollments
CREATE POLICY "Admins have full access to enrollments"
  ON public.enrollments FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Lesson Progress
CREATE POLICY "Admins have full access to lesson progress"
  ON public.lesson_progress FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users manage own lesson progress"
  ON public.lesson_progress FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Orders
CREATE POLICY "Admins have full access to orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Payments
CREATE POLICY "Admins have full access to payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
    )
  );

-- Certificates
CREATE POLICY "Admins have full access to certificates"
  ON public.certificates FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Public can verify certificates by code"
  ON public.certificates FOR SELECT
  TO anon
  USING (TRUE);

-- Reviews
CREATE POLICY "Admins have full access to reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Public can view reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Enrolled students can write reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.user_id = auth.uid() AND enrollments.course_id = reviews.course_id
    )
  );

-- Contact Messages
CREATE POLICY "Admins have full access to contact messages"
  ON public.contact_messages FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Anyone can submit contact message"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

-- Playback Sessions
CREATE POLICY "Admins have full access to playback sessions"
  ON public.playback_sessions FOR ALL
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users manage own playback sessions"
  ON public.playback_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
