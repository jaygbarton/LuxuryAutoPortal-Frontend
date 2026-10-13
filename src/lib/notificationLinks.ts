const LEGACY_FRONTEND_ORIGIN = "https://luxury-auto-portal-frontend.vercel.app";
const COMPANY_FRONTEND_ORIGINS = new Set([
  "https://goldenluxuryauto.com",
  "https://www.goldenluxuryauto.com",
]);

/** Keep stored links to the old production alias on the current company site. */
export function normalizeNotificationLink(link: string, currentOrigin: string): string {
  if (!COMPANY_FRONTEND_ORIGINS.has(currentOrigin)) return link;

  try {
    const url = new URL(link);
    if (url.origin === LEGACY_FRONTEND_ORIGIN) {
      // A root-relative path must not become a protocol-relative destination.
      return url.pathname.replace(/^\/+/, "/") + url.search + url.hash;
    }
  } catch {
    // Relative links and existing invalid-link fallback keep their behavior.
  }

  return link;
}
