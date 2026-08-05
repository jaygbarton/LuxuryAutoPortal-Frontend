import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { type PublicLocation } from "@/lib/location-config";
import { Link } from "wouter";
import { ArrowRight, Car, ClipboardCheck, ExternalLink } from "lucide-react";

const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  return (
    <section className="bg-[#0A0A0A] py-16 text-white lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-[#3A2A10] bg-[#111] lg:grid-cols-2">
          <article className="grid min-h-[560px] grid-rows-[260px_1fr] lg:min-h-[620px]">
            <div className="relative overflow-hidden">
              <img
                src="/list-your-car-key-handoff.jpg"
                alt="Vehicle key handoff for Golden Luxury Auto vehicle management"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
              >
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#E8B830" }}>
                Vehicle Management
              </p>
              <h2 className="mb-4 font-serif text-3xl font-bold text-white sm:text-4xl">
                List your vehicle with us
              </h2>
              <p className="mb-8 max-w-xl text-base leading-7 text-white/70">
                Have a vehicle you want managed for rentals? Start with our owner
                onboarding page and our team will review the details with you.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={`${location.path}/onboarding`} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-management-get-started"
                  >
                    List Your Car
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <Link href={`${location.path}/contact`} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all"
                    style={{ border: "1.5px solid #D4A017", color: "#E8B830", background: "transparent" }}
                    data-testid="button-management-info"
                  >
                    Info
                  </button>
                </Link>
              </div>
            </div>
          </article>

          <article className="grid min-h-[560px] grid-rows-[260px_1fr] border-t border-[#3A2A10] lg:min-h-[620px] lg:border-l lg:border-t-0">
            <div className="relative overflow-hidden">
              <img
                src="/rent-a-car-interior.jpg"
                alt="Luxury rental vehicle interior"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            <div className="flex flex-col justify-center bg-[#151515] p-7 sm:p-10 lg:p-12">
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: "#FFFFFF", color: "#8B6914" }}
              >
                <Car className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#E8B830" }}>
                Rent a Vehicle
              </p>
              <h2 className="mb-4 font-serif text-3xl font-bold text-white sm:text-4xl">
                Find a car for your trip
              </h2>
              <p className="mb-8 max-w-xl text-base leading-7 text-white/70">
                Browse our available vehicles, compare the options, and book through
                the vehicle's Turo listing when you are ready.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={location.fleetPath} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-rental-fleet"
                  >
                    Our Fleet
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <a href={location.turoFleetUrl || TURO_VEHICLES_URL} target="_blank" rel="noopener noreferrer">
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all"
                    style={{ border: "1.5px solid #D4A017", color: "#E8B830", background: "transparent" }}
                    data-testid="button-rental-turo"
                  >
                    Book on Turo
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </a>
              </div>
            </div>
          </article>
        </div>
        <div className="mt-6">
          <SiteStatsStrip variant="dark" />
        </div>
      </div>
    </section>
  );
}

function LocationHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero mode="hub" />
      </main>
      <Footer />
    </div>
  );
}

function ComingSoon({ location }: { location: PublicLocation }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="flex min-h-[calc(100vh-68px)] items-center bg-[#0A0A0A] text-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-[3px]" style={{ color: "#E8B830" }}>
              {location.cityState}
            </p>
            <h1 className="font-serif text-4xl font-bold sm:text-6xl">Coming Soon</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
              Golden Luxury Auto is preparing this location.
            </p>
            <div className="mt-10">
              <Link href="/">
                <button
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition-all"
                  style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                >
                  Select Location
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function Home({ location }: { location?: PublicLocation }) {
  if (!location) return <LocationHub />;
  if (location.comingSoon) return <ComingSoon location={location} />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero location={location} />
        <ServiceSplitSection location={location} />
        <FeaturedCars location={location} />
        <Services location={location} />
        <CTASection location={location} />
      </main>
      <Footer />
    </div>
  );
}
