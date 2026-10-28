import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const rateLimit = checkRateLimit(`forgot:${ip}`, 5, 3600 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "invalidEmail" },
        { status: 400 }
      );
    }

    const { email } = result.data;
    const origin = req.nextUrl.origin || "http://localhost:3000";
    const supabase = await createClient();

    // Call Supabase password reset
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reinitialiser-mot-de-passe`,
    });

    // ALWAYS return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Forgot password route error:", err);
    return NextResponse.json(
      { error: "serverError" },
      { status: 500 }
    );
  }
}
