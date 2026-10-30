-- Signed webhook receipts and effects are committed in the same transaction.
-- Local migration only: apply manually after the existing migrations.
BEGIN;
CREATE TABLE public.webhook_events(
 provider text NOT NULL CHECK(provider IN ('bunny','resend')),
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 256),
 event_type text NOT NULL,resource_id text NOT NULL,
 body_hash text NOT NULL CHECK(body_hash ~ '^[0-9a-f]{64}$'),
 occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,event_id)
);
CREATE TABLE public.bunny_video_assets(
 video_id uuid PRIMARY KEY,library_id bigint NOT NULL CHECK(library_id>0),
 status integer NOT NULL CHECK(status IN (0,1,2,3,4,5,6,7,8,32)),
 duration_sec integer CHECK(duration_sec>=0),last_event_at timestamptz NOT NULL,last_event_id text NOT NULL
);
CREATE TABLE public.email_deliveries(
 provider_message_id uuid NOT NULL,recipient_hash text NOT NULL CHECK(recipient_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL,last_event_at timestamptz NOT NULL,last_event_id text NOT NULL,
 PRIMARY KEY(provider_message_id,recipient_hash)
);
CREATE TABLE public.email_suppressions(
 recipient_hash text PRIMARY KEY CHECK(recipient_hash ~ '^[0-9a-f]{64}$'),
 suppressed boolean NOT NULL,reason text NOT NULL,last_event_at timestamptz NOT NULL
);
CREATE INDEX webhook_events_received_at_idx ON public.webhook_events(received_at);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bunny_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
-- No browser policies, no raw payloads, no email subjects, codes, links or signatures.
REVOKE ALL ON public.webhook_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.bunny_video_assets FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.email_deliveries FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.email_suppressions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.webhook_events,public.bunny_video_assets,public.email_deliveries,public.email_suppressions TO service_role;

CREATE FUNCTION public.apply_bunny_webhook(p_event_id text,p_library_id bigint,p_video_id uuid,p_status integer,p_duration integer,p_occurred_at timestamptz,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_inserted integer;v_changed uuid;
BEGIN
 INSERT INTO public.webhook_events(provider,event_id,event_type,resource_id,body_hash,occurred_at)
 VALUES('bunny',p_event_id,'video.'||p_status,p_video_id::text,p_hash,p_occurred_at) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.webhook_events WHERE provider='bunny' AND event_id=p_event_id AND body_hash=p_hash) THEN RAISE EXCEPTION 'event_conflict';END IF;
  RETURN jsonb_build_object('duplicate',true);
 END IF;
 INSERT INTO public.bunny_video_assets AS a(video_id,library_id,status,duration_sec,last_event_at,last_event_id)
 VALUES(p_video_id,p_library_id,p_status,CASE WHEN p_status=32 THEN 0 ELSE p_duration END,p_occurred_at,p_event_id)
 ON CONFLICT(video_id) DO UPDATE SET status=EXCLUDED.status,duration_sec=COALESCE(EXCLUDED.duration_sec,a.duration_sec),last_event_at=EXCLUDED.last_event_at,last_event_id=EXCLUDED.last_event_id
 WHERE a.library_id=EXCLUDED.library_id AND (EXCLUDED.last_event_at>a.last_event_at OR (EXCLUDED.last_event_at=a.last_event_at AND array_position(ARRAY[6,7,0,1,2,4,3,8,5,32],EXCLUDED.status)>array_position(ARRAY[6,7,0,1,2,4,3,8,5,32],a.status)))
 RETURNING video_id INTO v_changed;
 IF v_changed IS NOT NULL AND (p_duration IS NOT NULL OR p_status=32) THEN
  UPDATE public.lessons SET duration_sec=CASE WHEN p_status=32 THEN 0 ELSE p_duration END WHERE video_id=p_video_id::text;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'applied',v_changed IS NOT NULL);
END;$$;
REVOKE ALL ON FUNCTION public.apply_bunny_webhook(text,bigint,uuid,integer,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_bunny_webhook(text,bigint,uuid,integer,integer,timestamptz,text) TO service_role;

-- A webhook may finish before the administrator saves the lesson. Synchronize then too.
CREATE FUNCTION public.sync_lesson_bunny_duration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_duration integer;
BEGIN
 SELECT duration_sec INTO v_duration FROM public.bunny_video_assets WHERE video_id::text=NEW.video_id;
 IF FOUND AND v_duration IS NOT NULL THEN NEW.duration_sec=v_duration;END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.sync_lesson_bunny_duration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_lesson_bunny_duration BEFORE INSERT OR UPDATE OF video_id,duration_sec ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_bunny_duration();

CREATE FUNCTION public.apply_resend_webhook(p_event_id text,p_type text,p_resource uuid,p_recipients text[],p_occurred_at timestamptz,p_hash text,p_suppressed boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_inserted integer;v_recipient text;
BEGIN
 IF p_type NOT IN ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed','suppression.added','suppression.removed') OR COALESCE(array_length(p_recipients,1),0) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'invalid_event';END IF;
 INSERT INTO public.webhook_events(provider,event_id,event_type,resource_id,body_hash,occurred_at)
 VALUES('resend',p_event_id,p_type,p_resource::text,p_hash,p_occurred_at) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN
  IF NOT EXISTS(SELECT 1 FROM public.webhook_events WHERE provider='resend' AND event_id=p_event_id AND body_hash=p_hash) THEN RAISE EXCEPTION 'event_conflict';END IF;
  RETURN jsonb_build_object('duplicate',true);
 END IF;
 -- Stable order avoids deadlocks for concurrent multi-recipient events.
 FOR v_recipient IN SELECT DISTINCT x FROM unnest(p_recipients) AS x ORDER BY x LOOP
  IF p_type LIKE 'email.%' THEN
   INSERT INTO public.email_deliveries AS d(provider_message_id,recipient_hash,status,last_event_at,last_event_id)
   VALUES(p_resource,v_recipient,p_type,p_occurred_at,p_event_id)
   ON CONFLICT(provider_message_id,recipient_hash) DO UPDATE SET status=EXCLUDED.status,last_event_at=EXCLUDED.last_event_at,last_event_id=EXCLUDED.last_event_id
   WHERE EXCLUDED.last_event_at>d.last_event_at OR (EXCLUDED.last_event_at=d.last_event_at AND array_position(ARRAY['email.sent','email.delivery_delayed','email.delivered','email.failed','email.bounced','email.suppressed','email.complained'],EXCLUDED.status)>array_position(ARRAY['email.sent','email.delivery_delayed','email.delivered','email.failed','email.bounced','email.suppressed','email.complained'],d.status));
  END IF;
  IF p_suppressed IS NOT NULL THEN
   INSERT INTO public.email_suppressions AS s(recipient_hash,suppressed,reason,last_event_at)
   VALUES(v_recipient,p_suppressed,COALESCE(p_reason,'suppressed'),p_occurred_at)
   ON CONFLICT(recipient_hash) DO UPDATE SET suppressed=EXCLUDED.suppressed,reason=EXCLUDED.reason,last_event_at=EXCLUDED.last_event_at
   WHERE EXCLUDED.last_event_at>s.last_event_at OR (EXCLUDED.last_event_at=s.last_event_at AND EXCLUDED.suppressed);
  END IF;
 END LOOP;
 RETURN jsonb_build_object('duplicate',false);
END;$$;
REVOKE ALL ON FUNCTION public.apply_resend_webhook(text,text,uuid,text[],timestamptz,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_resend_webhook(text,text,uuid,text[],timestamptz,text,boolean,text) TO service_role;
COMMIT;
