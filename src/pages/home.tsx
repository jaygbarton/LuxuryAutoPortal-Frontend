import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { RotatingGoogleReviews } from "@/components/reviews/rotating-google-reviews";
import { type PublicLocation } from "@/lib/location-config";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Car, ClipboardCheck, ExternalLink, Sparkles, UserPlus } from "lucide-react";

const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

function ServiceSplitSection({ location }: { location: PublicLocation }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isSceneActive, setIsSceneActive] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const splitY = useTransform(scrollYProgress, [0, 0.54, 0.78], shouldReduceMotion ? [0, 0, 0] : ["18vh", "-17vh", "-33vh"]);
  const reviewY = useTransform(scrollYProgress, [0.2, 0.44, 0.82], shouldReduceMotion ? [0, 0, 0] : ["24vh", "0vh", "-8vh"]);
  const splitOpacity = useTransform(scrollYProgress, [0, 0.34, 0.5], [1, 1, 0]);
  const reviewOpacity = useTransform(scrollYProgress, [0.34, 0.48, 0.84, 0.94], [0, 1, 1, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.12, 0.86, 1], [0.88, 1, 1, 0.94]);
  const imageScale = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [1, 1] : [1.04, 1.11]);
  const shadeOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.52, 0.36, 0.5]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.03, 0.94, 1], [0, 1, 1, 0]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setIsSceneActive(latest > 0.01 && latest < 0.98);
  });
  const businessOptions = [
    {
      eyebrow: "Vehicle Management",
      title: "List your vehicle with GLA",
      copy:
        "We'll manage the rental process while you sit back and reap the benefits.",
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
      title: "Premium rental or detail",
      copy:
        "Choose from GLA's premium fleet, compare the right fit, or book a clean detail appointment.",
      image: "/rent-a-car-interior.jpg",
      icon: Car,
      primary: "Our Fleet",
      primaryHref: location.fleetPath,
      secondary: "Book on Turo",
      secondaryHref: location.turoFleetUrl || TURO_VEHICLES_URL,
      tertiary: "Detail Shop",
      tertiaryHref: `${location.path}/detail-shop`,
      testId: "button-rental-fleet",
      externalSecondary: true,
    },
  ];

  return (
    <section id="business-split" ref={sectionRef} className="cinematic-scroll-section relative bg-[#050505] text-white lg:min-h-[285svh]">
      <div className="relative overflow-hidden lg:hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/homepage-hero-escalade.jpg')" }}
        />
        <div className="absolute inset-0 bg-[#050505]/72" />
        <div className="relative z-10 px-4 py-14">
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">
              Rental Operations + Vehicle Management
            </p>
            <h2 className="font-serif text-3xl font-light leading-tight">
              One company, two businesses.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/74">
              Rent from the fleet or put your vehicle into a managed program built for real day-to-day operations.
            </p>
          </div>

          <div className="space-y-5">
            {businessOptions.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.eyebrow} className="overflow-hidden rounded-md border border-white/16 bg-[#090909]/84 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img src={item.image} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/48 via-black/18 to-transparent" />
                  </div>
                  <div className="p-5">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-sm bg-[#D4A017] text-[#1A0E00]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">{item.eyebrow}</p>
                    <h3 className="font-serif text-2xl font-light leading-tight">{item.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-white/72">{item.copy}</p>
                    <div className="mt-6 flex flex-col gap-3">
                      <Link href={item.primaryHref} onClick={scrollToTopOnNavigate}>
                        <button
                          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-bold"
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
                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold"
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
                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold"
                            style={{ border: "1px solid rgba(212,160,23,0.8)", color: "#E8B830", background: "transparent" }}
                            data-testid="button-management-info"
                          >
                            {item.secondary}
                          </button>
                        </Link>
                      )}
                      {item.tertiary && item.tertiaryHref ? (
                        <Link href={item.tertiaryHref} onClick={scrollToTopOnNavigate}>
                          <button
                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm bg-white px-6 text-sm font-bold text-[#171717]"
                            data-testid="button-rental-detail"
                          >
                            {item.tertiary}
                            <Sparkles className="h-4 w-4" />
                          </button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-white/16 bg-[#070707]/80 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <RotatingGoogleReviews surface="dark" className="bg-transparent" compact />
          </div>
          <div className="mt-5">
            <SiteStatsStrip variant="dark" />
          </div>
        </div>
      </div>

      <motion.div
        className={`hidden lg:block lg:h-svh lg:overflow-hidden ${
          isSceneActive ? "lg:fixed lg:inset-0" : "lg:absolute lg:inset-x-0 lg:top-0"
        }`}
        style={{ opacity: sceneOpacity, pointerEvents: isSceneActive ? "auto" : "none" }}
      >
        <motion.div
          className="absolute inset-0 bg-cover bg-[center_58%] bg-no-repeat will-change-transform"
          style={{
            backgroundImage: "url('/homepage-hero-escalade.jpg')",
            scale: imageScale,
          }}
        />
        <motion.div className="absolute inset-0 bg-[#050505]" style={{ opacity: shadeOpacity }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(232,184,48,0.2),transparent_28%),linear-gradient(180deg,rgba(5,5,5,0.06),rgba(5,5,5,0.78))]" />

        <motion.div
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8"
          style={{ opacity: contentOpacity }}
        >
          <motion.div style={{ y: splitY, opacity: splitOpacity }} className="will-change-transform">
            <div className="mb-8 max-w-3xl sm:mb-10">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">
                Rental Operations + Vehicle Management
              </p>
              <h2 className="font-serif text-3xl font-light leading-tight sm:text-4xl lg:text-5xl">
                One company, two businesses.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/74">
                Rent from the fleet or put your vehicle into a managed program built for real day-to-day operations.
              </p>
            </div>

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
              {businessOptions.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.article
                    key={item.eyebrow}
                    className="group overflow-hidden rounded-md border border-white/16 bg-[#090909]/78 shadow-[0_28px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 26 }}
                    whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.62, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img src={item.image} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/48 via-black/18 to-transparent" />
                    </div>
                    <div className="p-5 sm:p-7 lg:p-8">
                      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-sm bg-[#D4A017] text-[#1A0E00]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#D4A017]">{item.eyebrow}</p>
                      <h3 className="font-serif text-2xl font-light leading-tight sm:text-3xl">{item.title}</h3>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-white/72 sm:text-base sm:leading-7">{item.copy}</p>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                        {item.tertiary && item.tertiaryHref ? (
                          <Link href={item.tertiaryHref} onClick={scrollToTopOnNavigate}>
                            <button
                              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm bg-white px-6 text-sm font-bold text-[#171717] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                              data-testid="button-rental-detail"
                            >
                              {item.tertiary}
                              <Sparkles className="h-4 w-4" />
                            </button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            style={{ y: reviewY, opacity: reviewOpacity }}
            className="absolute inset-x-4 bottom-8 will-change-transform sm:inset-x-6 lg:inset-x-8"
          >
            <div className="rounded-md border border-white/16 bg-[#070707]/76 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <RotatingGoogleReviews surface="dark" className="bg-transparent" compact />
            </div>
            <div className="mt-5">
              <SiteStatsStrip variant="dark" />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function AnimatedHomeSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 34 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
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
        <ServiceSplitSection location={location} />
        <AnimatedHomeSection>
          <FeaturedCars location={location} />
        </AnimatedHomeSection>
        <AnimatedHomeSection>
          <Services location={location} />
        </AnimatedHomeSection>
        <AnimatedHomeSection>
          <CTASection location={location} />
        </AnimatedHomeSection>
      </main>
      <Footer />
    </div>
  );
}
