import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Car, Phone, FileText, Home, Sparkles, BadgePercent, BriefcaseBusiness, Star, PlusCircle, Navigation, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPublicLocationFromPath, withLocationPath } from "@/lib/location-config";
import { UserAccountMenu } from "@/components/layout/user-account-menu";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fleet", label: "Our Fleet", icon: Car },
  { href: "/pick-up-and-drop-off", label: "Pick Up/Drop Off", icon: Navigation },
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
  const [isPagesOpen, setIsPagesOpen] = useState(false);
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
  const primaryLinks = links.filter((link) => link.href === "/" || link.href === "/fleet" || link.href === "/contact");
  const pageLinks = links.filter((link) => !primaryLinks.some((primary) => primary.href === link.href));
  const isPagesActive = pageLinks.some((link) => location === withLocationPath(link.href, publicLocation));

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
            {primaryLinks.slice(0, 2).map((link) => {
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
            {pageLinks.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setIsPagesOpen(true)}
                onMouseLeave={() => setIsPagesOpen(false)}
              >
                <button
                  type="button"
                  className="relative flex items-center gap-1 px-2.5 py-2 text-sm font-medium transition-colors xl:px-3"
                  style={{
                    color: isPagesActive || isPagesOpen ? "#C49000" : "#4A4A4A",
                  }}
                  onClick={() => setIsPagesOpen((open) => !open)}
                  onFocus={() => setIsPagesOpen(true)}
                  data-testid="button-nav-pages"
                >
                  Pages
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isPagesOpen ? "rotate-180" : "rotate-0")} />
                  <span
                    className={cn(
                      "absolute bottom-0 left-2.5 right-2.5 h-0.5 origin-left transition-transform xl:left-3 xl:right-3",
                      isPagesActive || isPagesOpen ? "scale-x-100" : "scale-x-0"
                    )}
                    style={{ background: "#D4A017", borderRadius: "1px" }}
                  />
                </button>

                {isPagesOpen && (
                  <div
                    className="absolute left-1/2 top-full z-[70] mt-3 w-[260px] -translate-x-1/2 rounded-md border bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                    style={{ borderColor: "#E8D4A0" }}
                  >
                    {pageLinks.map((link) => {
                      const Icon = link.icon;
                      const href = withLocationPath(link.href, publicLocation);
                      const active = location === href;
                      return (
                        <Link
                          key={link.href}
                          href={href}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                          style={{
                            color: active ? "#C49000" : "#4A4A4A",
                            background: active ? "#FDF8EE" : "transparent",
                            textDecoration: "none",
                          }}
                          onClick={() => setIsPagesOpen(false)}
                          data-testid={`link-nav-pages-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 truncate">{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {primaryLinks.slice(2).map((link) => {
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
