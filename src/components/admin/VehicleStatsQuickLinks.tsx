import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calculator,
  CreditCard,
  DollarSign,
  FileText,
  History,
  LineChart,
  Receipt,
  TrendingDown,
  Wrench,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportLinkCard } from "@/pages/client/_components/ReportLinkCard";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";

interface StatsCar {
  id: number;
  vin?: string | null;
  makeModel?: string | null;
  make?: string | null;
  model?: string | null;
  licensePlate?: string | null;
  plateNumber?: string | null;
  year?: number | string | null;
  carStatus?: string | null;
  returnedAt?: string | null;
}

function normalizeClientCar(car: any): StatsCar {
  return {
    id: car.id,
    vin: car.vin || null,
    makeModel: car.makeModel || [car.make, car.model].filter(Boolean).join(" ") || "N/A",
    make: car.make || null,
    model: car.model || null,
    licensePlate: car.plateNumber || car.licensePlate || null,
    year: car.year || null,
    carStatus: car.carStatus || null,
    returnedAt: car.returnedAt || null,
  };
}

function getCarLabel(car: StatsCar) {
  return [
    car.year,
    car.make || car.makeModel,
    car.model && car.model !== car.makeModel ? car.model : null,
    car.licensePlate || car.plateNumber ? `(${car.licensePlate || car.plateNumber})` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function VehicleStatsQuickLinks() {
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  const { data: meData } = useQuery<{
    user?: { isAdmin?: boolean; isClient?: boolean; isEmployee?: boolean };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });

  const isAdmin = Boolean(meData?.user?.isAdmin);
  const isClient = Boolean(meData?.user?.isClient);
  const canView = isAdmin || isClient;

  const { data, isLoading } = useQuery<{ success: boolean; data: StatsCar[] }>({
    queryKey: isClient ? ["/api/client/cars", "view-stats-links"] : ["/api/cars", "view-stats-links"],
    queryFn: async () => {
      if (isClient) {
        const response = await fetch(buildApiUrl("/api/client/cars?includeReturned=true"), {
          credentials: "include",
        });
        if (!response.ok) return { success: false, data: [] };
        const result = await response.json();
        const clientCars = Array.isArray(result?.data) ? result.data : [];
        return { success: true, data: clientCars.map(normalizeClientCar) };
      }

      const response = await fetch(buildApiUrl("/api/cars?page=1&limit=1000"), {
        credentials: "include",
      });
      if (!response.ok) return { success: false, data: [] };
      return response.json();
    },
    enabled: canView,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const cars = useMemo(
    () =>
      (data?.data ?? []).slice().sort((a, b) =>
        getCarLabel(a).localeCompare(getCarLabel(b), undefined, { sensitivity: "base" }),
      ),
    [data?.data],
  );

  const selectedCar = cars.find((car) => String(car.id) === selectedCarId);
  const carPath = (path: string) => selectedCar ? `/admin/cars/${selectedCar.id}/${path}` : "#";

  const links = selectedCar
    ? [
        { href: `/admin/view-car/${selectedCar.id}`, icon: BarChart3, label: "Stats Overview" },
        { href: carPath("earnings"), icon: DollarSign, label: "Earnings" },
        { href: carPath("totals"), icon: Receipt, label: "Totals" },
        { href: carPath("graphs"), icon: LineChart, label: "Graphs and Charts" },
        { href: carPath("depreciation"), icon: TrendingDown, label: "NADA Depreciation" },
        { href: carPath("payments"), icon: CreditCard, label: "Payment History" },
        { href: carPath("records"), icon: History, label: "Records" },
        { href: carPath("income-expense"), icon: FileText, label: "Income and Expenses" },
        ...(isAdmin
          ? [
              { href: carPath("expenses"), icon: Receipt, label: "Total Expenses" },
              { href: carPath("calculator"), icon: Calculator, label: "Payment Calculator" },
              { href: carPath("maintenance"), icon: Wrench, label: "Maintenance" },
            ]
          : []),
      ]
    : [];

  if (!canView) return null;

  return (
    <div className="rounded-xl border-2 border-[#D3BC8D] bg-[#D3BC8D]/10 px-6 py-5 shadow-sm shadow-[#D3BC8D]/10">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D3BC8D]/70 bg-[#D3BC8D]/20 text-[#8B6914]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">View Stats</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Select a car to show its stats quick links.
            </p>
          </div>
        </div>

        <Select value={selectedCarId} onValueChange={setSelectedCarId}>
          <SelectTrigger className="w-full lg:w-[460px] border-[#D3BC8D]/70 bg-background/70 text-foreground">
            <SelectValue placeholder={isLoading ? "Loading cars..." : "Select a car"} />
          </SelectTrigger>
          <SelectContent className="max-h-80 border-[#D3BC8D]/70 bg-card text-foreground">
            {cars.length > 0 ? (
              cars.map((car) => (
                <SelectItem key={`stats-car-${car.id}`} value={String(car.id)}>
                  {getCarLabel(car) || `Car #${car.id}`}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-cars" disabled>
                No cars available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedCar && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-2 md:grid-cols-3 lg:grid-cols-4">
          {links.map((link) => (
            <ReportLinkCard
              key={`${selectedCar.id}-${link.label}`}
              href={link.href}
              icon={link.icon}
              label={link.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
