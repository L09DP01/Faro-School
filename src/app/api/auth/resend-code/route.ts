import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail, checkEmailDispatchLimit, recordEmailDispatched } from "@/lib/auth/rate-limit";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/resend";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const resendSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["fr", "ht"]).default("fr"),
});

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const body = await req.json();
    const parsed = resendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }

    const normEmail = normalizeEmail(parsed.data.email);
    const locale = parsed.data.locale;
    const origin = req.nextUrl.origin || "http://localhost:3000";

    const supabase = getAdminSupabase();

    // Verify user exists and is not yet verified
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email_verified_at")
      .eq("email", normEmail)
      .maybeSingle();

    if (!profile) {
      // Do not reveal email existence
      return NextResponse.json({ success: true });
    }

    if (profile.email_verified_at) {
      return NextResponse.json({
        success: true,
        alreadyVerified: true,
        message: "Cet e-mail est déjà vérifié. Vous pouvez vous connecter.",
      });
    }

    // Rate limit check (60s cooldown + 5/hr max)
    const limit = await checkEmailDispatchLimit(normEmail, ip, "verification_email");
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: limit.reason || "Veuillez patienter avant de renvoyer un code.",
          retryAfterSeconds: limit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const { code, token } = await createEmailVerificationToken(normEmail);
    const verifyUrl = `${origin}/${locale}/verification-email?token=${token}&email=${encodeURIComponent(normEmail)}`;

    await sendVerificationEmail(normEmail, code, verifyUrl, locale);
    await recordEmailDispatched(normEmail, ip, "verification_email");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Resend code error:", err);
    return NextResponse.json({ error: "Erreur lors de l'envoi du code." }, { status: 500 });
  }
}
