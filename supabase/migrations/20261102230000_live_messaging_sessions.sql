BEGIN;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assistance_mode text NOT NULL DEFAULT 'AI_ACTIVE' CHECK(assistance_mode IN('AI_ACTIVE','HUMAN_SUPPORT','AI_RESUMED')),ADD COLUMN IF NOT EXISTS assistance_epoch bigint NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
REVOKE UPDATE,DELETE ON messages FROM authenticated,anon;
CREATE TABLE IF NOT EXISTS staff_presence_sessions(user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,session_id uuid NOT NULL,token_version int NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(user_id,session_id));
ALTER TABLE staff_presence_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_presence_sessions FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON staff_presence_sessions TO service_role;
CREATE INDEX IF NOT EXISTS staff_presence_expiry ON staff_presence_sessions(user_id,expires_at);
CREATE OR REPLACE FUNCTION can_observe_staff(p_staff uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND (p.id=p_staff OR p.role='admin' OR EXISTS(SELECT 1 FROM conversations c WHERE c.staff_id=p_staff AND c.student_id=p.id)));
$$;
REVOKE ALL ON FUNCTION can_observe_staff(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION can_observe_staff(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION staff_is_online(p_staff uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM staff_presence_sessions s JOIN profiles p ON p.id=s.user_id JOIN user_credentials u ON u.user_id=p.id WHERE s.user_id=p_staff AND s.expires_at>now() AND s.token_version=u.token_version AND p.role IN('admin','instructor') AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL);
$$;
REVOKE ALL ON FUNCTION staff_is_online(uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION staff_is_online(uuid) TO service_role;
DROP POLICY IF EXISTS staff_live_read ON realtime.messages;
CREATE POLICY staff_live_read ON realtime.messages FOR SELECT TO authenticated USING(extension='presence' AND realtime.topic() LIKE 'staff-live:%' AND can_observe_staff(CASE WHEN substring(realtime.topic() from 12) ~ '^[a-f0-9-]{36}$' THEN substring(realtime.topic() from 12)::uuid ELSE NULL END));
DROP POLICY IF EXISTS staff_live_write ON realtime.messages;
CREATE POLICY staff_live_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK(extension='presence' AND realtime.topic()='staff-live:'||auth.uid()::text AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN('admin','instructor') AND email_verified_at IS NOT NULL AND banned_at IS NULL));
-- No private history is deleted or hidden merely because the thread was closed.
DROP POLICY IF EXISTS chat_sanction_conversations ON conversations;
CREATE POLICY chat_sanction_conversations ON conversations AS RESTRICTIVE FOR ALL TO authenticated USING(chat_access_allowed()) WITH CHECK(chat_access_allowed());
CREATE OR REPLACE FUNCTION public.guard_chat_lifecycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid();
 IF TG_TABLE_NAME='conversations' THEN
  IF TG_OP='UPDATE' THEN
   IF OLD.status='closed' AND NEW.status<>'closed' THEN RAISE EXCEPTION 'conversation_closed'; END IF;
   IF actor.role='student' AND pg_trigger_depth()=1 AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.assistance_mode IS DISTINCT FROM OLD.assistance_mode OR NEW.assistance_epoch IS DISTINCT FROM OLD.assistance_epoch) THEN RAISE EXCEPTION 'forbidden_status'; END IF;
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

  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_chat_lifecycle() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_chat_lifecycle ON public.conversations;
CREATE TRIGGER guard_chat_lifecycle BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.guard_chat_lifecycle();
DROP TRIGGER IF EXISTS guard_chat_message ON public.messages;
CREATE TRIGGER guard_chat_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_chat_lifecycle();

CREATE OR REPLACE FUNCTION public.set_conversation_control(p_conversation uuid,p_control text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=auth.uid();
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL OR actor.role NOT IN('instructor','admin') OR c.id IS NULL
 OR NOT(c.staff_id=actor.id OR(c.course_id IS NULL AND actor.role='admin')) OR c.status='closed' OR p_control NOT IN('human','ai','closed') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_control='ai' AND c.course_id IS NULL THEN RAISE EXCEPTION 'support_ticket_requires_resolution'; END IF;
 IF c.course_id IS NULL AND p_control='closed' THEN
  UPDATE escalations SET resolved_at=now() WHERE conversation_id=c.id AND resolved_at IS NULL;
  UPDATE conversations SET assistance_mode='AI_RESUMED',status='ai_handling',assistance_epoch=assistance_epoch+1 WHERE id=c.id;
  INSERT INTO messages(conversation_id,sender_type,body)VALUES(c.id,'system',CASE WHEN actor.locale='ht' THEN 'Tikè a rezoud. Istorik la konsève. Asistan IA a disponib ankò.' ELSE 'Ticket résolu. L’historique est conservé. L’assistant IA est de nouveau disponible.' END);
  RETURN;
 END IF;
 UPDATE conversations SET staff_id=CASE WHEN c.course_id IS NULL THEN actor.id ELSE staff_id END,status=CASE p_control WHEN 'human' THEN 'staff_replied' WHEN 'ai' THEN 'ai_handling' ELSE 'closed' END WHERE id=c.id;
 IF c.course_id IS NOT NULL AND p_control IN('human','closed') THEN UPDATE escalations SET resolved_at=now() WHERE conversation_id=c.id AND resolved_at IS NULL; END IF;
 IF actor.role='admin' THEN INSERT INTO admin_audit_logs(admin_id,action,target_id,reason)VALUES(actor.id,'conversation_'||p_control,c.id::text,'Explicit staff control'); END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_conversation_control(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_conversation_control(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.commit_assistant_reply(p_actor uuid,p_conversation uuid,p_message uuid,p_body text,p_meta jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; online boolean;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor OR c.status='closed' OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND email_verified_at IS NOT NULL AND banned_at IS NULL AND(muted_until IS NULL OR muted_until<=now())) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM messages WHERE id=p_message AND conversation_id=c.id AND sender_id=p_actor AND sender_type='student') THEN RETURN false; END IF;
 IF c.course_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.course_id AND revoked_at IS NULL) THEN RETURN false; END IF;
 SELECT staff_is_online(c.staff_id) INTO online;
 IF c.status='staff_replied' AND coalesce(online,false) THEN RETURN false; END IF;
 IF c.course_id IS NULL AND(coalesce((p_meta->>'assistanceEpoch')::bigint,0)<>c.assistance_epoch OR c.assistance_mode='HUMAN_SUPPORT' OR c.status='waiting_staff' OR EXISTS(SELECT 1 FROM escalations WHERE conversation_id=c.id AND resolved_at IS NULL)) THEN RETURN false; END IF;
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
DECLARE c conversations; actor profiles; pending uuid; email_id uuid; escalation_id uuid:=gen_random_uuid(); ticket_number text; ticket_notice text;
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
 IF c.course_id IS NULL AND coalesce(p_meta->>'supportTicketRequested','false')<>'true' THEN RAISE EXCEPTION 'explicit_ticket_request_required'; END IF;
 ticket_number:='FARO-SUP-'||upper(replace(escalation_id::text,'-',''));
 ticket_notice:=CASE WHEN c.course_id IS NOT NULL THEN left(p_notice,4000) WHEN actor.locale='ht' THEN 'Tikè sipò '||ticket_number||' kreye. Yon administratè avèti. Ou ka kontinye ekri pandan w ap tann repons li.' ELSE 'Ticket support '||ticket_number||' créé. Un administrateur est averti. Vous pouvez continuer à écrire en attendant sa réponse.' END;
 email_id:=queue_instructor_escalation(p_actor,c.id,p_message,escalation_id,left(CASE WHEN c.course_id IS NULL THEN ticket_number||' — ' ELSE '' END||p_reason,500),NULL);
 INSERT INTO messages(conversation_id,sender_type,sender_id,body,meta)VALUES(c.id,'system',NULL,ticket_notice,p_meta||CASE WHEN c.course_id IS NULL THEN jsonb_build_object('ticketNumber',ticket_number,'ticketCreated',true) ELSE '{}'::jsonb END);
 IF c.course_id IS NULL THEN
  INSERT INTO notifications(user_id,type,payload)VALUES(c.staff_id,'student_message',jsonb_build_object('conversationId',c.id,'ticketNumber',ticket_number,'ticketCreated',true));
  UPDATE email_outbox SET data=jsonb_set(data,'{detail}',to_jsonb(ticket_number||E'\n\n'||coalesce(data->>'detail',''))) WHERE id=email_id;
 END IF;
 UPDATE conversations SET status='waiting_staff' WHERE id=c.id;
 RETURN jsonb_build_object('created',true,'email_id',email_id);
END $$;
REVOKE ALL ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_assistant_handoff(uuid,uuid,uuid,text,text,jsonb) TO service_role;


CREATE OR REPLACE FUNCTION acknowledge_private_messages(p_conversation uuid,p_read boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor uuid:=auth.uid(); n int;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=p_conversation;
 IF actor IS NULL OR NOT chat_access_allowed() OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND email_verified_at IS NOT NULL AND banned_at IS NULL) OR NOT(actor=c.student_id OR actor=c.staff_id OR(c.course_id IS NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=actor AND role='admin'))) THEN RAISE EXCEPTION 'forbidden';END IF;
 UPDATE messages SET delivered_at=coalesce(delivered_at,now()),read_at=CASE WHEN p_read THEN coalesce(read_at,now()) ELSE read_at END
 WHERE conversation_id=c.id AND ((actor=c.student_id AND sender_type IN('staff','ai','system')) OR (actor<>c.student_id AND sender_type='student')) AND(delivered_at IS NULL OR(p_read AND read_at IS NULL));
 GET DIAGNOSTICS n=ROW_COUNT;
 IF p_read THEN UPDATE notifications SET read_at=now() WHERE user_id=actor AND read_at IS NULL AND payload->>'conversationId'=c.id::text; END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION acknowledge_private_messages(uuid,boolean) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION acknowledge_private_messages(uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION mark_private_conversation_read(p_conversation uuid) RETURNS integer LANGUAGE sql SECURITY INVOKER AS $$SELECT acknowledge_private_messages(p_conversation,true)$$;
CREATE OR REPLACE FUNCTION sync_support_ticket_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cid uuid:=NEW.conversation_id; pending boolean;
BEGIN
 PERFORM 1 FROM conversations WHERE id=cid FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM escalations WHERE conversation_id=cid AND resolved_at IS NULL) INTO pending;
 UPDATE conversations SET assistance_mode=CASE WHEN pending THEN 'HUMAN_SUPPORT' ELSE 'AI_RESUMED' END,assistance_epoch=assistance_epoch+1,status=CASE WHEN pending THEN 'waiting_staff' ELSE 'ai_handling' END WHERE id=cid AND course_id IS NULL AND status<>'closed';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sync_support_ticket_mode() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS support_ticket_mode ON escalations;
CREATE TRIGGER support_ticket_mode AFTER INSERT OR UPDATE OF resolved_at ON escalations FOR EACH ROW EXECUTE FUNCTION sync_support_ticket_mode();
UPDATE conversations c SET assistance_mode='HUMAN_SUPPORT',assistance_epoch=assistance_epoch+1 WHERE c.course_id IS NULL AND EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id=c.id AND e.resolved_at IS NULL) AND assistance_mode<>'HUMAN_SUPPORT';
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;END IF;
 END IF;END$$;
NOTIFY pgrst,'reload schema';
COMMIT;
