/**
 * Edge-compatible in-memory rate limiter for server routes and form submissions.
 * Defaults to 5 messages per hour per IP.
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 3600 * 1000 // 1 hour
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // If no record or window expired, reset
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // If limit reached, deny
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}
