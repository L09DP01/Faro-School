import { createClient } from "@supabase/supabase-js";

/**
 * Creates the initial administrator from ADMIN_EMAIL without hardcoding or printing passwords.
 *
 * Usage:
 *   ADMIN_EMAIL="admin@faroschool.com" npx tsx scripts/create-first-admin.ts
 */

async function main() {
  console.log("==================================================");
  console.log("FARO SCHOOL - INITIAL ADMIN CREATION SCRIPT");
  console.log("==================================================");

  const email = process.env.ADMIN_EMAIL || process.argv[2];
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

  console.log(`Checking if user already exists for email: ${email}...`);

  let targetUserId: string | null = null;

  // 1. Check existing users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users from Supabase Auth:", listError.message);
    process.exit(1);
  }

  const existingUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    console.log(`User already exists with ID: ${existingUser.id}.`);
    targetUserId = existingUser.id;
  } else {
    console.log("Creating new user with confirmed email...");
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: "Administrateur Faro" },
    });

    if (createError || !createData.user) {
      console.error("Failed to create admin user:", createError?.message);
      process.exit(1);
    }

    targetUserId = createData.user.id;
    console.log(`Created user successfully with ID: ${targetUserId}`);
  }

  // 2. Set user role to 'admin' using secure RPC
  console.log("Assigning 'admin' role in database profiles table...");
  const { error: roleError } = await supabase.rpc("set_user_role", {
    target_user_id: targetUserId,
    new_role: "admin",
  });

  if (roleError) {
    // Fallback direct update with service role key if RPC trigger restricts self-assignment
    console.log("RPC notice, applying direct update via service role client...");
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", targetUserId);

    if (profileError) {
      console.error("Failed to set admin role on profile:", profileError.message);
      process.exit(1);
    }
  }

  // 3. Generate secure password reset / invitation link
  console.log("Generating secure password setup link...");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://faroschool.com";
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/reinitialiser-mot-de-passe`,
    },
  });

  if (linkError || !linkData.properties?.action_link) {
    console.error("Failed to generate setup link:", linkError?.message);
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("ADMIN ACCOUNT PROVISIONED SUCCESSFULLY!");
  console.log("==================================================");
  console.log(`User ID:     ${targetUserId}`);
  console.log(`Role:        admin`);
  console.log(`Email:       ${email}`);
  console.log(`Setup Link:  ${linkData.properties.action_link}`);
  console.log("Send this one-time link securely to the administrator to set their password.");
  console.log("No passwords were created or stored in any repository file.\n");
}

main().catch(console.error);
