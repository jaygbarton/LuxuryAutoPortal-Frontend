import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { type PublicLocation } from "@/lib/location-config";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

function VideoSection() {
  return (
    <section className="bg-black py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="mb-2 font-serif text-3xl font-light text-[#FFD700] lg:text-4xl">
          Experience Golden Luxury Auto
        </h2>
        <p className="mb-8 text-white/60">
          See why our fleet stands apart
        </p>
        <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-xl shadow-2xl">
          <iframe
            className="absolute inset-0 h-full w-full"
            src="https://www.youtube.com/embed/jsdo0yDeFCs?si=Le_SJZ8P7cqyx2Bn"
            title="Golden Luxury Auto"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
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
        <VideoSection />
        <FeaturedCars location={location} />
        <Services location={location} />
        <CTASection location={location} />
      </main>
      <Footer />
    </div>
  );
}
