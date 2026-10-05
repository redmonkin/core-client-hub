// Password rules for sign-up, reset and change. Keep MIN_PASSWORD_LENGTH and
// the character rules in step with Supabase Auth > Providers > Email
// ("Minimum password length" and "Password requirements").

export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, with upper- and lowercase letters and a number.`;

/** Returns a message describing what's wrong, or null if the password is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password needs an uppercase letter, a lowercase letter and a number";
  }
  return null;
}

/**
 * True if the password appears in a known data breach, using the Have I Been
 * Pwned range API (k-anonymity: only the first 5 characters of the password's
 * SHA-1 hash leave the browser). Returns false if the service can't be
 * reached, so an outage never blocks sign-up.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/** Runs both checks; returns an error message or null. */
export async function checkNewPassword(password: string): Promise<string | null> {
  const problem = passwordProblem(password);
  if (problem) return problem;
  if (await isPasswordBreached(password)) {
    return "This password has appeared in a data breach. Please choose a different one.";
  }
  return null;
}
