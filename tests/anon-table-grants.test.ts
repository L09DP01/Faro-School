import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("=== TESTING DATABASE MIGRATION & ANON TABLE GRANTS ===\n");

// 1. Whitelist of tables permitted to be readable by anon (public catalog data)
const ALLOWED_ANON_READABLE_TABLES = new Set([
  "courses",
  "modules",
  "lessons",
  "reviews",
  "certificates",
  "coupons",
  "instructors",
  "platform_settings",
]);

// 2. Strict blacklist of tables that must NEVER be readable by anon
const FORBIDDEN_ANON_TABLES = [
  "profiles",
  "user_credentials",
  "email_verification_tokens",
  "password_reset_tokens",
  "auth_attempts",
  "orders",
  "payments",
  "enrollments",
  "lesson_progress",
  "playback_sessions",
  "lesson_notes",
  "lesson_resources",
  "admin_audit_logs",
  "community_messages",
  "community_reactions",
  "community_reports",
  "community_reads",
  "community_rules_accepted",
  "conversations",
  "messages",
  "escalations",
  "notifications",
  "instructor_ai_versions",
  "private_conversation_access_logs",
  "moderation_flags",
  "ai_usage",
];

// 3. Parse migration files to extract explicit table grants to anon
const migrationsDir = path.resolve("supabase/migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Analyzing ${migrationFiles.length} migration files in ${migrationsDir}...`);

// Track active anon grants across migrations
const anonSelectTables = new Set<string>();

const grantSelectRegex = /GRANT\s+SELECT\s+ON\s+(?:TABLE\s+)?(?:public\.)?([a-z_0-9]+)\s+TO\s+[^;]*anon/gi;
const revokeAllRegex = /REVOKE\s+ALL\s+ON\s+(?:TABLE\s+)?(?:public\.)?([a-z_0-9]+)\s+FROM\s+[^;]*anon/gi;

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

  // Check REVOKEs
  let revokeMatch;
  while ((revokeMatch = revokeAllRegex.exec(content)) !== null) {
    const table = revokeMatch[1].toLowerCase();
    anonSelectTables.delete(table);
  }

  // Check GRANT SELECTs to anon
  let grantMatch;
  while ((grantMatch = grantSelectRegex.exec(content)) !== null) {
    const table = grantMatch[1].toLowerCase();
    anonSelectTables.add(table);
  }
}

console.log("\nTables with explicit SELECT granted to anon in migrations:");
const actualAnonTables = Array.from(anonSelectTables).sort();
for (const tbl of actualAnonTables) {
  console.log(`  - ${tbl}`);
}

// 4. Assert no unexpected tables are readable by anon
const unexpectedTables = actualAnonTables.filter((tbl) => !ALLOWED_ANON_READABLE_TABLES.has(tbl));
assert.strictEqual(
  unexpectedTables.length,
  0,
  `SECURITY VIOLATION: Unexpected table(s) readable by anon: ${unexpectedTables.join(", ")}`
);

// 5. Assert all sensitive tables are strictly absent from anon SELECT
for (const forbidden of FORBIDDEN_ANON_TABLES) {
  assert(
    !anonSelectTables.has(forbidden),
    `SECURITY VIOLATION: Sensitive table '${forbidden}' must NEVER be readable by anon!`
  );
}

// 6. Verify single Auth.js migration file completeness
const authMigrationFile = migrationFiles.find((f) => f.includes("authjs_migration"));
assert(authMigrationFile, "Auth.js migration file must exist in supabase/migrations");

const authMigrationSql = fs.readFileSync(path.join(migrationsDir, authMigrationFile), "utf-8");

// Assert new tables exist in migration
const requiredNewTables = [
  "user_credentials",
  "email_verification_tokens",
  "password_reset_tokens",
  "auth_attempts",
];

for (const table of requiredNewTables) {
  assert(
    authMigrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
    `Migration must create table '${table}'`
  );
  assert(
    authMigrationSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
    `Table '${table}' must have RLS enabled`
  );
  assert(
    authMigrationSql.includes(`REVOKE ALL ON public.${table} FROM anon, authenticated;`),
    `Table '${table}' must revoke all privileges from anon and authenticated`
  );
}

// Assert auth.users foreign key and trigger removal
assert(
  authMigrationSql.includes("DROP CONSTRAINT IF EXISTS profiles_id_fkey"),
  "Migration must drop profiles foreign key to auth.users"
);
assert(
  authMigrationSql.includes("ALTER COLUMN id SET DEFAULT gen_random_uuid()"),
  "Migration must set profiles.id default to gen_random_uuid()"
);
assert(
  authMigrationSql.includes("ADD COLUMN IF NOT EXISTS email_verified_at"),
  "Migration must add email_verified_at column to profiles"
);
assert(
  authMigrationSql.includes("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users"),
  "Migration must drop on_auth_user_created trigger on auth.users"
);
assert(
  authMigrationSql.includes("DROP FUNCTION IF EXISTS public.handle_new_user()"),
  "Migration must drop handle_new_user function"
);

console.log("\n[PASS] All migration assertions passed: only expected catalog tables are readable by anon.");
console.log("==================================================\n");
