BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_available boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.validate_conversation_participants()
RETURNS TRIGGER AS $$
DECLARE
  v_student_role TEXT;
  v_staff_role TEXT;
  v_course_instructor UUID;
  v_is_enrolled BOOLEAN;
  v_creator_role TEXT;
BEGIN
  -- 1. Creator check: Instructors can NEVER initiate a conversation
  SELECT role INTO v_creator_role FROM public.profiles WHERE id = auth.uid();
  IF TG_OP='INSERT' AND v_creator_role = 'instructor' THEN
    RAISE EXCEPTION 'Unauthorized: Instructors cannot initiate private conversations.';
  END IF;

  IF TG_OP='UPDATE' AND
    (NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.course_id IS DISTINCT FROM OLD.course_id OR
    (NEW.staff_id IS DISTINCT FROM OLD.staff_id AND NOT (v_creator_role='admin' AND OLD.course_id IS NULL AND NEW.course_id IS NULL AND NEW.staff_id=auth.uid()))) THEN
    RAISE EXCEPTION 'Unauthorized: Conversation participants cannot be changed.';
  END IF;

  -- 2. Verify student participant
  SELECT role INTO v_student_role FROM public.profiles WHERE id = NEW.student_id AND email_verified_at IS NOT NULL AND banned_at IS NULL;
  IF v_student_role IS NULL OR v_student_role != 'student' THEN
    RAISE EXCEPTION 'Invalid student_id: Participant must have role "student".';
  END IF;

  -- 3. Verify staff participant: MUST be instructor or admin. NEVER a student.
  SELECT role INTO v_staff_role FROM public.profiles WHERE id = NEW.staff_id AND email_verified_at IS NOT NULL AND banned_at IS NULL;
  IF v_staff_role IS NULL OR v_staff_role NOT IN ('instructor', 'admin') THEN
    RAISE EXCEPTION 'Invalid staff_id: Student-to-student conversations are strictly forbidden. Staff must be instructor or admin.';
  END IF;

  -- 4. Check different participants
  IF NEW.student_id = NEW.staff_id THEN
    RAISE EXCEPTION 'Invalid participants: student_id and staff_id cannot be the same user.';
  END IF;

  -- 5. Course enrollment check
  IF NEW.course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE user_id = NEW.student_id AND course_id = NEW.course_id AND revoked_at IS NULL
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
      RAISE EXCEPTION 'Unauthorized: Student is not enrolled in course %', NEW.course_id;
    END IF;

    BEGIN
      SELECT instructor_id INTO v_course_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_course_instructor IS NULL OR v_course_instructor != NEW.staff_id THEN
        RAISE EXCEPTION 'Unauthorized: Staff member is not the instructor of course %', NEW.course_id;
      END IF;
    END;
  ELSE
    -- If course_id is NULL, staff_id must be an admin
    IF v_staff_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: General inquiries without a course must be directed to an administrator.';
    END IF;
  END IF;

  IF TG_OP='UPDATE' AND NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    INSERT INTO public.admin_audit_logs(admin_id,action,target_id,reason)VALUES(auth.uid(),'claim_support_ticket',NEW.id::text,'Technical support takeover');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;


DROP TRIGGER IF EXISTS trg_validate_conversation_participants ON public.conversations;
CREATE TRIGGER trg_validate_conversation_participants BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.validate_conversation_participants();
REVOKE ALL ON FUNCTION public.validate_conversation_participants() FROM PUBLIC,anon,authenticated;


