-- Migration: Course Management & Options
-- Adds options column and RPC helpers for admin course management

-- 1. Add options column to courses table if not exists
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{"certificate": true, "lifetime_access": true, "guarantee_days": 7}'::jsonb;

-- 2. Function to list all courses for admin with enrollment count and total revenue
CREATE OR REPLACE FUNCTION public.get_admin_courses_list()
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title_fr TEXT,
  title_ht TEXT,
  description_fr TEXT,
  description_ht TEXT,
  price_htg INT,
  compare_price_htg INT,
  level TEXT,
  category TEXT,
  cover_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  students_count INT,
  revenue_htg INT,
  modules_count INT,
  lessons_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH course_enrollments AS (
    SELECT course_id, COUNT(id)::INT AS cnt
    FROM public.enrollments
    GROUP BY course_id
  ),
  course_revenue AS (
    SELECT o.course_id, COALESCE(SUM(o.amount_htg), 0)::INT AS rev
    FROM public.orders o
    JOIN public.payments p ON p.order_id = o.id
    WHERE p.status = 'validated'
    GROUP BY o.course_id
  ),
  course_modules AS (
    SELECT course_id, COUNT(id)::INT AS cnt
    FROM public.modules
    GROUP BY course_id
  ),
  course_lessons AS (
    SELECT m.course_id, COUNT(l.id)::INT AS cnt
    FROM public.modules m
    JOIN public.lessons l ON l.module_id = m.id
    GROUP BY m.course_id
  )
  SELECT
    c.id,
    c.slug,
    c.title_fr,
    c.title_ht,
    c.description_fr,
    c.description_ht,
    c.price_htg,
    c.compare_price_htg,
    c.level,
    c.category,
    c.cover_url,
    c.status,
    c.created_at,
    COALESCE(ce.cnt, 0) AS students_count,
    COALESCE(cr.rev, 0) AS revenue_htg,
    COALESCE(cm.cnt, 0) AS modules_count,
    COALESCE(cl.cnt, 0) AS lessons_count
  FROM public.courses c
  LEFT JOIN course_enrollments ce ON ce.course_id = c.id
  LEFT JOIN course_revenue cr ON cr.course_id = c.id
  LEFT JOIN course_modules cm ON cm.course_id = c.id
  LEFT JOIN course_lessons cl ON cl.course_id = c.id
  ORDER BY c.created_at DESC;
$$;

-- 3. Function to duplicate a course with its modules and lessons
CREATE OR REPLACE FUNCTION public.duplicate_course(p_course_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_course_id UUID := gen_random_uuid();
  v_old_course RECORD;
  v_new_slug TEXT;
  v_suffix INT := 1;
  v_mod RECORD;
  v_new_mod_id UUID;
  v_les RECORD;
  v_new_les_id UUID;
BEGIN
  -- Fetch original course
  SELECT * INTO v_old_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Generate unique slug with -copie suffix
  v_new_slug := v_old_course.slug || '-copie';
  WHILE EXISTS (SELECT 1 FROM public.courses WHERE slug = v_new_slug) LOOP
    v_suffix := v_suffix + 1;
    v_new_slug := v_old_course.slug || '-copie-' || v_suffix;
  END LOOP;

  -- Insert cloned course with draft status
  INSERT INTO public.courses (
    id, slug, title_fr, title_ht, description_fr, description_ht,
    price_htg, compare_price_htg, level, category, cover_url, status, options, created_at
  )
  VALUES (
    v_new_course_id,
    v_new_slug,
    v_old_course.title_fr || ' (Copie)',
    CASE WHEN v_old_course.title_ht <> '' THEN v_old_course.title_ht || ' (Kopi)' ELSE '' END,
    v_old_course.description_fr,
    v_old_course.description_ht,
    v_old_course.price_htg,
    v_old_course.compare_price_htg,
    v_old_course.level,
    v_old_course.category,
    v_old_course.cover_url,
    'draft',
    v_old_course.options,
    NOW()
  );

  -- Clone modules & lessons
  FOR v_mod IN SELECT * FROM public.modules WHERE course_id = p_course_id ORDER BY position ASC LOOP
    v_new_mod_id := gen_random_uuid();
    INSERT INTO public.modules (id, course_id, position, title_fr, title_ht)
    VALUES (v_new_mod_id, v_new_course_id, v_mod.position, v_mod.title_fr, v_mod.title_ht);

    FOR v_les IN SELECT * FROM public.lessons WHERE module_id = v_mod.id ORDER BY position ASC LOOP
      v_new_les_id := gen_random_uuid();
      INSERT INTO public.lessons (
        id, module_id, position, title_fr, title_ht, video_id,
        duration_sec, is_free_preview, description_fr, description_ht
      )
      VALUES (
        v_new_les_id, v_new_mod_id, v_les.position, v_les.title_fr, v_les.title_ht,
        v_les.video_id, v_les.duration_sec, v_les.is_free_preview, v_les.description_fr, v_les.description_ht
      );

      -- Clone lesson resources
      INSERT INTO public.lesson_resources (id, lesson_id, name, file_url)
      SELECT gen_random_uuid(), v_new_les_id, name, file_url
      FROM public.lesson_resources
      WHERE lesson_id = v_les.id;
    END LOOP;
  END LOOP;

  RETURN v_new_course_id;
END;
$$;
