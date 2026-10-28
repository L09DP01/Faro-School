-- Migration: 20250111000000_instructor_role_and_permissions.sql
-- Description: Add 'instructor' role, instructors table, courses.instructor_id, and central RLS policies

-- 1. Update profiles.role constraint to include 'instructor'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'instructor', 'admin'));

-- 2. Add community, messaging, and profile enrichment fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ NULL;

-- 3. Create instructors table
CREATE TABLE IF NOT EXISTS public.instructors (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  escalation_email TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active instructors
CREATE INDEX IF NOT EXISTS idx_instructors_active ON public.instructors(is_active);

-- 4. Add instructor_id to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses(instructor_id);

-- Backfill existing courses with the first admin profile
UPDATE public.courses
SET instructor_id = (
  SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
)
WHERE instructor_id IS NULL;

-- 5. Helper function: check if authenticated user is instructor
CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'instructor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Helper function: check if authenticated user owns the course
CREATE OR REPLACE FUNCTION public.is_course_instructor(p_course_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = p_course_id AND instructor_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. RLS for instructors table
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Admins have full access to instructors
CREATE POLICY "Admins full access to instructors"
  ON public.instructors FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Instructors can read their own profile
CREATE POLICY "Instructors can read own profile"
  ON public.instructors FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Public can view active instructors
CREATE POLICY "Public can view active instructors"
  ON public.instructors FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- 8. Course policies for instructors
-- Instructors can view their own courses (even draft)
CREATE POLICY "Instructors view own courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    (public.is_instructor() AND instructor_id = auth.uid())
  );

-- Instructors can update their own courses
CREATE POLICY "Instructors update own courses"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR
    (public.is_instructor() AND instructor_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin() OR
    (public.is_instructor() AND instructor_id = auth.uid())
  );

-- Instructors can insert courses (setting themselves as instructor)
CREATE POLICY "Instructors insert own courses"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    (public.is_instructor() AND instructor_id = auth.uid())
  );

-- 9. Modules policies for instructors
CREATE POLICY "Instructors manage own course modules"
  ON public.modules FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_course_instructor(course_id)
  )
  WITH CHECK (
    public.is_admin() OR
    public.is_course_instructor(course_id)
  );

-- 10. Lessons policies for instructors
CREATE POLICY "Instructors manage own course lessons"
  ON public.lessons FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.modules
      JOIN public.courses ON courses.id = modules.course_id
      WHERE modules.id = lessons.module_id AND courses.instructor_id = auth.uid()
    )
  );

-- 11. Lesson resources policies for instructors
CREATE POLICY "Instructors manage own lesson resources"
  ON public.lesson_resources FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON modules.id = lessons.module_id
      JOIN public.courses ON courses.id = modules.course_id
      WHERE lessons.id = lesson_resources.lesson_id AND courses.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.lessons
      JOIN public.modules ON modules.id = lessons.module_id
      JOIN public.courses ON courses.id = modules.course_id
      WHERE lessons.id = lesson_resources.lesson_id AND courses.instructor_id = auth.uid()
    )
  );

-- 12. Enrollments policies for instructors
-- Instructors can only view enrollments for courses they instruct
CREATE POLICY "Instructors view enrollments for own courses"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    public.is_course_instructor(course_id)
  );

-- 13. Profiles policies for instructors
-- Instructors can only view student profiles for students enrolled in their courses
CREATE POLICY "Instructors view profiles of their enrolled students"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.user_id = profiles.id AND c.instructor_id = auth.uid()
    )
  );

-- 14. Lesson Progress policies for instructors
-- Instructors can view student lesson progress for their courses
CREATE POLICY "Instructors view progress of their course lessons"
  ON public.lesson_progress FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      WHERE l.id = lesson_progress.lesson_id AND c.instructor_id = auth.uid()
    )
  );
