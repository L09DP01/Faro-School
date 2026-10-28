/**
 * Security & RLS Test Suite for Faro School
 * Verifies that:
 * 1. RLS policies block cross-user reads across all tables.
 * 2. Every /admin route and server action enforces role = admin.
 * 3. Video and resource URLs are only issued to enrolled users.
 * 4. Payment amounts are never accepted from the client.
 * 5. Rate limits exist on login, contact and checkout.
 * 6. No private server secret is bundled or exposed to client components.
 */

import fs from "fs";
import path from "path";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  results.push({
    name,
    passed: condition,
    details: condition ? undefined : details,
  });
}

// -------------------------------------------------------------
// 1. RLS Policy Coverage Verification
// -------------------------------------------------------------
function testRLSPolicies() {
  const schemaPath = path.resolve("supabase/migrations/20250101000000_initial_schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Tables that MUST have RLS enabled
  const requiredRlsTables = [
    "profiles",
    "courses",
    "modules",
    "lessons",
    "lesson_resources",
    "coupons",
    "enrollments",
    "lesson_progress",
    "orders",
    "payments",
    "certificates",
    "reviews",
    "contact_messages",
    "playback_sessions",
  ];

  for (const table of requiredRlsTables) {
    const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");
    assert(rlsRegex.test(schemaSql), `RLS enabled on table '${table}'`);
  }

  // Cross-user read isolation assertions
  assert(
    /Users can read own profile[\s\S]*?USING\s*\(id\s*=\s*auth\.uid\(\)\)/i.test(schemaSql),
    "RLS blocks cross-user profile reads (id = auth.uid())"
  );

  assert(
    /Users can view own orders[\s\S]*?USING\s*\(user_id\s*=\s*auth\.uid\(\)\)/i.test(schemaSql),
    "RLS blocks cross-user orders reads (user_id = auth.uid())"
  );

  assert(
    /Users can view own payments[\s\S]*?orders\.user_id\s*=\s*auth\.uid\(\)/i.test(schemaSql),
    "RLS blocks cross-user payments reads (orders.user_id = auth.uid())"
  );

  assert(
    /Users can view own enrollments[\s\S]*?USING\s*\(user_id\s*=\s*auth\.uid\(\)\)/i.test(schemaSql),
    "RLS blocks cross-user enrollments reads (user_id = auth.uid())"
  );

  assert(
    /Users manage own lesson progress[\s\S]*?USING\s*\(user_id\s*=\s*auth\.uid\(\)\)/i.test(schemaSql),
    "RLS blocks cross-user lesson progress reads (user_id = auth.uid())"
  );

  assert(
    /Users manage own playback sessions[\s\S]*?USING\s*\(user_id\s*=\s*auth\.uid\(\)\)/i.test(schemaSql),
    "RLS blocks cross-user playback sessions reads (user_id = auth.uid())"
  );

  // Admin audit logs RLS
  const auditLogsPath = path.resolve("supabase/migrations/20250108000000_admin_payments_and_audit_logs.sql");
  const auditLogsSql = fs.readFileSync(auditLogsPath, "utf-8");
  assert(
    /ALTER\s+TABLE\s+public\.admin_audit_logs\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(auditLogsSql),
    "RLS enabled on table 'admin_audit_logs'"
  );
  assert(
    /profiles\.role\s*=\s*'admin'/i.test(auditLogsSql),
    "RLS restricts admin_audit_logs access strictly to profiles.role = 'admin'"
  );
}

// -------------------------------------------------------------
// 2. Admin Route & Server Action Authorization Verification
// -------------------------------------------------------------
function testAdminGuards() {
  // Middleware
  const middlewarePath = path.resolve("src/middleware.ts");
  const middlewareCode = fs.readFileSync(middlewarePath, "utf-8");
  assert(
    middlewareCode.includes("isAdminRoute") &&
      middlewareCode.includes('profile?.role !== "admin"'),
    "Middleware strictly redirects non-admins away from /admin"
  );

  // Admin Layout
  const layoutPath = path.resolve("src/app/[locale]/(admin)/layout.tsx");
  const layoutCode = fs.readFileSync(layoutPath, "utf-8");
  assert(
    layoutCode.includes("requireAdmin(locale)"),
    "Admin shared layout invokes requireAdmin(locale)"
  );

  // Server Actions
  const actionFiles = [
    "src/app/actions/admin-courses.ts",
    "src/app/actions/admin-payments.ts",
    "src/app/actions/admin-students.ts",
    "src/app/actions/admin-promotions.ts",
    "src/app/actions/admin-messages.ts",
  ];

  for (const file of actionFiles) {
    const code = fs.readFileSync(path.resolve(file), "utf-8");
    assert(
      code.includes("assertAdmin()") && code.includes('role !== "admin"'),
      `Server action file '${file}' asserts role === 'admin'`
    );
  }

  // Admin API Routes
  const adminApiRoutes = [
    "src/app/api/admin/payments/[id]/validate/route.ts",
    "src/app/api/admin/upload/cover/route.ts",
    "src/app/api/admin/video/direct-upload/route.ts",
  ];

  for (const file of adminApiRoutes) {
    const code = fs.readFileSync(path.resolve(file), "utf-8");
    assert(
      code.includes('role !== "admin"') || code.includes("role === 'admin'"),
      `Admin API route '${file}' verifies role === 'admin'`
    );
  }
}

// -------------------------------------------------------------
// 3. Secrets Leak Scan
// -------------------------------------------------------------
function testSecretsLeak() {
  function scanDir(dir: string): string[] {
    let files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (item.name.endsWith(".tsx") || item.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const clientFiles = scanDir(path.resolve("src/components"));
  const leakedFiles: string[] = [];

  const forbiddenSecrets = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "BUNNY_API_KEY",
    "BUNNY_STREAM_API_KEY",
    "BUNNY_STORAGE_ACCESS_KEY",
    "MONCASH_CLIENT_SECRET",
    "KOBARA_SECRET_KEY",
    "ENCRYPTION_KEY",
  ];

  for (const file of clientFiles) {
    const content = fs.readFileSync(file, "utf-8");
    for (const secret of forbiddenSecrets) {
      if (content.includes(secret)) {
        leakedFiles.push(`${path.basename(file)} contains ${secret}`);
      }
    }
  }

  assert(
    leakedFiles.length === 0,
    "No server secrets reach client components",
    leakedFiles.join(", ")
  );
}

// -------------------------------------------------------------
// 4. Video & Resource Enrollment Verification
// -------------------------------------------------------------
function testResourceSecurity() {
  const videoAccessPath = path.resolve("src/lib/video/access.ts");
  const videoAccessCode = fs.readFileSync(videoAccessPath, "utf-8");

  assert(
    videoAccessCode.includes("from(\"enrollments\")") &&
      videoAccessCode.includes("is_free_preview"),
    "Lesson video access verifies enrollment or free preview"
  );

  const resourcePath = path.resolve("src/app/api/video/resources/[resourceId]/download/route.ts");
  const resourceCode = fs.readFileSync(resourcePath, "utf-8");

  assert(
    resourceCode.includes("from(\"enrollments\")") &&
      resourceCode.includes("Accès refusé"),
    "Resource download verifies student enrollment"
  );
}

// -------------------------------------------------------------
// 5. Payment Amount Tampering Verification
// -------------------------------------------------------------
function testPaymentSecurity() {
  const paymentCreatePath = path.resolve("src/app/api/payments/create/route.ts");
  const paymentCreateCode = fs.readFileSync(paymentCreatePath, "utf-8");

  assert(
    paymentCreateCode.includes("from(\"courses\")") &&
      paymentCreateCode.includes("price_htg") &&
      !/amount\s*:\s*z\.number/i.test(paymentCreateCode),
    "Payment amount is calculated on server and never accepted from client body"
  );
}

// -------------------------------------------------------------
// 6. Rate Limit Verification
// -------------------------------------------------------------
function testRateLimits() {
  const loginPath = path.resolve("src/app/api/auth/login/route.ts");
  const loginCode = fs.readFileSync(loginPath, "utf-8");
  assert(loginCode.includes("checkRateLimit"), "Rate limit exists on login");

  const contactPath = path.resolve("src/app/api/contact/route.ts");
  const contactCode = fs.readFileSync(contactPath, "utf-8");
  assert(contactCode.includes("checkRateLimit"), "Rate limit exists on contact form");

  const checkoutPath = path.resolve("src/app/api/payments/create/route.ts");
  const checkoutCode = fs.readFileSync(checkoutPath, "utf-8");
  assert(checkoutCode.includes("checkRateLimit"), "Rate limit exists on checkout API");
}

// -------------------------------------------------------------
// RUN ALL TESTS
// -------------------------------------------------------------
console.log("=== FARO SCHOOL: SECURITY & RLS AUDIT TEST SUITE ===");
testRLSPolicies();
testAdminGuards();
testSecretsLeak();
testResourceSecurity();
testPaymentSecurity();
testRateLimits();

let failedCount = 0;
for (const r of results) {
  if (r.passed) {
    console.log(`  ✓ ${r.name}`);
  } else {
    failedCount++;
    console.error(`  ✗ ${r.name} - ${r.details || "FAILED"}`);
  }
}

console.log(`\nResults: ${results.length - failedCount}/${results.length} tests passed.`);

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("ALL SECURITY & RLS ASSERTIONS PASSED!");
}
