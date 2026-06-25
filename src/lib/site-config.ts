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
  hours: "24/7 Always Available",
};

export const SITE_TAGLINE =
  "We are the leaders in car management. We specialize in renting cars to our clients, while you make money off your car.";

export const LEGAL_LINKS = {
  privacy: "https://goldenluxuryauto.com/privacy-policy",
  terms: "https://goldenluxuryauto.com/terms-and-conditions/",
};

// Public social profiles for the footer. Update hrefs as accounts are confirmed.
export const SOCIAL_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/goldenluxuryauto" },
  { name: "Instagram", href: "https://www.instagram.com/goldenluxuryauto" },
  { name: "TikTok", href: "https://www.tiktok.com/@goldenluxuryauto" },
  { name: "YouTube", href: "https://www.youtube.com/@goldenluxuryauto" },
] as const;
