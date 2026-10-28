-- Migration: Auto-issue certificate upon 100% course completion
-- Also ensures updated_at on lesson_progress

ALTER TABLE public.lesson_progress
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Function to check course completion and issue certificate
CREATE OR REPLACE FUNCTION public.check_course_completion_and_issue_certificate()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_total_lessons INT;
  v_completed_lessons INT;
  v_cert_exists BOOLEAN;
  v_cert_code TEXT;
  v_random_suffix TEXT;
BEGIN
  -- Only proceed if the lesson was completed
  IF NEW.completed_at IS NULL THEN
    NEW.updated_at = NOW();
    RETURN NEW;
  END IF;

  NEW.updated_at = NOW();

  -- 1. Get course_id for this lesson
  SELECT m.course_id INTO v_course_id
  FROM public.lessons l
  JOIN public.modules m ON l.module_id = m.id
  WHERE l.id = NEW.lesson_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Count total lessons in the course
  SELECT COUNT(l.id) INTO v_total_lessons
  FROM public.lessons l
  JOIN public.modules m ON l.module_id = m.id
  WHERE m.course_id = v_course_id;

  IF v_total_lessons = 0 THEN
    RETURN NEW;
  END IF;

  -- 3. Count completed lessons for this user & course
  SELECT COUNT(lp.lesson_id) INTO v_completed_lessons
  FROM public.lesson_progress lp
  JOIN public.lessons l ON lp.lesson_id = l.id
  JOIN public.modules m ON l.module_id = m.id
  WHERE m.course_id = v_course_id
    AND lp.user_id = NEW.user_id
    AND lp.completed_at IS NOT NULL;

  -- 4. If all lessons are completed, issue certificate if not already issued
  IF v_completed_lessons >= v_total_lessons THEN
    SELECT EXISTS (
      SELECT 1 FROM public.certificates
      WHERE user_id = NEW.user_id AND course_id = v_course_id
    ) INTO v_cert_exists;

    IF NOT v_cert_exists THEN
      -- Generate clean certificate verification code (e.g. LA-CERT-7B3K9X)
      v_random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
      v_cert_code := 'LA-' || v_random_suffix;

      INSERT INTO public.certificates (user_id, course_id, code, issued_at)
      VALUES (NEW.user_id, v_course_id, v_cert_code, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on lesson_progress insert or update
DROP TRIGGER IF EXISTS trg_issue_certificate_on_completion ON public.lesson_progress;
CREATE TRIGGER trg_issue_certificate_on_completion
BEFORE INSERT OR UPDATE OF completed_at, last_position_sec ON public.lesson_progress
FOR EACH ROW
EXECUTE FUNCTION public.check_course_completion_and_issue_certificate();
