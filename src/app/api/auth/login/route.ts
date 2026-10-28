import { NextRequest, NextResponse } from "next/server";
import { loginSchema, sanitizeRedirectUrl } from "@/lib/validators/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Rate limit: 5 login attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rateLimit" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = result.data;
    const { searchParams } = new URL(req.url);
    const nextParam = searchParams.get("next") || body.next;
    const redirectUrl = sanitizeRedirectUrl(nextParam, "/dashboard");

    // Check for development test accounts (Instant Mock Session)
    const isMockStudent =
      (email.toLowerCase() === "student@faroschool.com" ||
        email.toLowerCase() === "etudiant@faroschool.com") &&
      password === "Student123!";

    const isMockAdmin =
      email.toLowerCase() === "admin@faroschool.com" &&
      password === "Admin123!";

    const isMockInstructor =
      (email.toLowerCase() === "instructor@faroschool.com" ||
        email.toLowerCase() === "formateur@faroschool.com") &&
      password === "Instructor123!";

    if (isMockStudent || isMockAdmin || isMockInstructor) {
      let mockUser;
      let defaultTarget = redirectUrl;

      if (isMockAdmin) {
        mockUser = {
          id: "mock-admin-id",
          email: "admin@faroschool.com",
          role: "admin",
          fullName: "Professeur Faro",
          phone: "+509 36 00 0000",
          locale: "fr",
        };
        defaultTarget = nextParam || "/admin";
      } else if (isMockInstructor) {
        mockUser = {
          id: "mock-instructor-id",
          email: "instructor@faroschool.com",
          role: "instructor",
          fullName: "Jean-Baptiste Formateur",
          phone: "+509 38 11 2233",
          locale: "fr",
        };
        defaultTarget = nextParam || "/admin/formations";
      } else {
        mockUser = {
          id: "mock-student-id",
          email: "student@faroschool.com",
          role: "student",
          fullName: "Alexandre Jean",
          phone: "+509 37 12 3456",
          locale: "fr",
        };
      }

      const sessionValue = Buffer.from(JSON.stringify(mockUser)).toString("base64");
      const targetUrl = defaultTarget;
      const res = NextResponse.json({
        success: true,
        redirectUrl: targetUrl,
      });

      res.cookies.set("faro_session", sessionValue, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: rememberMe ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 30, // 30-90 days for persistent PWA login
      });

      return res;
    }

    // Supabase sign in
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Return GENERIC error message (never reveal whether email exists)
      return NextResponse.json(
        { error: "invalidCredentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "serverError" },
      { status: 500 }
    );
  }
}
