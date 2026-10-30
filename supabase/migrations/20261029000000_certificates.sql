-- Apply manually after 20250121000000_authjs_migration.sql. No remote changes by the agent.
BEGIN;
DROP TRIGGER IF EXISTS trg_issue_certificate_on_completion ON public.lesson_progress;
DROP FUNCTION IF EXISTS public.check_course_completion_and_issue_certificate();
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate_min_progress numeric NOT NULL DEFAULT 100 CHECK (certificate_min_progress > 0 AND certificate_min_progress <= 100);
-- The previous schema published whole courses only. Existing lessons remain published.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
CREATE FUNCTION public.protect_course_certificate_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('postgres','service_role') OR public.is_current_user_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.certificate_enabled IS DISTINCT FROM true OR NEW.certificate_min_progress<>100 THEN RAISE EXCEPTION 'forbidden'; END IF;
 ELSIF NEW.certificate_enabled IS DISTINCT FROM OLD.certificate_enabled OR NEW.certificate_min_progress IS DISTINCT FROM OLD.certificate_min_progress THEN
  RAISE EXCEPTION 'forbidden';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER certificate_settings_admin_only BEFORE INSERT OR UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.protect_course_certificate_settings();
REVOKE ALL ON FUNCTION public.protect_course_certificate_settings() FROM PUBLIC,anon,authenticated;

ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certificate_number text UNIQUE;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS course_title text;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS instructor_name text;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS content_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS revoked_reason text;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS signature_name text NOT NULL DEFAULT '';
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS signature_title text NOT NULL DEFAULT '';
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS signature_image_path text;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.certificates(id);
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
-- Preserve historical codes, but revoke legacy auto-issued rows without confirmed names.
UPDATE public.certificates c SET certificate_number=c.code, student_name=p.full_name,
 course_title=co.title_fr, instructor_name=COALESCE(i.full_name,'Faro School'),
 revoked_at=COALESCE(c.revoked_at,now()), revoked_reason=COALESCE(c.revoked_reason,'legacy_unconfirmed')
 FROM public.profiles p, public.courses co LEFT JOIN public.profiles i ON i.id=co.instructor_id
 WHERE c.user_id=p.id AND c.course_id=co.id AND c.certificate_number IS NULL;
ALTER TABLE public.certificates ALTER COLUMN certificate_number SET NOT NULL;
ALTER TABLE public.certificates ALTER COLUMN student_name SET NOT NULL;
ALTER TABLE public.certificates ALTER COLUMN course_title SET NOT NULL;
ALTER TABLE public.certificates ALTER COLUMN instructor_name SET NOT NULL;
-- Reissues are historical rows; only one VALID certificate may exist per student/course.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.certificates'::regclass AND contype='u'
 AND pg_get_constraintdef(oid) ~ 'user_id, course_id' LOOP
 EXECUTE format('ALTER TABLE public.certificates DROP CONSTRAINT %I',r.conname); END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS certificates_one_valid ON public.certificates(user_id,course_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS certificates_owner ON public.certificates(user_id,issued_at DESC);

CREATE TABLE public.certificate_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), signature_name text NOT NULL DEFAULT '',
 signature_title text NOT NULL DEFAULT '', signature_image_path text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.certificate_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.certificate_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.certificate_settings FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.certificate_settings TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
-- Remove ALL historical policies, including the public verification policy.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='certificates'
 LOOP EXECUTE format('DROP POLICY %I ON public.certificates',r.policyname); END LOOP;
END $$;
REVOKE ALL ON public.certificates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
CREATE POLICY certificates_read ON public.certificates FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL)
 AND (user_id=auth.uid() OR public.is_current_user_admin() OR (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='instructor') AND EXISTS(
 SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.instructor_id=auth.uid())))
);

