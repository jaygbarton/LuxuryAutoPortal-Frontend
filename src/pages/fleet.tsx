import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, X, Loader2, ExternalLink } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

// Public fleet vehicle shape returned by GET /api/public/fleet — only the
// non-sensitive display fields plus the public Turo link.
interface FleetCar {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  makeModel: string;
  color: string | null;
  mileage: number | null;
  fuelType: string | null;
  numberOfSeats: number | null;
  numberOfDoors: number | null;
  vehicleTrim: string | null;
  photo: string | null;
  turoLink: string | null;
}

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

/** Treat placeholder/junk values ("No Data", "N/A", "--", "") as empty so the
 *  card sub-line is hidden instead of showing "No Data · No Data". */
function cleanVal(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return /^(no data|n\/a|na|--|-|none|null|undefined)$/i.test(s) ? "" : s;
}

function CarCard({ car }: { car: FleetCar }) {
  const imgSrc = car.photo ? getProxiedImageUrl(car.photo) : PLACEHOLDER_IMG;
  return (
    <Card className="group overflow-hidden bg-card border-border hover-elevate">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={imgSrc}
          alt={car.makeModel}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <CardContent className="p-6">
        <div className="mb-6">
          {/* Name format matches the booking car picker: "<make/model/trim> <year>"
              (e.g. "Acura MDX Base - AWD 2020"). Mileage and fuel removed since
              our mileage data isn't kept up to date (often showed "0 mi"). */}
          <h3 className="text-xl font-semibold text-foreground">
            {[car.makeModel, car.year].filter(Boolean).join(" ")}
          </h3>
          {(() => {
            const sub = [car.vehicleTrim, car.color].map(cleanVal).filter(Boolean).join(" · ");
            return sub ? <p className="text-sm text-gray-500">{sub}</p> : null;
          })()}
        </div>

        {car.turoLink ? (
          // Book Now → the car's OWN public Turo link (not the admin Turo link).
          <a href={car.turoLink} target="_blank" rel="noopener noreferrer">
            <Button className="w-full group/btn bg-primary text-primary-foreground hover:bg-primary/90">
              Book Now
              <ExternalLink className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          </a>
        ) : (
          // No Turo link on file → fall back to the inquiry/contact flow.
          <Link href="/contact">
            <Button variant="outline" className="w-full group/btn border-gray-300 text-foreground hover:bg-gray-50">
              Inquire
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function Fleet() {
  const [search, setSearch] = useState("");
  const [make, setMake] = useState("All Makes");
  const [year, setYear] = useState("All Years");

  const { data, isLoading } = useQuery<{ success: boolean; data: FleetCar[] }>({
    queryKey: ["/api/public/fleet"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/public/fleet"));
      if (!res.ok) throw new Error("Failed to load fleet");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const cars = useMemo(() => data?.data ?? [], [data]);

  // Filter options derived live from the active fleet.
  const makes = useMemo(
    () => ["All Makes", ...Array.from(new Set(cars.map((c) => c.make).filter(Boolean) as string[])).sort()],
    [cars],
  );
  const years = useMemo(
    () => [
      "All Years",
      ...Array.from(new Set(cars.map((c) => c.year).filter((y): y is number => y != null)))
        .sort((a, b) => b - a)
        .map(String),
    ],
    [cars],
  );

  const clearFilters = () => {
    setMake("All Makes");
    setYear("All Years");
    setSearch("");
  };

  const filteredCars = cars.filter((car) => {
    const matchesSearch =
      search === "" ||
      car.makeModel.toLowerCase().includes(search.toLowerCase()) ||
      (car.vehicleTrim ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesMake = make === "All Makes" || car.make === make;
    const matchesYear = year === "All Years" || String(car.year) === year;
    return matchesSearch && matchesMake && matchesYear;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-primary tracking-widest uppercase mb-3">
              Our Collection
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl font-light text-foreground mb-4">
              Luxury Fleet
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Explore our curated selection of the world's most prestigious automobiles.
            </p>
          </div>

          <div>
            {/* Top filter bar: search on the left, Make / Year on the right. */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search vehicles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>

              <div className="w-full md:w-44">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Make</label>
                <Select value={make} onValueChange={setMake}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {makes.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-36">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Year</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(make !== "All Makes" || year !== "All Years") && (
                <Button variant="ghost" onClick={clearFilters} className="md:mb-0">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-medium">{filteredCars.length}</span> vehicles
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredCars.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredCars.map((car) => (
                  <CarCard key={car.id} car={car} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-lg text-muted-foreground mb-4">
                  {cars.length === 0
                    ? "No vehicles are available right now. Please check back soon."
                    : "No vehicles match your criteria"}
                </p>
                {cars.length > 0 && (
                  <Button variant="outline" onClick={clearFilters} className="border-white/20">
                    Clear All Filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
