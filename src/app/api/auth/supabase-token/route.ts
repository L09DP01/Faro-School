import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signSupabaseToken } from "@/lib/auth/supabase-jwt";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Session requise pour obtenir un jeton de données." },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  // Verify against database for sensitive operations & token version
  const supabase = getAdminSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, email_verified_at")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.email_verified_at) {
    return NextResponse.json(
      { error: "Forbidden", message: "Compte non vérifié ou inexistant." },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const { data: creds } = await supabase
    .from("user_credentials")
    .select("token_version")
    .eq("user_id", profile.id)
    .single();

  // If session tokenVersion doesn't match DB token_version, session is revoked
  const sessionTokenVersion = (session.user as any).tokenVersion ?? 0;
  const dbTokenVersion = creds?.token_version ?? 0;
  if (sessionTokenVersion !== dbTokenVersion) {
    return NextResponse.json(
      { error: "SessionRevoked", message: "Votre session a été invalidée suite à un changement de sécurité." },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const token = await signSupabaseToken({
    id: profile.id,
    role: profile.role,
    email: profile.email,
    tokenVersion: dbTokenVersion,
  });

  return NextResponse.json(
    {
      token,
      expiresIn: 3600,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
