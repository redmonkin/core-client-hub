// Deployment-specific public URLs. Self-hosters set these in .env; the
// fallbacks point at the upstream project.

/** Public origin of this deployment, used for canonical / og:url tags. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");

/** Source repository linked from the landing page. */
export const REPO_URL = (import.meta.env.VITE_REPO_URL || "https://github.com/redmonkin/core-client-hub").replace(/\/$/, "");

export const SELF_HOST_GUIDE_URL = `${REPO_URL}#self-hosting`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
