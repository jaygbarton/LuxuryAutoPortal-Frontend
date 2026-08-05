import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Car, Phone, FileText, Home, Sparkles, BadgePercent, BriefcaseBusiness, Star, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPublicLocationFromPath, withLocationPath } from "@/lib/location-config";
import { UserAccountMenu } from "@/components/layout/user-account-menu";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fleet", label: "Our Fleet", icon: Car },
  { href: "/detail-shop", label: "Detail Shop", icon: Sparkles },
  { href: "/extras", label: "Extras", icon: PlusCircle },
  { href: "/deals", label: "Deals", icon: BadgePercent },
  { href: "/testimonials", label: "Testimonials", icon: Star },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/onboarding", label: "List Your Car", icon: FileText },
  { href: "/suggested-cars", label: "Suggested Cars", icon: Car },
  { href: "/contact", label: "Contact", icon: Phone },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const publicLocation = getPublicLocationFromPath(location);
  const links = navLinks.filter((link) => {
    if (!publicLocation) return link.href === "/" || link.href === "/contact";
    if (publicLocation.comingSoon) return link.href === "/";
    if (link.href === "/detail-shop") return publicLocation.availablePages.detailShop;
    if (link.href === "/deals") return publicLocation.availablePages.deals;
    if (link.href === "/jobs") return publicLocation.availablePages.jobs;
    if (link.href === "/suggested-cars") return publicLocation.availablePages.suggestedCars;
    return true;
  });

  return (
    <>
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid #E5E5E5",
        height: "68px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between h-full">
          <Link
            href={publicLocation?.path ?? "/"}
            className="flex items-center"
            data-testid="link-logo"
          >
            <img
              src="/logo.png"
              alt="Golden Luxury Auto"
              className="w-[140px] md:w-[180px] h-auto object-contain"
              style={{ filter: "drop-shadow(0 0 12px rgba(212,160,23,0.35))" }}
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {links.map((link) => {
              const href = withLocationPath(link.href, publicLocation);
              return (
              <Link
                key={link.href}
                href={href}
                className="px-2.5 xl:px-3 py-2 text-sm font-medium transition-colors relative group"
                style={{
                  color: location === href ? "#C49000" : "#4A4A4A",
                  textDecoration: "none",
                }}
                data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute bottom-0 left-2.5 right-2.5 xl:left-3 xl:right-3 h-0.5 transition-transform origin-left",
                    location === href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  )}
                  style={{ background: "#D4A017", borderRadius: "1px" }}
                />
              </Link>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <UserAccountMenu context="public" />
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <UserAccountMenu context="public" className="h-9 w-9" />
            <button
              className="p-2"
              style={{ color: "#1C1C1C" }}
              onClick={() => setIsOpen(!isOpen)}
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </nav>

      {/* Mobile menu — must be a sibling of <nav>, not a child, because the
          parent <nav> uses `backdrop-filter`, which on iOS Safari creates a
          new containing block for `position: fixed` descendants and would
          trap the menu at 68px tall. */}
      {isOpen && (
        <div
          className="lg:hidden fixed left-0 right-0 bottom-0 z-[60] flex flex-col p-6 gap-2 overflow-y-auto"
          style={{
            top: "68px",
            backgroundColor: "#ffffff",
            borderBottom: "2px solid #D4A017",
          }}
        >
          {links.map((link) => {
            const Icon = link.icon;
            const href = withLocationPath(link.href, publicLocation);
            return (
              <Link
                key={link.href}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors"
                style={{
                  color: location === href ? "#C49000" : "#4A4A4A",
                  background: location === href ? "#FDF8EE" : "transparent",
                }}
                onClick={() => setIsOpen(false)}
                data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
