import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { authConfig } from "./auth.config";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const searchParams = request.nextUrl.searchParams;

  // 1. PWA special routes bypass intl middleware
  if (pathname === "/app" || pathname === "/offline") {
    const res = NextResponse.next();
    if (searchParams.get("source") === "pwa") {
      res.cookies.set("faro_display", "standalone", {
        maxAge: 31536000,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
  }

  // 2. Detect Standalone / PWA installed mode
  const faroDisplay = request.cookies.get("faro_display")?.value;
  const isPwaSource = searchParams.get("source") === "pwa";
  const isStandalone = faroDisplay === "standalone" || isPwaSource;

  // Never show marketing landing page in installed / standalone mode
  if (isStandalone) {
    const isLanding =
      pathname === "/" ||
      pathname === "/fr" ||
      pathname === "/fr/" ||
      pathname === "/ht" ||
      pathname === "/ht/";

    if (isLanding) {
      const appUrl = new URL("/app", request.url);
      if (isPwaSource) appUrl.searchParams.set("source", "pwa");
      const redirectRes = NextResponse.redirect(appUrl);
      redirectRes.cookies.set("faro_display", "standalone", {
        maxAge: 31536000,
        path: "/",
        sameSite: "lax",
      });
      return redirectRes;
    }
  }

  // First run next-intl middleware for locale routing
  const response = intlMiddleware(request);

  if (isPwaSource && !request.cookies.has("faro_display")) {
    response.cookies.set("faro_display", "standalone", {
      maxAge: 31536000,
      path: "/",
      sameSite: "lax",
    });
  }

  // If next-intl generated a redirect (such as / -> /fr), return immediately
  if (response.headers.get("location")) {
    return response;
  }

  const segments = pathname.split("/").filter(Boolean);
  const locale = routing.locales.includes(segments[0] as any)
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(1).join("/");

  const isDashboardRoute = pathWithoutLocale.startsWith("/dashboard");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");

  if (isDashboardRoute || isAdminRoute) {
    // Auth.js Edge-safe session verification via encrypted JWT cookie.
    // Zero database queries in Edge middleware.
    const secret = process.env.AUTH_SECRET;
    const token = await getToken({
      req: request,
      secret,
      secureCookie: authConfig.useSecureCookies,
    });

    if (!token || !token.id) {
      const loginUrl = new URL(`/${locale}/connexion`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminRoute) {
      const userRole = (token.role as string) || "student";
      if (userRole !== "admin" && userRole !== "instructor") {
        return NextResponse.redirect(
          new URL(`/${locale}/dashboard`, request.url)
        );
      }

      if (userRole === "instructor") {
        const isExactAdminRoot =
          pathWithoutLocale === "/admin" || pathWithoutLocale === "/admin/";
        const isForbiddenPath = [
          "/admin/paiements",
          "/admin/promotions",
          "/admin/formateurs",
          "/admin/parametres",
        ].some((prefix) => pathWithoutLocale.startsWith(prefix));

        if (isExactAdminRoot || isForbiddenPath) {
          return NextResponse.redirect(
            new URL(`/${locale}/admin/unauthorized`, request.url)
          );
        }
      }
    }
  }

  // Prevent indexing on staging/preview environments and on private routes
  const isProduction =
    process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
  if (!isProduction || isDashboardRoute || isAdminRoute) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
