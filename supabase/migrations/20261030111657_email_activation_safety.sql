-- Local migration only. Apply after existing Auth.js and webhook migrations.
BEGIN;
CREATE TABLE public.email_send_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL,
 status text NOT NULL, category text, http_status integer, provider_message_id text,
 correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_send_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_send_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.email_send_attempts TO service_role;
CREATE INDEX ON public.email_send_attempts(created_at DESC);

CREATE TABLE public.email_rate_budgets (
 identifier text NOT NULL, kind text NOT NULL, count integer NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now(), last_at timestamptz,
 PRIMARY KEY(identifier,kind)
);
ALTER TABLE public.email_rate_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_rate_budgets FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_rate_budgets TO service_role;
CREATE FUNCTION public.reserve_email_budget(p_address text,p_ip text,p_kind text,p_max integer DEFAULT 5,p_window integer DEFAULT 3600,p_cooldown integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE b public.email_rate_budgets; k text; n timestamptz := clock_timestamp();
BEGIN
 IF p_max<1 OR p_window<1 OR p_cooldown<0 THEN RAISE EXCEPTION 'invalid_budget'; END IF;
 -- Deterministic locking order prevents concurrent per-address/IP reservations racing.
 FOR k IN SELECT DISTINCT v FROM unnest(ARRAY['address:'||lower(p_address),'ip:'||p_ip]) v ORDER BY v LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(p_kind||k,0));
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(ARRAY['address:'||lower(p_address),'ip:'||p_ip]) v LOOP
  SELECT * INTO b FROM email_rate_budgets WHERE identifier=k AND kind=p_kind FOR UPDATE;
  IF FOUND AND b.window_start>n-make_interval(secs=>p_window) AND (b.count>=p_max OR (k LIKE 'address:%' AND b.last_at>n-make_interval(secs=>p_cooldown))) THEN
   RETURN jsonb_build_object('allowed',false,'retryAfterSeconds',CASE WHEN b.count>=p_max THEN greatest(1,ceil(extract(epoch FROM b.window_start+make_interval(secs=>p_window)-n))) ELSE greatest(1,ceil(extract(epoch FROM b.last_at+make_interval(secs=>p_cooldown)-n))) END);
  END IF;
 END LOOP;
 FOR k IN SELECT DISTINCT v FROM unnest(ARRAY['address:'||lower(p_address),'ip:'||p_ip]) v LOOP
  INSERT INTO email_rate_budgets(identifier,kind,count,window_start,last_at) VALUES(k,p_kind,1,n,n)
  ON CONFLICT(identifier,kind) DO UPDATE SET count=CASE WHEN email_rate_budgets.window_start<=n-make_interval(secs=>p_window) THEN 1 ELSE email_rate_budgets.count+1 END,window_start=CASE WHEN email_rate_budgets.window_start<=n-make_interval(secs=>p_window) THEN n ELSE email_rate_budgets.window_start END,last_at=n;
 END LOOP;
 RETURN '{"allowed":true}'::jsonb;
END $$;

CREATE FUNCTION public.email_constant_equal(a text,b text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE difference integer:=0; i integer;
BEGIN
 IF length(a)<>64 OR length(b)<>64 OR a IS NULL OR b IS NULL THEN RETURN false; END IF;
 FOR i IN 1..64 LOOP difference:=difference | (ascii(substr(a,i,1)) # ascii(substr(b,i,1))); END LOOP;
 RETURN difference=0;
END $$;
CREATE FUNCTION public.create_verification_token(p_email text,p_code_hash text,p_token_hash text,p_expires timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_email),1));
 UPDATE email_verification_tokens SET used_at=now() WHERE email=lower(p_email) AND used_at IS NULL;
 INSERT INTO email_verification_tokens(email,code_hash,token_hash,expires_at) VALUES(lower(p_email),p_code_hash,p_token_hash,p_expires);
END $$;
CREATE FUNCTION public.consume_verification_token(p_email text DEFAULT NULL,p_code_hash text DEFAULT NULL,p_token_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t email_verification_tokens; u uuid;
BEGIN
 IF p_token_hash IS NOT NULL THEN
  SELECT * INTO t FROM email_verification_tokens WHERE token_hash=p_token_hash ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_email),1));
  SELECT * INTO t FROM email_verification_tokens WHERE email=lower(p_email) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 END IF;
 IF NOT FOUND OR t.id IS NULL THEN RETURN '{"success":false,"reason":"not_found"}'; END IF;
 IF t.used_at IS NOT NULL THEN RETURN '{"success":false,"reason":"already_used"}'; END IF;
 IF t.expires_at<=now() THEN RETURN '{"success":false,"reason":"expired"}'; END IF;
 IF t.attempts>=5 THEN RETURN '{"success":false,"reason":"max_attempts"}'; END IF;
 IF p_token_hash IS NULL AND NOT email_constant_equal(t.code_hash,p_code_hash) THEN
  UPDATE email_verification_tokens SET attempts=attempts+1 WHERE id=t.id;
  RETURN jsonb_build_object('success',false,'reason',CASE WHEN t.attempts+1>=5 THEN 'max_attempts' ELSE 'invalid' END);
 END IF;
 UPDATE profiles SET email_verified_at=coalesce(email_verified_at,now()) WHERE email=t.email RETURNING id INTO u;
 IF u IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
 UPDATE email_verification_tokens SET used_at=now() WHERE id=t.id;
 RETURN jsonb_build_object('success',true,'email',t.email,'userId',u);
END $$;
CREATE FUNCTION public.create_reset_token(p_user uuid,p_hash text,p_expires timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 UPDATE password_reset_tokens SET used_at=now() WHERE user_id=p_user AND used_at IS NULL;
 INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(p_user,p_hash,p_expires);
END $$;
CREATE FUNCTION public.consume_reset_token(p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t password_reset_tokens;
BEGIN
 SELECT * INTO t FROM password_reset_tokens WHERE token_hash=p_hash LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=now() THEN RETURN '{"success":false,"reason":"invalid"}'; END IF;
 UPDATE password_reset_tokens SET used_at=now() WHERE id=t.id;
 RETURN jsonb_build_object('success',true,'userId',t.user_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_email_budget(text,text,text,integer,integer,integer),public.email_constant_equal(text,text),public.create_verification_token(text,text,text,timestamptz),public.consume_verification_token(text,text,text),public.create_reset_token(uuid,text,timestamptz),public.consume_reset_token(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_budget(text,text,text,integer,integer,integer),public.email_constant_equal(text,text),public.create_verification_token(text,text,text,timestamptz),public.consume_verification_token(text,text,text),public.create_reset_token(uuid,text,timestamptz),public.consume_reset_token(text) TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.email_verification_tokens,public.password_reset_tokens,public.user_credentials,public.auth_attempts TO service_role;
COMMIT;
