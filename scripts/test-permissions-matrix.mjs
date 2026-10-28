import { can } from "../src/lib/permissions.js";
import { STUDENT_DM_ENABLED } from "../src/config/messaging.js";
import { getAdminStudentsList } from "../src/lib/admin/students.js";

async function runTests() {
  console.log("=== RUNNING PERMISSION MATRIX & SECURITY TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const admin = { id: "admin-1", role: "admin" };
  const instructor1 = { id: "inst-1", role: "instructor" };
  const instructor2 = { id: "inst-2", role: "instructor" };
  const student = { id: "stud-1", role: "student" };

  const ownCourse = { instructor_id: "inst-1" };
  const otherCourse = { instructor_id: "inst-2" };
  const ownStudent = { enrolledCourseInstructorIds: ["inst-1"] };
  const otherStudent = { enrolledCourseInstructorIds: ["inst-2"] };

  // 1. Course Management
  assert(can(admin, "course.manage", otherCourse) === true, "Admin can manage any course");
  assert(can(instructor1, "course.manage", ownCourse) === true, "Instructor can manage own course");
  assert(can(instructor1, "course.manage", otherCourse) === false, "Instructor CANNOT manage other instructor course");
  assert(can(student, "course.manage") === false, "Student CANNOT manage courses");

  // 2. Course Publish
  assert(can(admin, "course.publish") === true, "Admin can publish course");
  assert(can(instructor1, "course.publish", ownCourse) === true, "Instructor can publish own course");
  assert(can(instructor1, "course.publish", otherCourse) === false, "Instructor CANNOT publish other course");
  assert(can(student, "course.publish") === false, "Student CANNOT publish course");

  // 3. Change Instructor
  assert(can(admin, "course.change_instructor") === true, "Admin can change course instructor");
  assert(can(instructor1, "course.change_instructor") === false, "Instructor CANNOT change instructor");
  assert(can(student, "course.change_instructor") === false, "Student CANNOT change instructor");

  // 4. View Students
  assert(can(admin, "students.view") === true, "Admin can view students");
  assert(can(instructor1, "students.view", ownStudent) === true, "Instructor can view own course students");
  assert(can(instructor1, "students.view", otherStudent) === false, "Instructor CANNOT view other instructor students");
  assert(can(student, "students.view") === false, "Student CANNOT view students");

  // 5. Dashboards
  assert(can(admin, "admin.dashboard") === true, "Admin can view admin dashboard");
  assert(can(instructor1, "admin.dashboard") === false, "Instructor CANNOT view admin dashboard");
  assert(can(instructor1, "instructor.dashboard") === true, "Instructor can view instructor dashboard");
  assert(can(student, "instructor.dashboard") === false, "Student CANNOT view instructor dashboard");

  // 6. Payments & Revenue (P19 strict rule: no revenue or payments for instructors)
  assert(can(admin, "payments.view") === true, "Admin can view payments");
  assert(can(instructor1, "payments.view") === false, "Instructor CANNOT view payments or revenue");
  assert(can(student, "payments.view") === false, "Student CANNOT view payments");

  // 7. Promotions
  assert(can(admin, "promotions.manage") === true, "Admin can manage promotions");
  assert(can(instructor1, "promotions.manage") === false, "Instructor CANNOT manage promotions");
  assert(can(student, "promotions.manage") === false, "Student CANNOT manage promotions");

  // 8. Instructors Manage
  assert(can(admin, "instructors.manage") === true, "Admin can manage instructors");
  assert(can(instructor1, "instructors.manage") === false, "Instructor CANNOT manage instructors");

  // 9. Community Moderation & Pinning
  assert(can(admin, "community.moderate") === true, "Admin can moderate community");
  assert(can(instructor1, "community.moderate") === false, "Instructor CANNOT moderate community");
  assert(can(admin, "community.pin") === true, "Admin can pin community messages");
  assert(can(instructor1, "community.pin") === true, "Instructor can pin community messages");
  assert(can(student, "community.pin") === false, "Student CANNOT pin community messages");

  // 10. AI Configuration
  assert(can(admin, "ai.configure") === true, "Admin can configure global AI");
  assert(can(instructor1, "ai.configure") === false, "Instructor CANNOT configure global AI");
  assert(can(student, "ai.configure") === false, "Student CANNOT configure AI");

  // 11. Student-to-Student DM Prohibition
  assert(STUDENT_DM_ENABLED === false, "STUDENT_DM_ENABLED is strictly false (Student-to-student DM blocked)");

  // 12. Privacy Scrub Verification
  const instructorStudents = await getAdminStudentsList("inst-mock-id");
  const leakedEmail = instructorStudents.find(s => s.email && s.email.length > 0);
  const leakedPhone = instructorStudents.find(s => s.phone && s.phone.length > 0);
  const leakedPayments = instructorStudents.find(s => s.payments && s.payments.length > 0);

  assert(!leakedEmail, "Instructor student list contains ZERO student email addresses");
  assert(!leakedPhone, "Instructor student list contains ZERO student phone numbers");
  assert(!leakedPayments, "Instructor student list contains ZERO payment/revenue records");

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
