/**
 * Cloudflare Workers & OpenNext compatible password hashing using Web Crypto PBKDF2-SHA256.
 * Zero Node-only dependencies, zero native bcrypt bindings.
 */

const ITERATIONS = 100_000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;
const DUMMY_SALT = new Uint8Array([
  0x1f, 0x2e, 0x3d, 0x4c, 0x5b, 0x6a, 0x79, 0x88, 0x97, 0xa6, 0xb5, 0xc4, 0xd3, 0xe2, 0xf1, 0x00,
]);

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time string / hex comparison to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Derives a PBKDF2-SHA256 hash using the Web Crypto API.
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  return globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    KEY_LEN_BYTES * 8
  );
}

/**
 * Hashes a plaintext password.
 * Format: pbkdf2$iterations$saltHex$hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LEN_BYTES);
  globalThis.crypto.getRandomValues(salt);

  const derived = await deriveKey(password, salt, ITERATIONS);
  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(derived);

  return `pbkdf2$${ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];

    if (isNaN(iterations) || iterations <= 0 || !saltHex || !expectedHashHex) {
      return false;
    }

    const salt = hexToUint8Array(saltHex);
    const derived = await deriveKey(password, salt, iterations);
    const candidateHashHex = bufferToHex(derived);

    return constantTimeCompare(candidateHashHex, expectedHashHex);
  } catch (err) {
    console.error("[Auth] Password verification error:", err);
    return false;
  }
}

/**
 * Executes a constant-time dummy hash computation on non-existent account login
 * so timing attacks cannot determine whether an email exists in the database.
 */
export async function dummyHashWork(): Promise<void> {
  try {
    await deriveKey("DummyPasswordToPreventTimingAttacks123!", DUMMY_SALT, ITERATIONS);
  } catch {
    // ignore
  }
}

/**
 * Benchmark / measurement helper to verify CPU execution time of one hash.
 */
export async function measureHashCpuTime(): Promise<number> {
  const start = performance.now();
  await hashPassword("TestPasswordBenchmark123!");
  return performance.now() - start;
}
