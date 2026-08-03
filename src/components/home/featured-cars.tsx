import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, Calendar, Users, Loader2, Car, ClipboardCheck } from "lucide-react";
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
  numberOfSeats: number | null;
  vehicleTrim: string | null;
  photo: string | null;
  turoLink: string | null;
}

type FeaturedMode = "previous-month" | "top-performing";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";
const TURO_VEHICLES_URL = "https://turo.com/us/en/drivers/4325673/vehicles";

function scrollToTopOnNavigate() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 0);
}

/** Hide placeholder/junk values ("No Data", "N/A", etc.) instead of printing them. */
function cleanVal(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return /^(no data|n\/a|na|--|-|none|null|undefined)$/i.test(s) ? "" : s;
}

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
          {(() => {
            const sub = [car.vehicleTrim, car.color].map(cleanVal).filter(Boolean).join(" · ");
            return sub ? <p className="text-sm" style={{ color: "#808080" }}>{sub}</p> : null;
          })()}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Calendar className="w-4 h-4" style={{ stroke: "#d3bc8d" }} />
            <span>{car.year ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#808080" }}>
            <Users className="w-4 h-4" style={{ stroke: "#C49000" }} />
            <span>{car.numberOfSeats != null ? `${car.numberOfSeats} seats` : "—"}</span>
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
  const [mode, setMode] = useState<FeaturedMode>("previous-month");

  const { data, isLoading } = useQuery<{ success: boolean; data: FeaturedCar[] }>({
    queryKey: ["/api/public/fleet/featured", mode],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/public/fleet/featured?mode=${mode}`));
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
            {mode === "previous-month"
              ? "Our top-performing vehicles from the previous month — updated automatically."
              : "Our top-performing vehicles by broader backend performance — updated automatically."}
          </p>
          <div className="mt-6 inline-flex rounded-lg border p-1" style={{ borderColor: "#E8D4A0", background: "#FFF8E8" }}>
            {([
              ["previous-month", "Top Monthly Performing"],
              ["top-performing", "Top Performing"],
            ] as const).map(([value, label]) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className="px-4 py-2 text-sm font-semibold rounded-md transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, #D4A017, #E8B830)" : "transparent",
                    color: active ? "#1A0E00" : "#8B6914",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
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

        <div className="mt-16 overflow-hidden rounded-xl border" style={{ borderColor: "#E8D4A0", background: "#FFFFFF" }}>
          <div className="grid min-h-[360px] grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 lg:p-12" style={{ background: "#FFFDF8" }}>
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
              >
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#C49000" }}>
                Vehicle Management
              </p>
              <h3 className="mb-4 font-serif text-3xl font-bold" style={{ color: "#1C1C1C" }}>
                List your vehicle with us
              </h3>
              <p className="mb-8 max-w-xl text-base leading-7" style={{ color: "#4A4A4A" }}>
                Have a vehicle you want managed for rentals? Start with our owner
                onboarding page and our team will review the details with you.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/onboarding" onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-management-get-started"
                  >
                    List Your Car
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <Link href="/contact" onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all"
                    style={{ border: "1.5px solid #D4A017", color: "#8B6914", background: "transparent" }}
                    data-testid="button-management-info"
                  >
                    Info
                  </button>
                </Link>
              </div>
            </div>

            <div className="flex flex-col justify-center border-t p-8 lg:border-l lg:border-t-0 lg:p-12" style={{ borderColor: "#E8D4A0", background: "#FFFFFF" }}>
              <div
                className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ background: "#1C1C1C", color: "#E8B830" }}
              >
                <Car className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#C49000" }}>
                Rent a Vehicle
              </p>
              <h3 className="mb-4 font-serif text-3xl font-bold" style={{ color: "#1C1C1C" }}>
                Find a car for your trip
              </h3>
              <p className="mb-8 max-w-xl text-base leading-7" style={{ color: "#4A4A4A" }}>
                Browse our available vehicles, compare the options, and book through
                the vehicle's Turo listing when you are ready.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/fleet" onClick={scrollToTopOnNavigate}>
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg, #D4A017, #E8B830)", color: "#1A0E00" }}
                    data-testid="button-rental-fleet"
                  >
                    Our Fleet
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <a href={TURO_VEHICLES_URL} target="_blank" rel="noopener noreferrer">
                  <button
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold transition-all"
                    style={{ border: "1.5px solid #D4A017", color: "#8B6914", background: "transparent" }}
                    data-testid="button-rental-turo"
                  >
                    Book on Turo
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
