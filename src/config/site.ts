import { getBrandName, getSiteUrl, getCurrency } from "@/lib/env.public";

export const siteConfig = {
  name: getBrandName(),
  description: "Plateforme de formation vidéo en ligne pour Haïti",
  url: getSiteUrl(),
  currency: getCurrency(),
  locales: ["fr", "ht"] as const,
  defaultLocale: "fr",
  slogan: "Apprenez aujourd'hui, construisez demain.",
  ogImage: "/brand/og-image.png",
  links: {
    facebook: "https://facebook.com/faroschool",
    instagram: "https://instagram.com/faroschool",
    youtube: "https://youtube.com/@faroschool",
  },
};
