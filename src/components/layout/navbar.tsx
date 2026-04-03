import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, Car, Phone, FileText, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildApiUrl } from "@/lib/queryClient";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/fleet", label: "Our Fleet", icon: Car },
  { href: "/onboarding", label: "Get Started", icon: FileText },
  { href: "/contact", label: "Contact", icon: Phone },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  // Check if user is already logged in
  const { data: authData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const isLoggedIn = !!authData?.user;

  return (
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
            href="/"
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
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium transition-colors relative group"
                style={{
                  color: location === link.href ? "#C49000" : "#4A4A4A",
                  textDecoration: "none",
                  letterSpacing: "0.3px",
                }}
                data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute bottom-0 left-4 right-4 h-0.5 transition-transform origin-left",
                    location === link.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  )}
                  style={{ background: "#D4A017", borderRadius: "1px" }}
                />
              </Link>
            ))}
          </div>

          {/* Desktop action buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href={isLoggedIn ? "/dashboard" : "/admin/login"}>
              <button
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                style={{
                  background: "none",
                  border: "1.5px solid #E5E5E5",
                  color: "#1C1C1C",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "#D4A017";
                  el.style.color = "#C49000";
                  el.style.background = "#FDF8EE";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "#E5E5E5";
                  el.style.color = "#1C1C1C";
                  el.style.background = "none";
                }}
                data-testid="button-login"
              >
                {isLoggedIn ? "Dashboard" : "Login"}
              </button>
            </Link>
            <Link href="/onboarding">
              <button
                className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, #D4A017, #E8B830)",
                  color: "#1A0E00",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "linear-gradient(135deg, #C49000, #D4A017)";
                  el.style.boxShadow = "0 4px 20px rgba(212,160,23,0.3)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)";
                  el.style.boxShadow = "none";
                }}
                data-testid="button-get-started"
              >
                Get Started
              </button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2"
            style={{ color: "#1C1C1C" }}
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-mobile-menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 top-[68px] z-40 flex flex-col p-6 gap-2"
          style={{ background: "#fff", borderBottom: "2px solid #D4A017" }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors"
                style={{
                  color: location === link.href ? "#C49000" : "#4A4A4A",
                  background: location === link.href ? "#FDF8EE" : "transparent",
                }}
                onClick={() => setIsOpen(false)}
                data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
          <div
            className="mt-6 pt-6 space-y-2"
            style={{ borderTop: "1px solid #E8D4A0" }}
          >
            <Link href={isLoggedIn ? "/dashboard" : "/admin/login"} className="w-full">
              <button
                className="w-full py-3 rounded-lg text-sm font-medium transition-all"
                style={{ background: "none", border: "1.5px solid #E8D4A0", color: "#C49000" }}
                onClick={() => setIsOpen(false)}
                data-testid="button-mobile-login"
              >
                {isLoggedIn ? "Dashboard" : "Login"}
              </button>
            </Link>
            <Link href="/onboarding" className="w-full">
              <button
                className="w-full py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, #D4A017, #E8B830)",
                  color: "#1A0E00",
                  border: "none",
                }}
                onClick={() => setIsOpen(false)}
                data-testid="button-mobile-get-started"
              >
                Get Started
              </button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
