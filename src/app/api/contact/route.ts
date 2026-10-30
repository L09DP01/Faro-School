import {processOutbox} from "@/lib/email/outbox";
import {createAdminClient} from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from "@/lib/validators/contact";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Extract IP for rate limiting
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // 2. Enforce 5 messages per hour per IP
    const rateLimit = await checkRateLimit(`contact:${ip}`, 5, 3600 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit", message: "Limite de messages atteinte. Réessayez plus tard." },
        { status: 429 }
      );
    }

    // 3. Parse and validate body
    const body = await req.json();
    const result = contactSchema.safeParse(body);

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

    const { name, contact, message, hp } = result.data;

    // 4. Honeypot check (Bots fill hidden fields)
    if (hp && hp.trim().length > 0) {
      // Return simulated success to fool automated scrapers
      return NextResponse.json({ success: true, simulated: true });
    }

    // 5. Save to database table contact_messages
    const supabase = createAdminClient();
    const {data:stored,error:dbError}=await supabase.rpc('store_contact_with_email',{p_name:name,p_contact:contact,p_message:message,p_support:process.env.SUPPORT_EMAIL?.trim()??'',p_locale:body.locale==='ht'?'ht':'fr'});
    if(dbError||!stored)return NextResponse.json({error:'serverError'},{status:503});
    const [sent]=await processOutbox(stored.email_id);
    if(sent&&sent.status!=='accepted')console.warn('[email] contact_notification_pending',{correlationId:sent.correlationId});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[contact] unavailable");
    return NextResponse.json(
      { error: "serverError", message: "unavailable" },
      { status: 500 }
    );
  }
}
