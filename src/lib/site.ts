// Deployment-specific public URLs. Self-hosters set these in .env; the
// fallbacks point at the upstream project.

/** Public origin of this deployment, used for canonical / og:url tags. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/$/, "");

/** Source repository linked from the landing page. */
export const REPO_URL = (import.meta.env.VITE_REPO_URL || "https://github.com/redmonkin/core-client-hub").replace(/\/$/, "");

export const SELF_HOST_GUIDE_URL = `${REPO_URL}/blob/main/docs/self-hosting.md`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/** Shown when free sign-ups are full ("contact us"). Optional. */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || "").trim();

/** Cloudflare Turnstile site key; enables the CAPTCHA on auth forms (optional). */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
