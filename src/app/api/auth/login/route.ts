import { NextRequest, NextResponse } from "next/server";
import { loginSchema, sanitizeRedirectUrl } from "@/lib/validators/auth";
import {
  normalizeEmail,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/auth/rate-limit";
import { verifyPassword, dummyHashWork } from "@/lib/auth/password";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const normEmail = normalizeEmail(email);

    // 1. Check rate limit & lockout (5 failed attempts -> 15 min lockout)
    const rateLimit = await checkLoginRateLimit(normEmail, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit", message: rateLimit.reason },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const nextParam = searchParams.get("next") || body.next;
    const redirectUrl = sanitizeRedirectUrl(nextParam, "/dashboard");

    const supabase = getAdminSupabase();

    // 2. Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, email_verified_at")
      .eq("email", normEmail)
      .maybeSingle();

    if (!profile) {
      await dummyHashWork();
      await recordFailedLogin(normEmail, ip);
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 }
      );
    }

    // 3. Fetch credentials
    const { data: creds } = await supabase
      .from("user_credentials")
      .select("password_hash, token_version, locked_until")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!creds || !creds.password_hash) {
      await dummyHashWork();
      await recordFailedLogin(normEmail, ip);
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 }
      );
    }

    // 4. Verify password with PBKDF2 Web Crypto
    const isValid = await verifyPassword(password, creds.password_hash);
    if (!isValid) {
      await recordFailedLogin(normEmail, ip);
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 }
      );
    }

    // 5. Require email verification
    if (!profile.email_verified_at) {
      return NextResponse.json(
        {
          error: "unverified",
          email: normEmail,
          message: "Veuillez vérifier votre adresse e-mail avant de vous connecter.",
        },
        { status: 403 }
      );
    }

    // 6. Success: clear failed attempts
    await clearFailedLogins(normEmail, ip);

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "serverError" },
      { status: 500 }
    );
  }
}
