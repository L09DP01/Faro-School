import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { isCommonPassword } from "@/lib/auth/rate-limit";
import { verifyAndConsumePasswordResetToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Jeton de réinitialisation manquant." }, { status: 400 });
    }

    const result = resetPasswordSchema.safeParse({ password: body.password });
    if (!result.success) {
      return NextResponse.json(
        {
          error:
            "Le mot de passe doit comporter au moins 10 caractères avec majuscule, minuscule et chiffre.",
        },
        { status: 400 }
      );
    }

    const { password } = result.data;
    if (isCommonPassword(password)) {
      return NextResponse.json(
        { error: "Ce mot de passe est trop facile à deviner. Choisissez un mot de passe plus robuste." },
        { status: 400 }
      );
    }

    // Verify and consume token
    const tokenResult = await verifyAndConsumePasswordResetToken(token);
    if (!tokenResult.success || !tokenResult.userId) {
      return NextResponse.json(
        { error: tokenResult.reason || "Jeton de réinitialisation invalide ou expiré." },
        { status: 400 }
      );
    }

    const userId = tokenResult.userId;
    const passwordHash = await hashPassword(password);
    const supabase = getAdminSupabase();

    // 1. Fetch current token_version
    const { data: creds } = await supabase
      .from("user_credentials")
      .select("token_version")
      .eq("user_id", userId)
      .single();

    const nextTokenVersion = (creds?.token_version ?? 0) + 1;

    // 2. Update credentials, increment token_version to invalidate all existing sessions
    await supabase
      .from("user_credentials")
      .update({
        password_hash: passwordHash,
        token_version: nextTokenVersion,
        failed_count: 0,
        locked_until: null,
      })
      .eq("user_id", userId);

    // 3. Ensure profile is marked verified
    await supabase
      .from("profiles")
      .update({
        email_verified_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .is("email_verified_at", null);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Erreur serveur lors de la réinitialisation." }, { status: 500 });
  }
}
