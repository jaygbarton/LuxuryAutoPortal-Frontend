import { Shield, Truck, Headphones, FileCheck, Sparkles, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const services = [
  {
    icon: Shield,
    title: "Certified Quality",
    description: "Every vehicle undergoes a rigorous 200-point inspection by our master technicians.",
  },
  {
    icon: Truck,
    title: "Worldwide Delivery",
    description: "White-glove delivery service to any destination, fully insured and tracked.",
  },
  {
    icon: Headphones,
    title: "Concierge Service",
    description: "Dedicated personal advisor to guide you through every step of your purchase.",
  },
  {
    icon: FileCheck,
    title: "Complete Documentation",
    description: "Full service history, provenance documentation, and authenticity certificates.",
  },
  {
    icon: Sparkles,
    title: "Detailing Excellence",
    description: "Professional detailing and preparation before every delivery.",
  },
  {
    icon: Clock,
    title: "Extended Warranty",
    description: "Comprehensive warranty options for complete peace of mind.",
  },
];

export function Services() {
  return (
    <section className="py-20 lg:py-28" style={{ background: "#fff" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-3"
            style={{ color: "#C49000", letterSpacing: "3px" }}
          >
            Why Choose Us
          </p>
          <h2
            className="font-serif text-3xl lg:text-4xl font-bold mb-4"
            style={{ color: "#1C1C1C" }}
          >
            The Luxury Experience
          </h2>
          <p
            className="max-w-2xl mx-auto"
            style={{ color: "#4A4A4A", fontSize: "16px", lineHeight: "1.65" }}
          >
            Beyond exceptional vehicles, we deliver an unparalleled ownership experience
            tailored to the most discerning clientele.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card
                key={index}
                className="hover-elevate group transition-all duration-300 relative overflow-hidden"
                style={{
                  background: "#FFFDF8",
                  border: "1px solid #E8D4A0",
                  borderRadius: "16px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#D4A017";
                  el.style.transform = "translateY(-3px)";
                  el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
                  const bar = el.querySelector(".gold-top-bar") as HTMLElement | null;
                  if (bar) bar.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#E8D4A0";
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                  const bar = el.querySelector(".gold-top-bar") as HTMLElement | null;
                  if (bar) bar.style.opacity = "0";
                }}
              >
                {/* Gold top accent bar on hover */}
                <div
                  className="gold-top-bar absolute top-0 left-0 right-0 h-[3px] transition-opacity duration-300"
                  style={{
                    background: "linear-gradient(90deg, #D4A017, #E8B830)",
                    opacity: 0,
                  }}
                />
                <CardContent className="p-6 lg:p-8">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background: "linear-gradient(135deg, #D4A017, #E8B830)",
                      boxShadow: "0 4px 12px rgba(212,160,23,0.25)",
                    }}
                  >
                    <Icon className="w-6 h-6" style={{ stroke: "#1A0E00", fill: "none", strokeWidth: 1.8 }} />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: "#1C1C1C" }}
                  >
                    {service.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#4A4A4A" }}
                  >
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
