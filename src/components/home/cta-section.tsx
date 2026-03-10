import { Link } from "wouter";
import { ArrowRight, Phone } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?ixlib=rb-4.0.3&auto=format&fit=crop&w=2574&q=80')`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(28,20,8,0.55), rgba(28,20,8,0.88))",
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "#E8B830", letterSpacing: "3px" }}
        >
          Start Your Journey
        </p>
        <h2 className="font-serif text-3xl lg:text-5xl font-bold text-white mb-6">
          Ready to Find Your
          <span
            className="block mt-2"
            style={{
              background: "linear-gradient(135deg, #E8B830, #F0D060)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Dream Vehicle?
          </span>
        </h2>
        <p
          className="text-lg mb-10 max-w-2xl mx-auto"
          style={{ color: "rgba(255,255,255,0.7)", lineHeight: "1.65" }}
        >
          Our team of luxury automotive specialists is ready to help you find
          the perfect vehicle that matches your lifestyle and preferences.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/onboarding">
            <button
              className="inline-flex items-center gap-2 min-w-[200px] justify-center px-8 py-4 rounded-lg text-sm font-bold transition-all duration-300 group"
              style={{
                background: "linear-gradient(135deg, #D4A017, #E8B830)",
                color: "#1A0E00",
                border: "none",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "linear-gradient(135deg, #C49000, #D4A017)";
                el.style.boxShadow = "0 8px 32px rgba(212,160,23,0.4)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)";
                el.style.boxShadow = "none";
                el.style.transform = "translateY(0)";
              }}
              data-testid="button-cta-get-started"
            >
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </Link>
          <a href="tel:+1234567890">
            <button
              className="inline-flex items-center gap-2 min-w-[200px] justify-center px-8 py-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.2)";
                el.style.borderColor = "rgba(255,255,255,0.4)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(255,255,255,0.1)";
                el.style.borderColor = "rgba(255,255,255,0.25)";
              }}
              data-testid="button-cta-call"
            >
              <Phone className="w-4 h-4" />
              Call Us Now
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}
