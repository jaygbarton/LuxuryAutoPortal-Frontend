import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, Gauge, Calendar, Fuel, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

// Top-3 featured vehicles come from GET /api/public/fleet/featured — the top
// active cars by the PREVIOUS month's rental income. Auto-updates monthly.
interface FeaturedCar {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  makeModel: string;
  color: string | null;
  mileage: number | null;
  fuelType: string | null;
  vehicleTrim: string | null;
  photo: string | null;
  turoLink: string | null;
}

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

function CarCard({ car }: { car: FeaturedCar }) {
  const imgSrc = car.photo ? getProxiedImageUrl(car.photo) : PLACEHOLDER_IMG;
  return (
    <Card
      className="group overflow-hidden hover-elevate transition-all duration-300"
      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "16px" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#E8D4A0"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#E5E5E5"; }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={imgSrc}
          alt={car.makeModel}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG; }}
        />
        <Badge
          className="absolute top-4 left-4 font-semibold"
          style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00", border: "none" }}
        >
          Featured
        </Badge>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <CardContent className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold" style={{ color: "#1C1C1C", fontFamily: "'Playfair Display', Georgia, serif" }}>
            {car.makeModel}
          </h3>
          {(car.vehicleTrim || car.color) && (
            <p className="text-sm" style={{ color: "#808080" }}>
              {[car.vehicleTrim, car.color].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Calendar className="w-4 h-4" style={{ stroke: "#d3bc8d" }} />
            <span>{car.year ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Gauge className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.mileage != null ? `${car.mileage.toLocaleString()} mi` : "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Fuel className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.fuelType || "—"}</span>
          </div>
        </div>

        {car.turoLink ? (
          <a href={car.turoLink} target="_blank" rel="noopener noreferrer">
            <button
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 group/btn"
              style={{ border: "1.5px solid #E8D4A0", background: "#FDF8EE", color: "#8B6914" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)"; el.style.color = "#1A0E00"; el.style.borderColor = "#D4A017"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "#FDF8EE"; el.style.color = "#8B6914"; el.style.borderColor = "#E8D4A0"; }}
            >
              Book Now
              <ExternalLink className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </a>
        ) : (
          <Link href="/fleet">
            <button
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 group/btn"
              style={{ border: "1.5px solid #E8D4A0", background: "#FDF8EE", color: "#8B6914" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)"; el.style.color = "#1A0E00"; el.style.borderColor = "#D4A017"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "#FDF8EE"; el.style.color = "#8B6914"; el.style.borderColor = "#E8D4A0"; }}
            >
              View Details
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function FeaturedCars() {
  const { data, isLoading } = useQuery<{ success: boolean; data: FeaturedCar[] }>({
    queryKey: ["/api/public/fleet/featured"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/public/fleet/featured"));
      if (!res.ok) throw new Error("Failed to load featured vehicles");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
  });

  const cars = data?.data ?? [];

  return (
    <section id="featured-fleet" className="py-20 lg:py-28" style={{ background: "#FFFDF8" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#C49000", letterSpacing: "3px" }}>
            Curated Selection
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold mb-4" style={{ color: "#1C1C1C" }}>
            Featured Vehicles
          </h2>
          <p className="max-w-2xl mx-auto" style={{ color: "#4A4A4A", fontSize: "16px", lineHeight: "1.65" }}>
            Our top-performing vehicles from last month — updated automatically.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C49000" }} />
          </div>
        ) : cars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        ) : (
          <p className="text-center" style={{ color: "#808080" }}>
            Explore our full collection below.
          </p>
        )}

        <div className="text-center mt-12">
          <Link href="/fleet">
            <button
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{ background: "none", border: "2px solid #D4A017", color: "#8B6914" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)"; el.style.color = "#1A0E00"; el.style.boxShadow = "0 4px 20px rgba(212,160,23,0.3)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "none"; el.style.color = "#8B6914"; el.style.boxShadow = "none"; }}
              data-testid="button-view-all-fleet"
            >
              View All Vehicles
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
