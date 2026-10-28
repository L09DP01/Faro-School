-- Migration: 20250112000000_community_schema.sql
-- Description: Community messages, reactions, reports, reads, and rules acceptance

-- 1. Helper function to check if a user is muted
CREATE OR REPLACE FUNCTION public.is_muted(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND muted_until IS NOT NULL
      AND muted_until > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Helper function to check if a user is banned
CREATE OR REPLACE FUNCTION public.is_banned(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND banned_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Community Messages Table
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000 AND char_length(body) > 0),
  attachment_url TEXT NULL,
  reply_to_id UUID NULL REFERENCES public.community_messages(id) ON DELETE SET NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON public.community_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_author_id ON public.community_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_pinned ON public.community_messages(pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_community_messages_deleted_at ON public.community_messages(deleted_at) WHERE deleted_at IS NULL;

-- 4. Community Reactions Table
CREATE TABLE IF NOT EXISTS public.community_reactions (
  message_id UUID NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_community_reactions_message ON public.community_reactions(message_id);

-- 5. Community Reports Table
CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_reports_status ON public.community_reports(status);

-- 6. Community Reads Table (Tracks last read message timestamp per user)
CREATE TABLE IF NOT EXISTS public.community_reads (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Community Rules Accepted Table
CREATE TABLE IF NOT EXISTS public.community_rules_accepted (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_rules_accepted ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies: community_messages
-- Non-banned users can read all non-deleted messages (or admins can read all)
CREATE POLICY "Read community messages"
  ON public.community_messages FOR SELECT
  TO authenticated
  USING (
    NOT public.is_banned(auth.uid()) AND (deleted_at IS NULL OR public.is_admin())
  );

-- Non-banned and non-muted users can insert their own messages
CREATE POLICY "Insert community messages"
  ON public.community_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND NOT public.is_banned(auth.uid())
    AND NOT public.is_muted(auth.uid())
  );

-- Admin can soft delete or pin/unpin any message.
-- Author can soft-delete within 5 minutes of creation.
-- Instructors can pin/unpin messages.
CREATE POLICY "Update community messages"
  ON public.community_messages FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_instructor() AND NOT public.is_banned(auth.uid()))
    OR (author_id = auth.uid() AND created_at >= NOW() - INTERVAL '5 minutes' AND NOT public.is_banned(auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_instructor() AND NOT public.is_banned(auth.uid()))
    OR (author_id = auth.uid() AND created_at >= NOW() - INTERVAL '5 minutes' AND NOT public.is_banned(auth.uid()))
  );

-- 10. RLS Policies: community_reactions
CREATE POLICY "Read reactions"
  ON public.community_reactions FOR SELECT
  TO authenticated
  USING (NOT public.is_banned(auth.uid()));

CREATE POLICY "Insert own reactions"
  ON public.community_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_banned(auth.uid())
    AND NOT public.is_muted(auth.uid())
  );

CREATE POLICY "Delete own reactions"
  ON public.community_reactions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- 11. RLS Policies: community_reports
CREATE POLICY "Read reports"
  ON public.community_reports FOR SELECT
  TO authenticated
  USING (public.is_admin() OR reporter_id = auth.uid());

CREATE POLICY "Insert reports"
  ON public.community_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND NOT public.is_banned(auth.uid())
  );

CREATE POLICY "Admin update reports"
  ON public.community_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- 12. RLS Policies: community_reads
CREATE POLICY "Manage own reads"
  ON public.community_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 13. RLS Policies: community_rules_accepted
CREATE POLICY "Manage own rules accepted"
  ON public.community_rules_accepted FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 14. Add to Realtime Publication if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reads;
  END IF;
END $$;
