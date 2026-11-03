BEGIN;
-- Realtime/PostgREST reads reject revoked custom JWTs as well as banned/muted accounts.
CREATE OR REPLACE FUNCTION has_current_account_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p JOIN user_credentials u ON u.user_id=p.id
 WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND to_jsonb(u.token_version)=auth.jwt()->'token_version')
$$;
REVOKE ALL ON FUNCTION has_current_account_session() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION has_current_account_session() TO authenticated;
CREATE OR REPLACE FUNCTION can_read_current_chat_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT chat_access_allowed() AND has_current_account_session()$$;
REVOKE ALL ON FUNCTION can_read_current_chat_session() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION can_read_current_chat_session() TO authenticated;
DROP POLICY IF EXISTS current_account_session_read ON notifications;
CREATE POLICY current_account_session_read ON notifications AS RESTRICTIVE FOR SELECT TO authenticated USING(has_current_account_session());
DROP POLICY IF EXISTS current_chat_session_read ON messages;
CREATE POLICY current_chat_session_read ON messages AS RESTRICTIVE FOR SELECT TO authenticated USING(can_read_current_chat_session());
DROP POLICY IF EXISTS current_chat_session_read ON conversations;
CREATE POLICY current_chat_session_read ON conversations AS RESTRICTIVE FOR SELECT TO authenticated USING(can_read_current_chat_session());
-- Private identifiers only: message bodies are fetched with current account permissions.
CREATE OR REPLACE FUNCTION can_receive_live_conversation(p_conversation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT can_read_current_chat_session() AND EXISTS(SELECT 1 FROM conversations c JOIN profiles p ON p.id=auth.uid()
 WHERE c.id=p_conversation AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL
 AND(c.student_id=p.id OR c.staff_id=p.id OR(c.course_id IS NULL AND p.role='admin')))
$$;
REVOKE ALL ON FUNCTION can_receive_live_conversation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION can_receive_live_conversation(uuid) TO authenticated;
DROP POLICY IF EXISTS live_message_read ON realtime.messages;
CREATE POLICY live_message_read ON realtime.messages FOR SELECT TO authenticated USING(has_current_account_session() AND extension='broadcast' AND (
 (CASE WHEN realtime.topic() ~ '^private-conv-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN can_receive_live_conversation(substring(realtime.topic() from 14)::uuid) ELSE false END)
 OR(realtime.topic()='user-inbox:'||auth.uid()::text AND has_current_account_session())
 OR(realtime.topic()='support-inbox' AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin' AND email_verified_at IS NOT NULL AND banned_at IS NULL))));
DROP POLICY IF EXISTS staff_live_read ON realtime.messages;
CREATE POLICY staff_live_read ON realtime.messages FOR SELECT TO authenticated USING(has_current_account_session() AND extension IN('presence','broadcast') AND can_observe_staff(CASE WHEN realtime.topic() ~ '^staff-live:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN substring(realtime.topic() from 12)::uuid ELSE NULL END));
CREATE OR REPLACE FUNCTION send_private_live_event(p_payload jsonb,p_event text,p_topic text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
  PERFORM realtime.send(p_payload,p_event,p_topic,true);
 END IF;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'private_live_event_unavailable (%)',SQLSTATE;
END $$;
REVOKE ALL ON FUNCTION send_private_live_event(jsonb,text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION broadcast_private_message_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c conversations; payload jsonb;
BEGIN
 SELECT * INTO c FROM conversations WHERE id=NEW.conversation_id;
 payload:=jsonb_build_object('conversationId',NEW.conversation_id,'messageId',NEW.id);
 PERFORM send_private_live_event(payload,'message-change','private-conv-'||c.id::text);
 PERFORM send_private_live_event(payload,'message-change','user-inbox:'||c.student_id::text);
 PERFORM send_private_live_event(payload,'message-change','user-inbox:'||c.staff_id::text);
 IF c.course_id IS NULL THEN PERFORM send_private_live_event(payload,'message-change','support-inbox'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION broadcast_private_message_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS private_message_live_event ON messages;
CREATE TRIGGER private_message_live_event AFTER INSERT OR UPDATE OF read_at,delivered_at ON messages FOR EACH ROW EXECUTE FUNCTION broadcast_private_message_event();
CREATE OR REPLACE FUNCTION broadcast_private_conversation_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE payload jsonb:=jsonb_build_object('conversationId',NEW.id);
BEGIN
 PERFORM send_private_live_event(payload,'conversation-change','user-inbox:'||NEW.student_id::text);
 PERFORM send_private_live_event(payload,'conversation-change','user-inbox:'||NEW.staff_id::text);
 IF NEW.course_id IS NULL THEN PERFORM send_private_live_event(payload,'conversation-change','support-inbox'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION broadcast_private_conversation_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS private_conversation_live_event ON conversations;
CREATE TRIGGER private_conversation_live_event AFTER UPDATE OF status,assistance_mode ON conversations FOR EACH ROW WHEN(OLD.status IS DISTINCT FROM NEW.status OR OLD.assistance_mode IS DISTINCT FROM NEW.assistance_mode) EXECUTE FUNCTION broadcast_private_conversation_event();
CREATE OR REPLACE FUNCTION broadcast_staff_lease_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM send_private_live_event(jsonb_build_object('staffId',NEW.user_id),'presence-change','staff-live:'||NEW.user_id::text);RETURN NEW;END $$;
REVOKE ALL ON FUNCTION broadcast_staff_lease_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS staff_lease_live_event ON staff_presence_sessions;
CREATE TRIGGER staff_lease_live_event AFTER INSERT OR UPDATE ON staff_presence_sessions FOR EACH ROW EXECUTE FUNCTION broadcast_staff_lease_event();

CREATE TABLE IF NOT EXISTS message_push_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 endpoint text UNIQUE NOT NULL,p256dh text NOT NULL,auth_secret text NOT NULL,token_version integer NOT NULL,
 disabled_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE message_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT ALL ON message_push_subscriptions TO service_role;
CREATE INDEX IF NOT EXISTS message_push_subscriptions_user ON message_push_subscriptions(user_id) WHERE disabled_at IS NULL;
CREATE OR REPLACE FUNCTION save_message_push_subscription(p_user uuid,p_token_version integer,p_endpoint text,p_p256dh text,p_auth text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles p JOIN user_credentials u ON u.user_id=p.id WHERE p.id=p_user AND p.role='student' AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND u.token_version=p_token_version) THEN RAISE EXCEPTION 'forbidden';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||'push',0));
 IF(SELECT count(*) FROM message_push_subscriptions WHERE user_id=p_user AND disabled_at IS NULL AND endpoint<>p_endpoint)>=10 THEN RAISE EXCEPTION 'subscription_limit';END IF;
 INSERT INTO message_push_subscriptions(user_id,endpoint,p256dh,auth_secret,token_version)VALUES(p_user,p_endpoint,p_p256dh,p_auth,p_token_version)
 ON CONFLICT(endpoint)DO UPDATE SET user_id=p_user,p256dh=p_p256dh,auth_secret=p_auth,token_version=p_token_version,disabled_at=NULL,updated_at=now() RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION save_message_push_subscription(uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION save_message_push_subscription(uuid,integer,text,text,text) TO service_role;
CREATE TABLE IF NOT EXISTS message_push_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subscription_id uuid NOT NULL REFERENCES message_push_subscriptions(id) ON DELETE CASCADE,
 message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','sending','sent','skipped','dead')),
 attempts integer NOT NULL DEFAULT 0,claim_id uuid,locked_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,error_code text,
 UNIQUE(subscription_id,message_id));
ALTER TABLE message_push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON message_push_jobs FROM PUBLIC,anon,authenticated;GRANT ALL ON message_push_jobs TO service_role;
CREATE INDEX IF NOT EXISTS message_push_jobs_pending ON message_push_jobs(next_attempt_at) WHERE state IN('pending','sending');
CREATE OR REPLACE FUNCTION queue_private_message_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.sender_type IN('staff','ai','system') THEN
  INSERT INTO message_push_jobs(subscription_id,message_id,conversation_id)
   SELECT s.id,NEW.id,c.id FROM conversations c JOIN message_push_subscriptions s ON s.user_id=c.student_id
   JOIN profiles p ON p.id=s.user_id JOIN user_credentials u ON u.user_id=p.id
   WHERE c.id=NEW.conversation_id AND s.disabled_at IS NULL AND s.token_version=u.token_version
   AND p.role='student' AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.muted_until IS NULL OR p.muted_until<=now())
   ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION queue_private_message_push() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS private_message_push_job ON messages;
CREATE TRIGGER private_message_push_job AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION queue_private_message_push();
CREATE OR REPLACE FUNCTION claim_message_push_jobs(p_conversation uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH chosen AS(SELECT j.id FROM message_push_jobs j WHERE(j.state='pending' OR(j.state='sending' AND j.locked_until<now()))
 AND j.next_attempt_at<=now() AND(p_conversation IS NULL OR j.conversation_id=p_conversation)
 ORDER BY j.created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),50)),claimed AS(
 UPDATE message_push_jobs j SET state='sending',attempts=attempts+1,claim_id=gen_random_uuid(),locked_until=now()+interval '60 seconds'
 FROM chosen c WHERE j.id=c.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',j.id,'claimId',j.claim_id,'messageId',j.message_id,'conversationId',j.conversation_id,
 'subscriptionId',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth_secret,'locale',p.locale,'attempts',j.attempts,'createdAt',j.created_at,
 'read',m.read_at IS NOT NULL,'eligible',c.student_id=s.user_id AND s.disabled_at IS NULL AND s.token_version=u.token_version AND p.role='student' AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.muted_until IS NULL OR p.muted_until<=now()))),'[]'::jsonb)
 FROM claimed j JOIN message_push_subscriptions s ON s.id=j.subscription_id JOIN profiles p ON p.id=s.user_id
 JOIN user_credentials u ON u.user_id=p.id JOIN messages m ON m.id=j.message_id JOIN conversations c ON c.id=j.conversation_id;
$$;
REVOKE ALL ON FUNCTION claim_message_push_jobs(uuid,integer) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION claim_message_push_jobs(uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION finish_message_push_job(p_id uuid,p_claim uuid,p_state text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_state NOT IN('sent','skipped','dead','pending') THEN RAISE EXCEPTION 'invalid'; END IF;
 UPDATE message_push_jobs SET state=p_state,locked_until=NULL,completed_at=CASE WHEN p_state='pending' THEN NULL ELSE now() END,
 next_attempt_at=now()+make_interval(secs=>least(3600,15*power(2,least(attempts,7))::integer)),error_code=left(p_error,40)
 WHERE id=p_id AND claim_id=p_claim AND state='sending';RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION finish_message_push_job(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION finish_message_push_job(uuid,uuid,text,text) TO service_role;
DO $$BEGIN IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;END IF;
END IF;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
