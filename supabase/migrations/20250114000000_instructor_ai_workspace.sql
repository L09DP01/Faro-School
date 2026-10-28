-- Migration: 20250114000000_instructor_ai_workspace.sql
-- Description: Instructor AI settings versions, knowledge base, and student progress tracking

-- 1. Table for AI settings version history (stores last 5 versions per instructor)
CREATE TABLE IF NOT EXISTS public.instructor_ai_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings JSONB NOT NULL,
  version_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_versions_instructor ON public.instructor_ai_versions(instructor_id, version_number DESC);

-- 2. Function to rotate AI settings versions (keeping at most 5 versions)
CREATE OR REPLACE FUNCTION public.save_instructor_ai_version(
  p_instructor_id UUID,
  p_settings JSONB
)
RETURNS VOID AS $$
DECLARE
  v_next_version INT;
BEGIN
  -- Get max version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.instructor_ai_versions
  WHERE instructor_id = p_instructor_id;

  -- Insert new version
  INSERT INTO public.instructor_ai_versions (instructor_id, settings, version_number, created_at)
  VALUES (p_instructor_id, p_settings, v_next_version, NOW());

  -- Delete older versions beyond the last 5
  DELETE FROM public.instructor_ai_versions
  WHERE instructor_id = p_instructor_id
    AND id NOT IN (
      SELECT id FROM public.instructor_ai_versions
      WHERE instructor_id = p_instructor_id
      ORDER BY version_number DESC
      LIMIT 5
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS on instructor_ai_versions
ALTER TABLE public.instructor_ai_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own AI versions"
  ON public.instructor_ai_versions FOR SELECT
  TO authenticated
  USING (
    instructor_id = auth.uid() OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Instructors can insert own AI versions"
  ON public.instructor_ai_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    instructor_id = auth.uid() OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
