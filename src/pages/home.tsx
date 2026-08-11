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

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  return (
    <section className="bg-[#0A0A0A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">
            Rental Operations + Vehicle Management
          </p>
          <h2 className="font-serif text-3xl font-light leading-tight sm:text-4xl lg:text-5xl">
            One company, two clean paths.
          </h2>
          <p className="mt-4 text-base leading-7 text-white/68">
            Rent from the fleet or put your vehicle into a managed program built for real day-to-day operations.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {[
            {
              eyebrow: "Vehicle Management",
              title: "List your vehicle with GLA",
              copy:
                "Owners get a managed rental program with fleet presentation, trip coordination, and ongoing operations handled by the team.",
              image: "/list-your-car-key-handoff-enhanced.png",
              icon: ClipboardCheck,
              primary: "List Your Car",
              primaryHref: `${location.path}/onboarding`,
              secondary: "Management Info",
              secondaryHref: `${location.path}/contact`,
              testId: "button-management-get-started",
            },
            {
              eyebrow: "Rent a Vehicle",
              title: "Book a premium rental",
              copy:
                "Guests can browse the fleet, compare the right fit, and book through the vehicle listing with clear trip support.",
              image: "/rent-a-car-interior.jpg",
              icon: Car,
              primary: "Our Fleet",
              primaryHref: location.fleetPath,
              secondary: "Book on Turo",
              secondaryHref: location.turoFleetUrl || TURO_VEHICLES_URL,
              testId: "button-rental-fleet",
              externalSecondary: true,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.eyebrow} className="overflow-hidden rounded-md border border-white/12 bg-white/[0.035]">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img src={item.image} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/42 via-black/12 to-transparent" />
                </div>
                <div className="p-6 sm:p-8">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-sm bg-[#D4A017] text-[#1A0E00]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">{item.eyebrow}</p>
                  <h3 className="font-serif text-3xl font-light leading-tight">{item.title}</h3>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">{item.copy}</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link href={item.primaryHref} onClick={scrollToTopOnNavigate}>
                      <button
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-bold transition-all hover:-translate-y-0.5"
                        style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                        data-testid={item.testId}
                      >
                        {item.primary}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </Link>
                    {item.externalSecondary ? (
                      <a href={item.secondaryHref} target="_blank" rel="noopener noreferrer">
                        <button
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold transition-all hover:bg-white/5"
                          style={{ border: "1px solid rgba(212,160,23,0.8)", color: "#E8B830", background: "transparent" }}
                          data-testid="button-rental-turo"
                        >
                          {item.secondary}
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </a>
                    ) : (
                      <Link href={item.secondaryHref} onClick={scrollToTopOnNavigate}>
                        <button
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold transition-all hover:bg-white/5"
                          style={{ border: "1px solid rgba(212,160,23,0.8)", color: "#E8B830", background: "transparent" }}
                          data-testid="button-management-info"
                        >
                          {item.secondary}
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10">
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
