BEGIN;
CREATE TABLE IF NOT EXISTS public.lesson_quizzes(
 lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions) BETWEEN 1 AND 20 AND octet_length(questions::text)<=60000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lesson_quiz_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 answers jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_quiz_attempts_user ON public.lesson_quiz_attempts(user_id,lesson_id,created_at DESC);
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_quizzes,public.lesson_quiz_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lesson_quizzes TO authenticated;
GRANT SELECT ON public.lesson_quiz_attempts TO authenticated;
GRANT ALL ON public.lesson_quizzes,public.lesson_quiz_attempts TO service_role;
DROP POLICY IF EXISTS quiz_author ON public.lesson_quizzes;
CREATE POLICY quiz_author ON public.lesson_quizzes FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role='admin' OR(p.role='instructor' AND EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE l.id=lesson_id AND c.instructor_id=p.id)))))
 WITH CHECK(EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.role='admin' OR(p.role='instructor' AND EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE l.id=lesson_id AND c.instructor_id=p.id)))));
DROP POLICY IF EXISTS quiz_own_score ON public.lesson_quiz_attempts;
CREATE POLICY quiz_own_score ON public.lesson_quiz_attempts FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND p.email_verified_at IS NOT NULL AND p.banned_at IS NULL AND(p.id=user_id OR p.role='admin' OR(p.role='instructor' AND EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE l.id=lesson_id AND c.instructor_id=p.id)))));
NOTIFY pgrst,'reload schema';
COMMIT;
