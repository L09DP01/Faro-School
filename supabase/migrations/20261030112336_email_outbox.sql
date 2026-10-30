BEGIN;
CREATE TABLE public.email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL,
 user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
 recipient text NOT NULL, locale text NOT NULL DEFAULT 'fr' CHECK(locale IN('fr','ht')),
 idempotency_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','accepted','delivered','failed_temporary','failed_permanent','bounced','complained','suppressed')),
 attempts int NOT NULL DEFAULT 0, next_attempt_at timestamptz DEFAULT now(),
 last_error_category text, provider_http_status int, provider_message_id text,
 correlation_id uuid NOT NULL DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 prepared_at timestamptz, provider_event_at timestamptz,
 CHECK (kind NOT IN('verification','reset','invitation','email_change') OR NOT (data ?| ARRAY['code','token','password','html','text','subject']))
);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_outbox TO service_role;
CREATE UNIQUE INDEX email_outbox_message_id ON public.email_outbox(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX email_outbox_pending ON public.email_outbox(next_attempt_at) WHERE status IN('queued','failed_temporary','sending');
ALTER TABLE public.email_verification_tokens ADD COLUMN outbox_id uuid UNIQUE REFERENCES public.email_outbox(id) ON DELETE CASCADE;
ALTER TABLE public.password_reset_tokens ADD COLUMN outbox_id uuid UNIQUE REFERENCES public.email_outbox(id) ON DELETE CASCADE;
CREATE FUNCTION public.claim_email_outbox(p_id uuid DEFAULT NULL,p_limit int DEFAULT 5) RETURNS SETOF public.email_outbox
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 UPDATE email_outbox SET status='sending',attempts=attempts+1,updated_at=now(),next_attempt_at=NULL
 WHERE id IN (SELECT id FROM email_outbox WHERE (p_id IS NULL OR id=p_id) AND attempts<5 AND created_at>now()-interval '23 hours' AND
 ((status IN('queued','failed_temporary') AND next_attempt_at<=now()) OR (status='sending' AND updated_at<now()-interval '2 minutes'))
 ORDER BY created_at LIMIT greatest(1,least(p_limit,5)) FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
CREATE FUNCTION public.prepare_outbox_token(p_id uuid,p_code_hash text,p_token_hash text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE o email_outbox; expiry timestamptz;
BEGIN
 SELECT * INTO o FROM email_outbox WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'sending' THEN RAISE EXCEPTION 'not_claimed'; END IF;
 IF o.prepared_at IS NOT NULL THEN RETURN o.prepared_at; END IF;
 IF o.kind IN('verification','email_change') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(o.recipient),1));
  -- Never invalidate a previously accepted token. Failed pre-provider rows may be superseded.
  UPDATE email_verification_tokens t SET used_at=now() FROM email_outbox old
   WHERE t.outbox_id=old.id AND t.email=o.recipient AND t.used_at IS NULL AND old.provider_message_id IS NULL AND old.id<>o.id;
  INSERT INTO email_verification_tokens(email,code_hash,token_hash,expires_at,outbox_id)
   VALUES(o.recipient,p_code_hash,p_token_hash,now()+interval '10 minutes',o.id);
 ELSE
  PERFORM 1 FROM profiles WHERE id=o.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
  INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,outbox_id)
   VALUES(o.user_id,p_token_hash,now()+CASE WHEN o.kind='invitation' THEN interval '48 hours' ELSE interval '1 hour' END,o.id);
 END IF;
 UPDATE email_outbox SET prepared_at=now() WHERE id=o.id;
 RETURN now();
END $$;
-- Keep state monotonic, even if callback arrives before the synchronous HTTP response is saved.
CREATE FUNCTION public.sync_outbox_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE email_outbox SET status=CASE NEW.status WHEN 'email.delivered' THEN 'delivered' WHEN 'email.bounced' THEN 'bounced' WHEN 'email.complained' THEN 'complained' WHEN 'email.suppressed' THEN 'suppressed' WHEN 'email.failed' THEN 'failed_permanent' WHEN 'email.delivery_delayed' THEN 'accepted' ELSE 'accepted' END,
 provider_event_at=NEW.last_event_at,updated_at=now(),next_attempt_at=NULL
 WHERE provider_message_id=NEW.provider_message_id::text AND (provider_event_at IS NULL OR provider_event_at<NEW.last_event_at)
 AND (status NOT IN('delivered','bounced','complained','suppressed') OR NEW.status IN('email.bounced','email.complained','email.suppressed'));
 RETURN NEW;
END $$;
-- Verify column names below against the preceding webhook migration.
CREATE TRIGGER email_delivery_outbox AFTER INSERT OR UPDATE ON public.email_deliveries FOR EACH ROW EXECUTE FUNCTION public.sync_outbox_delivery();
REVOKE ALL ON FUNCTION public.claim_email_outbox(uuid,integer),public.prepare_outbox_token(uuid,text,text),public.sync_outbox_delivery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(uuid,integer),public.prepare_outbox_token(uuid,text,text) TO service_role;
CREATE FUNCTION public.finish_email_outbox(p_id uuid,p_attempt int,p_status text,p_category text,p_http int,p_message text,p_next timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d email_deliveries; o email_outbox;
BEGIN
 SELECT * INTO o FROM email_outbox WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.attempts<>p_attempt OR o.status<>'sending' THEN RETURN; END IF;
 UPDATE email_outbox SET status=p_status,last_error_category=p_category,provider_http_status=p_http,provider_message_id=p_message,next_attempt_at=p_next,updated_at=now() WHERE id=p_id;
 IF p_message IS NOT NULL THEN
  SELECT * INTO d FROM email_deliveries WHERE provider_message_id::text=p_message ORDER BY last_event_at DESC LIMIT 1;
  IF FOUND THEN UPDATE email_outbox SET status=CASE d.status WHEN 'email.delivered' THEN 'delivered' WHEN 'email.bounced' THEN 'bounced' WHEN 'email.complained' THEN 'complained' WHEN 'email.suppressed' THEN 'suppressed' WHEN 'email.failed' THEN 'failed_permanent' ELSE 'accepted' END,provider_event_at=d.last_event_at WHERE id=p_id; END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_email_outbox(uuid,integer,text,text,integer,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_email_outbox(uuid,integer,text,text,integer,text,timestamptz) TO service_role;
CREATE FUNCTION public.admin_retry_email(p_id uuid,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE o email_outbox;
BEGIN
 PERFORM 1 FROM profiles WHERE id=p_actor AND role='admin' AND email_verified_at IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO o FROM email_outbox WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.provider_message_id IS NOT NULL OR o.status NOT IN('failed_temporary','failed_permanent') OR o.last_error_category IN('suppressed','provider_validation') OR o.created_at<now()-interval '23 hours' THEN RAISE EXCEPTION 'not_retryable'; END IF;
 INSERT INTO admin_audit_logs(admin_id,action,note,metadata) VALUES(p_actor,'email_retry','Email retry requested',jsonb_build_object('outbox_id',p_id,'correlation_id',o.correlation_id));
 UPDATE email_outbox SET status='queued',attempts=0,next_attempt_at=now(),updated_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_retry_email(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_email(uuid,uuid) TO service_role;
COMMIT;
