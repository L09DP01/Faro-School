/**
 * Utilities for masking sensitive data before logging or storing in payments.raw.
 */

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  // Keep first 3 characters and last 2 characters (e.g. "+509 38** **12" or "38****12")
  const start = trimmed.slice(0, Math.min(3, trimmed.length - 2));
  const end = trimmed.slice(-2);
  return `${start}****${end}`;
}

export function maskSensitiveData<T = any>(data: T): T {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item)) as unknown as T;
  }

  const SENSITIVE_KEY_REGEX = /token|secret|password|auth|authorization|api_?key|private_?key|credential/i;
  const PHONE_KEY_REGEX = /phone|telephone|mobile|msisdn/i;

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = "[REDACTED]";
    } else if (PHONE_KEY_REGEX.test(key) && typeof value === "string") {
      result[key] = maskPhoneNumber(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = maskSensitiveData(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
