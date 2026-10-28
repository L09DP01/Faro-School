import { NextRequest, NextResponse } from "next/server";
import { loginSchema, sanitizeRedirectUrl } from "@/lib/validators/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Rate limit: 5 login attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = result.data;
    const { searchParams } = new URL(req.url);
    const nextParam = searchParams.get("next") || body.next;
    const redirectUrl = sanitizeRedirectUrl(nextParam, "/dashboard");

    // Authenticate exclusively through Supabase Auth (no hardcoded passwords or mock bypasses)
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      // Return GENERIC error message (never reveal whether email exists)
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 }
      );
    }

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
