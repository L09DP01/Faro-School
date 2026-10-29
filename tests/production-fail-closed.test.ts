import assert from "node:assert";
import { validateEnvironment } from "../src/lib/env";
import { KobaraProvider } from "../src/lib/payments/kobara";

console.log("=== TESTING PRODUCTION FAIL CLOSED & STARTUP VALIDATION ===\n");

// 1. Refuse startup when APP_ENV=production and APP_MODE=demo
console.log("1. Testing startup refusal with APP_ENV=production and APP_MODE=demo...");
assert.throws(
  () => {
    validateEnvironment({
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_MODE: "demo",
      NEXT_PUBLIC_APP_URL: "https://faroschool.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      KOBARA_MODE: "live",
      KOBARA_API_KEY: "kobara_sk_live_test_key_123",
      KOBARA_BASE_URL: "https://api.kobara.app",
      KOBARA_WEBHOOK_SECRET: "whsec_test",
      CRON_SECRET: "cron_secret_123",
      BUNNY_STREAM_API_KEY: "bunny_api",
      BUNNY_STREAM_LIBRARY_ID: "12345",
      BUNNY_STREAM_TOKEN_AUTH_KEY: "bunny_token",
    });
  },
  /SECURITY VIOLATION.*APP_MODE/,
  "Must throw security violation when APP_MODE=demo in production"
);
console.log("  ✓ Correctly refused startup with APP_MODE=demo in production.");

// 2. Refuse startup when required credentials are missing in production
console.log("2. Testing startup refusal with missing credentials in production...");
assert.throws(
  () => {
    validateEnvironment({
      NODE_ENV: "production",
      APP_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://faroschool.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      // Omit SUPABASE_SERVICE_ROLE_KEY, KOBARA_MODE, etc.
    });
  },
  /PRODUCTION STARTUP HALTED/,
  "Must throw when required production variables are missing"
);
console.log("  ✓ Correctly refused startup when credentials are missing.");

// 3. Refuse payment processing when KOBARA_MODE !== 'live' in production
console.log("3. Testing payment provider refusal when KOBARA_MODE is not live in production...");
const prevNodeEnv = process.env.NODE_ENV;
const prevAppEnv = process.env.APP_ENV;
const prevKobaraMode = process.env.KOBARA_MODE;
const prevKobaraKey = process.env.KOBARA_SECRET_KEY;

try {
  (process.env as any).NODE_ENV = "production";
  process.env.APP_ENV = "production";
  process.env.KOBARA_MODE = "sandbox"; // not 'live'
  process.env.KOBARA_SECRET_KEY = "kobara_sk_live_test_key_123";
  process.env.KOBARA_WEBHOOK_SECRET = "whsec_test";

  assert.throws(
    () => {
      new KobaraProvider();
    },
    /SECURITY HALT.*KOBARA_MODE must be 'live'/,
    "Must throw when KOBARA_MODE is not 'live' in production"
  );
  console.log("  ✓ KobaraProvider correctly refused non-live mode in production.");
} finally {
  (process.env as any).NODE_ENV = prevNodeEnv;
  process.env.APP_ENV = prevAppEnv;
  process.env.KOBARA_MODE = prevKobaraMode;
  process.env.KOBARA_SECRET_KEY = prevKobaraKey;
}

// 4. Graceful AI degradation when ANTHROPIC_API_KEY is missing
console.log("4. Testing graceful AI degradation when ANTHROPIC_API_KEY is missing...");
const envWithoutAi = validateEnvironment({
  NODE_ENV: "production",
  APP_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://faroschool.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  KOBARA_MODE: "live",
  KOBARA_API_KEY: "kobara_sk_live_test_key_123",
  KOBARA_BASE_URL: "https://api.kobara.app",
  KOBARA_WEBHOOK_SECRET: "whsec_test",
  CRON_SECRET: "cron_secret_123",
  BUNNY_STREAM_API_KEY: "bunny_api",
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_TOKEN_AUTH_KEY: "bunny_token",
  // No ANTHROPIC_API_KEY
});

assert.strictEqual(envWithoutAi.isAiAvailable, false, "AI must be marked unavailable without crashing");
console.log("  ✓ Startup succeeds gracefully without AI key, marking isAiAvailable=false.");

console.log("\nALL PRODUCTION FAIL CLOSED TESTS PASSED!\n");
