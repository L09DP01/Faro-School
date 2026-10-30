BEGIN;
CREATE TABLE public.email_outbox_material(outbox_id uuid PRIMARY KEY REFERENCES public.email_outbox(id) ON DELETE CASCADE,nonce text NOT NULL,ciphertext text NOT NULL);
ALTER TABLE public.email_outbox_material ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox_material FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.email_outbox_material TO service_role;
-- Transactional, deduplicated event capture. No network requests from PostgreSQL.
CREATE FUNCTION public.queue_profile_email(p_user uuid,p_kind text,p_key text,p_data jsonb DEFAULT '{}',p_recipient text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u profiles; result uuid;
BEGIN
 SELECT * INTO u FROM profiles WHERE id=p_user;
 IF NOT FOUND OR coalesce(p_recipient,u.email) IS NULL THEN RETURN NULL; END IF;
 INSERT INTO email_outbox(kind,user_id,recipient,locale,idempotency_key,data)
 VALUES(p_kind,u.id,coalesce(p_recipient,u.email),CASE WHEN u.locale='ht' THEN 'ht' ELSE 'fr' END,p_key,p_data)
 ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.capture_payment_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o orders; c courses; kind text;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status AND to_jsonb(NEW)->>'refunded_at' IS NOT DISTINCT FROM to_jsonb(OLD)->>'refunded_at' THEN RETURN NEW; END IF;
 kind:=CASE WHEN NEW.status='refunded' OR to_jsonb(NEW)->>'refunded_at' IS NOT NULL THEN 'access_revoked' WHEN NEW.status='validated' THEN 'payment_confirmed' WHEN NEW.status IN('failed','cancelled') THEN 'payment_failed' ELSE NULL END;
 IF kind IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO o FROM orders WHERE id=NEW.order_id;SELECT * INTO c FROM courses WHERE id=o.course_id;
 PERFORM queue_profile_email(o.user_id,kind,'payment:'||NEW.id||':'||kind,jsonb_build_object('course',c.title_fr,'course_slug',c.slug,'amount',o.amount_htg||' HTG','order_id',o.id,'detail',CASE WHEN kind='payment_failed' THEN 'payment_not_completed' ELSE '' END));
 RETURN NEW;
END $$;
CREATE TRIGGER capture_payment_email AFTER UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.capture_payment_email();
CREATE FUNCTION public.capture_access_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c courses;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.revoked_at IS NULL OR OLD.revoked_at IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT * INTO c FROM courses WHERE id=OLD.course_id;
 PERFORM queue_profile_email(OLD.user_id,'access_revoked','access:'||OLD.id||':revoked',jsonb_build_object('course',c.title_fr,'course_slug',c.slug));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER capture_access_deleted BEFORE DELETE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.capture_access_email();
CREATE TRIGGER capture_access_revoked AFTER UPDATE OF revoked_at ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.capture_access_email();
CREATE FUNCTION public.capture_certificate_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM queue_profile_email(NEW.user_id,'certificate','certificate:'||NEW.id,jsonb_build_object('course',NEW.course_title,'certificate_number',NEW.certificate_number));RETURN NEW;
END $$;
CREATE TRIGGER capture_certificate_email AFTER INSERT ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.capture_certificate_email();
CREATE FUNCTION public.capture_password_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
  PERFORM queue_profile_email(NEW.user_id,'security','password:'||NEW.user_id||':'||NEW.token_version);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER capture_password_email AFTER UPDATE OF password_hash ON public.user_credentials FOR EACH ROW EXECUTE FUNCTION public.capture_password_email();

CREATE FUNCTION public.reset_password_atomic(p_hash text,p_password_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t password_reset_tokens; v int; invitation boolean;
BEGIN
 SELECT * INTO t FROM password_reset_tokens WHERE token_hash=p_hash LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR t.used_at IS NOT NULL OR t.expires_at<=now() THEN RETURN '{"success":false,"reason":"invalid"}'; END IF;
 PERFORM 1 FROM profiles WHERE id=t.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 INSERT INTO user_credentials(user_id,password_hash,token_version) VALUES(t.user_id,p_password_hash,1)
 ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,token_version=user_credentials.token_version+1,failed_count=0,locked_until=NULL RETURNING token_version INTO v;
 IF v IS NULL THEN RAISE EXCEPTION 'credentials_missing'; END IF;
 SELECT kind='invitation' INTO invitation FROM email_outbox WHERE id=t.outbox_id;
 IF invitation THEN UPDATE profiles SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=t.user_id; END IF;
 UPDATE password_reset_tokens SET used_at=now() WHERE id=t.id;
 RETURN jsonb_build_object('success',true,'userId',t.user_id);
END $$;
CREATE FUNCTION public.change_password_atomic(p_user uuid,p_version int,p_old_hash text,p_new_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 UPDATE user_credentials SET password_hash=p_new_hash,token_version=token_version+1,failed_count=0,locked_until=NULL
 WHERE user_id=p_user AND token_version=p_version AND password_hash=p_old_hash;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;
END $$;
-- Verify against all active accepted codes, not only the newest resend; five failed attempts per address.
CREATE OR REPLACE FUNCTION public.consume_verification_token(p_email text DEFAULT NULL,p_code_hash text DEFAULT NULL,p_token_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t email_verification_tokens; u uuid; old_email text; o email_outbox;
BEGIN
 IF p_token_hash IS NOT NULL THEN
  SELECT email INTO p_email FROM email_verification_tokens WHERE token_hash=p_token_hash LIMIT 1;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(p_email),1));
 IF p_token_hash IS NOT NULL THEN SELECT * INTO t FROM email_verification_tokens WHERE token_hash=p_token_hash LIMIT 1 FOR UPDATE;
 ELSE
  SELECT * INTO t FROM email_verification_tokens WHERE email=lower(p_email) ORDER BY (used_at IS NULL AND expires_at>now() AND email_constant_equal(code_hash,p_code_hash)) DESC,created_at DESC LIMIT 1 FOR UPDATE;
 END IF;
 IF t.id IS NULL THEN RETURN '{"success":false,"reason":"not_found"}'; END IF;
 IF t.used_at IS NOT NULL THEN RETURN '{"success":false,"reason":"already_used"}'; END IF;
 IF t.expires_at<=now() THEN RETURN '{"success":false,"reason":"expired"}'; END IF;
 IF t.attempts>=5 THEN RETURN '{"success":false,"reason":"max_attempts"}'; END IF;
 IF p_token_hash IS NULL AND NOT email_constant_equal(t.code_hash,p_code_hash) THEN
  UPDATE email_verification_tokens SET attempts=least(5,attempts+1) WHERE email=lower(p_email) AND used_at IS NULL AND expires_at>now();
  RETURN jsonb_build_object('success',false,'reason',CASE WHEN t.attempts+1>=5 THEN 'max_attempts' ELSE 'invalid' END);
 END IF;
 SELECT * INTO o FROM email_outbox WHERE id=t.outbox_id;
 IF o.kind='email_change' THEN
  SELECT email INTO old_email FROM profiles WHERE id=o.user_id FOR UPDATE;
  UPDATE profiles SET email=t.email,email_verified_at=now() WHERE id=o.user_id RETURNING id INTO u;
  UPDATE user_credentials SET token_version=token_version+1 WHERE user_id=u;
  PERFORM queue_profile_email(u,'security','email-changed:'||t.id,'{}',old_email);
 ELSE UPDATE profiles SET email_verified_at=coalesce(email_verified_at,now()) WHERE email=t.email RETURNING id INTO u;
 END IF;
 IF u IS NULL THEN RAISE EXCEPTION 'profile_missing'; END IF;
 UPDATE email_verification_tokens SET used_at=now() WHERE email=t.email AND used_at IS NULL;
 RETURN jsonb_build_object('success',true,'email',t.email,'userId',u);
END $$;
-- Once provider acceptance is recorded, a delayed worker must not announce success twice.
CREATE FUNCTION public.accept_escalation_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE conversation uuid;
BEGIN
 IF NEW.kind='escalation' AND NEW.status IN('accepted','delivered') AND OLD.status NOT IN('accepted','delivered') THEN
  UPDATE escalations SET email_status='sent' WHERE id=(NEW.data->>'escalation_id')::uuid AND email_status<>'sent' RETURNING conversation_id INTO conversation;
  IF conversation IS NOT NULL THEN
   INSERT INTO messages(conversation_id,sender_type,sender_id,body) VALUES(conversation,'system',NULL,CASE WHEN NEW.data->>'student_locale'='ht' THEN 'Fòmatè a resevwa yon notifikasyon imèl pou kesyon ou an.' ELSE 'Le formateur a reçu une notification par e-mail pour votre question.' END);
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER email_escalation_accepted AFTER UPDATE OF status ON public.email_outbox FOR EACH ROW EXECUTE FUNCTION public.accept_escalation_email();
REVOKE ALL ON FUNCTION public.queue_profile_email(uuid,text,text,jsonb,text),public.capture_payment_email(),public.capture_access_email(),public.capture_certificate_email(),public.capture_password_email(),public.reset_password_atomic(text,text),public.change_password_atomic(uuid,int,text,text),public.accept_escalation_email() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_profile_email(uuid,text,text,jsonb,text),public.reset_password_atomic(text,text),public.change_password_atomic(uuid,int,text,text) TO service_role;
-- Retries reuse the same secret and extend its validity from the latest send attempt.
DROP FUNCTION public.prepare_outbox_token(uuid,text,text);
CREATE FUNCTION public.prepare_outbox_token(p_id uuid,p_code_hash text,p_token_hash text,p_expires timestamptz) RETURNS timestamptz
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
CREATE FUNCTION public.invalidate_role_sessions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.role IS DISTINCT FROM OLD.role THEN UPDATE user_credentials SET token_version=token_version+1 WHERE user_id=NEW.id; END IF;RETURN NEW;
END $$;
CREATE TRIGGER email_role_session_safety AFTER UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.invalidate_role_sessions();
REVOKE ALL ON FUNCTION public.invalidate_role_sessions() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.store_contact_with_email(p_name text,p_contact text,p_message text,p_support text,p_locale text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE message_id uuid; email_id uuid;
BEGIN
 INSERT INTO contact_messages(name,contact,message) VALUES(p_name,p_contact,p_message) RETURNING id INTO message_id;
 INSERT INTO email_outbox(kind,recipient,locale,idempotency_key,data) VALUES('contact',coalesce(nullif(p_support,''),'unconfigured'),CASE WHEN p_locale='ht' THEN 'ht' ELSE 'fr' END,'contact:'||message_id,jsonb_build_object('name',p_name,'detail',p_message)) RETURNING id INTO email_id;
 RETURN jsonb_build_object('message_id',message_id,'email_id',email_id);
END $$;
REVOKE ALL ON FUNCTION public.store_contact_with_email(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_contact_with_email(text,text,text,text,text) TO service_role;
CREATE FUNCTION public.email_status_summary() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('counts',coalesce((SELECT jsonb_object_agg(status,n) FROM (SELECT status,count(*) n FROM email_outbox WHERE created_at>now()-interval '24 hours' GROUP BY status) c),'{}'::jsonb),'lastSuccess',(SELECT created_at FROM email_send_attempts WHERE status='accepted' ORDER BY created_at DESC LIMIT 1),'lastFailure',(SELECT category FROM email_send_attempts WHERE category IS NOT NULL ORDER BY created_at DESC LIMIT 1));
$$;
REVOKE ALL ON FUNCTION public.email_status_summary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_status_summary() TO service_role;
CREATE FUNCTION public.queue_instructor_escalation(p_actor uuid,p_conversation uuid,p_message uuid,p_escalation uuid,p_reason text,p_fallback text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c conversations; actor profiles; staff profiles; course courses; m messages; recipient text; email_id uuid;
BEGIN
 SELECT * INTO actor FROM profiles WHERE id=p_actor;
 IF actor.id IS NULL OR actor.email_verified_at IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO c FROM conversations WHERE id=p_conversation FOR UPDATE;
 IF c.id IS NULL OR c.student_id<>p_actor THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO m FROM messages WHERE id=p_message AND conversation_id=c.id AND sender_id=p_actor AND sender_type='student';
 IF m.id IS NULL THEN RAISE EXCEPTION 'message_missing'; END IF;
 IF c.course_id IS NOT NULL THEN SELECT * INTO course FROM courses WHERE id=c.course_id;IF course.instructor_id IS DISTINCT FROM c.staff_id THEN RAISE EXCEPTION 'staff_changed'; END IF; END IF;
 SELECT * INTO staff FROM profiles WHERE id=c.staff_id AND role IN('instructor','admin') AND email_verified_at IS NOT NULL;
 IF staff.id IS NULL THEN RAISE EXCEPTION 'recipient_unavailable'; END IF;
 SELECT escalation_email INTO recipient FROM instructors WHERE profile_id=staff.id;
 recipient:=coalesce(nullif(recipient,''),staff.email,nullif(p_fallback,''));
 IF recipient IS NULL THEN RAISE EXCEPTION 'recipient_unavailable'; END IF;
 INSERT INTO escalations(id,conversation_id,trigger_message_id,reason,email_status,deadline_at) VALUES(p_escalation,c.id,m.id,p_reason,'pending',now()+interval '2 minutes') ON CONFLICT(id) DO NOTHING;
 INSERT INTO email_outbox(kind,recipient,locale,user_id,idempotency_key,data)
 VALUES('escalation',recipient,CASE WHEN staff.locale='ht' THEN 'ht' ELSE 'fr' END,staff.id,'escalation:'||p_escalation,jsonb_build_object('name',actor.full_name,'course',coalesce(course.title_fr,''),'detail',c.subject||E'\n\n'||m.body,'conversation_id',c.id,'escalation_id',p_escalation,'student_locale',actor.locale))
 ON CONFLICT(idempotency_key) DO NOTHING;
 SELECT id INTO email_id FROM email_outbox WHERE idempotency_key='escalation:'||p_escalation;
 RETURN email_id;
END $$;
REVOKE ALL ON FUNCTION public.queue_instructor_escalation(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_instructor_escalation(uuid,uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
