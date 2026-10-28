-- Migration: 20250113000000_private_messaging_schema.sql
-- Description: Private messaging between student and staff (instructor/admin), presence, AI escalation, and 2-minute rule

-- 1. Extend instructors table with availability and AI configuration
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ai_settings JSONB NOT NULL DEFAULT '{
    "name": "Assistant IA",
    "tone": "bienveillant et concis",
    "languages": ["fr", "ht"],
    "confidence_threshold": 0.7,
    "always_escalate": ["remboursement", "paiement", "certificat", "note", "plainte", "compte", "mot de passe"]
  }'::jsonb;

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES public.courses(id) ON DELETE SET NULL,
  subject TEXT NOT NULL CHECK (char_length(subject) > 0 AND char_length(subject) <= 200),
  status TEXT NOT NULL CHECK (status IN ('open', 'ai_handling', 'waiting_staff', 'staff_replied', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_different_participants CHECK (student_id != staff_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_student ON public.conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_staff ON public.conversations(staff_id);
CREATE INDEX IF NOT EXISTS idx_conversations_course ON public.conversations(course_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'staff', 'ai', 'system')),
  sender_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 4000),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(conversation_id, read_at) WHERE read_at IS NULL;

-- 4. Escalations Table
CREATE TABLE IF NOT EXISTS public.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  trigger_message_id UUID NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  email_status TEXT NOT NULL CHECK (email_status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  deadline_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NULL,
  followup_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_pending ON public.escalations(deadline_at) 
  WHERE resolved_at IS NULL AND followup_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escalations_conversation ON public.escalations(conversation_id);

-- 5. AI Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_conversation ON public.ai_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage(created_at DESC);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);

-- 7. Hard Verification Rules & Guard Functions
-- Verifies that:
-- - student_id is an actual student
-- - staff_id is an instructor or admin
-- - If course_id is set: student must be enrolled in course, and staff_id must be the course instructor (or admin)
-- - If course_id is NULL: staff_id must be an admin
CREATE OR REPLACE FUNCTION public.validate_conversation_participants()
RETURNS TRIGGER AS $$
DECLARE
  v_student_role TEXT;
  v_staff_role TEXT;
  v_course_instructor UUID;
  v_is_enrolled BOOLEAN;
BEGIN
  -- Check student role
  SELECT role INTO v_student_role FROM public.profiles WHERE id = NEW.student_id;
  IF v_student_role IS NULL OR v_student_role != 'student' THEN
    RAISE EXCEPTION 'Invalid student_id: Participant must have role "student"';
  END IF;

  -- Check staff role
  SELECT role INTO v_staff_role FROM public.profiles WHERE id = NEW.staff_id;
  IF v_staff_role IS NULL OR v_staff_role NOT IN ('instructor', 'admin') THEN
    RAISE EXCEPTION 'Invalid staff_id: Participant must have role "instructor" or "admin"';
  END IF;

  -- If course_id is provided
  IF NEW.course_id IS NOT NULL THEN
    -- Student must be enrolled in the course
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE user_id = NEW.student_id AND course_id = NEW.course_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
      RAISE EXCEPTION 'Unauthorized: Student is not enrolled in course %', NEW.course_id;
    END IF;

    -- Staff must be instructor of the course or an admin
    IF v_staff_role != 'admin' THEN
      SELECT instructor_id INTO v_course_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_course_instructor IS NULL OR v_course_instructor != NEW.staff_id THEN
        RAISE EXCEPTION 'Unauthorized: Staff member is not the instructor of course %', NEW.course_id;
      END IF;
    END IF;
  ELSE
    -- General question without a course must be directed to an admin
    IF v_staff_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: General inquiries without a course must be directed to an admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_conversation ON public.conversations;
CREATE TRIGGER trg_validate_conversation
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_participants();

-- Trigger to keep conversation.last_message_at updated
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_conversation_last_msg ON public.messages;
CREATE TRIGGER trg_update_conversation_last_msg
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- 8. Row Level Security Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Conversations RLS
-- Students: read & create own conversations
CREATE POLICY "Students can view own conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Instructors: read only conversations where they are the assigned staff member
CREATE POLICY "Instructors can view assigned conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'instructor');

CREATE POLICY "Instructors can update assigned conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (staff_id = auth.uid() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'instructor');

-- Admins: can view their own conversations directly, or any conversation
CREATE POLICY "Admins can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Messages RLS
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.student_id = auth.uid() OR c.staff_id = auth.uid())
    )
    OR
    ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  );

CREATE POLICY "Participants can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          (sender_type = 'student' AND c.student_id = auth.uid() AND sender_id = auth.uid())
          OR
          (sender_type = 'staff' AND c.staff_id = auth.uid() AND sender_id = auth.uid())
          OR
          (sender_type IN ('ai', 'system')) -- Generated by Server Actions / System
        )
    )
  );

-- Notifications RLS
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Escalations RLS (Staff and Admins only)
CREATE POLICY "Staff can view escalations"
  ON public.escalations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = escalations.conversation_id
        AND (c.staff_id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    )
  );

-- Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
