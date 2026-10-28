import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: "student" | "instructor" | "admin";
  fullName: string;
  phone: string | null;
  locale: "fr" | "ht";
}

/**
 * Returns the currently authenticated user with their profile role, or null if not logged in.
 * Identity is verified strictly server-side with supabase.auth.getUser().
 * Role is always fetched directly from the database (profiles.role) for the verified user id.
 * Cached only for the duration of the current request via React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // Role is ALWAYS verified from the database profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name, phone, locale")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    const validRoles = ["student", "instructor", "admin"] as const;
    const role = validRoles.includes(profile.role as any)
      ? (profile.role as "student" | "instructor" | "admin")
      : "student";

    return {
      id: user.id,
      email: user.email ?? null,
      role,
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? null,
      locale: (profile.locale as "fr" | "ht") ?? "fr",
    };
  } catch {
    return null;
  }
});
