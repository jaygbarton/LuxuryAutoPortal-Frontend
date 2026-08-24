import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CarFront, Clock, Loader2, ShieldCheck, Users } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { PUBLIC_LOCATIONS, fleetCarBelongsToLocation } from "@/lib/location-config";

interface FleetCar {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  makeModel: string;
  color: string | null;
  numberOfSeats: number | null;
  vehicleTrim: string | null;
  photo: string | null;
  turoLink: string | null;
  locationTag?: string | null;
}

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

const UNAVAILABLE_CHAUFFEUR_MAKES = new Set(["ford", "infiniti", "kia", "toyota", "rivian"]);

type ChauffeurSort = "newest" | "price-high" | "price-low" | "alphabetical";
type SeatFilter = "all" | "7" | "8";

const CHAUFFEUR_NAME_OVERRIDES: Record<number, string> = {
  1156: "Acura MDX Tech Package",
  900: "GMC Yukon XL AT4",
};

const CHAUFFEUR_FEATURE_OVERRIDES: Record<number, string> = {
  1156: "Tech Package",
  900: "Yukon XL AT4 trim",
};

function cleanVehicleDetail(value?: string | null): string | null {
  const detail = value?.trim();
  if (!detail || /^(n\/a|no data|null)$/i.test(detail)) return null;
  return detail;
}

