import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { type PublicLocation } from "@/lib/location-config";
import { Link } from "wouter";
import { ArrowRight, Car, ClipboardCheck, ExternalLink, Star } from "lucide-react";

const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  return (
    <section className="relative overflow-hidden bg-[#090909] py-10 text-white lg:py-14">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A017]/45 to-transparent" />
      <div className="absolute left-0 top-24 h-[360px] w-[24vw] bg-gradient-to-r from-[#D4A017]/12 to-transparent" />
      <div className="absolute bottom-20 right-0 h-[360px] w-[24vw] bg-gradient-to-l from-white/7 to-transparent" />
      <div className="relative mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <article className="group grid min-h-[480px] overflow-hidden rounded-[6px] bg-[#111] shadow-[0_24px_90px_rgba(0,0,0,0.35)] ring-1 ring-white/10 lg:min-h-[540px] lg:grid-rows-[0.95fr_0.85fr]">
            <div className="relative min-h-[230px] overflow-hidden">
              <img
                src="/list-your-car-key-handoff.jpg"
                alt="Vehicle key handoff for Golden Luxury Auto vehicle management"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            </div>
            <div className="relative flex flex-col justify-center p-7 sm:p-9 lg:p-10">
              <div className="absolute left-0 top-8 h-16 w-1 bg-[#D4A017]" />
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm"
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
              <p className="mb-6 max-w-xl text-base leading-7 text-white/70">
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

          <article className="group grid min-h-[480px] overflow-hidden rounded-[6px] bg-[#151515] shadow-[0_24px_90px_rgba(0,0,0,0.35)] ring-1 ring-white/10 lg:min-h-[540px] lg:grid-rows-[0.95fr_0.85fr]">
            <div className="relative min-h-[230px] overflow-hidden">
              <img
                src="/rent-a-car-interior.jpg"
                alt="Luxury rental vehicle interior"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            <div className="relative flex flex-col justify-center bg-[#151515] p-7 sm:p-9 lg:p-10">
              <div className="absolute left-0 top-8 h-16 w-1 bg-white/70" />
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm"
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
              <p className="mb-6 max-w-xl text-base leading-7 text-white/70">
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
        <div className="mt-6">
          <SiteStatsStrip variant="dark" />
        </div>
      </div>
    </section>
  );
}

const homeTestimonials = [
  {
    name: "Sinthia Kabir",
    date: "15/08/2025",
    quote:
      "I had a great experience with their service. They have clear instructions I had no issues finding the car. They drop the car within very short notice which was really helpful. Car was clean and smells great. I will definitely book with them again.",
  },
  {
    name: "Melissa Rose Stoltzfus",
    date: "08/08/2025",
    quote: "Great experience, will use them again when in the area.",
  },
  {
    name: "Faatupuinati Muliumu",
    date: "22/08/2025",
    quote:
      "First class service, highly recommended. The service was impeccable, had a last minute trip to Salt Lake City for a family event and Jay and his team went above and beyond.",
  },
  {
    name: "Tony LoPresto",
    date: "15/08/2025",
    quote: "We had a great experience renting in Salt Lake City! It could not have been an easier experience. 5 stars!",
  },
];

function HomeTestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % homeTestimonials.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="overflow-hidden bg-[#0A0A0A] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[3px]" style={{ color: "#E8B830" }}>
              Customer Testimonials
            </p>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">What guests say after the trip</h2>
          </div>
          <div className="flex gap-2">
            {homeTestimonials.map((item, index) => (
              <button
                key={item.name}
                aria-label={`Show testimonial from ${item.name}`}
                onClick={() => setActiveIndex(index)}
                className="h-2.5 w-8 rounded-full transition-all"
                style={{ background: index === activeIndex ? "#D4A017" : "rgba(255,255,255,0.22)" }}
              />
            ))}
          </div>
        </div>

        <div className="relative min-h-[250px] overflow-hidden rounded-[6px] border border-white/10 bg-[#111]">
          {homeTestimonials.map((item, index) => (
            <article
              key={item.name}
              className="absolute inset-0 grid content-center gap-5 p-7 transition-all duration-700 sm:p-10 lg:p-12"
              style={{
                opacity: index === activeIndex ? 1 : 0,
                transform: `translateX(${(index - activeIndex) * 18}px)`,
                pointerEvents: index === activeIndex ? "auto" : "none",
              }}
            >
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star key={starIndex} className="h-5 w-5 fill-[#D4A017] text-[#D4A017]" />
                ))}
              </div>
              <p className="max-w-5xl text-xl leading-8 text-white/82 sm:text-2xl sm:leading-10">
                "{item.quote}"
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-white">{item.name}</span>
                <span className="h-1 w-1 rounded-full bg-[#D4A017]" />
                <span className="text-white/58">{item.date}</span>
              </div>
            </article>
          ))}
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
        <HomeTestimonialsSection />
      </main>
      <Footer />
    </div>
  );
}
