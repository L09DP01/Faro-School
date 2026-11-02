BEGIN;
-- Chat sanctions never remove access to courses or the rest of the account.
CREATE OR REPLACE FUNCTION public.chat_access_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND email_verified_at IS NOT NULL AND banned_at IS NULL AND (muted_until IS NULL OR muted_until<=now()))
$$;
REVOKE ALL ON FUNCTION public.chat_access_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.chat_access_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_chat_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid();
 IF TG_TABLE_NAME='conversations' THEN
  IF TG_OP='UPDATE' THEN
   IF OLD.status='closed' AND NEW.status<>'closed' THEN RAISE EXCEPTION 'conversation_closed'; END IF;
   IF actor.role='student' AND pg_trigger_depth()=1 AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'forbidden_status'; END IF;
  ELSE
   IF actor.role='student' AND NEW.status<>'open' THEN RAISE EXCEPTION 'forbidden_status'; END IF;
   IF actor.role='student' AND NOT chat_access_allowed() THEN RAISE EXCEPTION 'chat_suspended'; END IF;
   -- Serializes creation, including attempts from a browser bypassing the app.
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.student_id::text||coalesce(NEW.course_id::text,'support'),0));
   IF EXISTS(SELECT 1 FROM conversations WHERE student_id=NEW.student_id AND course_id IS NOT DISTINCT FROM NEW.course_id AND status<>'closed') THEN RAISE EXCEPTION 'active_conversation_exists'; END IF;
  END IF;
 ELSE
  SELECT * INTO c FROM conversations WHERE id=NEW.conversation_id FOR UPDATE;
  IF c.id IS NULL OR(c.status='closed' AND NEW.sender_type<>'system') THEN RAISE EXCEPTION 'conversation_closed'; END IF;
  IF NEW.sender_type='student' THEN
   IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.sender_id AND id=c.student_id AND email_verified_at IS NOT NULL AND banned_at IS NULL AND (muted_until IS NULL OR muted_until<=now())) THEN RAISE EXCEPTION 'chat_suspended'; END IF;
   IF c.course_id IS NULL AND c.status='waiting_staff' THEN RAISE EXCEPTION 'support_ticket_waiting'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_chat_lifecycle() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_chat_lifecycle ON public.conversations;
CREATE TRIGGER guard_chat_lifecycle BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_chat_lifecycle();
DROP TRIGGER IF EXISTS guard_chat_message ON public.messages;
CREATE TRIGGER guard_chat_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_chat_lifecycle();

-- A student reply must not reset human ownership or a pending support ticket.
CREATE OR REPLACE FUNCTION public.deliver_private_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; target uuid;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=NEW.conversation_id;
 target:=CASE WHEN NEW.sender_type='student' THEN c.staff_id ELSE c.student_id END;
 INSERT INTO notifications(user_id,type,payload)VALUES(target,CASE WHEN NEW.sender_type='student' THEN 'student_message' ELSE 'staff_reply' END,jsonb_build_object('conversationId',c.id,'messageId',NEW.id));
 UPDATE conversations SET last_message_at=NEW.created_at,status=CASE WHEN NEW.sender_type='staff' THEN 'staff_replied' ELSE status END WHERE id=c.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.deliver_private_message() FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS chat_sanction_conversations ON public.conversations;
CREATE POLICY chat_sanction_conversations ON public.conversations AS RESTRICTIVE FOR ALL TO authenticated USING(chat_access_allowed() AND (student_id<>auth.uid() OR status<>'closed')) WITH CHECK(chat_access_allowed());
DROP POLICY IF EXISTS chat_sanction_messages ON public.messages;
CREATE POLICY chat_sanction_messages ON public.messages AS RESTRICTIVE FOR ALL TO authenticated USING(chat_access_allowed()) WITH CHECK(chat_access_allowed());
DROP POLICY IF EXISTS chat_sanction_community ON public.community_messages;
CREATE POLICY chat_sanction_community ON public.community_messages AS RESTRICTIVE FOR ALL TO authenticated USING(chat_access_allowed()) WITH CHECK(chat_access_allowed());

