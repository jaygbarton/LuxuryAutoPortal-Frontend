import { Link } from "wouter";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  const scrollToFleet = () => {
    document.getElementById("featured-fleet")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2574&q=80')`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(15,12,8,0.4), rgba(15,12,8,0.75) 60%, rgba(15,12,8,0.95))",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{
            background: "rgba(212,160,23,0.15)",
            border: "1px solid rgba(212,160,23,0.4)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{
              background: "#E8B830",
              boxShadow: "0 0 8px #D4A017",
            }}
          />
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ color: "#E8B830", letterSpacing: "1px" }}
          >
            Exclusive Collection Available
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-white mb-6">
          Experience
          <span
            className="block mt-2"
            style={{
              background: "linear-gradient(135deg, #E8B830, #F0D060, #D4A017)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Automotive Excellence
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg sm:text-xl leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.7)" }}>
          Discover our curated collection of the world's most prestigious luxury vehicles.
          Each car tells a story of craftsmanship, performance, and timeless elegance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/fleet">
            <Button
              size="lg"
              className="min-w-[180px] group font-bold"
              style={{
                background: "linear-gradient(135deg, #D4A017, #E8B830)",
                color: "#1A0E00",
                border: "none",
              }}
              data-testid="button-explore-fleet"
            >
              Explore Fleet
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              size="lg"
              variant="outline"
              className="min-w-[180px] font-medium"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
              }}
              data-testid="button-contact-us"
            >
              Contact Us
            </Button>
          </Link>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <button
            onClick={scrollToFleet}
            className="flex flex-col items-center gap-2 transition-colors group"
            style={{ color: "rgba(255,255,255,0.4)" }}
            data-testid="button-scroll-down"
          >
            <span className="text-xs tracking-widest uppercase">Scroll to explore</span>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </button>
        </div>
      </div>
    </section>
  );
}
