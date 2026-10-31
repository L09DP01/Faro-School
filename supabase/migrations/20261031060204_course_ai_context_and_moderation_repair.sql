BEGIN;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS target_id text, ADD COLUMN IF NOT EXISTS reason text, ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS public.course_ai_context (
 course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
 summary_fr text NOT NULL DEFAULT '' CHECK(char_length(summary_fr)<=12000),
 summary_ht text NOT NULL DEFAULT '' CHECK(char_length(summary_ht)<=12000),
 enabled boolean NOT NULL DEFAULT true,
 web_search_enabled boolean NOT NULL DEFAULT true,
 updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(char_length(trim(summary_fr))>=80 OR char_length(trim(summary_ht))>=80)
);
ALTER TABLE public.course_ai_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_ai_context FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.course_ai_context TO authenticated;
GRANT ALL ON public.course_ai_context TO service_role;
DROP POLICY IF EXISTS course_author_context ON public.course_ai_context;
CREATE POLICY course_author_context ON public.course_ai_context FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.profiles p JOIN public.courses c ON c.id=course_id WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role='admin' OR(p.role='instructor' AND c.instructor_id=p.id))))
 WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p JOIN public.courses c ON c.id=course_id WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role='admin' OR(p.role='instructor' AND c.instructor_id=p.id))));
-- Fill optional configuration only if absent; preserve every administrator choice.
INSERT INTO public.platform_settings(key,value)VALUES('word_filter','{"fr":[],"ht":[]}'),('community_rules','{"fr":"","ht":""}') ON CONFLICT(key)DO NOTHING;
INSERT INTO public.platform_settings(key,value) SELECT 'ai_global_settings',value FROM public.platform_settings WHERE key='global_ai_settings' ON CONFLICT(key)DO NOTHING;
INSERT INTO public.platform_settings(key,value)VALUES('ai_global_settings','{"default_model":"gemini-3.5-flash-lite","default_confidence_threshold":0.75,"daily_cost_cap_usd":5,"student_daily_limit":30,"kill_switch":false}') ON CONFLICT(key)DO NOTHING;

-- One human handoff and one email per unresolved conversation, even for concurrent requests.
CREATE OR REPLACE FUNCTION public.queue_assistant_handoff(p_actor uuid,p_conversation uuid,p_message uuid,p_reason text,p_notice text,p_meta jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles; pending uuid; email_id uuid; escalation_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=p_actor;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL OR actor.banned_at IS NOT NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor OR c.status='closed' THEN RAISE EXCEPTION 'forbidden'; END IF;
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
-- Provider acceptance is not proof of delivery; use role-neutral, accurate wording.
CREATE OR REPLACE FUNCTION public.accept_escalation_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE conversation uuid;
BEGIN
 IF NEW.kind='escalation' AND NEW.status IN('accepted','delivered') AND OLD.status NOT IN('accepted','delivered') THEN
  UPDATE escalations SET email_status='sent' WHERE id=(NEW.data->>'escalation_id')::uuid AND email_status<>'sent' RETURNING conversation_id INTO conversation;
  IF conversation IS NOT NULL THEN
   INSERT INTO messages(conversation_id,sender_type,sender_id,body) VALUES(conversation,'system',NULL,CASE WHEN NEW.data->>'student_locale'='ht' THEN 'Notifikasyon imèl la te aksepte pa sèvis voye a. Demann ou a disponib nan bwat resepsyon ekip ki responsab la.' ELSE 'La notification e-mail a été acceptée par le service d’envoi. Votre demande est disponible dans la boîte de réception de l’intervenant concerné.' END);
  END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accept_escalation_email() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