-- Only a participant can mark the messages addressed to them as read.
CREATE OR REPLACE FUNCTION public.mark_private_conversation_read(p_conversation uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.conversations; actor uuid:=auth.uid(); n integer;
BEGIN
 SELECT * INTO c FROM public.conversations WHERE id=p_conversation;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND email_verified_at IS NOT NULL AND banned_at IS NULL)
 OR (actor IS DISTINCT FROM c.student_id AND actor IS DISTINCT FROM c.staff_id AND NOT(c.course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=actor AND role='admin'))) THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE messages SET read_at=now() WHERE conversation_id=c.id AND read_at IS NULL
 AND (((actor=c.staff_id OR(c.course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=actor AND role='admin'))) AND sender_type='student') OR (actor=c.student_id AND sender_type IN ('staff','ai','system')));
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE notifications SET read_at=now() WHERE user_id=actor AND read_at IS NULL AND payload->>'conversationId'=c.id::text;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.mark_private_conversation_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_private_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.private_unread_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id
 WHERE m.read_at IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND email_verified_at IS NOT NULL AND banned_at IS NULL)
 AND (((c.staff_id=auth.uid() OR(c.course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin'))) AND m.sender_type='student') OR(c.student_id=auth.uid() AND m.sender_type IN('staff','ai','system')))
$$;
REVOKE ALL ON FUNCTION public.private_unread_count() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.private_unread_count() TO authenticated;

-- The database delivers an in-app notification regardless of presence or AI availability.
CREATE OR REPLACE FUNCTION public.deliver_private_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.conversations; target uuid;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=NEW.conversation_id;
 IF NEW.sender_type='student' THEN target:=c.staff_id;
 ELSE target:=c.student_id; END IF;
 INSERT INTO notifications(user_id,type,payload)VALUES(target,CASE WHEN NEW.sender_type='student' THEN 'student_message' ELSE 'staff_reply' END,
 jsonb_build_object('conversationId',c.id,'messageId',NEW.id));
 IF NEW.sender_type IN('student','staff') THEN
 UPDATE conversations SET last_message_at=NEW.created_at,status=CASE WHEN NEW.sender_type='student' THEN 'open' ELSE 'staff_replied' END WHERE id=c.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.deliver_private_message() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_deliver_private_message ON public.messages;
CREATE TRIGGER trg_deliver_private_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.deliver_private_message();

-- Extra restrictions compose with existing permissive policies, without widening access.
DROP POLICY IF EXISTS private_messages_audited_read ON public.messages;
CREATE POLICY private_messages_audited_read ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM conversations c WHERE c.id=conversation_id AND(auth.uid()=c.student_id OR auth.uid()=c.staff_id OR(c.course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin' AND email_verified_at IS NOT NULL AND banned_at IS NULL))))
 OR (EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin' AND email_verified_at IS NOT NULL AND banned_at IS NULL)
 AND EXISTS(SELECT 1 FROM private_conversation_access_logs a WHERE a.admin_id=auth.uid() AND a.conversation_id=messages.conversation_id::text AND a.accessed_at>now()-interval '15 minutes'))
);
DROP POLICY IF EXISTS private_messages_human_sender ON public.messages;
CREATE POLICY private_messages_human_sender ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 sender_id=auth.uid() AND EXISTS(SELECT 1 FROM conversations c WHERE c.id=conversation_id AND c.status<>'closed'
 AND ((sender_type='student' AND c.student_id=auth.uid())OR(sender_type='staff' AND c.staff_id=auth.uid())))
);
-- Automated messages use trusted server code after checking session and participation.
REVOKE UPDATE,DELETE ON public.messages FROM authenticated;

-- Only metadata aggregates, never message contents, are returned to verified admins.
CREATE OR REPLACE FUNCTION public.get_messaging_supervision_stats(p_period text DEFAULT '7d')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE days integer:=CASE p_period WHEN 'today' THEN 1 WHEN '7d' THEN 7 WHEN '30d' THEN 30 ELSE NULL END; since_at timestamptz; result jsonb;
BEGIN
 IF days IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin' AND email_verified_at IS NOT NULL AND banned_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 since_at:=now()-make_interval(days=>days);
 SELECT jsonb_build_object('period',p_period,'totalConversations',count(*),'activeConversations',count(*) FILTER(WHERE status<>'closed'),
 'aiResolutionRatePercent',CASE WHEN count(*)=0 THEN 0 ELSE round(100.0*count(*) FILTER(WHERE status='ai_handling')/count(*)) END) INTO result FROM conversations WHERE created_at>=since_at;
 result:=result||(SELECT jsonb_build_object('escalationsCount',count(*),'reviensPlusTardCount',count(followup_sent_at)) FROM escalations WHERE created_at>=since_at);
 result:=result||(SELECT jsonb_build_object('totalTokensUsed',coalesce(sum(input_tokens+output_tokens),0),'aiCostPerDayUsd',coalesce(sum(cost_usd),0)/days) FROM ai_usage WHERE created_at>=since_at);
 result:=result||(SELECT jsonb_build_object('medianResponseTimeMinutes',coalesce(round((percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM(response.created_at-m.created_at))/60))::numeric),0))
 FROM messages m JOIN LATERAL(SELECT created_at FROM messages WHERE conversation_id=m.conversation_id AND sender_type='staff' AND created_at>=m.created_at ORDER BY created_at LIMIT 1)response ON true
 WHERE m.sender_type='student' AND m.created_at>=since_at);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_messaging_supervision_stats(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_messaging_supervision_stats(text) TO authenticated;

-- Persisted instructor/admin assistant versions, guarded even through direct RPC calls.
CREATE OR REPLACE FUNCTION public.save_instructor_ai_version(p_instructor_id uuid,p_settings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid() AND email_verified_at IS NOT NULL AND banned_at IS NULL;
 IF actor.id IS NULL OR actor.role NOT IN('instructor','admin') OR(actor.role<>'admin' AND actor.id<>p_instructor_id)
 OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_instructor_id AND role IN('instructor','admin')) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF jsonb_typeof(p_settings)<>'object' THEN RAISE EXCEPTION 'invalid_settings'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_instructor_id::text,0));
 INSERT INTO instructor_ai_versions(instructor_id,settings,version_number)
 SELECT p_instructor_id,p_settings,coalesce(max(version_number),0)+1 FROM instructor_ai_versions WHERE instructor_id=p_instructor_id;
 DELETE FROM instructor_ai_versions WHERE instructor_id=p_instructor_id AND id NOT IN(SELECT id FROM instructor_ai_versions WHERE instructor_id=p_instructor_id ORDER BY version_number DESC LIMIT 5);
END $$;
REVOKE ALL ON FUNCTION public.save_instructor_ai_version(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_instructor_ai_version(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
