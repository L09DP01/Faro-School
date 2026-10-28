-- Migration: 20250116000000_pwa_community_dm_moderation_fixes.sql
-- Description: Message idempotency (client_message_id), Moderation flags table, and DM permission guards.

-- 1. Add client_message_id to community_messages for idempotent sends
ALTER TABLE public.community_messages
  ADD COLUMN IF NOT EXISTS client_message_id UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_messages_client_id
  ON public.community_messages(author_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- 2. Add client_message_id to messages (private messaging) for idempotent sends
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_message_id UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id
  ON public.messages(sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- 3. Moderation Flags Table
CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NULL, -- e.g. 'community' or conversation UUID
  conversation_id UUID NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('phone', 'offplatform')),
  excerpt TEXT NOT NULL, -- Always masked, e.g. '+509 •• •• 12 34' or 'écrivez-moi sur wa...'
  status TEXT NOT NULL CHECK (status IN ('open', 'reviewed', 'dismissed')) DEFAULT 'open',
  reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_status ON public.moderation_flags(user_id, status);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_created ON public.moderation_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON public.moderation_flags(status) WHERE status = 'open';

-- RLS for moderation_flags
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderation flags"
  ON public.moderation_flags FOR ALL
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can insert own moderation flags"
  ON public.moderation_flags FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Extend conversations validation to strictly prevent instructors from starting conversations
CREATE OR REPLACE FUNCTION public.validate_conversation_participants()
RETURNS TRIGGER AS $$
DECLARE
  v_student_role TEXT;
  v_staff_role TEXT;
  v_course_instructor UUID;
  v_is_enrolled BOOLEAN;
  v_creator_role TEXT;
BEGIN
  -- Creator check: Instructors can NEVER initiate a conversation
  SELECT role INTO v_creator_role FROM public.profiles WHERE id = auth.uid();
  IF v_creator_role = 'instructor' THEN
    RAISE EXCEPTION 'Unauthorized: Instructors cannot initiate private conversations.';
  END IF;

  -- Check student role
  SELECT role INTO v_student_role FROM public.profiles WHERE id = NEW.student_id;
  IF v_student_role IS NULL THEN
    RAISE EXCEPTION 'Invalid student_id: Participant profile not found';
  END IF;

  -- Check staff role
  SELECT role INTO v_staff_role FROM public.profiles WHERE id = NEW.staff_id;
  IF v_staff_role IS NULL THEN
    RAISE EXCEPTION 'Invalid staff_id: Participant profile not found';
  END IF;

  -- If course_id is provided
  IF NEW.course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE user_id = NEW.student_id AND course_id = NEW.course_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled AND v_creator_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Student is not enrolled in course %', NEW.course_id;
    END IF;

    IF v_staff_role != 'admin' THEN
      SELECT instructor_id INTO v_course_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_course_instructor IS NULL OR v_course_instructor != NEW.staff_id THEN
        RAISE EXCEPTION 'Unauthorized: Staff member is not the instructor of course %', NEW.course_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Realtime publication for moderation_flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'moderation_flags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.moderation_flags;
  END IF;
END $$;
