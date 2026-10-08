// One layout and a small set of blocks for every email Clientra sends, so they
// all share the same structure, typography, colours and footer.
//
// Two kinds of email use it:
//   * client-facing (proposals, contracts, invoices, reminders): branded with
//     the sender's company name, logo and colour from branding_settings;
//   * account emails to Clientra users (status updates, expiry reminders,
//     team invitations): branded as Clientra.
//
// Everything is inline-styled tables, which is what email clients render
// reliably. All text passed to the helpers is escaped unless the parameter is
// named `html`.

export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const CLIENTRA_BLUE = "#0284C5";
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const C = {
  page: "#F1F5F9",
  card: "#FFFFFF",
  border: "#E2E8F0",
  panel: "#F8FAFC",
  heading: "#0F172A",
  text: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
};

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<Exclude<Tone, "brand">, { fg: string; bg: string; border: string }> = {
  success: { fg: "#15803D", bg: "#F0FDF4", border: "#16A34A" },
  warning: { fg: "#B45309", bg: "#FFFBEB", border: "#D97706" },
  danger: { fg: "#B91C1C", bg: "#FEF2F2", border: "#DC2626" },
  neutral: { fg: "#475569", bg: "#F8FAFC", border: "#94A3B8" },
};

export interface EmailBrand {
  name: string;
  logoUrl: string | null;
  color: string;
}

function appUrl(): string | null {
  const raw = (Deno.env.get("APP_URL") || "").trim().replace(/\/+$/, "");
  return /^https:\/\//i.test(raw) ? raw : null;
}

/** Clientra's own branding, for emails to Clientra users. */
export function clientraBrand(): EmailBrand {
  const base = appUrl();
  return { name: "Clientra", logoUrl: base ? `${base}/pwa-192x192.png` : null, color: CLIENTRA_BLUE };
}

function safeHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null;
}

/** Only logos in this project's public storage, never arbitrary (tracking) images. */
function safeLogo(value: unknown): string | null {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  if (!base || typeof value !== "string") return null;
  return value.startsWith(`${base}/storage/v1/object/public/`) ? value : null;
}

/** The sender's branding (branding_settings row), for client-facing emails. */
export function senderBrand(
  branding: { company_name?: string | null; company_logo_url?: string | null; primary_color?: string | null } | null | undefined,
  fallbackName: string,
): EmailBrand {
  return {
    name: (branding?.company_name || "").trim() || fallbackName,
    logoUrl: safeLogo(branding?.company_logo_url),
    color: safeHex(branding?.primary_color) || CLIENTRA_BLUE,
  };
}

/** Black or white, whichever reads better on the given background colour. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0F172A" : "#FFFFFF";
}

function toneColor(tone: Tone, brand: EmailBrand): string {
  return tone === "brand" ? brand.color : TONES[tone].border;
}

// ---------------------------------------------------------------------------
// Blocks. Each returns an HTML string to pass to renderEmail({ content }).
// ---------------------------------------------------------------------------

/** A paragraph of already-built HTML. */
export const paragraphHtml = (html: string, opts: { muted?: boolean; small?: boolean } = {}) =>
  `<p style="margin:0 0 16px;font-size:${opts.small ? 14 : 15}px;line-height:1.6;color:${opts.muted ? C.muted : C.text};">${html}</p>`;

/** Plain text, escaped; blank lines start new paragraphs. */
export const paragraphs = (text: string, opts: { muted?: boolean; small?: boolean } = {}) =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => paragraphHtml(escapeHtml(para).replace(/\n/g, "<br>"), opts))
    .join("");

