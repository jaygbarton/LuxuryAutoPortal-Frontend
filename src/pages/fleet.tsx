import { useMemo, useState } from "react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, X, ExternalLink, Users, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  locationTag?: string | null;
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
  const details = [car.vehicleTrim, car.color].map(cleanVal).filter(Boolean).join(" · ");
  const href = car.turoLink || "/contact";
  const bookingProps = car.turoLink ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <article data-fleet-card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E3DACA] bg-white shadow-[0_8px_28px_rgba(36,37,30,0.04)]">
      <a href={href} {...bookingProps} className="relative block aspect-[4/3] overflow-hidden bg-[#E8E2D7]" aria-label={`View ${car.makeModel}${car.turoLink ? " on Turo" : " inquiry"}`}>
        <img src={imgSrc} alt={car.makeModel} loading="lazy" className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          onError={e => { if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG; }} />
        <span className="absolute left-4 top-4 rounded-full bg-[#FAF8F2]/95 px-3 py-1.5 text-xs font-medium text-[#544228]">{vehicleType(car) === "Other" ? "GLA collection" : vehicleType(car)}</span>
        {car.year != null && <span className="absolute bottom-4 right-4 rounded-md bg-black/60 px-3 py-1 text-xs font-semibold text-white">{car.year}</span>}
      </a>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-3xl leading-tight">{car.makeModel}</h3>
        {details && <p className="mt-2 text-sm leading-6 text-[#686868]">{details}</p>}
        <div className="mb-6 mt-5 flex flex-wrap gap-4 border-t border-[#E8E1D5] pt-4 text-xs text-[#686868]">
          {car.numberOfSeats != null && <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#87632C]" />{car.numberOfSeats} seats</span>}
          {cleanVal(car.fuelType) && <span>{car.fuelType}</span>}
        </div>
        <a href={href} {...bookingProps} className="mt-auto flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#D3BC8D] px-5 py-3 text-sm font-semibold text-[#211B11] hover:bg-[#E3CCA0]">
          {car.turoLink ? "Book Now" : "Inquire"}{car.turoLink ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </a>
      </div>
    </article>
  );
}

