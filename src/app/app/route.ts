import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {sanitizeRedirectUrl} from '@/lib/validators/auth';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const searchParams = request.nextUrl.searchParams;
  const nextParam = sanitizeRedirectUrl(searchParams.get("next"), '');

  // Determine locale: saved preference cookie -> browser language -> fr
  let locale = "fr";
  if (user?.locale && (user.locale === "fr" || user.locale === "ht")) {
    locale = user.locale;
  } else {
    const cookieLocale =
      request.cookies.get("faro_locale")?.value ||
      request.cookies.get("NEXT_LOCALE")?.value;
    if (cookieLocale === "fr" || cookieLocale === "ht") {
      locale = cookieLocale;
    } else {
      const acceptLang = request.headers.get("accept-language") || "";
      if (acceptLang.includes("ht") || acceptLang.includes("kr")) {
        locale = "ht";
      }
    }
  }

  let redirectTarget: string;

  if (!user) {
    redirectTarget = `/${locale}/connexion`;
    if (nextParam && nextParam.startsWith("/")) {
      redirectTarget += `?next=${encodeURIComponent(nextParam)}`;
    }
  } else {
    if (nextParam && nextParam.startsWith("/")) {
      redirectTarget = nextParam;
    } else if (user.role === "admin") {
      redirectTarget = `/${locale}/admin`;
    } else if (user.role === "instructor") {
      redirectTarget = `/${locale}/admin/tableau-de-bord`;
    } else {
      redirectTarget = `/${locale}/dashboard`;
    }
  }

  const redirectUrl = new URL(redirectTarget, request.url);
  const response = NextResponse.redirect(redirectUrl);

  // Set long-lived standalone cookie so middleware knows installed mode
  response.cookies.set("faro_display", "standalone", {
    maxAge: 31536000, // 1 year
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