CREATE FUNCTION public.certificate_eligibility(p_user uuid,p_course uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_course record; v_enrollment uuid; v_total int; v_done int; v_verified boolean; v_existing jsonb;
BEGIN
 SELECT email_verified_at IS NOT NULL AND banned_at IS NULL INTO v_verified FROM profiles WHERE id=p_user;
 SELECT * INTO v_course FROM courses WHERE id=p_course;
 IF NOT FOUND OR NOT COALESCE(v_verified,false) THEN RETURN jsonb_build_object('eligible',false); END IF;
 SELECT id INTO v_enrollment FROM enrollments WHERE user_id=p_user AND course_id=p_course AND revoked_at IS NULL;
 SELECT to_jsonb(c) INTO v_existing FROM certificates c WHERE user_id=p_user AND course_id=p_course ORDER BY issued_at DESC LIMIT 1;
 SELECT count(*),count(lp.completed_at) INTO v_total,v_done FROM lessons l
 JOIN modules m ON m.id=l.module_id LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.user_id=p_user
 WHERE m.course_id=p_course AND l.is_published;
 RETURN jsonb_build_object('eligible', v_course.certificate_enabled AND v_course.status='published' AND v_enrollment IS NOT NULL
 AND v_total>0 AND v_done*100.0/v_total>=v_course.certificate_min_progress,
 'completed',v_done,'total',v_total,'required',v_course.certificate_min_progress,'certificate',v_existing);
END $$;
REVOKE ALL ON FUNCTION public.certificate_eligibility(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_eligibility(uuid,uuid) TO service_role;

CREATE FUNCTION public.issue_course_certificate(p_actor uuid,p_course uuid,p_name text,p_number text,p_old uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=p_actor; v_cert certificates%ROWTYPE; v_old certificates%ROWTYPE; v_elig jsonb;
 v_course courses%ROWTYPE; v_enroll uuid; v_instructor text; v_hours numeric; v_settings certificate_settings%ROWTYPE; v_role text;
BEGIN
 SELECT role INTO v_role FROM profiles WHERE id=p_actor AND email_verified_at IS NOT NULL AND banned_at IS NULL;
 IF v_role IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF char_length(trim(p_name)) NOT BETWEEN 2 AND 60 OR trim(p_name) !~ '^[[:alpha:]À-ž ''’‐-]+$' THEN RAISE EXCEPTION 'invalid_name'; END IF;
 IF p_number !~ '^FARO-[0-9]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$' THEN RAISE EXCEPTION 'invalid_number'; END IF;
 IF p_old IS NOT NULL THEN
  IF v_role<>'admin' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_old FROM certificates WHERE id=p_old;
  IF NOT FOUND OR v_old.course_id<>p_course THEN RAISE EXCEPTION 'not_found'; END IF;
  v_user:=v_old.user_id;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||p_course::text,0));
 SELECT * INTO v_cert FROM certificates WHERE user_id=v_user AND course_id=p_course ORDER BY issued_at DESC LIMIT 1 FOR UPDATE;
 IF p_old IS NULL AND FOUND AND v_cert.revoked_reason IS DISTINCT FROM 'legacy_unconfirmed' THEN
  RETURN jsonb_build_object('certificate',to_jsonb(v_cert),'created',false);
 END IF;
 IF p_old IS NOT NULL AND v_cert.id<>p_old THEN RAISE EXCEPTION 'stale_reissue'; END IF;
 SELECT id INTO v_enroll FROM enrollments WHERE user_id=v_user AND course_id=p_course AND revoked_at IS NULL FOR UPDATE;
 IF v_enroll IS NULL THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 IF EXISTS(SELECT 1 FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=v_user AND o.course_id=p_course
 AND (p.refunded_at IS NOT NULL OR to_jsonb(p)->>'status'='refunded' OR to_jsonb(o)->>'status'='refunded')) THEN RAISE EXCEPTION 'refunded'; END IF;
 SELECT * INTO v_course FROM courses WHERE id=p_course FOR SHARE;
 IF p_old IS NULL THEN
  v_elig:=certificate_eligibility(v_user,p_course);
  IF NOT COALESCE((v_elig->>'eligible')::boolean,false) THEN RAISE EXCEPTION 'not_eligible'; END IF;
 END IF;
 IF p_old IS NOT NULL THEN
  UPDATE certificates SET revoked_at=COALESCE(revoked_at,now()),revoked_reason='name_corrected',revoked_by=p_actor WHERE id=p_old;
  INSERT INTO admin_audit_logs(admin_id,action,user_id,course_id,metadata) VALUES(p_actor,'certificate_revoked',v_user,p_course,jsonb_build_object('certificate_id',p_old,'reason','name_corrected'));
 END IF;
 SELECT full_name INTO v_instructor FROM profiles WHERE id=v_course.instructor_id;
 SELECT COALESCE(sum(l.duration_sec),0)/3600.0 INTO v_hours FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.course_id=p_course AND l.is_published;
 SELECT * INTO v_settings FROM certificate_settings WHERE id=true;
 INSERT INTO certificates(user_id,course_id,enrollment_id,code,certificate_number,student_name,course_title,instructor_name,content_hours,
 signature_name,signature_title,signature_image_path,supersedes_id)
 VALUES(v_user,p_course,v_enroll,p_number,p_number,trim(p_name),COALESCE(v_old.course_title,v_course.title_fr),
 COALESCE(v_old.instructor_name,v_instructor,'Faro School'),COALESCE(v_old.content_hours,v_hours),
 v_settings.signature_name,v_settings.signature_title,v_settings.signature_image_path,p_old) RETURNING * INTO v_cert;
 INSERT INTO admin_audit_logs(admin_id,action,user_id,course_id,metadata) VALUES(CASE WHEN v_role='admin' THEN p_actor END,
 CASE WHEN p_old IS NULL THEN 'certificate_issued' ELSE 'certificate_reissued' END,v_user,p_course,
 jsonb_build_object('certificate_id',v_cert.id,'previous_id',p_old,'actor_id',p_actor));
 RETURN jsonb_build_object('certificate',to_jsonb(v_cert),'created',true);
END $$;
REVOKE ALL ON FUNCTION public.issue_course_certificate(uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_course_certificate(uuid,uuid,text,text,uuid) TO service_role;

CREATE FUNCTION public.revoke_course_certificate(p_actor uuid,p_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cert certificates%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='admin' AND email_verified_at IS NOT NULL AND banned_at IS NULL) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF char_length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 SELECT * INTO v_cert FROM certificates WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF v_cert.revoked_at IS NOT NULL THEN RETURN; END IF;
 UPDATE certificates SET revoked_at=now(),revoked_reason=trim(p_reason),revoked_by=p_actor WHERE id=p_id;
 INSERT INTO admin_audit_logs(admin_id,action,user_id,course_id,metadata) VALUES(p_actor,'certificate_revoked',v_cert.user_id,v_cert.course_id,jsonb_build_object('certificate_id',p_id,'reason',trim(p_reason)));
END $$;
REVOKE ALL ON FUNCTION public.revoke_course_certificate(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_course_certificate(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.revoke_enrollment_certificates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.revoked_at IS NOT NULL THEN
 UPDATE certificates SET revoked_at=now(),revoked_reason='enrollment_revoked' WHERE user_id=OLD.user_id AND course_id=OLD.course_id AND revoked_at IS NULL;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER certificates_enrollment_deleted BEFORE DELETE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.revoke_enrollment_certificates();
CREATE TRIGGER certificates_enrollment_revoked AFTER UPDATE OF revoked_at ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.revoke_enrollment_certificates();
CREATE FUNCTION public.revoke_refunded_certificates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_course uuid;
BEGIN
 IF to_jsonb(NEW)->>'status'='refunded' OR to_jsonb(NEW)->>'refunded_at' IS NOT NULL THEN
  IF TG_TABLE_NAME='payments' THEN SELECT user_id,course_id INTO v_user,v_course FROM orders WHERE id=NEW.order_id;
  ELSE v_user:=NEW.user_id; v_course:=NEW.course_id; END IF;
  UPDATE certificates SET revoked_at=now(),revoked_reason='payment_refunded' WHERE user_id=v_user AND course_id=v_course AND revoked_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER certificates_payment_refund AFTER UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.revoke_refunded_certificates();
CREATE TRIGGER certificates_order_refund AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.revoke_refunded_certificates();

-- Verification throttling: reuse auth_attempts, atomic count, no raw IP stored.
CREATE FUNCTION public.certificate_verification_limit(p_identifier text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_identifier,1));
 SELECT COALESCE(sum(attempts),0) INTO v_count FROM auth_attempts WHERE identifier=p_identifier AND attempt_type='certificate_verification' AND first_attempt_at>now()-interval '1 minute';
 IF v_count>=30 THEN RETURN false; END IF;
 INSERT INTO auth_attempts(identifier,attempt_type) VALUES(p_identifier,'certificate_verification');
 DELETE FROM auth_attempts WHERE attempt_type='certificate_verification' AND first_attempt_at<now()-interval '1 day';
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.certificate_verification_limit(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_verification_limit(text) TO service_role;
-- Trigger functions must not be callable from the Data API.
REVOKE ALL ON FUNCTION public.revoke_enrollment_certificates() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.revoke_refunded_certificates() FROM PUBLIC,anon,authenticated;
COMMIT;