-- Owner-only explicit handover, with the same row lock as AI commit.
CREATE OR REPLACE FUNCTION public.set_conversation_control(p_conversation uuid,p_control text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid();
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL OR actor.role NOT IN('instructor','admin') OR c.id IS NULL
 OR NOT(c.staff_id=actor.id OR(c.course_id IS NULL AND actor.role='admin')) OR c.status='closed' OR p_control NOT IN('human','ai','closed') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_control='ai' AND c.course_id IS NULL THEN RAISE EXCEPTION 'support_ticket_requires_resolution'; END IF;
 UPDATE conversations SET staff_id=CASE WHEN c.course_id IS NULL THEN actor.id ELSE staff_id END,status=CASE p_control WHEN 'human' THEN 'staff_replied' WHEN 'ai' THEN 'ai_handling' ELSE 'closed' END WHERE id=c.id;
 IF p_control IN('human','closed') THEN UPDATE escalations SET resolved_at=now() WHERE conversation_id=c.id AND resolved_at IS NULL; END IF;
 IF actor.role='admin' THEN INSERT INTO admin_audit_logs(admin_id,action,target_id,reason)VALUES(actor.id,'conversation_'||p_control,c.id::text,'Explicit staff control'); END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_conversation_control(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_conversation_control(uuid,text) TO authenticated;

-- Recheck ownership after the provider returns; an AI cannot answer over a takeover.
CREATE OR REPLACE FUNCTION public.commit_assistant_reply(p_actor uuid,p_conversation uuid,p_message uuid,p_body text,p_meta jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; online boolean;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor OR c.status='closed' OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND email_verified_at IS NOT NULL AND banned_at IS NULL AND(muted_until IS NULL OR muted_until<=now())) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM messages WHERE id=p_message AND conversation_id=c.id AND sender_id=p_actor AND sender_type='student') THEN RETURN false; END IF;
 IF c.course_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.course_id AND revoked_at IS NULL) THEN RETURN false; END IF;
 SELECT staff_available AND last_seen_at>now()-interval '90 seconds' INTO online FROM profiles WHERE id=c.staff_id;
 IF c.status='staff_replied' AND coalesce(online,false) THEN RETURN false; END IF;
 IF c.course_id IS NULL AND(c.status='waiting_staff' OR EXISTS(SELECT 1 FROM escalations WHERE conversation_id=c.id AND resolved_at IS NULL)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM messages WHERE conversation_id=c.id AND sender_type='ai' AND meta->>'replyTo'=p_message::text) THEN RETURN false; END IF;
 IF char_length(trim(p_body)) NOT BETWEEN 1 AND 4000 THEN RETURN false; END IF;
 INSERT INTO messages(conversation_id,sender_type,sender_id,body,meta)VALUES(c.id,'ai',NULL,p_body,p_meta||jsonb_build_object('replyTo',p_message));
 UPDATE conversations SET status=CASE WHEN EXISTS(SELECT 1 FROM escalations WHERE conversation_id=c.id AND resolved_at IS NULL) THEN 'waiting_staff' ELSE 'ai_handling' END WHERE id=c.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.commit_assistant_reply(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_assistant_reply(uuid,uuid,uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.queue_assistant_handoff(p_actor uuid,p_conversation uuid,p_message uuid,p_reason text,p_notice text,p_meta jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles; pending uuid; email_id uuid; escalation_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=p_actor;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL OR(actor.muted_until IS NOT NULL AND actor.muted_until>now()) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor OR c.status='closed' THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF c.status='staff_replied' AND EXISTS(SELECT 1 FROM profiles WHERE id=c.staff_id AND staff_available AND last_seen_at>now()-interval '90 seconds') THEN RETURN jsonb_build_object('created',false); END IF;
 IF NOT EXISTS(SELECT 1 FROM messages WHERE id=p_message AND conversation_id=c.id AND sender_id=p_actor AND sender_type='student') THEN RAISE EXCEPTION 'message_missing'; END IF;
 IF c.course_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.course_id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 SELECT id INTO pending FROM escalations WHERE conversation_id=c.id AND resolved_at IS NULL LIMIT 1;
 IF pending IS NOT NULL THEN UPDATE conversations SET status='waiting_staff' WHERE id=c.id;RETURN jsonb_build_object('created',false); END IF;
 email_id:=queue_instructor_escalation(p_actor,c.id,p_message,escalation_id,left(p_reason,500),NULL);
 INSERT INTO messages(conversation_id,sender_type,sender_id,body,meta)VALUES(c.id,'ai',NULL,left(p_notice,4000),p_meta);
 UPDATE conversations SET status='waiting_staff' WHERE id=c.id;
 RETURN jsonb_build_object('created',true,'email_id',email_id);
END $$;
REVOKE ALL ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
