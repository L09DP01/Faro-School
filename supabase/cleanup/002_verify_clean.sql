-- =============================================================================
-- FARO SCHOOL - DATABASE VERIFICATION SCRIPT (002_verify_clean.sql)
-- Reports table row counts to confirm zero test data remains in the database.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  v_count BIGINT;
  v_status TEXT;
  v_total_anomalies INT := 0;
BEGIN
  RAISE NOTICE '=======================================================================';
  RAISE NOTICE 'TABLE NAME                     | ACTUAL COUNT | EXPECTED | STATUS     ';
  RAISE NOTICE '=======================================================================';

  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename ASC
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.tablename) INTO v_count;

    IF r.tablename = 'platform_settings' THEN
      -- Reference configuration table, expected >= 1
      IF v_count >= 1 THEN
        v_status := 'OK (Config)';
      ELSE
        v_status := 'WARNING (Missing default settings)';
        v_total_anomalies := v_total_anomalies + 1;
      END IF;
    ELSIF r.tablename = 'profiles' THEN
      -- Expected 0 (before admin creation) or 1 (only the real initial admin)
      IF v_count <= 1 THEN
        v_status := 'OK (Admin only / clean)';
      ELSE
        v_status := 'ANOMALY (> 1 profile detected)';
        v_total_anomalies := v_total_anomalies + 1;
      END IF;
    ELSIF r.tablename = 'admin_audit_logs' THEN
      -- Expected 0 or low count from initial admin creation audit
      IF v_count <= 2 THEN
        v_status := 'OK (Audit clean)';
      ELSE
        v_status := 'WARNING (Residue audit logs)';
      END IF;
    ELSE
      -- All transaction, content, and student tables MUST be exactly 0
      IF v_count = 0 THEN
        v_status := 'OK (Empty)';
      ELSE
        v_status := 'FAIL (Expected 0)';
        v_total_anomalies := v_total_anomalies + 1;
      END IF;
    END IF;

    RAISE NOTICE '% | % | % | %',
      rpad(r.tablename, 30),
      lpad(v_count::text, 12),
      CASE 
        WHEN r.tablename = 'platform_settings' THEN ' >= 1     '
        WHEN r.tablename = 'profiles' THEN ' <= 1     '
        ELSE ' 0        '
      END,
      v_status;
  END LOOP;

  RAISE NOTICE '=======================================================================';
  IF v_total_anomalies = 0 THEN
    RAISE NOTICE 'VERIFICATION PASSED: Database is clean and ready for production!';
  ELSE
    RAISE WARNING 'VERIFICATION FAILED: % anomalous table(s) found with unexpected rows.', v_total_anomalies;
  END IF;
  RAISE NOTICE '=======================================================================';
END $$;
