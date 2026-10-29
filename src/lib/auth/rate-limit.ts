import disposableDomains from "@/config/disposable-domains.json";
import commonPasswords from "@/config/common-passwords.json";
import { getAdminSupabase } from "@/lib/supabase/admin";

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

/**
 * Normalizes email: trims and converts to lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Checks whether an email domain is in the disposable / temporary blocklist.
 */
export function isDisposableEmail(email: string): boolean {
  const norm = normalizeEmail(email);
  const parts = norm.split("@");
  if (parts.length !== 2) return true;
  const domain = parts[1].toLowerCase();

  // Reject clearly invalid domains
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return true;
  }

  return (disposableDomains as string[]).includes(domain);
}

/**
 * Checks whether a password is in the common password blocklist.
 */
export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  return (commonPasswords as string[]).some((common) => lower.includes(common));
}

/**
 * Rate limits email dispatch (verification codes & password resets).
 * Rules:
 * - 60s cooldown per email
 * - Max 5 emails per hour per email and per IP
 */
export async function checkEmailDispatchLimit(
  email: string,
  ip: string,
  type: "verification_email" | "reset_email"
): Promise<RateLimitCheckResult> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const sixtySecsAgo = new Date(now.getTime() - 60 * 1000).toISOString();

  try {
    // 1. Check email cooldown (60 seconds)
    const { data: emailRecent } = await supabase
      .from("auth_attempts")
      .select("last_attempt_at, attempts, first_attempt_at")
      .eq("identifier", normEmail)
      .eq("attempt_type", type)
      .single();

    if (emailRecent) {
      const lastAttempt = new Date(emailRecent.last_attempt_at).getTime();
      const elapsedSeconds = Math.floor((now.getTime() - lastAttempt) / 1000);
      if (elapsedSeconds < 60) {
        return {
          allowed: false,
          reason: "Veuillez patienter 60 secondes avant de demander un nouvel e-mail.",
          retryAfterSeconds: 60 - elapsedSeconds,
        };
      }

      // Check hourly cap (max 5)
      const firstAttempt = new Date(emailRecent.first_attempt_at).getTime();
      if (now.getTime() - firstAttempt < 60 * 60 * 1000 && emailRecent.attempts >= 5) {
        return {
          allowed: false,
          reason: "Limite horaire atteinte (maximum 5 e-mails par heure). Réessayez plus tard.",
          retryAfterSeconds: Math.ceil((firstAttempt + 60 * 60 * 1000 - now.getTime()) / 1000),
        };
      }
    }

    // 2. Check IP hourly limit (max 5 per hour)
    const { data: ipRecent } = await supabase
      .from("auth_attempts")
      .select("attempts, first_attempt_at")
      .eq("identifier", ip)
      .eq("attempt_type", type)
      .single();

    if (ipRecent) {
      const firstAttempt = new Date(ipRecent.first_attempt_at).getTime();
      if (now.getTime() - firstAttempt < 60 * 60 * 1000 && ipRecent.attempts >= 5) {
        return {
          allowed: false,
          reason: "Trop de requêtes depuis cette adresse IP. Réessayez dans une heure.",
          retryAfterSeconds: Math.ceil((firstAttempt + 60 * 60 * 1000 - now.getTime()) / 1000),
        };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("[RateLimit] Error checking email limit:", err);
    return { allowed: true }; // Fail open for database latency/transient error in non-prod
  }
}

/**
 * Records an email dispatch attempt for email and IP.
 */
export async function recordEmailDispatchAttempt(
  email: string,
  ip: string,
  type: "verification_email" | "reset_email"
): Promise<void> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recordForIdentifier = async (identifier: string) => {
    const { data: existing } = await supabase
      .from("auth_attempts")
      .select("id, attempts, first_attempt_at")
      .eq("identifier", identifier)
      .eq("attempt_type", type)
      .single();

    if (existing) {
      const isPastHour = new Date(existing.first_attempt_at) < oneHourAgo;
      await supabase
        .from("auth_attempts")
        .update({
          attempts: isPastHour ? 1 : existing.attempts + 1,
          first_attempt_at: isPastHour ? now.toISOString() : existing.first_attempt_at,
          last_attempt_at: now.toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("auth_attempts").insert({
        identifier,
        attempt_type: type,
        attempts: 1,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
      });
    }
  };

  await Promise.all([recordForIdentifier(normEmail), recordForIdentifier(ip)]);
}

export const recordEmailDispatched = recordEmailDispatchAttempt;

/**
 * Checks login rate limit & lockout for email and IP.
 * - 5 failed attempts locks out for 15 minutes.
 */
export async function checkLoginRateLimit(email: string, ip: string): Promise<RateLimitCheckResult> {
  const normEmail = normalizeEmail(email);
  const now = new Date();

  try {
    const supabase = getAdminSupabase();
    // Check lockouts on email or IP
    const { data: records } = await supabase
      .from("auth_attempts")
      .select("identifier, locked_until, attempts")
      .in("identifier", [normEmail, ip])
      .eq("attempt_type", "login");

    if (records) {
      for (const rec of records) {
        if (rec.locked_until) {
          const lockUntil = new Date(rec.locked_until).getTime();
          if (lockUntil > now.getTime()) {
            const waitSeconds = Math.ceil((lockUntil - now.getTime()) / 1000);
            return {
              allowed: false,
              reason: `Compte temporairement verrouillé pour des raisons de sécurité. Réessayez dans ${Math.ceil(
                waitSeconds / 60
              )} minute(s).`,
              retryAfterSeconds: waitSeconds,
            };
          }
        }
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("[RateLimit] Error checking login limit:", err);
    return { allowed: true };
  }
}

/**
 * Records a failed login attempt; locks for 15 minutes after 5 failures.
 */
export async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);
  const now = new Date();

  const recordFailure = async (identifier: string) => {
    const { data: existing } = await supabase
      .from("auth_attempts")
      .select("id, attempts, first_attempt_at")
      .eq("identifier", identifier)
      .eq("attempt_type", "login")
      .single();

    if (existing) {
      const newAttempts = existing.attempts + 1;
      const shouldLock = newAttempts >= 5;
      const lockedUntil = shouldLock ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;

      await supabase
        .from("auth_attempts")
        .update({
          attempts: shouldLock ? 0 : newAttempts,
          last_attempt_at: now.toISOString(),
          locked_until: lockedUntil,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("auth_attempts").insert({
        identifier,
        attempt_type: "login",
        attempts: 1,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
      });
    }
  };

  await Promise.all([recordFailure(normEmail), recordFailure(ip)]);
}

/**
 * Clears failed login counter on successful authentication.
 */
export async function clearFailedLogins(email: string, ip: string): Promise<void> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);
  await supabase
    .from("auth_attempts")
    .delete()
    .in("identifier", [normEmail, ip])
    .eq("attempt_type", "login");
}
