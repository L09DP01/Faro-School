BEGIN;
-- Keep browser coupon writes revoked. Only the authenticated server invokes these RPCs.
GRANT SELECT,INSERT,UPDATE,DELETE ON coupons,orders,enrollments,admin_audit_logs TO service_role;
CREATE OR REPLACE FUNCTION manage_promotion_coupon(p_actor uuid,p_version integer,p_operation text,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE target uuid; c coupons; archived boolean:=false; v_percent integer; v_amount integer; v_limit integer; v_expiry timestamptz; v_code text; v_active boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles p JOIN user_credentials u ON u.user_id=p.id WHERE p.id=p_actor AND p.role='admin' AND p.banned_at IS NULL AND p.email_verified_at IS NOT NULL AND u.token_version=p_version) THEN RAISE EXCEPTION 'forbidden';END IF;
 target:=nullif(p_value->>'id','')::uuid;
 IF p_operation='save' THEN
  v_code:=upper(trim(p_value->>'code'));v_percent:=nullif(p_value->>'percent_off','')::integer;v_amount:=nullif(p_value->>'amount_off_htg','')::integer;v_limit:=nullif(p_value->>'max_uses','')::integer;v_expiry:=nullif(p_value->>'expires_at','')::timestamptz;v_active:=(p_value->>'is_active')::boolean;
  IF v_code IS NULL OR v_code !~ '^[A-Z0-9_-]{3,30}$' OR num_nonnulls(v_percent,v_amount)<>1 OR v_percent NOT BETWEEN 1 AND 100 OR v_amount<=0 OR v_limit<=0 OR v_active IS NULL THEN RAISE EXCEPTION 'invalid_data';END IF;
  IF target IS NULL THEN
   INSERT INTO coupons(code,percent_off,amount_off_htg,max_uses,expires_at,is_active)VALUES(v_code,v_percent,v_amount,v_limit,v_expiry,v_active)RETURNING * INTO c;target:=c.id;
  ELSE
   SELECT * INTO c FROM coupons WHERE id=target FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
   UPDATE coupons SET code=v_code,percent_off=v_percent,amount_off_htg=v_amount,max_uses=v_limit,expires_at=v_expiry,is_active=v_active WHERE id=target RETURNING * INTO c;
  END IF;
 ELSIF p_operation IN('toggle','delete') THEN
  SELECT * INTO c FROM coupons WHERE id=target FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'not_found';END IF;
  IF p_operation='toggle' THEN
   v_active:=(p_value->>'is_active')::boolean;IF v_active IS NULL THEN RAISE EXCEPTION 'invalid_data';END IF;
   UPDATE coupons SET is_active=v_active WHERE id=target;
  ELSE
   archived:=EXISTS(SELECT 1 FROM orders WHERE coupon_id=target);
   IF archived THEN UPDATE coupons SET is_active=false WHERE id=target;ELSE DELETE FROM coupons WHERE id=target;END IF;
  END IF;
 ELSE RAISE EXCEPTION 'invalid_data';END IF;
 INSERT INTO admin_audit_logs(admin_id,action,note,metadata)VALUES(p_actor,p_operation||'_coupon','Promotion management',jsonb_build_object('target_id',target,'archived',archived));
 RETURN jsonb_build_object('id',target,'archived',archived);
