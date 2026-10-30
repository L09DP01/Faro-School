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
    const rateLimit = checkRateLimit(`contact:${ip}`, 5, 3600 * 1000);
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
    const supabase = await createClient();
    const { error: dbError } = await supabase.from("contact_messages").insert({
      name,
      contact,
      message,
    });

    if (dbError) {
      console.error("Database error inserting contact message:", dbError);
      // In offline/mock mode, we can still confirm reception so development proceeds
      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("example.co") || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ success: true, mock: true });
      }

      return NextResponse.json(
        { error: "serverError", message: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error in contact API:", err);
    return NextResponse.json(
      { error: "serverError", message: err.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
