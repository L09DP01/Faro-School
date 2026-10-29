/**
 * Global configuration and runtime mode enforcement.
 * Production must fail closed: demo/mock behavior is strictly forbidden in production.
 */

const isProd =
  process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

if (isProd && (process.env.APP_MODE === "demo" || process.env.APP_MODE === "mock")) {
  throw new Error("SECURITY VIOLATION: APP_MODE is strictly forbidden in production environment.");
}

export function isDemoMode(): boolean {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    return false;
  }
  return process.env.APP_MODE === "demo";
}
