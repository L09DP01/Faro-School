import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { signSupabaseToken } from "@/lib/auth/supabase-jwt";

/**
 * Creates a server-side Supabase client for data and RLS.
 * If a valid Auth.js session exists, mints a short-lived user JWT
 * so PostgreSQL RLS policies (auth.uid() = sub) are enforced transparently.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  let jwtToken: string | undefined;

  try {
    const session = await auth();
    if (session?.user?.id && session.user.email) {
      jwtToken = await signSupabaseToken({
        id: session.user.id,
        role: (session.user as any).role || "student",
        email: session.user.email,
        tokenVersion: (session.user as any).tokenVersion ?? 0,
      });
    }
  } catch {
    // Unauthenticated or error fetching session: anonymous client
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
