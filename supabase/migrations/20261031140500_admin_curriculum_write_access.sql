BEGIN;
-- Explicit grants are required when automatic Data API exposure is disabled.
-- Existing permissive policies still determine accessible rows; these extra guards
-- restrict every curriculum write to a verified, unbanned administrator or author.
GRANT INSERT,UPDATE,DELETE ON public.courses,public.modules,public.lessons,public.lesson_resources TO authenticated;
DO $$
DECLARE target text; predicate text; action text;
BEGIN
 FOREACH target IN ARRAY ARRAY['courses','modules','lessons','lesson_resources'] LOOP
  predicate:=CASE target
   WHEN 'courses' THEN 'EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role=''admin'' OR(p.role=''instructor'' AND instructor_id=p.id)))'
   WHEN 'modules' THEN 'EXISTS(SELECT 1 FROM public.profiles p JOIN public.courses c ON c.id=course_id WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role=''admin'' OR(p.role=''instructor'' AND c.instructor_id=p.id)))'
   WHEN 'lessons' THEN 'EXISTS(SELECT 1 FROM public.profiles p JOIN public.modules m ON m.id=module_id JOIN public.courses c ON c.id=m.course_id WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role=''admin'' OR(p.role=''instructor'' AND c.instructor_id=p.id)))'
   ELSE 'EXISTS(SELECT 1 FROM public.profiles p JOIN public.lessons l ON l.id=lesson_id JOIN public.modules m ON m.id=l.module_id JOIN public.courses c ON c.id=m.course_id WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role=''admin'' OR(p.role=''instructor'' AND c.instructor_id=p.id)))' END;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target);
  FOREACH action IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','verified_author_'||lower(action),target);
   IF action='INSERT' THEN EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)','verified_author_insert',target,predicate);
   ELSIF action='UPDATE' THEN EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)','verified_author_update',target,predicate,predicate);
   ELSE EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)','verified_author_delete',target,predicate); END IF;
  END LOOP;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
