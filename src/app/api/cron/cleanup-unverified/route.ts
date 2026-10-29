import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "edge";

async function isAuthorizedCron(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return false;
  }

  let candidate = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    candidate = authHeader.slice(7).trim();
  } else if (cronSecretHeader) {
    candidate = cronSecretHeader.trim();
  }

  if (!candidate || candidate.length !== expectedSecret.length) {
    return false;
  }

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(req: Request) {
  return handleCleanup(req);
}

export async function POST(req: Request) {
  return handleCleanup(req);
}

async function handleCleanup(req: Request) {
  const authorized = await isAuthorizedCron(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminSupabase();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    // 1. Find unverified profiles older than 48 hours
    const { data: expiredProfiles, error: findError } = await supabase
      .from("profiles")
      .select("id, email")
      .is("email_verified_at", null)
      .lt("created_at", fortyEightHoursAgo)
      .eq("role", "student"); // Never delete admin/instructors

    if (findError) {
      console.error("[CRON Cleanup] Error querying unverified profiles:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const idsToDelete = expiredProfiles.map((p) => p.id);
    const emailsToDelete = expiredProfiles.map((p) => p.email);

    // 2. Clean up tokens, credentials and profiles
    await supabase.from("email_verification_tokens").delete().in("email", emailsToDelete);
    await supabase.from("password_reset_tokens").delete().in("user_id", idsToDelete);
    await supabase.from("user_credentials").delete().in("user_id", idsToDelete);
    const { error: deleteError } = await supabase.from("profiles").delete().in("id", idsToDelete);

    if (deleteError) {
      console.error("[CRON Cleanup] Error deleting expired profiles:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: idsToDelete.length,
    });
  } catch (err: any) {
    console.error("[CRON Cleanup] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
