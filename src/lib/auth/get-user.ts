import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: "student" | "instructor" | "admin";
  fullName: string;
  phone: string | null;
  locale: "fr" | "ht";
  emailVerified: string | null;
  tokenVersion: number;
}

/**
 * Returns the currently authenticated user with their profile and role, or null if not logged in.
 * Authenticated session verified via Auth.js v5.
 * Re-reads role, email_verified_at and token_version directly from PostgreSQL to enforce:
 * 1. Immediate revocation on password change, reset, or ban (token_version mismatch)
 * 2. Strict enforcement of email verification (unusable if unverified)
 * Cached for the duration of the current request via React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    let session = null;
    try {
      session = await auth();
    } catch {
      // Handled outside Next.js request scope (e.g. standalone CLI tests)
      return null;
    }

    if (!session?.user?.id) {
      return null;
    }

    const supabase = getAdminSupabase();

    // 1. Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, phone, locale, email_verified_at")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // 2. Strict Rule: account is unusable without verified email
    if (!profile.email_verified_at) {
      return null;
    }

    // 3. Fetch user credentials to verify token_version
    const { data: creds } = await supabase
      .from("user_credentials")
      .select("token_version, locked_until")
      .eq("user_id", profile.id)
      .single();

    if (creds?.locked_until && new Date(creds.locked_until).getTime() > Date.now()) {
      return null;
    }

    const sessionTokenVersion = (session.user as any).tokenVersion ?? 0;
    const dbTokenVersion = creds?.token_version ?? 0;

    // Session revocation check
    if (sessionTokenVersion !== dbTokenVersion) {
      return null;
    }

    const validRoles = ["student", "instructor", "admin"] as const;
    const role = validRoles.includes(profile.role as any)
      ? (profile.role as "student" | "instructor" | "admin")
      : "student";

    return {
      id: profile.id,
      email: profile.email ?? null,
      role,
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? null,
      locale: (profile.locale as "fr" | "ht") ?? "fr",
      emailVerified: profile.email_verified_at,
      tokenVersion: dbTokenVersion,
    };
  } catch (err) {
    console.error("[getCurrentUser] Error fetching current user:", err);
    return null;
  }
});
