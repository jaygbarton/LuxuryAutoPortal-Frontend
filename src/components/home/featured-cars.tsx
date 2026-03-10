import { Link } from "wouter";
import { ArrowRight, Gauge, Calendar, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Car } from "@/types/car";

const featuredCars: Partial<Car>[] = [
  {
    id: "1",
    make: "Porsche",
    model: "911 GT3 RS",
    year: 2024,
    price: "249950.00",
    mileage: 1200,
    exteriorColor: "GT Silver Metallic",
    engine: "4.0L Flat-6",
    transmission: "7-Speed PDK",
    fuelType: "Gasoline",
    featured: true,
    status: "available",
    images: ["https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
  {
    id: "2",
    make: "Ferrari",
    model: "SF90 Stradale",
    year: 2023,
    price: "625000.00",
    mileage: 850,
    exteriorColor: "Rosso Corsa",
    engine: "4.0L Twin-Turbo V8 Hybrid",
    transmission: "8-Speed Dual-Clutch",
    fuelType: "Hybrid",
    featured: true,
    status: "available",
    images: ["https://images.unsplash.com/photo-1583121274602-3e2820c69888?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
  {
    id: "3",
    make: "Lamborghini",
    model: "Huracán Tecnica",
    year: 2024,
    price: "335000.00",
    mileage: 500,
    exteriorColor: "Verde Mantis",
    engine: "5.2L V10",
    transmission: "7-Speed Dual-Clutch",
    fuelType: "Gasoline",
    featured: true,
    status: "available",
    images: ["https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
];

function formatPrice(price: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));
}

function CarCard({ car }: { car: Partial<Car> }) {
  return (
    <Card
      className="group overflow-hidden hover-elevate transition-all duration-300"
      style={{
        background: "#fff",
        border: "1px solid #E5E5E5",
        borderRadius: "16px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E8D4A0";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E5E5E5";
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={car.images?.[0] || "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"}
          alt={`${car.make} ${car.model}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {car.featured && (
          <Badge
            className="absolute top-4 left-4 font-semibold"
            style={{
              background: "linear-gradient(135deg, #D4A017, #E8B830)",
              color: "#1A0E00",
              border: "none",
            }}
          >
            Featured
          </Badge>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: "#1C1C1C", fontFamily: "'Playfair Display', Georgia, serif" }}>
              {car.make} {car.model}
            </h3>
            <p className="text-sm" style={{ color: "#808080" }}>{car.exteriorColor}</p>
          </div>
          <p className="text-xl font-bold whitespace-nowrap" style={{ color: "#C49000" }}>
            {formatPrice(String(car.price || "0"))}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Calendar className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.year}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Gauge className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.mileage?.toLocaleString()} mi</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Fuel className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.fuelType}</span>
          </div>
        </div>

        <Link href={`/fleet/${car.id}`}>
          <button
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-300 group/btn"
            style={{
              border: "1.5px solid #E8D4A0",
              background: "#FDF8EE",
              color: "#8B6914",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)";
              el.style.color = "#1A0E00";
              el.style.borderColor = "#D4A017";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "#FDF8EE";
              el.style.color = "#8B6914";
              el.style.borderColor = "#E8D4A0";
            }}
            data-testid={`button-view-details-${car.id}`}
          >
            View Details
            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function FeaturedCars() {
  return (
    <section id="featured-fleet" className="py-20 lg:py-28" style={{ background: "#FFFDF8" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-3"
            style={{ color: "#C49000", letterSpacing: "3px" }}
          >
            Curated Selection
          </p>
          <h2
            className="font-serif text-3xl lg:text-4xl font-bold mb-4"
            style={{ color: "#1C1C1C" }}
          >
            Featured Vehicles
          </h2>
          <p className="max-w-2xl mx-auto" style={{ color: "#4A4A4A", fontSize: "16px", lineHeight: "1.65" }}>
            Hand-picked automobiles representing the pinnacle of automotive engineering and design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {featuredCars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/fleet">
            <button
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold transition-all duration-300"
              style={{
                background: "none",
                border: "2px solid #D4A017",
                color: "#8B6914",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "linear-gradient(135deg, #D4A017, #E8B830)";
                el.style.color = "#1A0E00";
                el.style.boxShadow = "0 4px 20px rgba(212,160,23,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "none";
                el.style.color = "#8B6914";
                el.style.boxShadow = "none";
              }}
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