export const greeting = (name: string | null | undefined) =>
  paragraphHtml(name && name.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,");

export const strong = (text: unknown) => `<strong style="color:${C.heading};">${escapeHtml(text)}</strong>`;

/** Label/value rows in a panel, with an optional large highlighted figure on top. */
export function summary(opts: {
  title?: string;
  highlight?: { label: string; value: string } | null;
  rows: Array<[string, string | null | undefined]>;
}): string {
  const rows = opts.rows.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  const title = opts.title
    ? `<tr><td colspan="2" style="padding:0 0 12px;font-size:16px;font-weight:600;color:${C.heading};">${escapeHtml(opts.title)}</td></tr>`
    : "";
  const highlight = opts.highlight
    ? `<tr><td colspan="2" style="padding:0 0 ${rows.length ? 14 : 0}px;">
         <div style="font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">${escapeHtml(opts.highlight.label)}</div>
         <div style="font-size:26px;font-weight:700;line-height:1.3;color:${C.heading};">${escapeHtml(opts.highlight.value)}</div>
       </td></tr>`
    : "";
  const body = rows
    .map(([label, value], i) => {
      const line = i ? `border-top:1px solid ${C.border};` : "";
      // Long values (e.g. objectives) get their own full-width line.
      if (String(value).length > 32) {
        return `<tr><td colspan="2" style="padding:8px 0;${line}">
          <div style="font-size:14px;color:${C.muted};">${escapeHtml(label)}</div>
          <div style="margin-top:2px;font-size:14px;line-height:1.55;color:${C.heading};">${escapeHtml(value)}</div>
        </td></tr>`;
      }
      return `<tr>
        <td style="padding:8px 12px 8px 0;font-size:14px;color:${C.muted};vertical-align:top;${line}">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;font-weight:600;color:${C.heading};text-align:right;vertical-align:top;${line}">${escapeHtml(value)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:${C.panel};border:1px solid ${C.border};border-radius:10px;">
    <tr><td style="padding:18px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${title}${highlight}${body}</table></td></tr>
  </table>`;
}

/** A list of items (e.g. expiring proposals), each with a title, a details line and an optional badge. */
export function itemList(items: Array<{ title: string; meta: string[]; badge?: { text: string; tone: Tone } | null }>, brand: EmailBrand): string {
  const rows = items
    .map(
      (item, i) => `<tr><td style="padding:14px 16px;${i ? `border-top:1px solid ${C.border};` : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top;">
            <div style="font-size:15px;font-weight:600;color:${C.heading};">${escapeHtml(item.title)}</div>
            <div style="margin-top:2px;font-size:13px;color:${C.muted};">${item.meta.filter(Boolean).map(escapeHtml).join(" &middot; ")}</div>
          </td>
          ${item.badge ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">${badge(item.badge.text, item.badge.tone, brand)}</td>` : ""}
        </tr></table>
      </td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid ${C.border};border-radius:10px;">${rows}</table>`;
}

export function badge(text: string, tone: Tone, brand: EmailBrand): string {
  const t = tone === "brand" ? { fg: brand.color, bg: C.panel } : TONES[tone];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${t.bg};color:${t.fg};font-size:12px;font-weight:600;border:1px solid ${tone === "brand" ? brand.color : TONES[tone].border}33;">${escapeHtml(text)}</span>`;
}

/** A highlighted note, e.g. the client's requested changes. */
export function note(label: string, text: string, tone: Exclude<Tone, "brand"> = "neutral"): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
    <tr><td style="padding:14px 16px;background:${t.bg};border-left:4px solid ${t.border};border-radius:0 8px 8px 0;">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${t.fg};">${escapeHtml(label)}</div>
      <div style="margin-top:6px;font-size:14px;line-height:1.6;color:${C.text};">${escapeHtml(text).replace(/\n/g, "<br>")}</div>
    </td></tr>
  </table>`;
}

/** The main call to action. Renders nothing if the link is missing. */
export function button(href: string | null | undefined, label: string, brand: EmailBrand): string {
  if (!href || !/^https?:\/\//i.test(href)) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
    <tr><td style="border-radius:8px;background:${brand.color};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${textOn(brand.color)};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** The password for a protected client-portal link. */
export const portalPassword = (password: string | null | undefined, fallback?: string) =>
  password
    ? paragraphHtml(`Access password: <strong style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:1px;color:${C.heading};">${escapeHtml(password)}</strong>`, { small: true, muted: true })
    : fallback
      ? paragraphHtml(escapeHtml(fallback), { small: true, muted: true })
      : "";

export const signoff = (fromName: string, closing = "Regards,") =>
  `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:${C.text};">${escapeHtml(closing)}<br>${strong(fromName)}</p>`;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function renderEmail(opts: {
  brand: EmailBrand;
  /** Small label above the title, e.g. "Invoice" or "Reminder". */
  eyebrow?: string;
  title: string;
  /** Accent colour of the top bar and eyebrow. Defaults to the brand colour. */
  tone?: Tone;
  /** Inbox preview text. */
  preheader?: string;
  content: string;
  /** Line under the card, e.g. who sent it and why. */
  footer: string;
}): string {
  const { brand } = opts;
  const accent = toneColor(opts.tone ?? "brand", brand);
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:8px;object-fit:contain;border:0;">`
    : `<div style="width:32px;height:32px;border-radius:8px;background:${brand.color};color:${textOn(brand.color)};font-size:16px;font-weight:700;line-height:32px;text-align:center;">${escapeHtml(brand.name.charAt(0).toUpperCase() || "C")}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 4px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">${logo}</td>
            <td style="vertical-align:middle;padding-left:10px;font-size:16px;font-weight:600;color:${C.heading};">${escapeHtml(brand.name)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
          <div style="height:4px;line-height:4px;font-size:0;background:${accent};border-radius:12px 12px 0 0;">&nbsp;</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 28px 16px;">
            ${opts.eyebrow ? `<div style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${accent};">${escapeHtml(opts.eyebrow)}</div>` : ""}
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;line-height:1.3;color:${C.heading};">${escapeHtml(opts.title)}</h1>
            ${opts.content}
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:${C.faint};">${opts.footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Footer for emails a Clientra user sends to their client. */
export const senderFooter = (fromName: string) => `Sent by ${escapeHtml(fromName)}`;

/** Footer for emails Clientra sends to its own users. */
export const accountFooter = (reason: string, opts: { manageLink?: boolean } = {}) => {
  const base = appUrl();
  const link = opts.manageLink !== false && base
    ? `<br><a href="${escapeHtml(base)}/profile" style="color:${C.faint};text-decoration:underline;">Manage email notifications</a>`
    : "";
  return `${escapeHtml(reason)}${link}`;
};
