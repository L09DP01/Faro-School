import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { requestAccountEmail } from "@/lib/email/auth-requests";
import { logEmailFailure } from "@/lib/email/diagnostics";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalidEmail" }, { status: 400 }); }
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
  try {
    await requestAccountEmail(parsed.data.email, "verification", {
      ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      locale: body.locale === "ht" ? "ht" : "fr",
    });
  } catch { logEmailFailure("verification_request"); }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
