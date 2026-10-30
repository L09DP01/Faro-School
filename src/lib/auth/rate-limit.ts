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
export async function reserveBudget(address:string,ip:string,kind:string,max=5,window=3600,cooldown=60):Promise<RateLimitCheckResult>{
 try{const{data,error}=await getAdminSupabase().rpc('reserve_email_budget',{p_address:address.trim().toLowerCase(),p_ip:ip,p_kind:kind,p_max:max,p_window:window,p_cooldown:cooldown});
 if(error||!data){console.error('[email] rate_limit_unavailable');return{allowed:false,reason:'unavailable',retryAfterSeconds:60};}return data;
 }catch{console.error('[email] rate_limit_unavailable');return{allowed:false,reason:'unavailable',retryAfterSeconds:60};}
}
/** Reserves atomically: a separate record step must never increment twice. */
export const checkEmailDispatchLimit=(email:string,ip:string,type:'verification_email'|'reset_email')=>reserveBudget(email,ip,type);
export async function recordEmailDispatchAttempt(_email:string,_ip:string,_type:string):Promise<void>{/* Budget already reserved atomically. */}
export const recordEmailDispatched=recordEmailDispatchAttempt;

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
