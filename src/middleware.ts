import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // Create SSR Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const segments = pathname.split("/").filter(Boolean);
  const locale = routing.locales.includes(segments[0] as any)
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = "/" + segments.slice(1).join("/");

  const isDashboardRoute = pathWithoutLocale.startsWith("/dashboard");
  const isAdminRoute = pathWithoutLocale.startsWith("/admin");

  if (isDashboardRoute || isAdminRoute) {
    // 1. Check development/test session cookie first
    const faroSession = request.cookies.get("faro_session")?.value;
    if (faroSession) {
      try {
        const decoded = JSON.parse(
          Buffer.from(faroSession, "base64").toString("utf-8")
        );
        if (decoded && decoded.id) {
          const userRole = decoded.role;
          if (isAdminRoute) {
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
          return response;
        }
      } catch {}
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL(`/${locale}/connexion`, request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminRoute) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = profile?.role;
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

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