END $$;
REVOKE ALL ON FUNCTION manage_promotion_coupon(uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION manage_promotion_coupon(uuid,integer,text,jsonb) TO service_role;

-- One durable consumption per real paid order, including gateway webhook retries.
CREATE TABLE IF NOT EXISTS coupon_order_uses(order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,coupon_id uuid NOT NULL REFERENCES coupons(id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE coupon_order_uses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON coupon_order_uses FROM PUBLIC,anon,authenticated;GRANT ALL ON coupon_order_uses TO service_role;
-- Baseline existing real paid orders without changing their historical counters.
INSERT INTO coupon_order_uses(order_id,coupon_id)SELECT id,coupon_id FROM orders WHERE status='paid' AND coupon_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION record_order_coupon_use(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE coupon uuid; inserted integer;
BEGIN
 SELECT coupon_id INTO coupon FROM orders WHERE id=p_order AND status='paid';IF coupon IS NULL THEN RETURN;END IF;
 INSERT INTO coupon_order_uses(order_id,coupon_id)VALUES(p_order,coupon)ON CONFLICT DO NOTHING;GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=1 THEN UPDATE coupons SET used_count=used_count+1 WHERE id=coupon;END IF;
END $$;
REVOKE ALL ON FUNCTION record_order_coupon_use(uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION record_order_coupon_use(uuid) TO service_role;
CREATE OR REPLACE FUNCTION handle_payment_validation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid;v_course uuid;
BEGIN
 IF NEW.status='validated' AND OLD.status IS DISTINCT FROM 'validated' THEN
  UPDATE orders SET status='paid' WHERE id=NEW.order_id RETURNING user_id,course_id INTO v_user,v_course;
  IF v_user IS NOT NULL AND v_course IS NOT NULL THEN INSERT INTO enrollments(user_id,course_id)VALUES(v_user,v_course)ON CONFLICT(user_id,course_id)DO NOTHING;END IF;
  PERFORM record_order_coupon_use(NEW.order_id);
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION handle_payment_validation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION redeem_zero_total_order(p_actor uuid,p_version integer,p_course uuid,p_code text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c courses;q coupons;existing orders;result orders;total integer;discount integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles p JOIN user_credentials u ON u.user_id=p.id WHERE p.id=p_actor AND p.banned_at IS NULL AND p.email_verified_at IS NOT NULL AND u.token_version=p_version) THEN RAISE EXCEPTION 'forbidden';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text||p_course::text,0));
 SELECT * INTO c FROM courses WHERE id=p_course AND status='published' FOR SHARE;IF NOT FOUND OR c.price_htg IS NULL OR c.price_htg<0 THEN RAISE EXCEPTION 'course_unavailable';END IF;
 SELECT * INTO existing FROM orders WHERE user_id=p_actor AND course_id=c.id AND amount_htg=0 AND status='paid' ORDER BY created_at DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.id AND revoked_at IS NULL) THEN
  IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('orderId',existing.id,'status','paid','alreadyRedeemed',true);END IF;RAISE EXCEPTION 'already_enrolled';
 END IF;
 IF EXISTS(SELECT 1 FROM enrollments WHERE user_id=p_actor AND course_id=c.id) THEN RAISE EXCEPTION 'access_unavailable';END IF;
 IF nullif(trim(p_code),'') IS NOT NULL THEN
  SELECT * INTO q FROM coupons WHERE code=upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR q.is_active IS NOT TRUE OR(q.expires_at IS NOT NULL AND q.expires_at<=now()) OR(q.max_uses IS NOT NULL AND q.used_count>=q.max_uses) OR num_nonnulls(q.percent_off,q.amount_off_htg)<>1 THEN RAISE EXCEPTION 'coupon_invalid';END IF;
  IF q.percent_off IS NOT NULL THEN discount:=round(c.price_htg::numeric*q.percent_off/100)::integer;ELSE discount:=least(c.price_htg,q.amount_off_htg);END IF;
 END IF;
 total:=greatest(0,c.price_htg-discount);IF total<>0 THEN RAISE EXCEPTION 'not_free';END IF;
 INSERT INTO orders(user_id,course_id,coupon_id,amount_htg,status,reference)VALUES(p_actor,c.id,q.id,0,'paid','FARO-FREE-'||replace(gen_random_uuid()::text,'-',''))RETURNING * INTO result;
 INSERT INTO enrollments(user_id,course_id)VALUES(p_actor,c.id);
 PERFORM record_order_coupon_use(result.id);
 RETURN jsonb_build_object('orderId',result.id,'status','paid','alreadyRedeemed',false);
END $$;
REVOKE ALL ON FUNCTION redeem_zero_total_order(uuid,integer,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION redeem_zero_total_order(uuid,integer,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_payment_transactional(
  p_payment_id UUID,
  p_provider_txn_id TEXT DEFAULT NULL,
  p_expected_amount_htg INT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_order RECORD;
  v_clean_txn_id TEXT;
  v_conflict_id UUID;
BEGIN
  v_clean_txn_id := NULLIF(TRIM(p_provider_txn_id), '');

  -- A. Lock the payment row to serialize concurrent webhooks or validation attempts
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND: %', p_payment_id;
  END IF;

  -- B. Idempotency guard: If already validated, return success immediately
  IF v_payment.status = 'validated' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_validated', true,
      'payment_id', v_payment.id,
      'order_id', v_payment.order_id
    );
  END IF;

  -- C. Allowed transition guard: only 'pending' or 'awaiting_validation' can transition to 'validated'
  IF v_payment.status NOT IN ('pending', 'awaiting_validation') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: current status is %', v_payment.status;
  END IF;

  -- D. Lock the corresponding order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', v_payment.order_id;
  END IF;

  -- E. Exact amount check (in HTG)
  IF p_expected_amount_htg IS NOT NULL AND v_order.amount_htg <> p_expected_amount_htg THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH: expected % HTG, order amount is % HTG',
      p_expected_amount_htg, v_order.amount_htg;
  END IF;

  -- F. Duplicate transaction ID check
  IF v_clean_txn_id IS NOT NULL THEN
    SELECT id INTO v_conflict_id
    FROM public.payments
    WHERE provider = v_payment.provider
      AND provider_txn_id = v_clean_txn_id
      AND status = 'validated'
      AND id <> p_payment_id
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'DUPLICATE_TRANSACTION_ID: % already used on payment %',
        v_clean_txn_id, v_conflict_id;
    END IF;
  END IF;

  -- G. Atomically update payment row
  UPDATE public.payments
  SET
    status = 'validated',
    provider_txn_id = COALESCE(v_clean_txn_id, provider_txn_id),
    validated_at = NOW(),
    validated_by = p_admin_id,
    raw = CASE
      WHEN p_metadata IS NOT NULL AND p_metadata <> '{}'::jsonb
      THEN COALESCE(raw, '{}'::jsonb) || p_metadata
      ELSE raw
    END
  WHERE id = p_payment_id;

  -- H. Atomically mark order as paid
  UPDATE public.orders
  SET status = 'paid'
  WHERE id = v_order.id;

  -- I. Atomically insert enrollment (idempotent via ON CONFLICT)
  IF v_order.user_id IS NOT NULL AND v_order.course_id IS NOT NULL THEN
    INSERT INTO public.enrollments (user_id, course_id)
    VALUES (v_order.user_id, v_order.course_id)
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- Both the payment trigger and this RPC use the same idempotent order ledger.
  PERFORM public.record_order_coupon_use(v_order.id);

  -- K. Record audit log
  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    payment_id,
    note,
    metadata
  )
  VALUES (
    p_admin_id,
    'payment_validated',
    p_payment_id,
    COALESCE(p_note, CASE WHEN p_admin_id IS NULL THEN 'Webhook Kobara automatique' ELSE 'Validation manuelle' END),
    jsonb_build_object(
      'provider', v_payment.provider,
      'provider_txn_id', COALESCE(v_clean_txn_id, v_payment.provider_txn_id),
      'amount_htg', v_order.amount_htg,
      'order_reference', v_order.reference,
      'automated', (p_admin_id IS NULL)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_validated', false,
    'payment_id', p_payment_id,
    'order_id', v_order.id,
    'order_reference', v_order.reference,
    'amount_htg', v_order.amount_htg
  );
END;
$$;

REVOKE ALL ON FUNCTION validate_payment_transactional(uuid,text,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION validate_payment_transactional(uuid,text,integer,uuid,text,jsonb) TO service_role;
-- Refresh only the unedited seeded support procedure; preserve administrator-authored articles.
DO $$BEGIN IF to_regclass('public.support_knowledge_articles') IS NOT NULL AND to_regclass('public.support_knowledge_versions') IS NOT NULL THEN
 INSERT INTO support_knowledge_versions(article_id,revision,snapshot)SELECT id,revision,to_jsonb(h) FROM support_knowledge_articles h WHERE slug='payments' AND reviewed_by IS NULL AND source_version IN('42306ec115bad86ff18f130a33e07415210219cc6643f227ac8444e921c7dffc','42306ec115bad86ff18f130a33e07415210219cc6643f227ac8444e921c7dffc') ON CONFLICT DO NOTHING;
 UPDATE support_knowledge_articles SET content='{"procedure": "Depuis le catalogue, choisir Acheter, se connecter avec un e-mail vérifié, sélectionner le moyen activé puis suivre la redirection sécurisée Kobara. La confirmation fiable vient du backend. Pour une erreur, identifier le cours, l’étape avant/pendant/après paiement, le texte exact et si l’utilisateur indique un débit. Un code promotionnel peut être appliqué avant confirmation. Si le total devient 0 HTG, utiliser Activer ma formation : le serveur vérifie le code puis active l’inscription sans paiement Kobara ni numéro MonCash/NatCash.", "conditions": "Ne pas recommander de payer à nouveau si un débit est signalé. Un débit déclaré n’est pas une confirmation backend. L’IA ne valide aucun paiement et n’accorde aucun accès. Les opérations de remboursement ou de correction nécessitent un administrateur. Un code expiré, désactivé ou dont la limite est atteinte est refusé. Une prévisualisation de réduction seule ne donne pas accès au cours.", "known_errors": "Codes réellement utilisés : provider_disabled (moyen désactivé), alreadyEnrolled (inscription déjà active), couponInvalid, rateLimit (429), order_write_unavailable, payment_lookup_unavailable, payment_binding_unavailable, gateway_auth (401/403 fournisseur), gateway_validation (400/422), gateway_rate_limited (429), gateway_unavailable, payment_checkout_unavailable, payment_checkout_invalid, payment_id_missing. Les trois erreurs de configuration ou de liaison nécessitent le support ; ne pas répéter le paiement. Statuts commande : pending, paid, failed, cancelled ; paiement : pending, awaiting_validation, validated, failed. Le retour du navigateur ne suffit pas à confirmer le paiement.", "solutions": "Codes réellement utilisés : provider_disabled (moyen désactivé), alreadyEnrolled (inscription déjà active), couponInvalid, rateLimit (429), order_write_unavailable, payment_lookup_unavailable, payment_binding_unavailable, gateway_auth (401/403 fournisseur), gateway_validation (400/422), gateway_rate_limited (429), gateway_unavailable, payment_checkout_unavailable, payment_checkout_invalid, payment_id_missing. Les trois erreurs de configuration ou de liaison nécessitent le support ; ne pas répéter le paiement. Statuts commande : pending, paid, failed, cancelled ; paiement : pending, awaiting_validation, validated, failed. Le retour du navigateur ne suffit pas à confirmer le paiement.", "links": ["/dashboard/paiements"]}'::jsonb,source_refs='["src/app/api/payments/create/route.ts", "src/lib/payments/kobara.ts", "src/lib/payments/types.ts", "src/app/api/orders/[orderId]/status/route.ts", "src/lib/payments/coupon.ts", "docs/COUPONS_AND_ZERO_TOTAL_CHECKOUT.md"]'::jsonb,source_version='944a0c9e18dfa1183a0f5835f289294592cb7536e1cc9dd00ad65b7c51989a05',revision=revision+1,reviewed_at=now(),updated_at=now() WHERE slug='payments' AND reviewed_by IS NULL AND source_version IN('42306ec115bad86ff18f130a33e07415210219cc6643f227ac8444e921c7dffc','42306ec115bad86ff18f130a33e07415210219cc6643f227ac8444e921c7dffc');
END IF;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
