// Sender for all outgoing mail. EMAIL_FROM_ADDRESS must be an address on a
// domain verified in Resend (e.g. noreply@notifications.example.com).
export function emailFrom(displayName?: string | null): string {
  const address = Deno.env.get("EMAIL_FROM_ADDRESS");
  if (!address) throw new Error("EMAIL_FROM_ADDRESS secret is not set");
  // Keep user-controlled names (company names) from breaking the header.
  const name = (displayName || "").replace(/[<>"\r\n]/g, "").trim() || "Clientra";
  return `${name} <${address}>`;
}
