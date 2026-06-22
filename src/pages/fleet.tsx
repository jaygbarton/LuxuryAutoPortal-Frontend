import { useState } from "react";
import { Link } from "wouter";
import { Search, Filter, ArrowRight, Gauge, Calendar, Fuel, X } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Car } from "@/types/car";

const allCars: Partial<Car>[] = [
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
  {
    id: "4",
    make: "McLaren",
    model: "720S Spider",
    year: 2023,
    price: "345000.00",
    mileage: 2100,
    exteriorColor: "Papaya Spark",
    engine: "4.0L Twin-Turbo V8",
    transmission: "7-Speed SSG",
    fuelType: "Gasoline",
    featured: false,
    status: "available",
    images: ["https://images.unsplash.com/photo-1621135802920-133df287f89c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
  {
    id: "5",
    make: "Bentley",
    model: "Continental GT",
    year: 2024,
    price: "275000.00",
    mileage: 300,
    exteriorColor: "Midnight Sapphire",
    engine: "6.0L W12",
    transmission: "8-Speed Dual-Clutch",
    fuelType: "Gasoline",
    featured: false,
    status: "available",
    images: ["https://images.unsplash.com/photo-1580273916550-e323be2ae537?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
  {
    id: "6",
    make: "Rolls-Royce",
    model: "Cullinan",
    year: 2024,
    price: "395000.00",
    mileage: 1500,
    exteriorColor: "English White",
    engine: "6.75L Twin-Turbo V12",
    transmission: "8-Speed Automatic",
    fuelType: "Gasoline",
    featured: false,
    status: "available",
    images: ["https://images.unsplash.com/photo-1563720223185-11003d516935?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"],
  },
];

const makes = ["All Makes", "Porsche", "Ferrari", "Lamborghini", "McLaren", "Bentley", "Rolls-Royce"];
const priceRanges = [
  { label: "All Prices", value: "all" },
  { label: "Under $250,000", value: "0-250000" },
  { label: "$250,000 - $400,000", value: "250000-400000" },
  { label: "Over $400,000", value: "400000-999999999" },
];
const years = ["All Years", "2024", "2023", "2022"];

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
    <Card className="group overflow-hidden bg-card border-border hover-elevate">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={car.images?.[0] || "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"}
          alt={`${car.make} ${car.model}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {car.featured && (
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
            Featured
          </Badge>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {car.make} {car.model}
            </h3>
            <p className="text-sm text-gray-500">{car.exteriorColor}</p>
          </div>
          <p className="text-xl font-semibold text-green-700 whitespace-nowrap">
            {formatPrice(String(car.price || "0"))}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-700" />
            <span>{car.year}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Gauge className="w-4 h-4 text-gray-700" />
            <span>{car.mileage?.toLocaleString()} mi</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Fuel className="w-4 h-4 text-gray-700" />
            <span>{car.fuelType}</span>
          </div>
        </div>

        <Link href="/contact">
          <Button variant="outline" className="w-full group/btn border-gray-300 text-foreground hover:bg-gray-50" data-testid={`button-view-${car.id}`}>
            Inquire
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function FilterSidebar({
  make,
  setMake,
  priceRange,
  setPriceRange,
  year,
  setYear,
  onClear,
}: {
  make: string;
  setMake: (value: string) => void;
  priceRange: string;
  setPriceRange: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  onClear: () => void;
}) {
  const hasFilters = make !== "All Makes" || priceRange !== "all" || year !== "All Years";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Filters</h3>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-filters">
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Make</label>
          <Select value={make} onValueChange={setMake}>
            <SelectTrigger data-testid="select-make">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Price Range</label>
          <Select value={priceRange} onValueChange={setPriceRange}>
            <SelectTrigger data-testid="select-price">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priceRanges.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Year</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function Fleet() {
  const [search, setSearch] = useState("");
  const [make, setMake] = useState("All Makes");
  const [priceRange, setPriceRange] = useState("all");
  const [year, setYear] = useState("All Years");

  const clearFilters = () => {
    setMake("All Makes");
    setPriceRange("all");
    setYear("All Years");
    setSearch("");
  };

  const filteredCars = allCars.filter((car) => {
    const matchesSearch =
      search === "" ||
      `${car.make} ${car.model}`.toLowerCase().includes(search.toLowerCase());
    const matchesMake = make === "All Makes" || car.make === make;
    const matchesYear = year === "All Years" || car.year?.toString() === year;

    let matchesPrice = true;
    if (priceRange !== "all") {
      const [min, max] = priceRange.split("-").map(Number);
      const price = parseFloat(String(car.price || "0"));
      matchesPrice = price >= min && price <= max;
    }

    return matchesSearch && matchesMake && matchesYear && matchesPrice;
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

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 p-6 rounded-lg bg-card border border-border">
                <FilterSidebar
                  make={make}
                  setMake={setMake}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  year={year}
                  setYear={setYear}
                  onClear={clearFilters}
                />
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search vehicles..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-card border-border"
                    data-testid="input-search"
                  />
                </div>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden border-white/20" data-testid="button-mobile-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="bg-background border-border">
                    <SheetHeader>
                      <SheetTitle className="text-foreground">Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterSidebar
                        make={make}
                        setMake={setMake}
                        priceRange={priceRange}
                        setPriceRange={setPriceRange}
                        year={year}
                        setYear={setYear}
                        onClear={clearFilters}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="text-foreground font-medium">{filteredCars.length}</span> vehicles
                </p>
              </div>

              {filteredCars.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredCars.map((car) => (
                    <CarCard key={car.id} car={car} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-lg text-muted-foreground mb-4">
                    No vehicles match your criteria
                  </p>
                  <Button variant="outline" onClick={clearFilters} className="border-white/20" data-testid="button-clear-all">
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
