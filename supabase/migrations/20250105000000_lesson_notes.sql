-- Migration: Lesson Notes table for private student notes per lesson

CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_lesson_notes UNIQUE (user_id, lesson_id)
);

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON public.lesson_notes(user_id, lesson_id);

-- Enable RLS
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins have full access to lesson notes"
  ON public.lesson_notes FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Students manage own notes
CREATE POLICY "Users can manage own lesson notes"
  ON public.lesson_notes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
