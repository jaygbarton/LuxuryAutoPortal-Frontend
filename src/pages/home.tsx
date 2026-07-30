import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { FeaturedCars } from "@/components/home/featured-cars";
import { Services } from "@/components/home/services";
import { CTASection } from "@/components/home/cta-section";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";

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
          <SiteStatsStrip />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <VideoSection />
        <FeaturedCars />
        <Services />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
