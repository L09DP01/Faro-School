import "server-only";
import { SignJWT } from "jose";

export interface SupabaseTokenClaims {
  id: string;
  role: string;
  email: string;
  tokenVersion?: number;
}

/**
 * Signs a Supabase-compatible HS256 JWT for Row Level Security (RLS) & Realtime.
 * PostgREST reads `sub` as `auth.uid()` and `role` as `auth.role()`.
 */
export async function signSupabaseToken(user: SupabaseTokenClaims): Promise<string> {
  const secretStr = process.env.SUPABASE_JWT_SECRET;
  if (!secretStr) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_JWT_SECRET is missing in production.");
    }
    // Fallback development secret if not yet configured locally
    return "dev_token_placeholder";
  }

  const secret = new TextEncoder().encode(secretStr);
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    sub: user.id,
    role: "authenticated",
    app_role: user.role,
    email: user.email,
    token_version: user.tokenVersion ?? 0,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour validity
    .setIssuer("supabase")
    .sign(secret);

  return jwt;
}
