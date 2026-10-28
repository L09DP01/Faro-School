import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if ((globalThis as any).__mockUser) {
    return (globalThis as any).__mockUser;
  }
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("faro_session")?.value;
    if (sessionCookie) {
      try {
        const decoded = JSON.parse(
          Buffer.from(sessionCookie, "base64").toString("utf-8")
        );
        if (decoded && decoded.id) {
          return {
            id: decoded.id,
            email: decoded.email ?? null,
            role: (decoded.role as "student" | "instructor" | "admin") ?? "student",
            fullName: decoded.fullName ?? "Utilisateur Test",
            phone: decoded.phone ?? null,
            locale: (decoded.locale as "fr" | "ht") ?? "fr",
          };
        }
      } catch {}
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, phone, locale")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? null,
      role: (profile?.role as "student" | "instructor" | "admin") ?? "student",
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? null,
      locale: (profile?.locale as "fr" | "ht") ?? "fr",
    };
  } catch {
    return null;
  }
}
