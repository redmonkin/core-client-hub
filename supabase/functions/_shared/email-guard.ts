// Guards for the user-triggered email functions (send-proposal-email,
// send-notification-email). Anyone can sign up, so every value a caller
// controls is treated as hostile: these stop the product's verified sending
// domain from being used to mail arbitrary links, attachments or CC lists.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EMAIL_RE = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/;
export const MAX_CC_EMAILS = 10;
export const DAILY_EMAIL_LIMIT = 100;

/** Valid, de-duplicated CC addresses (minus the main recipient), capped. */
export function sanitizeCcEmails(input: unknown, recipient?: string | null): string[] {
  if (!Array.isArray(input)) return [];
  const exclude = (recipient || "").trim().toLowerCase();
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const email = raw.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email) || email === exclude) continue;
    seen.add(email);
    if (seen.size >= MAX_CC_EMAILS) break;
  }
  return [...seen];
}

let warnedNoAppUrl = false;

/**
 * Returns the link only if it points at this app (same origin as APP_URL),
 * so an email button can never send a client to an attacker's site. Without
 * APP_URL configured any http(s) link is accepted, with a warning.
 */
export function appLinkOrNull(url: unknown): string | null {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const appUrl = Deno.env.get("APP_URL");
  if (!appUrl) {
    if (!warnedNoAppUrl) {
      console.warn("APP_URL is not set -- email links are not restricted to the app's origin");
      warnedNoAppUrl = true;
    }
    return parsed.toString();
  }
  try {
    return parsed.origin === new URL(appUrl).origin ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** True when base64 content decodes to a PDF (checks the %PDF- magic bytes). */
export function isPdfBase64(content: unknown): content is string {
  if (typeof content !== "string" || content.length < 8) return false;
  try {
    return atob(content.slice(0, 8)).startsWith("%PDF-");
  } catch {
    return false;
  }
}

/**
 * Records one send for the user and returns false once they've hit the daily
 * limit. Fails open if the quota RPC is unavailable so a missed migration
 * doesn't stop all email.
 */
export async function claimEmailQuota(userId: string): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return true;
  const admin = createClient(url, key);
  const { data, error } = await admin.rpc("claim_email_send_quota", {
    p_user_id: userId,
    p_limit: DAILY_EMAIL_LIMIT,
  });
  if (error) {
    console.error("Email quota check failed:", error.message);
    return true;
  }
  return data !== false;
}
