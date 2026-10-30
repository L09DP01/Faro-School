-- Repair the exact RPC contract used by the deployed email outbox.
-- Safe to rerun. Does not delete accounts, messages or existing proofs.
BEGIN;
DROP FUNCTION IF EXISTS public.prepare_outbox_token(uuid,text,text);
CREATE OR REPLACE FUNCTION public.prepare_outbox_token(p_id uuid,p_code_hash text,p_token_hash text,p_expires timestamptz) RETURNS timestamptz
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE o email_outbox;
BEGIN
 SELECT * INTO o FROM email_outbox WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'sending' THEN RAISE EXCEPTION 'not_claimed'; END IF;
 IF o.kind IN('verification','email_change') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(o.recipient),1));
  IF o.prepared_at IS NULL THEN
   -- Keep older proofs until expiry: an HTTP timeout may conceal provider acceptance.
   INSERT INTO email_verification_tokens(email,code_hash,token_hash,expires_at,outbox_id) VALUES(o.recipient,p_code_hash,p_token_hash,p_expires,o.id);
  ELSE
   UPDATE email_verification_tokens SET expires_at=p_expires WHERE outbox_id=o.id AND used_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'already_consumed'; END IF;
  END IF;
 ELSE
  PERFORM 1 FROM profiles WHERE id=o.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
  IF o.prepared_at IS NULL THEN
   INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,outbox_id) VALUES(o.user_id,p_token_hash,p_expires,o.id);
  ELSE
   UPDATE password_reset_tokens SET expires_at=p_expires WHERE outbox_id=o.id AND used_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'already_consumed'; END IF;
  END IF;
 END IF;
 UPDATE email_outbox SET prepared_at=coalesce(prepared_at,now()) WHERE id=o.id;
 RETURN now();
END $$;
REVOKE ALL ON FUNCTION public.prepare_outbox_token(uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_outbox_token(uuid,text,text,timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
