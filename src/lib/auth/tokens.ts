import { getAdminSupabase } from "@/lib/supabase/admin";
import { normalizeEmail } from "./rate-limit";

async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(str));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function generateRandomHex(bytesCount: number = 32): string {
  const bytes = new Uint8Array(bytesCount);
  globalThis.crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Creates and stores a 6-digit verification code and URL token for an email.
 * Code expires in 10 minutes.
 */
export async function createEmailVerificationToken(
  email: string
): Promise<{ code: string; token: string }> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);

  // Generate 6-digit code
  const codeInt = Math.floor(100000 + Math.random() * 900000);
  const code = codeInt.toString();
  const token = generateRandomHex(32);

  const codeHash = await sha256Hex(code);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Invalidate any existing unused tokens for this email
  await supabase
    .from("email_verification_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("email", normEmail)
    .is("used_at", null);

  // Insert new token
  await supabase.from("email_verification_tokens").insert({
    email: normEmail,
    code_hash: codeHash,
    token_hash: tokenHash,
    attempts: 0,
    expires_at: expiresAt,
  });

  return { code, token };
}

export type VerifyResult =
  | { success: true; email: string; userId: string }
  | { success: false; reason: "invalid" | "expired" | "max_attempts" | "already_used" | "not_found" };

/**
 * Verifies a 6-digit code entered by user.
 * Increments attempt count; max 5 attempts allowed.
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<VerifyResult> {
  const supabase = getAdminSupabase();
  const normEmail = normalizeEmail(email);
  const codeHash = await sha256Hex(code.trim());
  const now = new Date().toISOString();

  // Find most recent unused token for email
  const { data: record, error } = await supabase
    .from("email_verification_tokens")
    .select("id, code_hash, attempts, expires_at, used_at")
    .eq("email", normEmail)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !record) {
    return { success: false, reason: "not_found" };
  }

  if (record.used_at) {
    return { success: false, reason: "already_used" };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { success: false, reason: "expired" };
  }

  if (record.attempts >= 5) {
    return { success: false, reason: "max_attempts" };
  }

  // Check code match
  if (record.code_hash !== codeHash) {
    const newAttempts = record.attempts + 1;
    await supabase
      .from("email_verification_tokens")
      .update({ attempts: newAttempts })
      .eq("id", record.id);

    return {
      success: false,
      reason: newAttempts >= 5 ? "max_attempts" : "invalid",
    };
  }

  // Success: mark token used and update profile
  await supabase
    .from("email_verification_tokens")
    .update({ used_at: now })
    .eq("id", record.id);

  const { data: profile } = await supabase
    .from("profiles")
    .update({ email_verified_at: now })
    .eq("email", normEmail)
    .select("id")
    .single();

  return {
    success: true,
    email: normEmail,
    userId: profile?.id || "",
  };
}

/**
 * Verifies URL verification token (e.g. clicked in email link).
 */
export async function verifyEmailLinkToken(
  token: string
): Promise<VerifyResult> {
  const supabase = getAdminSupabase();
  const tokenHash = await sha256Hex(token.trim());
  const now = new Date().toISOString();

  const { data: record, error } = await supabase
    .from("email_verification_tokens")
    .select("id, email, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !record) {
    return { success: false, reason: "not_found" };
  }

  if (record.used_at) {
    return { success: false, reason: "already_used" };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { success: false, reason: "expired" };
  }

  // Success
  await supabase
    .from("email_verification_tokens")
    .update({ used_at: now })
    .eq("id", record.id);

  const { data: profile } = await supabase
    .from("profiles")
    .update({ email_verified_at: now })
    .eq("email", record.email)
    .select("id")
    .single();

  return {
    success: true,
    email: record.email,
    userId: profile?.id || "",
  };
}

/**
 * Creates and stores a password reset token.
 * Expires in 1 hour (or custom hours for instructor invitations).
 */
export async function createPasswordResetToken(
  userId: string,
  expiresInHours: number = 1
): Promise<string> {
  const supabase = getAdminSupabase();
  const token = generateRandomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();

  // Invalidate any existing unused reset tokens for this user
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null);

  await supabase.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return token;
}

/**
 * Verifies and consumes a password reset token.
 */
export async function verifyAndConsumePasswordResetToken(
  token: string
): Promise<{ success: boolean; userId?: string; reason?: string }> {
  const supabase = getAdminSupabase();
  const tokenHash = await sha256Hex(token.trim());
  const now = new Date().toISOString();

  const { data: record, error } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !record) {
    return { success: false, reason: "Jeton de réinitialisation invalide." };
  }

  if (record.used_at) {
    return { success: false, reason: "Ce lien a déjà été utilisé." };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { success: false, reason: "Ce lien a expiré. Veuillez refaire une demande." };
  }

  // Mark token consumed
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: now })
    .eq("id", record.id);

  return { success: true, userId: record.user_id };
}
