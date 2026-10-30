BEGIN;
CREATE OR REPLACE FUNCTION public.community_access_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid()
   AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL
   AND (p.role IN('admin','instructor') OR EXISTS(
     SELECT 1 FROM enrollments e WHERE e.user_id=p.id AND e.revoked_at IS NULL)));
$$;
REVOKE ALL ON FUNCTION public.community_access_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_access_allowed() TO authenticated,service_role;
-- Restrictive policies AND with the existing author, mute, ban and moderation rules.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['community_messages','community_reactions','community_reports','community_reads','community_rules_accepted'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS community_active_enrollment ON public.%I',t);
  EXECUTE format('CREATE POLICY community_active_enrollment ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.community_access_allowed()) WITH CHECK(public.community_access_allowed())',t);
 END LOOP;
END $$;
-- Realtime already enables RLS on this managed table; do not ALTER its owner/settings.
DROP POLICY IF EXISTS community_presence_read ON realtime.messages;
CREATE POLICY community_presence_read ON realtime.messages FOR SELECT TO authenticated
 USING(realtime.topic()='community-enrolled-room' AND extension='presence' AND public.community_access_allowed());
DROP POLICY IF EXISTS community_presence_write ON realtime.messages;
CREATE POLICY community_presence_write ON realtime.messages FOR INSERT TO authenticated
 WITH CHECK(realtime.topic()='community-enrolled-room' AND extension='presence' AND public.community_access_allowed());
NOTIFY pgrst,'reload schema';
COMMIT;