function chauffeurHourlyRate(car: FleetCar): number | null {
  const name = `${car.make ?? ""} ${car.model ?? ""} ${car.makeModel ?? ""} ${car.turoLink ?? ""}`.toLowerCase();

  if ((car.make ?? "").toLowerCase() === "acura" && car.year === 2026 && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 495;
  if (car.year === 2026 && (name.includes("suburban") || name.includes("yukon")) && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 595;
  if (car.year === 2026 && name.includes("tahoe") && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 545;
  if (car.year === 2026 && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 495;
  if (car.year === 2025 && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 445;
  if (car.year === 2024 && (car.numberOfSeats === 7 || car.numberOfSeats === 8)) return 395;

  if (car.year === 2023 && name.includes("cadillac") && name.includes("escalade")) return 395;

  return null;
}

function chauffeurEligible(car: FleetCar): boolean {
  if (UNAVAILABLE_CHAUFFEUR_MAKES.has((car.make ?? "").toLowerCase())) return false;
  return chauffeurHourlyRate(car) != null;
}

function displayName(car: FleetCar): string {
  const overrideName = CHAUFFEUR_NAME_OVERRIDES[car.id];
  const baseName = overrideName ?? car.makeModel;
  const trim = cleanVehicleDetail(car.vehicleTrim);
  const showTrim = !overrideName && trim && !baseName.toLowerCase().includes(trim.toLowerCase());
  return [baseName, showTrim ? trim : null, car.year].filter(Boolean).join(" ");
}

function chauffeurFeatureSummary(car: FleetCar): string {
  const feature = CHAUFFEUR_FEATURE_OVERRIDES[car.id] ?? cleanVehicleDetail(car.vehicleTrim);
  const details = [feature, `${car.numberOfSeats ?? 7} passenger seating`].filter(Boolean);
  return `Trim/features: ${details.join(", ")}.`;
}

function ChauffeurVehicleCard({ car }: { car: FleetCar }) {
  const imgSrc = car.photo ? getProxiedImageUrl(car.photo) : PLACEHOLDER_IMG;
  const rate = chauffeurHourlyRate(car);

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-[#E2D8BF] bg-white shadow-sm transition-shadow hover:shadow-xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#10100F]">
        <img
          src={imgSrc}
          alt={displayName(car)}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 rounded-md bg-white px-3 py-2 shadow-lg">
          <p className="text-2xl font-semibold text-[#171717]">${rate}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A6B44]">Per Hour</p>
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-5">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-[#171717]">{displayName(car)}</h2>
          <p className="mt-1 text-sm font-medium text-[#7A6B44]">Business SUV</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-md bg-[#F7F4EC] px-3 py-2 text-[#4A4438]">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-xs leading-tight">All inclusive final prices</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-[#F7F4EC] px-3 py-2 text-[#4A4438]">
            <Users className="h-4 w-4 text-primary" />
            <span>Capacity: {car.numberOfSeats ?? 7} Passenger</span>
          </div>
        </div>

        <div className="mb-6 space-y-3 text-sm leading-6 text-[#5D574A]">
          <p className="font-semibold text-[#171717]">minimum 4 hours</p>
          <p>{chauffeurFeatureSummary(car)}</p>
          <p>Prices are all-inclusive; car, driver, tolls, parking, taxes, fuel and gratuity.</p>
          <p>Prices are valid for travel in the state of Utah.</p>
          <p>Service begins from the scheduled pickup time and finishes at the final dropoff time. No. of hours used will be calculated from pickup to drop off.</p>
        </div>

        <div className="mt-auto">
          <Link href="/salt-lake-city/contact" className="block">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Reserve A Chauffeur
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChauffeurPage() {
  const location = PUBLIC_LOCATIONS.slc;
  const [sort, setSort] = useState<ChauffeurSort>("newest");
  const [seatFilter, setSeatFilter] = useState<SeatFilter>("all");

  const { data, isLoading } = useQuery<{ success: boolean; data: FleetCar[] }>({
    queryKey: ["/api/public/fleet"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/public/fleet"));
      if (!res.ok) throw new Error("Failed to load fleet");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const chauffeurCars = useMemo(
    () => {
      const cars = (data?.data ?? [])
        .filter((car) => fleetCarBelongsToLocation(car.turoLink, location, car.locationTag))
        .filter(chauffeurEligible)
        .filter((car) => seatFilter === "all" || car.numberOfSeats === Number(seatFilter));

      return cars.sort((a, b) => {
        const aRate = chauffeurHourlyRate(a) ?? 0;
        const bRate = chauffeurHourlyRate(b) ?? 0;

        if (sort === "price-high") return bRate - aRate || displayName(a).localeCompare(displayName(b));
        if (sort === "price-low") return aRate - bRate || displayName(a).localeCompare(displayName(b));
        if (sort === "alphabetical") return displayName(a).localeCompare(displayName(b));
        return (b.year ?? 0) - (a.year ?? 0) || displayName(a).localeCompare(displayName(b));
      });
    },
    [data, location, seatFilter, sort],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#070707] text-white">
          <div className="absolute inset-0">
            <img
              src="/homepage-hero-escalade.jpg"
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: "center center" }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(5,5,4,0.86) 0%, rgba(5,5,4,0.68) 42%, rgba(5,5,4,0.18) 100%), linear-gradient(180deg, rgba(5,5,4,0.10), rgba(5,5,4,0.52))",
              }}
            />
          </div>

          <div className="relative mx-auto grid min-h-[500px] max-w-7xl content-end px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">Chauffeur Services</p>
              <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
                Professional Chauffeurs, Exceptional Service
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                Private chauffeur service in Salt Lake City with driver-included luxury SUVs for airport transfers, events, and executive travel.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#chauffeur-vehicles">
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    Reserve A Chauffeur
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <Link href="/salt-lake-city/contact">
                  <Button size="lg" variant="outline" className="w-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#E6DDC7] bg-[#F7F4EC] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {[
              { icon: CarFront, title: "Business SUV", text: "7 and 8 passenger chauffeur vehicles." },
              { icon: Clock, title: "Minimum 4 Hours", text: "Service time runs pickup to final dropoff." },
              { icon: ShieldCheck, title: "All inclusive final prices", text: "Vehicle, driver, tolls, parking, taxes, fuel and gratuity included." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-4 rounded-md border border-[#E2D8BF] bg-white p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#171717]">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5D574A]">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="chauffeur-vehicles" className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">Available Vehicles</p>
                <h2 className="mt-2 font-serif text-3xl font-light text-[#171717] sm:text-4xl">Reserve A Chauffeur</h2>
              </div>
              {!isLoading && (
                <p className="text-sm text-[#5D574A]">
                  Showing <span className="font-semibold text-[#171717]">{chauffeurCars.length}</span> vehicles
                </p>
              )}
            </div>

            <div className="mb-8 flex flex-col gap-4 rounded-md border border-[#E2D8BF] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7A6B44]">Sort</p>
                <Select value={sort} onValueChange={(value) => setSort(value as ChauffeurSort)}>
                  <SelectTrigger className="border-[#D8D2C3] bg-white text-[#171717]" data-testid="select-chauffeur-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest Year</SelectItem>
                    <SelectItem value="price-high">Price High To Low</SelectItem>
                    <SelectItem value="price-low">Price Low To High</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7A6B44]">Filter</p>
                <div className="flex rounded-md border border-[#D8D2C3] bg-[#F7F4EC] p-1">
                  {[
                    { value: "all", label: "All" },
                    { value: "7", label: "7 Seater" },
                    { value: "8", label: "8 Seater" },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={seatFilter === option.value ? "bg-white text-[#171717] shadow-sm hover:bg-white" : "text-[#5D574A] hover:bg-white/70"}
                      onClick={() => setSeatFilter(option.value as SeatFilter)}
                      data-testid={`button-seat-filter-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : chauffeurCars.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {chauffeurCars.map((car) => (
                  <ChauffeurVehicleCard key={car.id} car={car} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-[#E2D8BF] bg-white p-10 text-center">
                <p className="text-[#5D574A]">No chauffeur vehicles are available right now. Please check back soon.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
