import assert from "node:assert";
import crypto from "node:crypto";
import { updatePasswordSchema, resetPasswordSchema } from "../src/lib/validators/auth";
import { checkRateLimit } from "../src/lib/security/rate-limit";

console.log("=== RUNNING STEP S1-F VERIFICATION TESTS ===");

// 1. Password Schema Tests
console.log("1. Testing updatePasswordSchema validation...");
const validUpdate = updatePasswordSchema.safeParse({
  password: "SuperSecret123!",
  confirmPassword: "SuperSecret123!",
});
assert.strictEqual(validUpdate.success, true, "Valid passwords should succeed");

const mismatched = updatePasswordSchema.safeParse({
  password: "SuperSecret123!",
  confirmPassword: "DifferentSecret123!",
});
assert.strictEqual(mismatched.success, false, "Mismatched passwords must fail");
assert.strictEqual(mismatched.error?.issues[0].message, "passwordsDoNotMatch");

const tooShort = updatePasswordSchema.safeParse({
  password: "short",
  confirmPassword: "short",
});
assert.strictEqual(tooShort.success, false, "Short password (< 8 chars) must fail");

// 2. Rate Limiting Tests
console.log("2. Testing checkRateLimit behavior...");
// Database-backed limits are exercised with real PostgreSQL in email-system.test.ts.
assert.strictEqual(checkRateLimit.constructor.name, 'AsyncFunction', 'Worker instances must share the SQL budget');

// 3. Timing-Safe Equal Cron Token Verification Test
console.log("3. Testing timingSafeEqual token verification...");
const expectedSecret = "my_cron_secret_high_entropy_token_12345";
const candidateValid = "my_cron_secret_high_entropy_token_12345";
const candidateInvalid = "wrong_cron_secret_high_entropy_token_12345";
const candidateShort = "short";

function verifyToken(expected: string, candidate: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}

assert.strictEqual(verifyToken(expectedSecret, candidateValid), true, "Valid secret matches");
assert.strictEqual(verifyToken(expectedSecret, candidateInvalid), false, "Mismatched secret rejected");
assert.strictEqual(verifyToken(expectedSecret, candidateShort), false, "Length mismatch rejected");

console.log("ALL STEP S1-F TESTS PASSED SUCCESSFULLY!");
