import { z } from "zod";

/**
 * Client-safe Public Environment Variables for Faro School.
 * Only accesses NEXT_PUBLIC_ variables. Safe to import in Client Components.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Faro School"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://your-project.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("placeholder-anon-key"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default("contact@faroschool.com"),
  NEXT_PUBLIC_SUPPORT_PHONE: z.string().default("+509 36 00 00 00"),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().default("+509 36 00 00 00"),
  NEXT_PUBLIC_COMPANY_ADDRESS: z.string().default("Port-au-Prince, Haïti"),
  NEXT_PUBLIC_CURRENCY: z.string().default("HTG"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublicEnv: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = publicEnvSchema.parse({
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      NEXT_PUBLIC_SUPPORT_PHONE: process.env.NEXT_PUBLIC_SUPPORT_PHONE,
      NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
      NEXT_PUBLIC_COMPANY_ADDRESS: process.env.NEXT_PUBLIC_COMPANY_ADDRESS,
      NEXT_PUBLIC_CURRENCY: process.env.NEXT_PUBLIC_CURRENCY,
    });
  }
  return cachedPublicEnv;
}

export const getSiteUrl = () => getPublicEnv().NEXT_PUBLIC_APP_URL;
export const getBrandName = () => getPublicEnv().NEXT_PUBLIC_APP_NAME;
export const getContactEmail = () => getPublicEnv().NEXT_PUBLIC_SUPPORT_EMAIL;
export const getWhatsAppNumber = () => getPublicEnv().NEXT_PUBLIC_SUPPORT_WHATSAPP;
export const getCurrency = () => getPublicEnv().NEXT_PUBLIC_CURRENCY;
