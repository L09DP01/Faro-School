import { NextRequest, NextResponse } from "next/server";
import { signupSchema, validateAndFormatHaitianPhone, sanitizeRedirectUrl } from "@/lib/validators/auth";
import {
  normalizeEmail,
  isDisposableEmail,
  isCommonPassword,
  checkEmailDispatchLimit,
  recordEmailDispatched,
} from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail, sendSecurityAlertEmail } from "@/lib/email/resend";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const body = await req.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]?.toString() || "form";
        fieldErrors[field] = issue.message;
      });
      return NextResponse.json(
        { error: "validation", fieldErrors },
        { status: 400 }
      );
    }

    const { fullName, phone, email, password } = result.data;
    const normEmail = normalizeEmail(email);

    // 1. Check disposable email domain
    if (isDisposableEmail(normEmail)) {
      return NextResponse.json(
        {
          error: "validation",
          fieldErrors: {
            email: "Les adresses e-mails temporaires ou jetables ne sont pas acceptées.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Check common weak passwords
    if (isCommonPassword(password)) {
      return NextResponse.json(
        {
          error: "validation",
          fieldErrors: {
            password: "Ce mot de passe est trop facile à deviner. Choisissez un mot de passe plus robuste.",
          },
        },
        { status: 400 }
      );
    }

    const phoneFormatting = validateAndFormatHaitianPhone(phone);
    const formattedPhone = phoneFormatting.formatted;

    const { searchParams } = new URL(req.url);
    const nextParam = searchParams.get("next") || body.next;
    const redirectUrl = sanitizeRedirectUrl(nextParam, "/dashboard");
    const locale = body.locale === "ht" ? "ht" : "fr";
    const origin = req.nextUrl.origin || "http://localhost:3000";

    const supabase = getAdminSupabase();

    // 3. Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, email_verified_at")
      .eq("email", normEmail)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.email_verified_at) {
        // Already verified: Never leak existence. Send a security alert email.
        const resetUrl = `${origin}/${locale}/mot-de-passe-oublie`;
        await sendSecurityAlertEmail(normEmail, resetUrl, locale);
        return NextResponse.json({
          success: true,
          requireVerification: true,
          email: normEmail,
          redirectUrl,
        });
      }

      // Unverified account: rate limit check before refreshing code
      const limitCheck = await checkEmailDispatchLimit(normEmail, ip, "verification_email");
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: "rateLimit", message: limitCheck.reason },
          { status: 429 }
        );
      }

      // Refresh code and resend
      const { code, token } = await createEmailVerificationToken(normEmail);
      const verifyUrl = `${origin}/${locale}/verification-email?token=${token}&email=${encodeURIComponent(normEmail)}`;
      await sendVerificationEmail(normEmail, code, verifyUrl, locale);
      await recordEmailDispatched(normEmail, ip, "verification_email");

      return NextResponse.json({
        success: true,
        requireVerification: true,
        email: normEmail,
        redirectUrl,
      });
    }

    // 4. Rate limit check for new registration
    const limitCheck = await checkEmailDispatchLimit(normEmail, ip, "verification_email");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "rateLimit", message: limitCheck.reason },
        { status: 429 }
      );
    }

    // 5. Hash password with PBKDF2 (Workers Web Crypto)
    const passwordHash = await hashPassword(password);

    // 6. Create user in profiles and user_credentials atomically
    let userId: string | null = null;
    const { data: rpcUserId, error: rpcError } = await supabase.rpc(
      "create_user_with_credentials",
      {
        p_email: normEmail,
        p_password_hash: passwordHash,
        p_full_name: fullName,
        p_phone: formattedPhone,
        p_role: "student",
        p_locale: locale,
      }
    );

    if (!rpcError && rpcUserId) {
      userId = rpcUserId as string;
    } else {
      // Fallback: direct inserts
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          email: normEmail,
          full_name: fullName,
          phone: formattedPhone,
          role: "student",
          locale,
          email_verified_at: null,
        })
        .select("id")
        .single();

      if (profileError || !newProfile) {
        console.error("Profile insert error:", profileError?.message);
        return NextResponse.json(
          { error: "signupFailed", message: "Impossible de créer le profil." },
          { status: 500 }
        );
      }

      userId = newProfile.id;

      const { error: credsError } = await supabase.from("user_credentials").insert({
        user_id: userId,
        password_hash: passwordHash,
        token_version: 0,
        failed_count: 0,
        locked_until: null,
      });

      if (credsError) {
        console.error("Credentials insert error:", credsError?.message);
        await supabase.from("profiles").delete().eq("id", userId);
        return NextResponse.json(
          { error: "signupFailed", message: "Impossible de créer les identifiants de sécurité." },
          { status: 500 }
        );
      }
    }

    // 7. Generate verification token and send email
    const { code, token } = await createEmailVerificationToken(normEmail);
    const verifyUrl = `${origin}/${locale}/verification-email?token=${token}&email=${encodeURIComponent(normEmail)}`;
    await sendVerificationEmail(normEmail, code, verifyUrl, locale);
    await recordEmailDispatched(normEmail, ip, "verification_email");

    return NextResponse.json({
      success: true,
      requireVerification: true,
      email: normEmail,
      redirectUrl,
    });
  } catch (err: any) {
    console.error("Signup route error:", err);
    return NextResponse.json(
      { error: "serverError" },
      { status: 500 }
    );
  }
}
