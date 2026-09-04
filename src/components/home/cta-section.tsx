import { Link } from "wouter";
import { ArrowRight, Car, Phone } from "lucide-react";
import type { PublicLocation } from "@/lib/location-config";

export function CTASection({ location }: { location: PublicLocation }) {
  return (
    <section className="no-view-reveal relative isolate overflow-hidden bg-[#050505] py-14 lg:py-20">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bmw-x6-cta.jpg')",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(10,7,3,0.84) 0%, rgba(10,7,3,0.62) 48%, rgba(10,7,3,0.32) 100%), linear-gradient(180deg, rgba(10,7,3,0.3), rgba(10,7,3,0.72))",
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "#E8B830", letterSpacing: "3px" }}
        >
          Start Your Journey
        </p>
        <h2 className="font-serif text-3xl lg:text-5xl font-bold text-white mb-6">
          Ready to Find Your
          <span
            className="block mt-2"
            style={{
              background: "linear-gradient(135deg, #E8B830, #F0D060)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Right Vehicle?
          </span>
        </h2>
        <p
          className="text-lg mb-10 max-w-2xl mx-auto"
          style={{ color: "rgba(255,255,255,0.7)", lineHeight: "1.65" }}
        >
          Tell us what you need and our team will help you choose a vehicle
          that fits the trip, timing, and pickup plan.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href={`${location.path}/onboarding`}>
            <button
              className="inline-flex items-center gap-2 min-w-[200px] justify-center px-8 py-4 rounded-lg text-sm font-bold transition-all duration-300 group"
              style={{
                background: "linear-gradient(135deg, #D4A017, #E8B830)",
                color: "#1A0E00",
                border: "none",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "linear-gradient(135deg, #C49000, #D4A017)";
                el.style.boxShadow = "0 8px 32px rgba(212,160,23,0.4)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)";
                el.style.boxShadow = "none";
                el.style.transform = "translateY(0)";
              }}
              data-testid="button-cta-get-started"
            >
              List Your Car
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </Link>
          <Link href={location.fleetPath}>
            <button
              className="inline-flex items-center gap-2 min-w-[200px] justify-center px-8 py-4 rounded-lg text-sm font-bold transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.96)",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#1A0E00",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#ffffff";
                el.style.boxShadow = "0 8px 32px rgba(255,255,255,0.22)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.96)";
                el.style.boxShadow = "none";
                el.style.transform = "translateY(0)";
              }}
              data-testid="button-cta-rent-car"
            >
              <Car className="w-4 h-4" />
              Rent a Car
            </button>
          </Link>
          <a href="tel:+1234567890">
            <button
              className="inline-flex items-center gap-2 min-w-[200px] justify-center px-8 py-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.2)";
                el.style.borderColor = "rgba(255,255,255,0.4)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.1)";
                el.style.borderColor = "rgba(255,255,255,0.25)";
              }}
              data-testid="button-cta-call"
            >
              <Phone className="w-4 h-4" />
              Call Us Now
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}
