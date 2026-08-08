import { Link } from "wouter";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBLIC_LOCATIONS, type PublicLocation } from "@/lib/location-config";

export function Hero({ location, mode = "location" }: { location?: PublicLocation; mode?: "hub" | "location" }) {
  const scrollToFleet = () => {
    document.getElementById("featured-fleet")?.scrollIntoView({ behavior: "smooth" });
  };
  const locations = [
    PUBLIC_LOCATIONS.slc,
    PUBLIC_LOCATIONS.wilmington,
    PUBLIC_LOCATIONS.myrtle,
    PUBLIC_LOCATIONS.charleston,
  ];

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('/homepage-hero-escalade.jpg')`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(15,12,8,0.4), rgba(15,12,8,0.75) 60%, rgba(15,12,8,0.95))",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-6 pt-20 text-center sm:px-6 sm:pb-8 sm:pt-24 lg:px-8 lg:pt-20">
        <div
          className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 sm:mb-8 sm:px-4"
          style={{
            background: "rgba(212,160,23,0.15)",
            border: "1px solid rgba(212,160,23,0.4)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{
              background: "#E8B830",
              boxShadow: "0 0 8px #D4A017",
            }}
          />
          <span
            className="truncate text-xs font-semibold tracking-wide sm:text-sm"
            style={{ color: "#E8B830", letterSpacing: "1px" }}
          >
            {mode === "hub" ? "Golden Luxury Auto Locations" : `${location?.cityState} Car Rentals`}
          </span>
        </div>

        <h1 className="mb-3 font-serif text-2xl font-bold leading-tight text-white sm:mb-6 sm:text-6xl lg:text-7xl">
          Experience
          <span
            className="mt-1 block sm:mt-2"
            style={{
              background: "linear-gradient(135deg, #E8B830, #F0D060, #D4A017)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Luxury Car Rentals
          </span>
        </h1>

        <p className="mx-auto mb-5 max-w-2xl text-sm leading-6 sm:mb-10 sm:text-xl sm:leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          Browse a practical selection of premium vehicles for trips, events, airport
          travel, and everyday transportation {mode === "hub" ? "across active and upcoming locations" : `around ${location?.name}`}.
        </p>

        {mode === "hub" ? (
          <div className="mx-auto max-w-5xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[2px] sm:mb-4 sm:tracking-[3px]" style={{ color: "#E8B830" }}>
              Select Location to Continue
            </p>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              {locations.map((item) => (
                <Link key={item.id} href={item.path}>
                  <button
                    className="group flex min-h-[54px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-all sm:min-h-[84px] sm:px-5 sm:py-4"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      borderColor: "rgba(232,184,48,0.35)",
                      color: "#fff",
                    }}
                    data-testid={`button-location-${item.id}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10"
                        style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                      >
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold sm:text-base">{item.cityState}</span>
                        {item.comingSoon ? (
                          <span className="block text-xs font-medium sm:mt-1" style={{ color: "rgba(255,255,255,0.62)" }}>
                            Coming Soon
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
              ))}
            </div>
          </div>
        ) : location ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/">
            <Button
              size="lg"
              className="min-w-[180px] group font-bold"
              style={{
                background: "linear-gradient(135deg, #D4A017, #E8B830)",
                color: "#1A0E00",
                border: "none",
              }}
              data-testid="button-switch-location"
            >
              Switch Location
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href={`${location.path}/contact`}>
            <Button
              size="lg"
              variant="outline"
              className="min-w-[180px] font-medium"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
              }}
              data-testid="button-contact-us"
            >
              Contact Us
            </Button>
          </Link>
          </div>
        ) : null}
      </div>

      {mode === "location" ? <div className="hidden sm:block absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={scrollToFleet}
          className="flex flex-col items-center gap-2 transition-colors group"
          style={{ color: "rgba(255,255,255,0.4)" }}
          data-testid="button-scroll-down"
        >
          <span className="text-xs tracking-widest uppercase">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </div> : null}
    </section>
  );
}
