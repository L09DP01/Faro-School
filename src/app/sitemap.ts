import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

  if (!isProduction) {
    return [];
  }

  const baseUrl = siteConfig.url;
  const now = new Date();

  const publicRoutes = [
    "",
    "/fr",
    "/ht",
    "/fr/formations",
    "/ht/formations",
    "/fr/contact",
    "/ht/contact",
    "/fr/conditions",
    "/ht/conditions",
    "/fr/confidentialite",
    "/ht/confidentialite",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route.includes("/formations") ? "daily" : "monthly",
    priority: route === "" || route === "/fr" || route === "/ht" ? 1.0 : 0.8,
  }));
}
