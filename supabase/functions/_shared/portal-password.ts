// Portal share-link passwords (proposal / contract / invoice access tokens).
//
// Keep in sync with src/lib/portal-password.ts, which generates and hashes
// passwords in the browser using the same format.
//
// Stored format: "pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>".
// Tokens created before this format existed hold an unsalted SHA-256 hex
// digest; verifyPortalPassword still accepts those until they expire.

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const PASSWORD_LENGTH = 10; // ~49.5 bits of entropy
const PBKDF2_ITERATIONS = 100_000;
const HASH_PREFIX = "pbkdf2_sha256";

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) || []).map((h) => parseInt(h, 16)));

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password: string, salt: BufferSource, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return toHex(new Uint8Array(bits));
}

export function generatePortalPassword(): string {
  // Rejection sampling so every character is equally likely.
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = "";
  while (out.length < PASSWORD_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH * 2));
    for (const b of bytes) {
      if (b < limit && out.length < PASSWORD_LENGTH) out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
    }
  }
  return out;
}

export async function hashPortalPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPortalPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const [, iterStr, saltHex, hashHex] = stored.split("$");
    const iterations = Number(iterStr);
    if (!Number.isInteger(iterations) || iterations < 1 || !saltHex || !hashHex) return false;
    return timingSafeEqual(await pbkdf2(password, fromHex(saltHex), iterations), hashHex);
  }
  // Legacy unsalted SHA-256.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return timingSafeEqual(toHex(new Uint8Array(digest)), stored);
}
