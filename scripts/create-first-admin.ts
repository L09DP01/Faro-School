import { createClient } from "@supabase/supabase-js";
import { createPasswordResetToken } from "../src/lib/auth/tokens";

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

  console.log(`Checking if user profile already exists for email: ${email}...`);

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

    // Ensure role is admin and email is verified
    await supabase
      .from("profiles")
      .update({
        role: "admin",
        email_verified_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);
  } else {
    console.log("Creating new admin profile...");
    const { data: newProfile, error: createError } = await supabase
      .from("profiles")
      .insert({
        email,
        full_name: "Administrateur Faro",
        role: "admin",
        locale: "fr",
        email_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createError || !newProfile) {
      console.error("Failed to create admin profile:", createError?.message);
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

  // 2. Generate secure 48h password setup token
  console.log("Generating secure password setup token...");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetToken = await createPasswordResetToken(targetUserId, 48);
  const setupUrl = `${appUrl}/fr/reinitialiser-mot-de-passe?token=${resetToken}`;

  console.log("==================================================");
  console.log("ADMIN ACCOUNT CONFIGURED SUCCESSFULLY");
  console.log("==================================================");
  console.log(`Email:   ${email}`);
  console.log(`User ID: ${targetUserId}`);
  console.log(`Role:    admin`);
  console.log("");
  console.log("Initial password setup link (valid for 48 hours):");
  console.log(setupUrl);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Fatal error creating admin:", err);
  process.exit(1);
});
