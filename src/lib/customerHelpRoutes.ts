/** Chat visibility only. Does not grant route or API access. Keep in sync with App.tsx. */
export const CUSTOMER_HELP_PUBLIC_PATHS = [
  "/choose-location",
  "/salt-lake-city",
  "/wilmington-nc",
  "/myrtle-beach-sc/list-your-vehicle",
  "/charleston-sc/list-your-vehicle",
  "/myrtle-beach-sc",
  "/charleston-sc",
  "/fleet",
  "/salt-lake-city/fleet",
  "/wilmington-nc/fleet",
  "/myrtle-beach-sc/fleet",
  "/charleston-sc/fleet",
  "/salt-lake-city/pick-up-and-drop-off",
  "/salt-lake-city/detail-shop/book",
  "/salt-lake-city/detail-shop",
  "/salt-lake-city/chauffeur-services",
  "/salt-lake-city/cybercab",
  "/salt-lake-city/meet-us",
  "/salt-lake-city/deals",
  "/salt-lake-city/jobs/apply",
  "/salt-lake-city/jobs",
  "/salt-lake-city/suggested-cars",
  "/salt-lake-city/testimonials",
  "/salt-lake-city/reviews-options",
  "/salt-lake-city/reviews",
  "/salt-lake-city/extras",
  "/salt-lake-city/privacy-policy",
  "/salt-lake-city/terms-and-conditions",
  "/salt-lake-city/terms",
  "/salt-lake-city/onboarding",
  "/salt-lake-city/contact",
  "/wilmington-nc/testimonials",
  "/wilmington-nc/reviews-options",
  "/wilmington-nc/reviews",
  "/wilmington-nc/extras",
  "/wilmington-nc/privacy-policy",
  "/wilmington-nc/terms-and-conditions",
  "/wilmington-nc/terms",
  "/wilmington-nc/onboarding",
  "/wilmington-nc/contact",
  "/detail-shop/book",
  "/detail-shop",
  "/chauffeur-services",
  "/pick-up-and-drop-off",
  "/deals",
  "/jobs/apply",
  "/jobs",
  "/privacy-policy",
  "/terms-and-conditions",
  "/terms",
  "/testimonials",
  "/reviews-options",
  "/reviews",
  "/extras",
  "/suggested-cars",
  "/onboarding",
  "/contact",
  "/employee-form",
  "/co-host-form",
  "/",
  "/login",
  "/admin/login",
  "/signup",
  "/reset-password",
] as const;

export const CUSTOMER_HELP_OWNER_PATTERNS = [
  /^\/(dashboard|profile|tutorial|cars)$/,
  /^\/client\/(dashboard|my-car-tracking|trip-history|trip-calendar|offboarding-form|geofence-zones|vehicle-trips|vehicle-behavior|account|profile|cars|record-and-files|earnings\/details|earnings-calculator)$/,
  /^\/admin\/view-car\/[^/]+$/,
  /^\/admin\/cars\/[^/]+(?:\/(earnings|depreciation|purchase|graphs|calculator|totals|records|payments|income-expense))?$/,
  /^\/admin\/cars\/[^/]+\/records\/[^/]+\/files$/,
  /^\/admin\/(forms|settings|car-block-off|testimonials|turo-guide|news-media|notifications)$/,
] as const;

// Co-hosts use some admin-prefixed fleet/account pages and may have isAdmin=true.
// Staff management tools remain excluded. Shared Operations/profile routes have
// a separate customer-context AND existing route-permission check below.
export const CUSTOMER_HELP_COHOST_PATTERNS = [
  ...CUSTOMER_HELP_OWNER_PATTERNS,
  /^\/cohost\/training-manual$/,
  /^\/admin\/(co-host-profile|my-co-host-cars|income-expenses|payments|payment-status|co-host-payments|totals|turo-trips|trip-calendar|bouncie|bouncie-trips|bouncie-geofence)$/,
  /^\/admin\/cars\/[^/]+\/expenses$/,
] as const;

export interface CustomerHelpUser {
  isAdmin?: boolean; isEmployee?: boolean; isClient?: boolean; isCoHost?: boolean; isSuperAdmin?: boolean;
  viewAsClient?: { clientId?: number }; viewAsCoHost?: { coHostId?: number }; viewAsEmployee?: { employeeId?: number };
}

/** Proactive invitations belong on public marketing pages only. Keep the native
 * help circle available on its existing account/token routes without prompting. */
export function customerHelpTeaserAllowed(location: string): boolean {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return (CUSTOMER_HELP_PUBLIC_PATHS as readonly string[]).includes(path)
    && !['/login', '/admin/login', '/signup', '/reset-password', '/employee-form', '/co-host-form'].includes(path)
    && !path.endsWith('/onboarding');
}

// Existing vehicle workflows, matching OperationsPage's TAB_IDS. Unknown/future
// tabs fail closed for chat until their customer scope has been reviewed.
export const CUSTOMER_HELP_OPERATIONS_TABS = [
  'trips', 'turo-inspection', 'inspections', 'claims', 'ticket-violation',
  'towing-impound', 'maintenance', 'service-due', 'completed', 'car-repaired',
  'car-block-off', 'day-schedule', 'tv-timeline',
] as const;

export function customerHelpAllowed(location: string, user?: CustomerHelpUser | null): boolean {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if ((CUSTOMER_HELP_PUBLIC_PATHS as readonly string[]).includes(path) || /^\/(sign-contract|maintenance-approval)\/[^/]+$/.test(path)) return true;
  if (!user || user.viewAsEmployee?.employeeId) return false;
  if (path === '/admin/profile' || path === '/admin/operations') {
    const customerContext = !!(user.isCoHost || user.isClient || user.viewAsClient?.clientId || user.viewAsCoHost?.coHostId);
    // Both routes already admit admin-flagged customers/co-hosts. Client-only
    // accounts still use /profile and cannot enter these routes. Plain admins
    // and employees do not get customer chat. This check grants no page access.
    if (!customerContext || user.isAdmin !== true) return false;
    if (path === '/admin/profile') return true;
    const search = location.split('#', 1)[0].split('?')[1] || '';
    const tab = new URLSearchParams(search).get('tab') || 'trips';
    return (CUSTOMER_HELP_OPERATIONS_TABS as readonly string[]).includes(tab);
  }
  if (user.viewAsClient?.clientId) return CUSTOMER_HELP_OWNER_PATTERNS.some(pattern => pattern.test(path));
  if (user.isCoHost || user.viewAsCoHost?.coHostId) return CUSTOMER_HELP_COHOST_PATTERNS.some(pattern => pattern.test(path));
  if (user.isAdmin || user.isSuperAdmin || user.isEmployee) return false;
  return user.isClient === true && CUSTOMER_HELP_OWNER_PATTERNS.some(pattern => pattern.test(path));
}
