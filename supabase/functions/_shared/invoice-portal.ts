// Client-portal links for invoices, ported from src/lib/invoice-portal-access.ts
// (Deno has the same Web Crypto globals as the browser).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generatePortalPassword, hashPortalPassword } from "./portal-password.ts";

export const isSafeHttpUrl = (url: unknown): url is string =>
  typeof url === "string" && /^https?:\/\//i.test(url);

/** Creates a new 30-day token. Returns null when APP_URL isn't a usable URL. */
export async function createInvoicePortalToken(
  supabase: SupabaseClient,
  invoiceId: string,
  appUrl: string,
): Promise<{ link: string; password: string } | null> {
  if (!isSafeHttpUrl(appUrl)) return null;

  const tokenArray = new Uint8Array(32);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray, (b) => b.toString(16).padStart(2, "0")).join("");

  const password = generatePortalPassword();
  const passwordHash = await hashPortalPassword(password);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error } = await supabase.from("invoice_access_tokens").insert({
    invoice_id: invoiceId,
    token,
    expires_at: expiresAt.toISOString(),
    password_hash: passwordHash,
  });
  if (error) throw error;

  return { link: `${appUrl}/portal?token=${token}`, password };
}

/**
 * Reuses the newest unexpired token (its password was already sent to the
 * client, so it's returned as null) or creates a new one, like
 * getOrCreateInvoicePortalAccess in the app.
 */
export async function getOrCreateInvoicePortalLink(
  supabase: SupabaseClient,
  invoiceId: string,
  appUrl: string,
): Promise<{ link: string; password: string | null } | null> {
  if (!isSafeHttpUrl(appUrl)) return null;

  const { data: existing, error } = await supabase
    .from("invoice_access_tokens")
    .select("token")
    .eq("invoice_id", invoiceId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (existing) return { link: `${appUrl}/portal?token=${existing.token}`, password: null };
  return createInvoicePortalToken(supabase, invoiceId, appUrl);
}
