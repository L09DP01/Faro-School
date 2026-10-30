import { z } from "zod";
import { publicEnvSchema, PublicEnv, getPublicEnv } from "./env.public";

export * from "./env.public";

/**
 * Validates and exposes server environment variables for Faro School.
 * Enforces strict production fail-closed security:
 * - Refuses startup in production if any mock/demo flag is enabled.
 * - Refuses startup in production if Kobara credentials or mode are not live.
 * - Gracefully disables AI when ANTHROPIC_API_KEY is omitted.
 */

// Server Environment Schema
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production", "test"]).optional(),
  APP_MODE: z.string().optional(),

  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Auth.js v5
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().optional(),

  // Email Dispatch (Resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Kobara Payment Gateway
  KOBARA_MODE: z.string().optional(), // 'live' required in production
  KOBARA_API_KEY: z.string().optional(),
  KOBARA_SECRET_KEY: z.string().optional(),
  KOBARA_BASE_URL: z.string().optional(),
  KOBARA_API_URL: z.string().optional(),
  KOBARA_WEBHOOK_SECRET: z.string().optional(),

  // AI Assistant (Google Gemini / Anthropic Claude)
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gemini-1.5-flash"),
  DISABLE_AI: z.string().optional(),
  AI_ASSISTANT_ENABLED: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().optional(),

  // Bunny Stream Video Protection
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_READ_ONLY_API_KEY: z.string().optional(),
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_TOKEN_AUTH_KEY: z.string().optional(),
  BUNNY_STREAM_HOSTNAME: z.string().default("video.faroschool.com"),

  // Bunny Storage CDN
  BUNNY_STORAGE_ZONE_NAME: z.string().default("faro-storage"),
  BUNNY_STORAGE_API_KEY: z.string().optional(),
  BUNNY_STORAGE_CDN_HOSTNAME: z.string().default("cdn.faroschool.com"),
  BUNNY_STORAGE_TOKEN_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates environment variables against production security rules.
 */
export function validateEnvironment(customEnv?: Record<string, string | undefined>): {
  public: PublicEnv;
  server: ServerEnv;
  isProduction: boolean;
  isAiAvailable: boolean;
} {
  const raw = customEnv || process.env;

  const publicResult = publicEnvSchema.safeParse(raw);
  if (!publicResult.success) {
    const issues = publicResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid public environment configuration:\n  ${issues.join("\n  ")}`);
  }

  const serverResult = serverEnvSchema.safeParse(raw);
  if (!serverResult.success) {
    const issues = serverResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server environment configuration:\n  ${issues.join("\n  ")}`);
  }

  const publicEnv = publicResult.data;
  const serverEnv = serverResult.data;

  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" && !customEnv;
  const isProduction =
    serverEnv.NODE_ENV === "production" || serverEnv.APP_ENV === "production";

  // Production Fail-Closed Validations (enforced at runtime and in test validations)
  if (isProduction && !isBuildPhase) {
    const missing: string[] = [];

    // 0. Auth.js & Token Signing Security
    if (!serverEnv.AUTH_SECRET || serverEnv.AUTH_SECRET.length < 32) {
      missing.push("AUTH_SECRET (must be at least 32 characters)");
    }
    if (!serverEnv.SUPABASE_JWT_SECRET || serverEnv.SUPABASE_JWT_SECRET.length < 32) {
      missing.push("SUPABASE_JWT_SECRET (must be at least 32 characters for RLS token minting)");
    }
    if (!serverEnv.RESEND_API_KEY) {
      missing.push("RESEND_API_KEY (for verification, password reset, and invitation emails)");
    }
    if (!serverEnv.RESEND_WEBHOOK_SECRET?.startsWith("whsec_")) {
      missing.push("RESEND_WEBHOOK_SECRET (Svix signing secret)");
    }
    if (!serverEnv.BUNNY_STREAM_READ_ONLY_API_KEY) {
      missing.push("BUNNY_STREAM_READ_ONLY_API_KEY (Bunny webhook signing key)");
    }
    if (!serverEnv.EMAIL_FROM) {
      missing.push("EMAIL_FROM (e.g. Faro School <noreply@faroschool.com>)");
    }

    // 1. Strict ban on mock/demo flags in production
    if (serverEnv.APP_MODE === "demo" || serverEnv.APP_MODE === "mock") {
      throw new Error(
        `SECURITY VIOLATION: Mock and demo modes (APP_MODE=${serverEnv.APP_MODE}) are strictly forbidden when APP_ENV=production.`
      );
    }

    // 2. Kobara Live Mode Verification
    const kobaraMode = serverEnv.KOBARA_MODE;
    if (kobaraMode !== "live") {
      missing.push("KOBARA_MODE must be explicitly set to 'live' in production.");
    }

    const kobaraKey = serverEnv.KOBARA_API_KEY || serverEnv.KOBARA_SECRET_KEY;
    if (!kobaraKey || kobaraKey.startsWith("mock_")) {
      missing.push("KOBARA_API_KEY (or KOBARA_SECRET_KEY)");
    }

    const kobaraBaseUrl = serverEnv.KOBARA_BASE_URL || serverEnv.KOBARA_API_URL;
    if (!kobaraBaseUrl) {
      missing.push("KOBARA_BASE_URL (or KOBARA_API_URL)");
    }

    if (!serverEnv.KOBARA_WEBHOOK_SECRET) {
      missing.push("KOBARA_WEBHOOK_SECRET");
    }

    // 3. Supabase Service Role Key
    if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    // 4. Cron Secret
    if (!serverEnv.CRON_SECRET) {
      missing.push("CRON_SECRET");
    }

    // 5. Bunny Stream Keys
    if (!serverEnv.BUNNY_STREAM_API_KEY) {
      missing.push("BUNNY_STREAM_API_KEY");
    }
    if (!serverEnv.BUNNY_STREAM_LIBRARY_ID) {
      missing.push("BUNNY_STREAM_LIBRARY_ID");
    }
    if (!serverEnv.BUNNY_STREAM_TOKEN_AUTH_KEY) {
      missing.push("BUNNY_STREAM_TOKEN_AUTH_KEY");
    }

    if (missing.length > 0) {
      throw new Error(
        `PRODUCTION STARTUP HALTED - Missing or invalid required production credentials:\n  - ${missing.join(
          "\n  - "
        )}`
      );
    }
  }

  // AI graceful degradation: AI key is optional, system falls back to human escalation if missing
  const isAiAvailable = Boolean(
    (serverEnv.GEMINI_API_KEY || serverEnv.ANTHROPIC_API_KEY) &&
      serverEnv.DISABLE_AI !== "true" &&
      serverEnv.AI_ASSISTANT_ENABLED !== "false"
  );

  return {
    public: publicEnv,
    server: serverEnv,
    isProduction,
    isAiAvailable,
  };
}

// Global cached validated environment instance
let cachedEnv: ReturnType<typeof validateEnvironment> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = validateEnvironment();
  }
  return cachedEnv;
}

export const isProductionEnv = () => getEnv().isProduction;
export const isAiEnabled = () => getEnv().isAiAvailable;
