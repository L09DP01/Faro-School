import { createClient } from "@supabase/supabase-js";
import {queueAuthEmail} from "../src/lib/email/outbox";
import {maskRecipient} from "../src/lib/email/result";

/**
 * Creates the initial administrator in profiles & user_credentials without hardcoding passwords.
 * Zero reliance on legacy admin auth APIs.
 *
 * Usage:
 *   ADMIN_EMAIL="admin@faroschool.com" npx tsx scripts/create-first-admin.ts
 */

async function main() {
  console.log("==================================================");
  console.log("FARO SCHOOL - INITIAL ADMIN CREATION SCRIPT");
  console.log("==================================================");

  const email = (process.env.ADMIN_EMAIL || process.argv[2] || "").trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !email.includes("@")) {
    console.error("ERROR: ADMIN_EMAIL environment variable (or CLI argument) is required.");
    console.error("Example: ADMIN_EMAIL=admin@faroschool.com npx tsx scripts/create-first-admin.ts");
    process.exit(1);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Checking profile: ${maskRecipient(email)}`);

  let targetUserId: string | null = null;

  // 1. Check existing profiles
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    console.log(`Profile already exists with ID: ${existingProfile.id}.`);
    targetUserId = existingProfile.id;

    if(existingProfile.role!=='admin')throw new Error('Refusing to promote an existing non-admin with the bootstrap script');

  } else {
    console.log("Creating new admin profile...");
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({
        email,
        full_name: "Administrateur Faro",
        role: "admin",
        locale: "fr",
        email_verified_at: null,
      })
      .select("id")
      .single();

    if (createError || !newProfile) {
      console.error("admin_profile_creation_failed");
      process.exit(1);
    }

    targetUserId = newProfile.id;
    console.log(`Created admin profile successfully with ID: ${targetUserId}`);

    // Create user_credentials row
    await supabase.from("user_credentials").upsert({
      user_id: targetUserId,
      password_hash: "PENDING_SETUP",
      token_version: 0,
      failed_count: 0,
      locked_until: null,
    });
  }

  if (!targetUserId) {
    throw new Error("Failed to resolve or create admin user ID.");
  }

  // No token or setup URL is ever printed. The private outbox owns delivery.
  const result=await queueAuthEmail(email,'invitation','fr','bootstrap:'+targetUserId);
  console.log({status:result.status,category:result.category,correlationId:result.correlationId,recipient:maskRecipient(email)});

}

main().catch((err) => {
  console.error("admin_bootstrap_failed");
  process.exit(1);
});
