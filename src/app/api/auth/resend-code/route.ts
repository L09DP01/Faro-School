import {queueAuthEmail} from "@/lib/email/outbox";
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

    const limit=await checkEmailDispatchLimit(normEmail,ip,"verification_email");
    if(!limit.allowed)return NextResponse.json({success:true});
    const {data:profile,error}=await supabase.from("profiles").select("id,email_verified_at").eq("email",normEmail).maybeSingle();
    if(error||!profile||profile.email_verified_at)return NextResponse.json({success:true});
    const sent=await queueAuthEmail(normEmail,"verification",locale);
    if(sent.status!=="accepted")console.warn("[email] verification_pending",{correlationId:sent.correlationId});
    await recordEmailDispatched(normEmail, ip, "verification_email");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[email] resend_unavailable");
    return NextResponse.json({success:true});
  }
}
