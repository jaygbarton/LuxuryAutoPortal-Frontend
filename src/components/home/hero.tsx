import { Link } from "wouter";
import { ArrowRight, MapPin } from "lucide-react";
import { PUBLIC_LOCATIONS, type PublicLocation } from "@/lib/location-config";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";

interface HeroProps {
  location?: PublicLocation;
  mode?: "hub" | "location";
  showBackground?: boolean;
}

export function Hero({ location, mode = "location", showBackground = true }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#141512] text-white" data-public-hero>
      {showBackground && <>
        <img src="/homepage-hero-escalade.jpg" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[65%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
      </>}
      <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-36 sm:px-8 sm:pt-44 lg:pt-48">
        <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E0C791]">
          <span className="h-px w-10 bg-[#D3BC8D]" />{mode === "hub" ? "Golden Luxury Auto" : location?.cityState}
        </p>
        <div className="max-w-4xl">
          <h1 className="font-serif text-[clamp(3.3rem,7vw,7rem)] font-light leading-[1.02] tracking-tight">
            A remarkable drive.<br /><span className="italic text-[#E0C791]">An unforgettable stay.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
            {mode === "hub"
              ? "Find your destination. Choose your drive. Explore Golden Luxury Auto’s locations."
              : `Make more of your time in ${location?.name}. Discover premium vehicles for your next getaway, family trip, or everyday escape.`}
          </p>
        </div>
        {mode === "hub" ? (
          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(PUBLIC_LOCATIONS).map(item => (
              <Link key={item.id} href={item.path} data-testid={`button-location-${item.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-white/25 bg-black/30 p-4 hover:bg-white/10">
                <span>
                  <span className="block font-medium">{item.cityState}</span>
                  {item.comingSoon && <span className="text-xs text-[#E0C791]">Coming Soon</span>}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        ) : location && (
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={location.fleetPath} className="gla-public-button bg-[#D3BC8D] text-[#201B12] hover:bg-[#E3CCA0]" data-testid="button-hero-fleet">
              Explore the fleet <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`${location.path}/list-your-car`} className="gla-public-button border border-white/40 text-white hover:bg-white/10" data-testid="button-hero-owner">
              Earn with your vehicle <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
        <div className="mb-5 mt-10 flex flex-wrap items-center gap-5 text-xs text-white/70">
          <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#D3BC8D]" />{mode === "hub" ? "Choose your location" : location?.cityState}</span>
          {location && <>
            <Link href="/choose-location" data-testid="button-switch-location" className="underline underline-offset-4">Change location</Link>
            <Link href={`${location.path}/contact`} data-testid="button-contact-us" className="underline underline-offset-4">Talk to our team</Link>
          </>}
        </div>
        <div className="mt-12 border-t border-white/15 pt-6"><SiteStatsStrip variant="dark" /></div>
      </div>
    </section>
  );
}
