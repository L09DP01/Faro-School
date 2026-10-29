import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/*",
        "/dashboard",
        "/dashboard/*",
        "/api/*",
        "/_next/*",
        "/app",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
