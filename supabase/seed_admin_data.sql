-- Seed Data for Admin Testing & Metrics Verification
-- Inserts sample admin, students, orders, payments, enrollments, and certificates.

DO $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_s1 UUID := '10000000-0000-0000-0000-000000000001';
  v_s2 UUID := '10000000-0000-0000-0000-000000000002';
  v_s3 UUID := '10000000-0000-0000-0000-000000000003';
  v_s4 UUID := '10000000-0000-0000-0000-000000000004';
  v_s5 UUID := '10000000-0000-0000-0000-000000000005';
  v_s6 UUID := '10000000-0000-0000-0000-000000000006';
  v_s7 UUID := '10000000-0000-0000-0000-000000000007';
  v_s8 UUID := '10000000-0000-0000-0000-000000000008';

  v_c1 UUID;
  v_c2 UUID;
  v_c3 UUID;
  v_c4 UUID;
  v_c5 UUID;
  v_c6 UUID;

  v_o_id UUID;
BEGIN
  -- Retrieve course IDs
  SELECT id INTO v_c1 FROM public.courses WHERE slug = 'marketing-digital' LIMIT 1;
  SELECT id INTO v_c2 FROM public.courses WHERE slug = 'excel-pour-entreprise' LIMIT 1;
  SELECT id INTO v_c3 FROM public.courses WHERE slug = 'comptabilite-pratique' LIMIT 1;
  SELECT id INTO v_c4 FROM public.courses WHERE slug = 'creer-du-contenu-video' LIMIT 1;
  SELECT id INTO v_c5 FROM public.courses WHERE slug = 'entrepreneuriat-haiti' LIMIT 1;
  SELECT id INTO v_c6 FROM public.courses WHERE slug = 'anglais-des-affaires' LIMIT 1;

  -- 1. Insert Admin Profile
  INSERT INTO public.profiles (id, full_name, phone, role, locale, created_at)
  VALUES (v_admin_id, 'Jean-Marc Joseph', '+50937000000', 'admin', 'fr', NOW() - INTERVAL '6 months')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Jean-Marc Joseph';

  -- 2. Insert Student Profiles with timestamps
  -- This month (3 students)
  INSERT INTO public.profiles (id, full_name, phone, role, locale, created_at)
  VALUES
    (v_s1, 'Marie Dieudonné', '+50936112233', 'student', 'fr', date_trunc('month', NOW()) + INTERVAL '2 days'),
    (v_s2, 'Pierre-Louis Jean', '+50937223344', 'student', 'ht', date_trunc('month', NOW()) + INTERVAL '4 days'),
    (v_s5, 'Wideline Saintil', '+50938556677', 'student', 'fr', date_trunc('month', NOW()) + INTERVAL '6 days')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Previous month (2 students)
  INSERT INTO public.profiles (id, full_name, phone, role, locale, created_at)
  VALUES
    (v_s3, 'Esther Moïse', '+50940334455', 'student', 'ht', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '5 days'),
    (v_s6, 'Frantz Voltaire', '+50942667788', 'student', 'fr', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '12 days')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Earlier months (3 students)
  INSERT INTO public.profiles (id, full_name, phone, role, locale, created_at)
  VALUES
    (v_s4, 'Jean-Baptiste Dorval', '+50941445566', 'student', 'fr', NOW() - INTERVAL '70 days'),
    (v_s7, 'Nadège Célestin', '+50939778899', 'student', 'ht', NOW() - INTERVAL '110 days'),
    (v_s8, 'Samuel Toussaint', '+50943889900', 'student', 'fr', NOW() - INTERVAL '140 days')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- 3. Orders & Validated Payments
  -- THIS MONTH:
  -- o1: Marie Dieudonné -> Marketing Digital (3 500 HTG, MonCash)
  IF v_c1 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s1, v_c1, 3500, 'paid', 'ORD-MC-001', date_trunc('month', NOW()) + INTERVAL '2 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1001', '+50936112233', 'validated', date_trunc('month', NOW()) + INTERVAL '2 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s1, v_c1, date_trunc('month', NOW()) + INTERVAL '2 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;

    -- o2: Pierre-Louis Jean -> Marketing Digital (3 500 HTG, NatCash)
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s2, v_c1, 3500, 'paid', 'ORD-NC-002', date_trunc('month', NOW()) + INTERVAL '5 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'natcash', 'TX_NC_2001', '+50937223344', 'validated', date_trunc('month', NOW()) + INTERVAL '5 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s2, v_c1, date_trunc('month', NOW()) + INTERVAL '5 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- o5: Wideline Saintil -> Excel pour Entreprise (4 000 HTG, MonCash)
  IF v_c2 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s5, v_c2, 4000, 'paid', 'ORD-MC-003', date_trunc('month', NOW()) + INTERVAL '7 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1002', '+50938556677', 'validated', date_trunc('month', NOW()) + INTERVAL '7 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s5, v_c2, date_trunc('month', NOW()) + INTERVAL '7 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- PREVIOUS MONTH:
  -- o3: Esther Moïse -> Marketing Digital (3 500 HTG, MonCash)
  IF v_c1 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s3, v_c1, 3500, 'paid', 'ORD-MC-004', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '5 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1003', '+50940334455', 'validated', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '5 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s3, v_c1, date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '5 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- o6: Frantz Voltaire -> Excel pour Entreprise (4 000 HTG, NatCash)
  IF v_c2 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s6, v_c2, 4000, 'paid', 'ORD-NC-005', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '12 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'natcash', 'TX_NC_2002', '+50942667788', 'validated', date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '12 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s6, v_c2, date_trunc('month', NOW() - INTERVAL '1 month') + INTERVAL '12 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- EARLIER MONTHS (for 12-month chart):
  IF v_c2 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s1, v_c2, 4000, 'paid', 'ORD-MC-006', date_trunc('month', NOW() - INTERVAL '3 months') + INTERVAL '10 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1004', '+50936112233', 'validated', date_trunc('month', NOW() - INTERVAL '3 months') + INTERVAL '10 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s1, v_c2, date_trunc('month', NOW() - INTERVAL '3 months') + INTERVAL '10 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  IF v_c3 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s7, v_c3, 4500, 'paid', 'ORD-NC-007', date_trunc('month', NOW() - INTERVAL '4 months') + INTERVAL '14 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'natcash', 'TX_NC_2003', '+50939778899', 'validated', date_trunc('month', NOW() - INTERVAL '4 months') + INTERVAL '14 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s7, v_c3, date_trunc('month', NOW() - INTERVAL '4 months') + INTERVAL '14 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;

    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s8, v_c3, 4500, 'paid', 'ORD-MC-008', date_trunc('month', NOW() - INTERVAL '5 months') + INTERVAL '18 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1005', '+50943889900', 'validated', date_trunc('month', NOW() - INTERVAL '5 months') + INTERVAL '18 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s8, v_c3, date_trunc('month', NOW() - INTERVAL '5 months') + INTERVAL '18 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  IF v_c4 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s2, v_c4, 3000, 'paid', 'ORD-MC-009', date_trunc('month', NOW() - INTERVAL '6 months') + INTERVAL '20 days');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_MC_1006', '+50937223344', 'validated', date_trunc('month', NOW() - INTERVAL '6 months') + INTERVAL '20 days');
    INSERT INTO public.enrollments (user_id, course_id, created_at)
    VALUES (v_s2, v_c4, date_trunc('month', NOW() - INTERVAL '6 months') + INTERVAL '20 days')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  -- 4. PAYMENTS AWAITING VALIDATION (Exactly 2 for KPI check)
  IF v_c5 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s3, v_c5, 5000, 'pending', 'ORD-WAIT-001', NOW() - INTERVAL '18 hours');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'natcash', 'NAT-TX-998811', '+50940334455', 'awaiting_validation', NOW() - INTERVAL '18 hours');
  END IF;

  IF v_c6 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s4, v_c6, 3800, 'pending', 'ORD-WAIT-002', NOW() - INTERVAL '2 hours');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'natcash', 'NAT-TX-776622', '+50941445566', 'awaiting_validation', NOW() - INTERVAL '2 hours');
  END IF;

  -- 5. FAILED PAYMENT (1 payment)
  IF v_c1 IS NOT NULL THEN
    v_o_id := gen_random_uuid();
    INSERT INTO public.orders (id, user_id, course_id, amount_htg, status, reference, created_at)
    VALUES (v_o_id, v_s8, v_c1, 3500, 'failed', 'ORD-FAIL-001', NOW() - INTERVAL '1 day');
    INSERT INTO public.payments (order_id, provider, provider_txn_id, payer_phone, status, created_at)
    VALUES (v_o_id, 'moncash', 'TX_ERR_0099', '+50943889900', 'failed', NOW() - INTERVAL '1 day');
  END IF;

  -- 6. CERTIFICATES (for completion rate check)
  IF v_c1 IS NOT NULL THEN
    INSERT INTO public.certificates (user_id, course_id, code, issued_at)
    VALUES (v_s1, v_c1, 'LA-CERT-MKTDIG-001', date_trunc('month', NOW()) + INTERVAL '10 days')
    ON CONFLICT (code) DO NOTHING;
  END IF;

  IF v_c2 IS NOT NULL THEN
    INSERT INTO public.certificates (user_id, course_id, code, issued_at)
    VALUES (v_s5, v_c2, 'LA-CERT-EXCEL-002', date_trunc('month', NOW()) + INTERVAL '12 days')
    ON CONFLICT (code) DO NOTHING;
  END IF;

END $$;
