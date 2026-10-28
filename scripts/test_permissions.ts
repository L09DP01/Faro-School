import { can, type PermissionUser } from "@/lib/permissions";

const adminUser: PermissionUser = {
  id: "admin-uuid-1",
  role: "admin",
};

const instructor1: PermissionUser = {
  id: "instructor-uuid-1",
  role: "instructor",
};

const instructor2: PermissionUser = {
  id: "instructor-uuid-2",
  role: "instructor",
};

const studentUser: PermissionUser = {
  id: "student-uuid-1",
  role: "student",
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log("=== RUNNING PERMISSIONS & ISOLATION TEST SUITE ===\n");

// 1. Admin omnipotence
console.log("1. Testing Admin Permissions:");
assert(can(adminUser, "admin.dashboard"), "Admin can access platform dashboard");
assert(can(adminUser, "payments.view"), "Admin can view payments");
assert(can(adminUser, "promotions.manage"), "Admin can manage promotions");
assert(can(adminUser, "instructors.manage"), "Admin can manage instructors");
assert(can(adminUser, "course.manage", { instructor_id: instructor1.id }), "Admin can manage instructor 1 courses");
assert(can(adminUser, "course.manage", { instructor_id: instructor2.id }), "Admin can manage instructor 2 courses");
assert(can(adminUser, "course.change_instructor"), "Admin can reassign course instructors");
assert(can(adminUser, "students.view"), "Admin can view all students");
assert(can(adminUser, "ai.configure"), "Admin can configure AI");

// 2. Instructor Restrictions & Isolation
console.log("\n2. Testing Instructor Restrictions & Cross-Tenant Isolation:");
assert(!can(instructor1, "admin.dashboard"), "Instructor CANNOT access admin platform dashboard");
assert(!can(instructor1, "payments.view"), "Instructor CANNOT view payments (isolated)");
assert(!can(instructor1, "promotions.manage"), "Instructor CANNOT touch promotions (isolated)");
assert(!can(instructor1, "instructors.manage"), "Instructor CANNOT manage other instructors (isolated)");
assert(!can(instructor1, "ai.configure"), "Instructor CANNOT configure system AI");
assert(!can(instructor1, "course.change_instructor"), "Instructor CANNOT reassign course instructors");
assert(can(instructor1, "instructor.dashboard"), "Instructor can access their personal dashboard");

// Course management isolation
assert(can(instructor1, "course.manage", { instructor_id: instructor1.id }), "Instructor 1 can manage their own course");
assert(!can(instructor1, "course.manage", { instructor_id: instructor2.id }), "Instructor 1 CANNOT manage Instructor 2's course");
assert(can(instructor1, "course.publish", { instructor_id: instructor1.id }), "Instructor 1 can publish their own course");
assert(!can(instructor1, "course.publish", { instructor_id: instructor2.id }), "Instructor 1 CANNOT publish Instructor 2's course");

// Students isolation
assert(
  can(instructor1, "students.view", { enrolledCourseInstructorIds: [instructor1.id] }),
  "Instructor 1 can view student enrolled in their courses"
);
assert(
  !can(instructor1, "students.view", { enrolledCourseInstructorIds: [instructor2.id] }),
  "Instructor 1 CANNOT view student enrolled ONLY in Instructor 2's courses"
);
assert(
  can(instructor1, "students.view", { enrolledCourseInstructorIds: [instructor1.id, instructor2.id] }),
  "Instructor 1 can view student enrolled in both instructors' courses"
);

// Community moderation & pinning
assert(!can(instructor1, "community.moderate"), "Instructor CANNOT moderate community (Admin only)");
assert(can(adminUser, "community.moderate"), "Admin can moderate community");
assert(can(instructor1, "community.pin"), "Instructor can pin community resources");

// 3. Student Restrictions
console.log("\n3. Testing Student Role Restrictions:");
assert(!can(studentUser, "admin.dashboard"), "Student CANNOT access admin dashboard");
assert(!can(studentUser, "instructor.dashboard"), "Student CANNOT access instructor dashboard");
assert(!can(studentUser, "course.manage"), "Student CANNOT manage courses");
assert(!can(studentUser, "payments.view"), "Student CANNOT view admin payments");
assert(!can(studentUser, "students.view"), "Student CANNOT view students table");

console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
if (failed > 0) {
  process.exit(1);
}
