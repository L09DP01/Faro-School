import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/config";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    if (!isDemoMode()) {
      throw new Error(
        "SECURITY ERROR: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing. Production fails closed."
      );
    }
  }

  return createSupabaseClient(
    supabaseUrl || "https://example.supabase.co",
    serviceRoleKey || "mock-service-role-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
