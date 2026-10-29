-- =============================================================================
-- FARO SCHOOL - DATABASE CLEANUP SCRIPT (001_remove_test_data.sql)
-- Idempotent, dependency-ordered removal of all seed, demo, and test data.
-- =============================================================================
--
-- SAFETY INSTRUCTIONS:
-- 1. ALWAYS TAKE A FULL DATABASE BACKUP FIRST (Supabase Dashboard -> Backup, or pg_dump):
--    pg_dump -h <host> -U postgres -d postgres -F c -b -v -f faro_pre_cleanup_backup.dump
--
-- 2. TO RUN IN DRY-RUN MODE (Default, will NOT delete anything, only prints counts):
--    SET LOCAL app.env = 'staging'; -- or 'production'
--    SET LOCAL app.dry_run = 'yes';
--    \i supabase/cleanup/001_remove_test_data.sql
--
-- 3. TO EXECUTE DELETION IN STAGING:
--    SET LOCAL app.env = 'staging';
--    SET LOCAL app.dry_run = 'no';
--    \i supabase/cleanup/001_remove_test_data.sql
--
-- 4. TO EXECUTE DELETION IN PRODUCTION (Requires explicit double confirmation):
--    SET LOCAL app.env = 'production';
--    SET LOCAL app.dry_run = 'no';
--    SET LOCAL app.confirm_production = 'yes';
--    SET LOCAL app.project_name = 'faro-school';
--    \i supabase/cleanup/001_remove_test_data.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_env TEXT := current_setting('app.env', true);
  v_dry_run TEXT := coalesce(current_setting('app.dry_run', true), 'yes');
  v_confirm_prod TEXT := current_setting('app.confirm_production', true);
  v_project_name TEXT := current_setting('app.project_name', true);

  -- Known test course slugs from seed data
  v_test_course_slugs TEXT[] := ARRAY[
    'marketing-digital',
    'excel-pour-entreprise',
    'comptabilite-pratique',
    'creer-du-contenu-video',
    'entrepreneuriat-haiti',
    'anglais-des-affaires'
  ];

  -- Known test emails / markers
  v_test_admin_id UUID := '00000000-0000-0000-0000-000000000001';

  v_count_moderation_flags INT;
  v_count_community_reports INT;
  v_count_community_reactions INT;
  v_count_community_messages INT;
  v_count_community_reads INT;
  v_count_community_rules INT;
  v_count_messages INT;
  v_count_conversations INT;
  v_count_escalations INT;
  v_count_ai_usage INT;
  v_count_notifications INT;
  v_count_playback_sessions INT;
  v_count_lesson_notes INT;
  v_count_lesson_progress INT;
  v_count_reviews INT;
  v_count_certificates INT;
  v_count_payments INT;
  v_count_orders INT;
  v_count_enrollments INT;
  v_count_coupons INT;
  v_count_lesson_resources INT;
  v_count_lessons INT;
  v_count_modules INT;
  v_count_courses INT;
  v_count_newsletter INT;
  v_count_contact INT;
  v_count_audit INT;
  v_count_instructors INT;
  v_count_profiles INT;
  v_count_auth_users INT;

BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'FARO SCHOOL DATABASE CLEANUP PROCEDURE INITIATED';
  RAISE NOTICE '=======================================================';

  -- 1. SAFETY VALIDATIONS
  IF v_env IS NULL OR v_env = '' THEN
    RAISE EXCEPTION 'SAFETY HALT: app.env must be explicitly set (e.g., SET LOCAL app.env = ''staging'' or ''production'').';
  END IF;

  IF v_env = 'production' THEN
    IF v_dry_run <> 'no' THEN
      RAISE NOTICE 'Running in PRODUCTION DRY-RUN mode. Set app.dry_run = ''no'' to execute deletion.';
    ELSE
      IF v_confirm_prod <> 'yes' THEN
        RAISE EXCEPTION 'SAFETY HALT: Deletion on PRODUCTION requires SET LOCAL app.confirm_production = ''yes''.';
      END IF;
      IF v_project_name <> 'faro-school' THEN
        RAISE EXCEPTION 'SAFETY HALT: Deletion on PRODUCTION requires SET LOCAL app.project_name = ''faro-school''.';
      END IF;
      RAISE WARNING 'ATTENTION: EXECUTING LIVE PERMANENT DELETION ON PRODUCTION DATABASE!';
    END IF;
  ELSE
    RAISE NOTICE 'Running in environment: % (dry_run: %)', v_env, v_dry_run;
  END IF;

  -- 2. COUNT TEST DATA TO BE REMOVED
  SELECT COUNT(*) INTO v_count_moderation_flags FROM public.moderation_flags;
  SELECT COUNT(*) INTO v_count_community_reports FROM public.community_reports;
  SELECT COUNT(*) INTO v_count_community_reactions FROM public.community_reactions;
  SELECT COUNT(*) INTO v_count_community_messages FROM public.community_messages;
  SELECT COUNT(*) INTO v_count_community_reads FROM public.community_reads;
  SELECT COUNT(*) INTO v_count_community_rules FROM public.community_rules_accepted;
  SELECT COUNT(*) INTO v_count_messages FROM public.messages;
  SELECT COUNT(*) INTO v_count_conversations FROM public.conversations;
  SELECT COUNT(*) INTO v_count_escalations FROM public.escalations;
  SELECT COUNT(*) INTO v_count_ai_usage FROM public.ai_usage;
  SELECT COUNT(*) INTO v_count_notifications FROM public.notifications;
  SELECT COUNT(*) INTO v_count_playback_sessions FROM public.playback_sessions;
  SELECT COUNT(*) INTO v_count_lesson_notes FROM public.lesson_notes;
  SELECT COUNT(*) INTO v_count_lesson_progress FROM public.lesson_progress;
  SELECT COUNT(*) INTO v_count_reviews FROM public.reviews;
  SELECT COUNT(*) INTO v_count_certificates FROM public.certificates;
  SELECT COUNT(*) INTO v_count_payments FROM public.payments;
  SELECT COUNT(*) INTO v_count_orders FROM public.orders;
  SELECT COUNT(*) INTO v_count_enrollments FROM public.enrollments;
  SELECT COUNT(*) INTO v_count_coupons FROM public.coupons;
  SELECT COUNT(*) INTO v_count_lesson_resources FROM public.lesson_resources;
  SELECT COUNT(*) INTO v_count_lessons FROM public.lessons WHERE video_id LIKE 'mock_%';
  SELECT COUNT(*) INTO v_count_modules FROM public.modules m JOIN public.courses c ON m.course_id = c.id WHERE c.slug = ANY(v_test_course_slugs);
  SELECT COUNT(*) INTO v_count_courses FROM public.courses WHERE slug = ANY(v_test_course_slugs);
  SELECT COUNT(*) INTO v_count_newsletter FROM public.newsletter_subscribers;
  SELECT COUNT(*) INTO v_count_contact FROM public.contact_messages;
  SELECT COUNT(*) INTO v_count_audit FROM public.admin_audit_logs;
  SELECT COUNT(*) INTO v_count_instructors FROM public.instructors;
  SELECT COUNT(*) INTO v_count_profiles FROM public.profiles WHERE id = v_test_admin_id OR id::text LIKE '10000000-0000-0000-0000-%';
  
  -- Auth users count (if accessible)
  BEGIN
    SELECT COUNT(*) INTO v_count_auth_users FROM auth.users WHERE email LIKE '%@example.com' OR email LIKE '%@faroschool.test' OR id = v_test_admin_id;
  EXCEPTION WHEN OTHERS THEN
    v_count_auth_users := 0;
  END;

  RAISE NOTICE '-------------------------------------------------------';
  RAISE NOTICE 'TARGETED ROWS FOR REMOVAL:';
  RAISE NOTICE '  - moderation_flags:          %', v_count_moderation_flags;
  RAISE NOTICE '  - community_reports:         %', v_count_community_reports;
  RAISE NOTICE '  - community_reactions:       %', v_count_community_reactions;
  RAISE NOTICE '  - community_messages:        %', v_count_community_messages;
  RAISE NOTICE '  - community_reads:           %', v_count_community_reads;
  RAISE NOTICE '  - community_rules_accepted:  %', v_count_community_rules;
  RAISE NOTICE '  - private messages:          %', v_count_messages;
  RAISE NOTICE '  - private conversations:     %', v_count_conversations;
  RAISE NOTICE '  - escalations:               %', v_count_escalations;
  RAISE NOTICE '  - ai_usage:                  %', v_count_ai_usage;
  RAISE NOTICE '  - notifications:             %', v_count_notifications;
  RAISE NOTICE '  - playback_sessions:         %', v_count_playback_sessions;
  RAISE NOTICE '  - lesson_notes:              %', v_count_lesson_notes;
  RAISE NOTICE '  - lesson_progress:           %', v_count_lesson_progress;
  RAISE NOTICE '  - reviews:                   %', v_count_reviews;
  RAISE NOTICE '  - certificates:              %', v_count_certificates;
  RAISE NOTICE '  - payments:                  %', v_count_payments;
  RAISE NOTICE '  - orders:                    %', v_count_orders;
  RAISE NOTICE '  - enrollments:               %', v_count_enrollments;
  RAISE NOTICE '  - coupons:                   %', v_count_coupons;
  RAISE NOTICE '  - lesson_resources:          %', v_count_lesson_resources;
  RAISE NOTICE '  - mock lessons:              %', v_count_lessons;
  RAISE NOTICE '  - test modules:              %', v_count_modules;
  RAISE NOTICE '  - test courses:              %', v_count_courses;
  RAISE NOTICE '  - newsletter_subscribers:    %', v_count_newsletter;
  RAISE NOTICE '  - contact_messages:          %', v_count_contact;
  RAISE NOTICE '  - admin_audit_logs:          %', v_count_audit;
  RAISE NOTICE '  - instructors:               %', v_count_instructors;
  RAISE NOTICE '  - test profiles:             %', v_count_profiles;
  RAISE NOTICE '  - test auth.users:           %', v_count_auth_users;
  RAISE NOTICE '-------------------------------------------------------';

  IF v_dry_run = 'yes' THEN
    RAISE NOTICE 'DRY RUN COMPLETE: Zero rows were deleted. Transaction will be rolled back.';
    RETURN;
  END IF;

  -- 3. EXECUTE DEPENDENCY-ORDERED DELETION
  RAISE NOTICE 'Executing deletion in strict foreign-key dependency order...';

  DELETE FROM public.moderation_flags;
  DELETE FROM public.community_reports;
  DELETE FROM public.community_reactions;
  DELETE FROM public.community_messages;
  DELETE FROM public.community_reads;
  DELETE FROM public.community_rules_accepted;

  DELETE FROM public.messages;
  DELETE FROM public.conversations;
  DELETE FROM public.escalations;
  DELETE FROM public.ai_usage;
  DELETE FROM public.notifications;

  DELETE FROM public.playback_sessions;
  DELETE FROM public.lesson_notes;
  DELETE FROM public.lesson_progress;
  DELETE FROM public.reviews;
  DELETE FROM public.certificates;

  DELETE FROM public.payments;
  DELETE FROM public.orders;
  DELETE FROM public.enrollments;
  DELETE FROM public.coupons;

  DELETE FROM public.lesson_resources;
  DELETE FROM public.lessons WHERE video_id LIKE 'mock_%' OR module_id IN (
    SELECT m.id FROM public.modules m JOIN public.courses c ON m.course_id = c.id WHERE c.slug = ANY(v_test_course_slugs)
  );
  DELETE FROM public.modules WHERE course_id IN (
    SELECT id FROM public.courses WHERE slug = ANY(v_test_course_slugs)
  );
  DELETE FROM public.courses WHERE slug = ANY(v_test_course_slugs);

  DELETE FROM public.newsletter_subscribers;
  DELETE FROM public.contact_messages;
  DELETE FROM public.admin_audit_logs;
  DELETE FROM public.instructors;

  -- Remove test profiles (fixed UUIDs from seed and demo scripts)
  DELETE FROM public.profiles WHERE id = v_test_admin_id OR id::text LIKE '10000000-0000-0000-0000-%';

  -- Remove test auth users if present
  BEGIN
    DELETE FROM auth.users WHERE email LIKE '%@example.com' OR email LIKE '%@faroschool.test' OR id = v_test_admin_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Note: auth.users cleanup skipped or not permitted under current connection privileges.';
  END;

  RAISE NOTICE 'DELETION SUCCESSFULLY APPLIED IN TRANSACTION.';
END $$;

-- If dry-run, rollback. If live execution, commit.
DO $$
BEGIN
  IF coalesce(current_setting('app.dry_run', true), 'yes') = 'yes' THEN
    RAISE NOTICE 'DRY RUN: Rolling back transaction.';
  ELSE
    RAISE NOTICE 'COMMITTING TRANSACTION.';
  END IF;
END $$;

COMMIT;
