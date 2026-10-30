import {queueAuthEmail} from "@/lib/email/outbox";
import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { normalizeEmail, checkEmailDispatchLimit, recordEmailDispatched } from "@/lib/auth/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const body = await req.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
    }

    const normEmail = normalizeEmail(result.data.email);
    const origin = req.nextUrl.origin || "http://localhost:3000";
    const locale = body.locale === "ht" ? "ht" : "fr";

    // Rate limit check: max 5 emails per hour per email & IP, 60s cooldown
    const limit = await checkEmailDispatchLimit(normEmail, ip, "reset_email");
    if (!limit.allowed) {
      return NextResponse.json({success:true});
    }

    const supabase = getAdminSupabase();

    // Check if user exists in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", normEmail)
      .maybeSingle();

    if (profile) {
      // Generate secure reset token (valid 1 hour)
      const sent=await queueAuthEmail(normEmail,"reset",locale);
      if(sent.status!=="accepted")console.warn("[email] reset_pending",{correlationId:sent.correlationId});
      await recordEmailDispatched(normEmail, ip, "reset_email");
    }

    // ALWAYS return success to prevent email enumeration attacks
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[email] reset_unavailable");
    return NextResponse.json({success:true});
  }
}
