import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { PUBLIC_LOCATIONS, type PublicLocation } from "@/lib/location-config";
import { Link } from "wouter";
import { ArrowRight, MapPin } from "lucide-react";

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
  const locations = [PUBLIC_LOCATIONS.slc, PUBLIC_LOCATIONS.wilmington];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#0A0A0A] text-white">
          <div className="absolute inset-0 opacity-40">
            <img src="/homepage-hero-escalade.jpg" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/75 to-black" />
          </div>
          <div className="relative mx-auto grid min-h-[calc(100vh-68px)] max-w-7xl content-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">
                Golden Luxury Auto
              </p>
              <h1 className="font-serif text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl">
                Choose Your Location
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
                Select the market you are in to see the right fleet, services, offers, and contact path.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {locations.map((item) => (
                <Link
                  key={item.id}
                  href={item.path}
                  className="group rounded-lg border border-white/15 bg-white/[0.06] p-6 text-white transition-all hover:border-[#D4A017] hover:bg-white/[0.1]"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#D4A017] text-[#1A0E00]">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-5 w-5 text-[#D3BC8D] transition-transform group-hover:translate-x-1" />
                  </div>
                  <h2 className="font-serif text-3xl font-bold">{item.cityState}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    View the {item.cityState} fleet and available local pages.
                  </p>
                </Link>
              ))}
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
