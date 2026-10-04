/**
 * Returns the URL only if it is an absolute http(s) link. Use for any
 * user-supplied link rendered as an href: React still renders `javascript:`
 * URLs, which would run script on our origin when clicked.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Normalises a typed website ("example.com" -> "https://example.com"); null if unusable. */
export function normalizeWebsiteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeHttpUrl(withScheme);
}

/** Returns the colour if it is a hex value (#rgb … #rrggbbaa), else the fallback. Brand colours end up in style values. */
export function safeHexColor(color: string | null | undefined, fallback: string): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color.trim()) ? color.trim() : fallback;
}
