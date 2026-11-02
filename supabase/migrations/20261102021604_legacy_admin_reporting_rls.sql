BEGIN;
-- Legacy reporting must use the caller's table permissions and RLS, not its owner.
DO $$
DECLARE signature text; target regprocedure;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.get_admin_payments_kpis()','public.get_admin_payments_list(text,text)','public.get_admin_courses_list()'] LOOP
  target:=to_regprocedure(signature);
  IF target IS NOT NULL THEN
   EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER',target);
   EXECUTE format('ALTER FUNCTION %s SET search_path = public,pg_temp',target);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',target);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',target);
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
