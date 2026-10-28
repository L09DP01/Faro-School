-- Migration: 20250117000000_audit_and_hardening.sql
-- Description: Absolute enforcement of student-to-student prohibition, participant validation, and privacy hardening.

CREATE OR REPLACE FUNCTION public.validate_conversation_participants()
RETURNS TRIGGER AS $$
DECLARE
  v_student_role TEXT;
  v_staff_role TEXT;
  v_course_instructor UUID;
  v_is_enrolled BOOLEAN;
  v_creator_role TEXT;
BEGIN
  -- 1. Creator check: Instructors can NEVER initiate a conversation
  SELECT role INTO v_creator_role FROM public.profiles WHERE id = auth.uid();
  IF v_creator_role = 'instructor' THEN
    RAISE EXCEPTION 'Unauthorized: Instructors cannot initiate private conversations.';
  END IF;

  -- 2. Verify student participant
  SELECT role INTO v_student_role FROM public.profiles WHERE id = NEW.student_id;
  IF v_student_role IS NULL OR v_student_role != 'student' THEN
    RAISE EXCEPTION 'Invalid student_id: Participant must have role "student".';
  END IF;

  -- 3. Verify staff participant: MUST be instructor or admin. NEVER a student.
  SELECT role INTO v_staff_role FROM public.profiles WHERE id = NEW.staff_id;
  IF v_staff_role IS NULL OR v_staff_role NOT IN ('instructor', 'admin') THEN
    RAISE EXCEPTION 'Invalid staff_id: Student-to-student conversations are strictly forbidden. Staff must be instructor or admin.';
  END IF;

  -- 4. Check different participants
  IF NEW.student_id = NEW.staff_id THEN
    RAISE EXCEPTION 'Invalid participants: student_id and staff_id cannot be the same user.';
  END IF;

  -- 5. Course enrollment check
  IF NEW.course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE user_id = NEW.student_id AND course_id = NEW.course_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled AND v_creator_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Student is not enrolled in course %', NEW.course_id;
    END IF;

    IF v_staff_role != 'admin' THEN
      SELECT instructor_id INTO v_course_instructor FROM public.courses WHERE id = NEW.course_id;
      IF v_course_instructor IS NULL OR v_course_instructor != NEW.staff_id THEN
        RAISE EXCEPTION 'Unauthorized: Staff member is not the instructor of course %', NEW.course_id;
      END IF;
    END IF;
  ELSE
    -- If course_id is NULL, staff_id must be an admin
    IF v_staff_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: General inquiries without a course must be directed to an administrator.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger if needed
DROP TRIGGER IF EXISTS trg_validate_conversation_participants ON public.conversations;
CREATE TRIGGER trg_validate_conversation_participants
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_conversation_participants();
