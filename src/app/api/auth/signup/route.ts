import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/validators/auth";
import { isDisposableEmail, isCommonPassword } from "@/lib/auth/rate-limit";
import { registerAccount } from "@/lib/email/auth-requests";
import { logEmailFailure } from "@/lib/email/diagnostics";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "validation" }, { status: 400 }); }
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", fieldErrors: Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])) }, { status: 400 });
  }
  if (isDisposableEmail(parsed.data.email)) return NextResponse.json({ error: "validation", fieldErrors: { email: "disposableEmail" } }, { status: 400 });
  if (isCommonPassword(parsed.data.password)) return NextResponse.json({ error: "validation", fieldErrors: { password: "passwordTooCommon" } }, { status: 400 });
  try {
    await registerAccount(parsed.data, {
      ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      locale: body.locale === "ht" ? "ht" : "fr",
      next: req.nextUrl.searchParams.get("next") ?? body.next,
    });
  } catch { logEmailFailure("registration_request"); }
  // Same response for new/existing/verified accounts, throttles and provider errors.
  // The UI describes a request, never claims provider delivery or creates a session.
  return NextResponse.json({ success: true, requireVerification: true }, { headers: { "Cache-Control": "no-store" } });
}
