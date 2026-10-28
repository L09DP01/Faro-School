import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

const newsletterSchema = z.object({
  email: z.string().trim().email("Adresse email invalide").toLowerCase(),
  locale: z.enum(["fr", "ht"]).default("fr"),
  hp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Enforce max 5 subscriptions per hour per IP
    const rateLimit = checkRateLimit(`newsletter:${ip}`, 5, 3600 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit", message: "Trop de tentatives. Veuillez réessayer plus tard." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = newsletterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "validation", message: result.error.issues[0]?.message || "Données invalides" },
        { status: 400 }
      );
    }

    const { email, locale, hp } = result.data;

    // Honeypot check
    if (hp && hp.trim().length > 0) {
      return NextResponse.json({ success: true, simulated: true });
    }

    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from("newsletter_subscribers").upsert(
      {
        email,
        locale,
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    if (dbError) {
      console.error("Database error inserting newsletter subscriber:", dbError);
      // Graceful handling if offline/mock
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("example.co") ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        return NextResponse.json({ success: true, mock: true });
      }

      return NextResponse.json(
        { error: "serverError", message: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error in newsletter API:", err);
    return NextResponse.json(
      { error: "serverError", message: err.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
