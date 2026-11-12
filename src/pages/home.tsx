import { RentalJourney } from "@/components/home/rental-journey";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { RotatingGoogleReviews } from "@/components/reviews/rotating-google-reviews";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { type PublicLocation } from "@/lib/location-config";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Car, ClipboardCheck, ExternalLink, Sparkles, UserPlus } from "lucide-react";

const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  const reduceMotion = useReducedMotion();
  const options = [
    {
      eyebrow: "For vehicle owners",
      title: "Your vehicle. More possibility.",
      copy: "Put your vehicle in GLA’s managed rental program. Discuss your vehicle’s earning potential with our team, then explore the next steps.",
      image: "/list-your-car-key-handoff-enhanced.png",
      icon: ClipboardCheck,
      primary: "List Your Car",
      primaryHref: `${location.path}/onboarding`,
      secondary: "Management Info",
      secondaryHref: `${location.path}/contact`,
      testId: "button-management-get-started",
    },
    {
      eyebrow: "For your next trip",
      title: "Find your next great drive.",
      copy: "Explore the fleet and find a vehicle that fits your plans. View rental details and continue to booking on Turo.",
      image: "/rent-a-car-interior.jpg",
      icon: Car,
      primary: "Our Fleet",
      primaryHref: location.fleetPath,
      secondary: "Book on Turo",
      secondaryHref: location.turoFleetUrl || TURO_VEHICLES_URL,
      testId: "button-rental-fleet",
      externalSecondary: true,
    },
  ];
  const linkStyle = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#96712D] focus-visible:ring-offset-4";

  // Keep interactive content in normal document flow. The old fixed scroll scene
  // disabled pointer events at its boundaries and layered reviews over the CTAs.
  return (
    <section id="business-split" aria-labelledby="business-split-title" className="relative isolate bg-[#FBF9F4] text-[#242019]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(211,188,141,0.24),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-12 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#795B26]">
              <span aria-hidden="true" className="h-px w-9 bg-[#B19052]" /> The Golden Luxury experience
            </p>
            <h2 id="business-split-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl lg:text-6xl">One company.<br /><span className="text-[#96712D]">Two ways to go further.</span></h2>
          </div>
          <p className="max-w-sm text-base leading-7 text-[#625C50]">A vehicle for your next trip. A team to manage your own. Choose where you’d like to start.</p>
        </div>
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          {options.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article key={item.testId} className="group flex flex-col overflow-hidden rounded-2xl border border-[#E3DACA] bg-white shadow-[0_12px_40px_rgba(65,48,19,0.06)] transition-shadow hover:shadow-[0_18px_48px_rgba(65,48,19,0.12)]"
                initial={false} whileHover={reduceMotion ? undefined : { y: -4 }} transition={{ duration: 0.2 }}>
                <div className="relative aspect-[16/9] overflow-hidden sm:aspect-[2/1]">
                  <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.035]" />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-4 left-5 rounded-full border border-white/35 bg-black/35 px-4 py-2 text-xs font-medium tracking-wide text-white backdrop-blur-sm">{item.eyebrow}</span>
                  <span aria-hidden="true" className="absolute right-5 top-4 font-serif text-3xl text-white">0{index + 1}</span>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-8">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E8DDC8] bg-[#F8F3E8] text-[#886524]"><Icon aria-hidden="true" className="h-5 w-5" /></div>
                  <h3 className="font-serif text-3xl leading-tight sm:text-4xl">{item.title}</h3>
                  <p className="mb-7 mt-4 text-sm leading-7 text-[#625C50] sm:text-base">{item.copy}</p>
                  <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Link href={item.primaryHref} className={`${linkStyle} bg-[#D3BC8D] text-[#211B11] hover:bg-[#C6A86D]`} data-testid={item.testId}>{item.primary}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
                    {item.externalSecondary ? (
                      <a href={item.secondaryHref} target="_blank" rel="noopener noreferrer" className={`${linkStyle} border border-[#D9CBB1] hover:bg-[#FBF8F1]`} data-testid="button-rental-turo">{item.secondary}<ExternalLink aria-hidden="true" className="h-4 w-4" /><span className="sr-only"> (opens in a new tab)</span></a>
                    ) : (
                      <Link href={item.secondaryHref} className={`${linkStyle} border border-[#D9CBB1] hover:bg-[#FBF8F1]`} data-testid="button-management-info">{item.secondary}</Link>
                    )}
                    {item.externalSecondary && location.availablePages.detailShop && (
                      <Link href={`${location.path}/detail-shop`} className={`${linkStyle} text-[#795B26] hover:bg-[#FBF8F1]`} data-testid="button-rental-detail">Detail Shop<Sparkles aria-hidden="true" className="h-4 w-4" /></Link>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
      <div className="relative border-t border-[#E3DACA] bg-white">
        <RotatingGoogleReviews surface="light" className="bg-transparent" compact />
      </div>
    </section>
  );
}

function LocationHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="public-page">
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
      <main className="public-page pt-20 lg:pt-24">
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
              <Link href="/choose-location">
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
      <main className="public-page">
        <Hero location={location} />
        <section data-home-intro className="bg-[#FAF8F2] px-5 py-12 sm:px-8 lg:py-16" aria-labelledby="home-intro-title">
          <ScrollReveal preset="soft" className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#87632C]">Golden Luxury Auto · {location.name}</p>
              <h2 id="home-intro-title" className="scroll-mt-24 font-serif text-3xl leading-tight sm:text-4xl">More from every mile.</h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-[#626262]">Find a premium vehicle for your next getaway, family trip, or everyday escape in {location.name}. Have a vehicle of your own? Explore our car sharing program and talk with our team about its earning potential. We’re here to help you take the next step.</p>
          </ScrollReveal>
        </section>
        <FeaturedCars location={location} />
        <ServiceSplitSection location={location} />
        <ScrollReveal preset="soft" amount={0.16}>
          <Services location={location} />
        </ScrollReveal>
        <RentalJourney location={location} />
        <CTASection location={location} />
      </main>
      <Footer />
    </div>
  );
}
