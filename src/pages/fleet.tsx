import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, X, Loader2, ExternalLink, Calendar, Users, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { PUBLIC_LOCATIONS, fleetCarBelongsToLocation, type PublicLocation } from "@/lib/location-config";

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
  performanceIncome?: number | null;
}

type SortOption = "az" | "za" | "top-performing" | "newest";
type SeatFilterOption = "-5" | "5" | "7" | "8" | "10+";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

/** Treat placeholder/junk values ("No Data", "N/A", "--", "") as empty so the
 *  card sub-line is hidden instead of showing "No Data · No Data". */
function cleanVal(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return /^(no data|n\/a|na|--|-|none|null|undefined)$/i.test(s) ? "" : s;
}

function vehicleType(car: FleetCar): string {
  const label = `${car.make ?? ""} ${car.model ?? ""} ${car.makeModel ?? ""}`.toLowerCase();
  if (/\b(tacoma|f-150|f150|silverado|sierra|ram|gladiator|truck)\b/.test(label)) return "Truck";
  if (/\b(sprinter|odyssey|voyager|sienna|carnival|pacifica|van)\b/.test(label)) return "Van";
  if (/\b(accord|camry|sonata|malibu|passat|altima|charger|sedan)\b/.test(label)) return "Sedan";
  if (/\b(mdx|q5|x2|x5|x6|enclave|escalade|yukon|tahoe|suburban|acadia|equinox|trax|telluride|grand cherokee|defender|range rover|outback|rav4|sequoia|expedition|navigator|bronco|wrangler|hummer|terrain|santa fe|suv)\b/.test(label)) return "SUV";
  return "Other";
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function seatBucket(car: FleetCar): SeatFilterOption | null {
  const seats = car.numberOfSeats;
  if (seats == null) return null;
  if (seats < 5) return "-5";
  if (seats >= 10) return "10+";
  if (seats === 5 || seats === 7 || seats === 8) return String(seats) as SeatFilterOption;
  return null;
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={() => onToggle(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CarCard({ car }: { car: FleetCar }) {
  const imgSrc = car.photo ? getProxiedImageUrl(car.photo) : PLACEHOLDER_IMG;
  return (
    <Card className="group flex flex-col h-full overflow-hidden bg-card border-border hover-elevate">
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
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="mb-6">
          {/* Name format matches the booking car picker: "<make/model/trim> <year>"
              (e.g. "Acura MDX Base - AWD 2020"). */}
          <h3 className="text-xl font-semibold text-foreground">
            {[car.makeModel, car.year].filter(Boolean).join(" ")}
          </h3>
          {(() => {
            const sub = [car.vehicleTrim, car.color].map(cleanVal).filter(Boolean).join(" · ");
            return sub ? <p className="text-sm text-gray-500">{sub}</p> : null;
          })()}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{car.year ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 shrink-0 text-primary" />
            <span className="truncate">{car.numberOfSeats != null ? `${car.numberOfSeats} seats` : "—"}</span>
          </div>
        </div>

        {/* mt-auto pins the action to the card bottom so buttons line up across
            a row regardless of title length or whether a subtitle is shown. */}
        <div className="mt-auto">
          {car.turoLink ? (
            // Book Now → the car's OWN public Turo link (not the admin Turo link).
            <a href={car.turoLink} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full group/btn bg-primary text-primary-foreground hover:bg-primary/90">
                Book Now
                <ExternalLink className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </a>
          ) : (
            // No Turo link on file → fall back to the inquiry/contact flow.
            <Link href="/contact" className="block">
              <Button variant="outline" className="w-full group/btn border-gray-300 text-foreground hover:bg-gray-50">
                Inquire
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Fleet({ location = PUBLIC_LOCATIONS.slc }: { location?: PublicLocation }) {
  const [search, setSearch] = useState("");
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("az");

  const { data, isLoading } = useQuery<{ success: boolean; data: FleetCar[] }>({
    queryKey: ["/api/public/fleet"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/public/fleet"));
      if (!res.ok) throw new Error("Failed to load fleet");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const cars = useMemo(
    () => (data?.data ?? []).filter((car) => fleetCarBelongsToLocation(car.turoLink, location)),
    [data, location],
  );

  // Filter options derived live from the active fleet.
  const makes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.make).filter(Boolean) as string[])).sort(),
    [cars],
  );
  const years = useMemo(
    () => Array.from(new Set(cars.map((c) => c.year).filter((y): y is number => y != null)))
      .sort((a, b) => b - a)
      .map(String),
    [cars],
  );
  const vehicleTypes = useMemo(
    () => Array.from(new Set(cars.map(vehicleType))).sort((a, b) => a.localeCompare(b)),
    [cars],
  );
  const seatOptions: SeatFilterOption[] = ["-5", "5", "7", "8", "10+"];
  const activeFilterCount = selectedMakes.length + selectedYears.length + selectedTypes.length + selectedSeats.length;

  const clearFilters = () => {
    setSelectedMakes([]);
    setSelectedYears([]);
    setSelectedTypes([]);
    setSelectedSeats([]);
    setSearch("");
  };

  const filteredCars = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return cars
      .filter((car) => {
        const matchesSearch =
          searchTerm === "" ||
          car.makeModel.toLowerCase().includes(searchTerm) ||
          (car.vehicleTrim ?? "").toLowerCase().includes(searchTerm);
        const matchesMake = selectedMakes.length === 0 || (car.make != null && selectedMakes.includes(car.make));
        const matchesYear = selectedYears.length === 0 || (car.year != null && selectedYears.includes(String(car.year)));
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(vehicleType(car));
        const matchesSeats = selectedSeats.length === 0 || (seatBucket(car) != null && selectedSeats.includes(seatBucket(car)!));
        return matchesSearch && matchesMake && matchesYear && matchesType && matchesSeats;
      })
      .sort((a, b) => {
        if (sort === "za") return b.makeModel.localeCompare(a.makeModel);
        if (sort === "newest") return (b.year ?? 0) - (a.year ?? 0) || a.makeModel.localeCompare(b.makeModel);
        if (sort === "top-performing") {
          return (b.performanceIncome ?? 0) - (a.performanceIncome ?? 0) || a.makeModel.localeCompare(b.makeModel);
        }
        return a.makeModel.localeCompare(b.makeModel);
      });
  }, [cars, search, selectedMakes, selectedSeats, selectedTypes, selectedYears, sort]);

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
              {location.cityState} Fleet
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground">
              Browse active vehicles available through Golden Luxury Auto in {location.cityState}.
            </p>
          </div>

          <div>
            {/* Top filter bar: search on the left, filter button on the right. */}
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto border-border bg-card">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,560px)] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-semibold text-foreground">Filter Vehicles</p>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                    <FilterGroup
                      title="Make"
                      options={makes}
                      selected={selectedMakes}
                      onToggle={(value) => setSelectedMakes((current) => toggleValue(current, value))}
                    />
                    <FilterGroup
                      title="Year"
                      options={years}
                      selected={selectedYears}
                      onToggle={(value) => setSelectedYears((current) => toggleValue(current, value))}
                    />
                    <FilterGroup
                      title="Type"
                      options={vehicleTypes}
                      selected={selectedTypes}
                      onToggle={(value) => setSelectedTypes((current) => toggleValue(current, value))}
                    />
                    <FilterGroup
                      title="Seats"
                      options={seatOptions}
                      selected={selectedSeats}
                      onToggle={(value) => setSelectedSeats((current) => toggleValue(current, value))}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {(activeFilterCount > 0 || search) && (
                <Button variant="ghost" onClick={clearFilters} className="md:mb-0">
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <p className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-medium">{filteredCars.length}</span> {filteredCars.length === 1 ? "vehicle" : "vehicles"}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort</span>
                <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
                  <SelectTrigger className="w-full sm:w-48 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="az">A-Z</SelectItem>
                    <SelectItem value="za">Z-A</SelectItem>
                    <SelectItem value="top-performing">Top Monthly Performing</SelectItem>
                    <SelectItem value="newest">Newest Model Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
