import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

/**
 * Creates or retrieves Supabase client for browser usage.
 * Completely free of @supabase/ssr.
 */
export function createClient(accessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

  if (accessToken) {
    return createSupabaseClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          apikey: anonKey,
        },
      },
    });
  }

  if (!clientInstance) {
    clientInstance = createSupabaseClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          apikey: anonKey,
        },
      },
    });
  }
  return clientInstance;
}

/**
 * Fetches short-lived Supabase JWT minted by Auth.js session
 * from authenticated GET /api/auth/supabase-token endpoint.
 */
export async function getSupabaseToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/supabase-token", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

/**
 * Initializes Supabase client with authenticated token for Realtime & RLS.
 */
export async function initAuthenticatedRealtimeClient(): Promise<SupabaseClient> {
  const token = await getSupabaseToken();
  const client = createClient(token || undefined);
  if (token && (client as any).realtime) {
    (client as any).realtime.setAuth(token);
  }
  return client;
}
