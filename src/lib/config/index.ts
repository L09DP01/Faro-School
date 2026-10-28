/**
 * Global configuration and runtime mode enforcement.
 * Production must fail closed: demo/mock behavior is strictly forbidden in production.
 */

if (process.env.NODE_ENV === "production" && process.env.APP_MODE === "demo") {
  throw new Error("SECURITY VIOLATION: APP_MODE=demo is strictly forbidden in production environment.");
}

export function isDemoMode(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.APP_MODE === "demo";
}
