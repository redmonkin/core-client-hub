// Portal share-link passwords (proposal / contract / invoice access tokens).
//
// Keep in sync with supabase/functions/_shared/portal-password.ts, which
// verifies these hashes in the client-portal edge function.
//
// Stored format: "pbkdf2_sha256$<iterations>$<salt hex>$<hash hex>".

const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const PASSWORD_LENGTH = 10; // ~49.5 bits of entropy
const PBKDF2_ITERATIONS = 100_000;
const HASH_PREFIX = "pbkdf2_sha256";

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}
