import { Link } from "wouter";
import { Mail, Phone, MapPin } from "lucide-react";

const quickLinks = [
  { href: "/fleet", label: "Our Fleet" },
  { href: "/onboarding", label: "Get Started" },
  { href: "/contact", label: "Contact Us" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

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
              Curating the world's finest automobiles for discerning collectors and enthusiasts.
            </p>
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
                  123 Luxury Lane<br />Beverly Hills, CA 90210
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 shrink-0" style={{ stroke: "#C49000" }} />
                <a
                  href="tel:+1234567890"
                  className="text-sm transition-colors"
                  style={{ color: "#4A4A4A" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4A4A4A"; }}
                  data-testid="link-footer-phone"
                >
                  +1 (234) 567-890
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 shrink-0" style={{ stroke: "#C49000" }} />
                <a
                  href="mailto:info@luxuryauto.com"
                  className="text-sm transition-colors"
                  style={{ color: "#4A4A4A" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4A4A4A"; }}
                  data-testid="link-footer-email"
                >
                  info@luxuryauto.com
                </a>
              </li>
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
            <ul className="space-y-2 text-sm" style={{ color: "#4A4A4A" }}>
              <li className="flex justify-between gap-4">
                <span>Monday – Friday</span>
                <span>9am – 7pm</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Saturday</span>
                <span>10am – 5pm</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Sunday</span>
                <span>By Appointment</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderTop: "1px solid #E8D4A0" }}
        >
          <p className="text-xs" style={{ color: "#808080" }}>
            &copy; {new Date().getFullYear()} Luxury Auto Gallery. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs transition-colors"
                style={{ color: "#808080" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C49000"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#808080"; }}
                data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