export default function Fleet({ location = PUBLIC_LOCATIONS.slc }: { location?: PublicLocation }) {
  const [search, setSearch] = useState("");
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("az");

  const { data, isLoading, isError, refetch } = useQuery<{ success: boolean; data: FleetCar[] }>({
    queryKey: ["/api/public/fleet"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/public/fleet"));
      if (!res.ok) throw new Error("Failed to load fleet");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const cars = useMemo(
    () => (data?.data ?? []).filter((car) => fleetCarBelongsToLocation(car.turoLink, location, car.locationTag)),
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
    <div className="min-h-screen bg-[#FAF8F2] text-[#262626]">
      <Navbar />
      <main className="public-page pt-[68px]">
        <section data-fleet-hero className="relative overflow-hidden bg-[#171717] text-white">
          <div data-fleet-hero-media className="absolute inset-0">
            <img src="/homepage-hero-escalade.jpg" alt="Cadillac Escalade in the Golden Luxury Auto collection" fetchPriority="high" className="h-full w-full object-cover object-center" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="relative mx-auto flex min-h-[540px] max-w-[1440px] items-center sm:min-h-[600px] 2xl:min-h-[min(68vw,760px)]">
            <div className="gla-fleet-intro relative z-10 px-5 py-14 sm:px-8 lg:py-20">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#D3BC8D]">The GLA collection · {location.name}</p>
              <h1 className="font-serif text-4xl font-light leading-[1.08] sm:text-5xl lg:text-[clamp(2.75rem,3.6vw,4rem)]">The right car.<br /><span className="italic text-[#DFC899]">A better journey.</span></h1>
              <p className="mt-6 max-w-md text-base leading-8 text-white/75">Space for the whole family. Comfort for the open road. Find a vehicle that fits your trip, then check dates and pricing on Turo.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#fleet-list" className="gla-public-button bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]">Explore the collection <ArrowRight className="h-4 w-4" /></a>
                <a href={location.turoFleetUrl} target="_blank" rel="noopener noreferrer" className="gla-public-button border border-white/30 hover:bg-white/10">View Jay's Turo Fleet <ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>

        <section id="fleet-list" aria-labelledby="fleet-heading" className="mx-auto max-w-[1920px] scroll-mt-20 px-5 py-14 sm:px-8 lg:py-20">
          <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#87632C]">Find your drive</p>
              <h2 id="fleet-heading" className="font-serif text-4xl sm:text-5xl">Explore our fleet.</h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-[#686868]">Browse {location.cityState} vehicles below. Each booking link opens that vehicle’s own Turo listing.</p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2" aria-label="Vehicle categories">
            <button type="button" aria-pressed={selectedTypes.length === 0} onClick={() => setSelectedTypes([])} className={`min-h-11 rounded-full border px-5 text-sm font-medium transition-colors ${selectedTypes.length === 0 ? "border-[#D3BC8D] bg-[#D3BC8D] text-[#211B11]" : "border-[#DCD5C7] bg-white text-[#686868] hover:border-[#96712D]"}`}>All vehicles</button>
            {vehicleTypes.map(type => (
              <button key={type} type="button" aria-pressed={selectedTypes.includes(type)} onClick={() => setSelectedTypes(current => toggleValue(current, type))} className={`min-h-11 rounded-full border px-5 text-sm font-medium transition-colors ${selectedTypes.includes(type) ? "border-[#D3BC8D] bg-[#D3BC8D] text-[#211B11]" : "border-[#DCD5C7] bg-white text-[#686868] hover:border-[#96712D]"}`}>{type}</button>
            ))}
          </div>

          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#E3DACA] bg-white p-4 sm:p-5 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#87632C]" />
              <Input aria-label="Search vehicles" placeholder="Search vehicles..." value={search} onChange={e => setSearch(e.target.value)} className="min-h-12 border-[#E3DACA] bg-[#FAF8F2] pl-10" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-h-12 border-[#DCD5C7] bg-white md:w-auto">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />Filters
                  {activeFilterCount > 0 && <span className="ml-2 rounded-full bg-[#D3BC8D] px-2 py-0.5 text-xs text-[#211B11]">{activeFilterCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,560px)] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-foreground">Filter Vehicles</p>
                  {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Clear</Button>}
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  <FilterGroup title="Make" options={makes} selected={selectedMakes} onToggle={value => setSelectedMakes(current => toggleValue(current, value))} />
                  <FilterGroup title="Year" options={years} selected={selectedYears} onToggle={value => setSelectedYears(current => toggleValue(current, value))} />
                  <FilterGroup title="Type" options={vehicleTypes} selected={selectedTypes} onToggle={value => setSelectedTypes(current => toggleValue(current, value))} />
                  <FilterGroup title="Seats" options={seatOptions} selected={selectedSeats} onToggle={value => setSelectedSeats(current => toggleValue(current, value))} />
                </div>
              </PopoverContent>
            </Popover>
            {(activeFilterCount > 0 || search) && <Button variant="ghost" onClick={clearFilters} className="min-h-12"><X className="mr-1 h-4 w-4" />Clear All</Button>}
          </div>

          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-[#686868]" role="status">{isLoading ? "Loading collection…" : `Showing ${filteredCars.length} ${filteredCars.length === 1 ? "vehicle" : "vehicles"}`}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#686868]" id="fleet-sort-label">Sort</span>
              <Select value={sort} onValueChange={value => setSort(value as SortOption)}>
                <SelectTrigger aria-labelledby="fleet-sort-label" className="min-h-11 w-full border-[#DCD5C7] bg-white sm:w-52"><SelectValue /></SelectTrigger>
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Loading fleet">
              {[1, 2, 3].map(n => <div key={n} className="overflow-hidden rounded-2xl border border-[#E3DACA] bg-white"><div className="aspect-[4/3] animate-pulse bg-[#E8E2D7]" /><div className="h-44" /></div>)}
            </div>
          ) : isError ? (
            <div role="alert" className="rounded-2xl border border-[#DCD5C7] bg-white p-10 text-center">
              <p>The fleet could not be loaded. Please try again.</p>
              <Button variant="outline" className="mt-5" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : filteredCars.length > 0 ? (
            <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 lg:gap-8" data-fleet-grid>
              {filteredCars.map((car, index) => (
                <ScrollReveal key={car.id} preset="soft" amount={0.08} delay={(index % 4) * 0.04} className="h-full min-w-0" data-fleet-reveal>
                  <CarCard car={car} />
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DCD5C7] bg-white px-6 py-16 text-center">
              <p className="font-serif text-2xl">{cars.length === 0 ? "No vehicles are available right now. Please check back soon." : "No vehicles match your criteria"}</p>
              {cars.length > 0 && <Button variant="outline" onClick={clearFilters} className="mt-5">Clear All Filters</Button>}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
