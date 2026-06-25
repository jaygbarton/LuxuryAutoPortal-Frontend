import { Link } from "wouter";
import { Mail, Phone, MapPin, Clock, Facebook, Instagram, Youtube, Music2 } from "lucide-react";
import { SITE_CONTACT, SITE_TAGLINE, LEGAL_LINKS, SOCIAL_LINKS } from "@/lib/site-config";

const quickLinks = [
  { href: "/fleet", label: "Our Fleet" },
  { href: "/onboarding", label: "Get Started" },
  { href: "/contact", label: "Contact Us" },
];

const legalLinks = [
  { href: LEGAL_LINKS.privacy, label: "Privacy Policy" },
  { href: LEGAL_LINKS.terms, label: "Terms of Service" },
];

const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  Facebook,
  Instagram,
  YouTube: Youtube,
  TikTok: Music2,
};

export function Footer() {
  return (
    <footer
      style={{
        background: "#FFFDF8",
        borderTop: "3px solid #D4A017",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex flex-col mb-4" data-testid="link-footer-logo">
              <span
                className="font-serif text-xl font-bold"
                style={{ color: "#1C1C1C" }}
              >
                <span style={{ color: "#C49000" }}>Golden</span> Luxury Auto
              </span>
              <span
                className="text-xs font-bold tracking-widest"
                style={{ color: "#D4A017", letterSpacing: "2.5px" }}
              >
                GALLERY
              </span>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
              {SITE_TAGLINE}
            </p>

            {/* Social media */}
            <div className="flex items-center gap-3 mt-5">
              {SOCIAL_LINKS.map((s) => {
                const Icon = SOCIAL_ICONS[s.name] ?? Facebook;
                return (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    title={s.name}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                    style={{ border: "1px solid #E8D4A0", color: "#C49000" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#C49000"; (e.currentTarget as HTMLAnchorElement).style.color = "#FFFDF8"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: "#C49000", letterSpacing: "2.5px" }}
            >
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: "#4A4A4A", textDecoration: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4A4A4A"; }}
                    data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: "#C49000", letterSpacing: "2.5px" }}
            >
              Contact
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ stroke: "#C49000" }} />
                <span className="text-sm" style={{ color: "#4A4A4A" }}>
                  {SITE_CONTACT.address[0]}<br />{SITE_CONTACT.address[1]}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 shrink-0" style={{ stroke: "#C49000" }} />
                <a
                  href={SITE_CONTACT.phoneHref}
                  className="text-sm transition-colors"
                  style={{ color: "#4A4A4A" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4A4A4A"; }}
                  data-testid="link-footer-phone"
                >
                  {SITE_CONTACT.phone}
                </a>
              </li>
              {SITE_CONTACT.emails.map((email) => (
                <li key={email} className="flex items-center gap-3">
                  <Mail className="w-4 h-4 shrink-0" style={{ stroke: "#C49000" }} />
                  <a
                    href={`mailto:${email}`}
                    className="text-sm transition-colors break-all"
                    style={{ color: "#4A4A4A" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4A4A4A"; }}
                  >
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: "#C49000", letterSpacing: "2.5px" }}
            >
              Hours
            </h3>
            <div className="flex items-center gap-3 text-sm" style={{ color: "#4A4A4A" }}>
              <Clock className="w-4 h-4 shrink-0" style={{ stroke: "#C49000" }} />
              <span>{SITE_CONTACT.hours}</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderTop: "1px solid #E8D4A0" }}
        >
          <p className="text-xs" style={{ color: "#808080" }}>
            &copy; {new Date().getFullYear()} Golden Luxury Auto. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {legalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs transition-colors"
                style={{ color: "#808080" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#808080"; }}
                data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
