/**
 * Single source of truth for public marketing-site contact details, social
 * links, tagline, and legal URLs. Used by the footer and Contact page so the
 * info stays consistent everywhere.
 */

export const SITE_CONTACT = {
  emails: ["goldenluxuryauto@gmail.com", "golden@goldenluxuryauto.com"],
  phone: "1-800-346-1394",
  phoneHref: "tel:+18003461394",
  address: ["South 500 West", "Salt Lake City, Utah 84101"],
  hours: "Available by appointment",
};

export const SITE_TAGLINE =
  "Golden Luxury Auto manages premium rentals for guests and vehicle owners in Utah.";

export const SITE_STATS = [
  { label: "Trips Taken", value: "22,924" },
  { label: "5-Star Google Reviews", value: "2,800+" },
  { label: "Turo Rating", value: "4.9" },
  { label: "Turo Host", value: "All-Star" },
] as const;

export const LEGAL_LINKS = {
  privacy: "https://goldenluxuryauto.com/privacy-policy",
  terms: "https://goldenluxuryauto.com/terms-and-conditions/",
};

// Public social profiles for the footer. Update hrefs as accounts are confirmed.
export const SOCIAL_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/Goldenluxuryauto/" },
  { name: "Instagram", href: "https://www.instagram.com/goldenluxuryauto/?hl=en" },
  { name: "YouTube", href: "https://www.youtube.com/@goldenluxuryauto" },
  { name: "Pinterest", href: "https://ph.pinterest.com/goldenluxuryauto/" },
  { name: "LinkedIn", href: "https://linkedin.com/company/golden-luxury-auto" },
  { name: "Google", href: "https://share.google/RGquoSnT9QCjNI8ZH" },
] as const;
