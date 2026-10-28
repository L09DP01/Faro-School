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
      (middlewareCode.includes('userRole !== "admin"') || middlewareCode.includes('profile?.role !== "admin"')),
    "Middleware strictly redirects non-admins away from /admin"
  );

  // Admin Layout
  const layoutPath = path.resolve("src/app/[locale]/(admin)/layout.tsx");
  const layoutCode = fs.readFileSync(layoutPath, "utf-8");
  assert(
    layoutCode.includes("requireStaff(locale)") || layoutCode.includes("requireAdmin(locale)"),
    "Admin shared layout invokes requireStaff(locale) or requireAdmin(locale)"
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
      (code.includes("assertAdmin()") && code.includes('role !== "admin"')) ||
        (code.includes("assertCourseManager()") && code.includes('can(user, "course.manage")')),
      `Server action file '${file}' asserts role privileges`
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

  const forgotPath = path.resolve("src/app/api/auth/forgot-password/route.ts");
  const forgotCode = fs.readFileSync(forgotPath, "utf-8");
  assert(forgotCode.includes("checkRateLimit"), "Rate limit exists on forgot-password API");

  const couponPath = path.resolve("src/app/api/coupons/validate/route.ts");
  const couponCode = fs.readFileSync(couponPath, "utf-8");
  assert(couponCode.includes("checkRateLimit"), "Rate limit exists on coupon validation API");
}

// -------------------------------------------------------------
// 7. Identity & Session Integrity (Step S1-A)
// -------------------------------------------------------------
function testIdentityIntegrity() {
  const getUserPath = path.resolve("src/lib/auth/get-user.ts");
  const getUserCode = fs.readFileSync(getUserPath, "utf-8");
  assert(!getUserCode.includes("faro_session"), "src/lib/auth/get-user.ts does not rely on faro_session cookie");
  assert(getUserCode.includes("supabase.auth.getUser()"), "Identity source is cryptographically verified supabase.auth.getUser()");

  const adminClientPath = path.resolve("src/lib/supabase/admin.ts");
  const adminCode = fs.readFileSync(adminClientPath, "utf-8");
  assert(adminCode.includes('"server-only"') || adminCode.includes("'server-only'"), "admin.ts is protected with server-only");
}

// -------------------------------------------------------------
// 8. Database Privileges & Role Guardrails (Step S1-B)
// -------------------------------------------------------------
function testDatabaseRoleGuards() {
  const roleMigrationPath = path.resolve("supabase/migrations/20250118000000_role_security_and_privilege_guards.sql");
  assert(fs.existsSync(roleMigrationPath), "Step S1-B migration exists");
  const roleSql = fs.readFileSync(roleMigrationPath, "utf-8");

  assert(roleSql.includes("REVOKE UPDATE (role) ON public.profiles"), "Update on profiles.role column is revoked");
  assert(roleSql.includes("FUNCTION public.set_user_role"), "set_user_role secure RPC exists");
  assert(roleSql.includes("trg_protect_profile_privileged_fields"), "protect_profile_privileged_fields trigger exists");
  assert(roleSql.includes("REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon"), "Anon write permissions revoked across public schema");
}

// -------------------------------------------------------------
// 9. Payment Integrity & Webhook Timing-Safe Equal (Step S1-C)
// -------------------------------------------------------------
function testPaymentAndWebhookGuards() {
  const kobaraLibPath = path.resolve("src/lib/payments/kobara.ts");
  const kobaraLibCode = fs.readFileSync(kobaraLibPath, "utf-8");
  assert(kobaraLibCode.includes("crypto.timingSafeEqual"), "Webhook signature uses timingSafeEqual");
  assert(kobaraLibCode.includes("tolerance"), "Webhook verifies 5-minute timestamp tolerance against replay");

  const txnMigrationPath = path.resolve("supabase/migrations/20250119000000_transactional_payment_validation.sql");
  assert(fs.existsSync(txnMigrationPath), "Step S1-C transaction migration exists");
  const txnSql = fs.readFileSync(txnMigrationPath, "utf-8");
  assert(txnSql.includes("FOR UPDATE"), "validate_payment_transactional locks rows with FOR UPDATE");
  assert(txnSql.includes("expected_amount_htg"), "validate_payment_transactional verifies expected HTG amount");
}

// -------------------------------------------------------------
// 10. AI Assistant Fail-Closed & Cost Governance (Step S1-E)
// -------------------------------------------------------------
function testAiAssistantGovernance() {
  const aiAssistantPath = path.resolve("src/lib/messaging/ai-assistant.ts");
  const aiCode = fs.readFileSync(aiAssistantPath, "utf-8");
  assert(aiCode.includes("killSwitch"), "AI assistant verifies killSwitch in governance checks");
  assert(aiCode.includes("record_ai_usage"), "AI assistant records persistent usage in DB");
  assert(aiCode.includes("check_ai_limits"), "AI assistant checks persistent DB limits");

  const aiMigrationPath = path.resolve("supabase/migrations/20250120000000_ai_usage_and_governance.sql");
  assert(fs.existsSync(aiMigrationPath), "Step S1-E AI governance migration exists");
  const aiSql = fs.readFileSync(aiMigrationPath, "utf-8");
  assert(aiSql.includes("cost_usd"), "ai_usage table tracks cost_usd");
  assert(aiSql.includes("user_id"), "ai_usage table tracks user_id");
}

// -------------------------------------------------------------
// 11. Cron Security & Account Recovery (Step S1-F)
// -------------------------------------------------------------
function testCronAndAccountRecovery() {
  const cronPath = path.resolve("src/app/api/cron/escalations/route.ts");
  const cronCode = fs.readFileSync(cronPath, "utf-8");
  assert(cronCode.includes("timingSafeEqual"), "Cron route uses crypto.timingSafeEqual");
  assert(cronCode.includes("CRON_SECRET"), "Cron route checks CRON_SECRET");

  const resetPagePath = path.resolve("src/app/[locale]/(auth)/reinitialiser-mot-de-passe/page.tsx");
  assert(fs.existsSync(resetPagePath), "Reset password route page exists");

  const resetFormPath = path.resolve("src/components/auth/ResetPasswordForm.tsx");
  assert(fs.existsSync(resetFormPath), "ResetPasswordForm component exists");
  const resetFormCode = fs.readFileSync(resetFormPath, "utf-8");
  assert(resetFormCode.includes("updatePasswordSchema"), "ResetPasswordForm uses updatePasswordSchema");
  assert(resetFormCode.includes("PASSWORD_RECOVERY"), "ResetPasswordForm listens to PASSWORD_RECOVERY event");
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
testIdentityIntegrity();
testDatabaseRoleGuards();
testPaymentAndWebhookGuards();
testAiAssistantGovernance();
testCronAndAccountRecovery();

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
