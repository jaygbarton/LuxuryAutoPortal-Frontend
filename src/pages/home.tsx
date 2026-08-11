import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { RotatingGoogleReviews } from "@/components/reviews/rotating-google-reviews";
import { type PublicLocation } from "@/lib/location-config";
import { Link } from "wouter";
import { ArrowRight, Car, ClipboardCheck, ExternalLink, UserPlus } from "lucide-react";

const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";
const readableTextShadow = "0 1px 2px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.82)";

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  return (
    <section className="relative overflow-hidden bg-black text-white lg:py-14">
      <div className="absolute inset-0 hidden lg:grid lg:grid-cols-2">
        <div className="relative min-h-[520px] lg:min-h-0">
          <img
            src="/list-your-car-key-handoff-enhanced.png"
            alt=""
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>
        <div className="relative min-h-[520px] lg:min-h-0">
          <img
            src="/rent-a-car-interior.jpg"
            alt=""
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/12" />
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/5 to-black/30" />
      <div className="absolute inset-y-0 left-1/2 hidden w-px bg-white/18 lg:block" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A017]/45 to-transparent" />
      <div className="relative mx-auto max-w-[1500px] lg:px-10">
        <div className="grid lg:grid-cols-2 lg:gap-6">
          <article className="relative grid min-h-[430px] place-items-center overflow-hidden bg-transparent p-4 sm:min-h-[460px] lg:min-h-[540px]">
            <img
              src="/list-your-car-key-handoff-enhanced.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover lg:hidden"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-black/8 lg:hidden" />
            <div className="relative w-full max-w-[560px] rounded-[6px] border border-white/25 bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-9 lg:p-10">
              <div className="absolute left-0 top-8 h-16 w-1 bg-[#D4A017]" />
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm"
                style={{ background: "rgba(212,160,23,0.72)", color: "#1A0E00", backdropFilter: "blur(18px)" }}
              >
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#E8B830", textShadow: readableTextShadow }}>
                Vehicle Management
              </p>
              <h2 className="mb-4 font-serif text-3xl font-bold text-white sm:text-4xl" style={{ textShadow: readableTextShadow }}>
                List your vehicle with us
              </h2>
              <p className="mb-6 max-w-xl text-sm leading-6 text-white/82 sm:text-base sm:leading-7" style={{ textShadow: readableTextShadow }}>
                Have a vehicle you want managed for rentals? Start with our owner
                onboarding page and our team will review the details with you.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={`${location.path}/onboarding`} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-management-get-started"
                  >
                    List Your Car
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <Link href={`${location.path}/contact`} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold transition-all hover:bg-white/5"
                    style={{ border: "1.5px solid #D4A017", color: "#E8B830", background: "transparent" }}
                    data-testid="button-management-info"
                  >
                    Info
                  </button>
                </Link>
              </div>
            </div>
          </article>

          <article className="relative grid min-h-[430px] place-items-center overflow-hidden bg-transparent p-4 sm:min-h-[460px] lg:min-h-[540px]">
            <img
              src="/rent-a-car-interior.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover lg:hidden"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-black/10 lg:hidden" />
            <div className="relative w-full max-w-[560px] rounded-[6px] border border-white/25 bg-white/[0.045] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_22px_80px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-9 lg:p-10">
              <div className="absolute left-0 top-8 h-16 w-1 bg-white/70" />
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm"
                style={{ background: "rgba(255,255,255,0.62)", color: "#8B6914", backdropFilter: "blur(18px)" }}
              >
                <Car className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#E8B830", textShadow: readableTextShadow }}>
                Rent a Vehicle
              </p>
              <h2 className="mb-4 font-serif text-3xl font-bold text-white sm:text-4xl" style={{ textShadow: readableTextShadow }}>
                Find a car for your trip
              </h2>
              <p className="mb-6 max-w-xl text-sm leading-6 text-white/82 sm:text-base sm:leading-7" style={{ textShadow: readableTextShadow }}>
                Browse our available vehicles, compare the options, and book through
                the vehicle's Turo listing when you are ready.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={location.fleetPath} onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-rental-fleet"
                  >
                    Our Fleet
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <a href={location.turoFleetUrl || TURO_VEHICLES_URL} target="_blank" rel="noopener noreferrer">
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold transition-all hover:bg-white/5"
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
        <div className="bg-black px-4 py-4 sm:px-6 lg:mt-6 lg:bg-transparent lg:p-0">
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
        <section className="flex min-h-[calc(100svh-68px)] items-center bg-[#0A0A0A] text-white">
          <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <p className="mb-3 text-xs font-bold uppercase tracking-[2px] sm:mb-4 sm:tracking-[3px]" style={{ color: "#E8B830" }}>
              {location.cityState}
            </p>
            <h1 className="font-serif text-3xl font-bold sm:text-6xl">Coming Soon</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70 sm:mt-6 sm:text-lg sm:leading-8">
              Golden Luxury Auto is preparing this location.
            </p>
            <div className="mx-auto mt-6 max-w-2xl rounded-md border border-white/10 bg-white/[0.06] p-4 sm:mt-8 sm:p-6">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#D4A017]/15 text-[#E8B830] sm:mb-4 sm:h-12 sm:w-12">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 className="font-serif text-xl font-bold sm:text-2xl">Interested in listing a vehicle in this location?</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">
                Join the launch list and we will notify you when {location.cityState} is ready for vehicle owners.
              </p>
              <Link href={`${location.path}/list-your-vehicle`}>
                <button
                  className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-all sm:min-h-[48px] sm:w-auto sm:px-6"
                  style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                >
                  Join Vehicle Owner List
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
            <div className="mt-6 sm:mt-8">
              <Link href="/">
                <button
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-all sm:min-h-[48px] sm:px-6"
                  style={{ border: "1px solid rgba(232,184,48,0.45)", color: "#E8B830", background: "transparent" }}
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
        <RotatingGoogleReviews surface="dark" />
      </main>
      <Footer />
    </div>
  );
}
