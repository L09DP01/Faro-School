import { z } from "zod";

/**
 * Validates and normalizes a Haitian phone number.
 * Must have exactly 8 digits following the country code (+509).
 * Accepts: "+509 36123456", "50936123456", "3612-3456", etc.
 */
export function validateAndFormatHaitianPhone(raw: string): {
  isValid: boolean;
  formatted: string;
} {
  if (!raw) return { isValid: false, formatted: "" };

  // Remove common separators and spaces
  const cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");
  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  if (digits.startsWith("509")) {
    digits = digits.slice(3);
  }

  // Haitian phone number must have exactly 8 local digits
  if (/^\d{8}$/.test(digits)) {
    return { isValid: true, formatted: `+509${digits}` };
  }

  return { isValid: false, formatted: "" };
}

/**
 * Strictly sanitizes redirect URL to prevent Open Redirect vulnerabilities.
 * Only allows internal relative paths starting with a single '/' (not '//' or 'http:').
 */
export function sanitizeRedirectUrl(
  next: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();

  // Must begin with a single '/' and not contain '://' or backslashes
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("://") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }

  return fallback;
}

// 1. Login schema
export const loginSchema = z.object({
  email: z.string().trim().email({ message: "invalidEmail" }),
  password: z.string().min(1, { message: "passwordTooShort" }),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// 2. Signup schema
export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "invalidName" })
    .max(100),
  phone: z
    .string()
    .trim()
    .refine((val) => validateAndFormatHaitianPhone(val).isValid, {
      message: "invalidPhone",
    }),
  email: z.string().trim().email({ message: "invalidEmail" }),
  password: z.string().min(8, { message: "passwordTooShort" }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "acceptTermsRequired" }),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

// 3. Password reset request schema
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "invalidEmail" }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// 4. Update password schema
export const resetPasswordSchema = z.object({
  password: z.string().min(8, { message: "passwordTooShort" }),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
