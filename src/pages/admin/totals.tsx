import React, { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ExternalLink, Download, ChevronDown, ChevronRight, ChevronLeft, Loader2, CalendarIcon } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
  turoLink?: string | null;
  adminTuroLink?: string | null;
  fuelType?: string | null;
  tireSize?: string | null;
  oilType?: string | null;
}

const formatCurrency = (value: unknown): string => {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!isFinite(num)) return "$ 0.00";
  if (num < 0) {
    return `$ (${Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (value: unknown): string => {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!isFinite(num)) return "0";
  return num.toLocaleString("en-US");
};

interface TotalRowProps {
  label: string;
  value: unknown;
  isCurrency?: boolean;
  bold?: boolean;
  separator?: boolean;
  indent?: boolean;
  negative?: boolean;
}

function TotalRow({ label, value, isCurrency = true, bold, separator, indent, negative }: TotalRowProps) {
  const num = typeof value === "string" ? parseFloat(value as string) : Number(value);
  const isNeg = negative || num < 0;
  return (
    <div className={cn(
      "flex items-center justify-between py-1.5 px-2 rounded-sm min-w-0",
      separator && "border-t border-border pt-3 mt-1",
      bold && "font-semibold",
      indent && "pl-4"
    )}>
      <span className={cn(
        "text-sm truncate mr-4 flex-1 min-w-0",
        bold ? "text-foreground" : "text-muted-foreground"
      )}>
        {label}
      </span>
      <span className={cn(
        "text-sm font-mono tabular-nums whitespace-nowrap",
        bold ? "font-semibold text-foreground" : "text-foreground",
        isNeg && "text-red-600 dark:text-red-400"
      )}>
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
      </span>
    </div>
  );
}

interface SectionProps {
  title: string;
  totalValue?: unknown;
  totalIsCurrency?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, totalValue, totalIsCurrency = true, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open
            ? <ChevronDown className="w-4 h-4 text-primary shrink-0" />
            : <ChevronRight className="w-4 h-4 text-primary shrink-0" />
          }
          <span className="font-medium text-sm text-foreground truncate">{title}</span>
        </div>
        {totalValue !== undefined && (
          <span className="font-semibold text-sm font-mono tabular-nums text-foreground whitespace-nowrap ml-4">
            {totalIsCurrency ? formatCurrency(totalValue) : formatNumber(totalValue)}
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-border bg-background/50">
          {children}
        </div>
      )}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MonthPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (month: number, year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const now = new Date();
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();

  useEffect(() => { setViewYear(year); }, [year]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-foreground text-sm",
          "hover:bg-muted/50 transition-colors min-w-[160px] justify-between"
        )}>
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>{MONTH_FULL[month - 1]} {year}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewYear(viewYear - 1)} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">{viewYear}</span>
          <button onClick={() => setViewYear(viewYear + 1)} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_LABELS.map((label, i) => {
            const m = i + 1;
            const isSelected = m === month && viewYear === year;
            const isCurrent = m === nowMonth && viewYear === nowYear;
            return (
              <button
                key={m}
                onClick={() => { onChange(m, viewYear); setOpen(false); }}
                className={cn(
                  "py-1.5 rounded text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isCurrent
                      ? "border border-primary text-primary font-medium hover:bg-primary/10"
                      : "hover:bg-muted text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
          <button
            onClick={() => { onChange(1, nowYear); setOpen(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => { onChange(nowMonth, nowYear); setOpen(false); }}
            className="text-xs text-primary font-medium hover:underline"
          >
            This month
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
const QUARTER_SHORT = ["Q1", "Q2", "Q3", "Q4"];

function QuarterPicker({ quarter, year, onChange }: {
  quarter: number; year: number;
  onChange: (quarter: number, year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const now = new Date();
  const nowQ = Math.ceil((now.getMonth() + 1) / 3);
  const nowYear = now.getFullYear();

  useEffect(() => { setViewYear(year); }, [year]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-foreground text-sm",
          "hover:bg-muted/50 transition-colors min-w-[160px] justify-between"
        )}>
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>{QUARTER_SHORT[quarter - 1]} {year}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setViewYear(viewYear - 1)} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">{viewYear}</span>
          <button onClick={() => setViewYear(viewYear + 1)} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUARTER_LABELS.map((label, i) => {
            const q = i + 1;
            const isSelected = q === quarter && viewYear === year;
            const isCurrent = q === nowQ && viewYear === nowYear;
            return (
              <button
                key={q}
                onClick={() => { onChange(q, viewYear); setOpen(false); }}
                className={cn(
                  "py-2 px-2 rounded text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isCurrent
                      ? "border border-primary text-primary font-medium hover:bg-primary/10"
                      : "hover:bg-muted text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
          <button
            onClick={() => { onChange(1, nowYear); setOpen(false); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => { onChange(nowQ, nowYear); setOpen(false); }}
            className="text-xs text-primary font-medium hover:underline"
          >
            This quarter
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function TotalsPage() {
  const [individualRoute, individualParams] = useRoute("/admin/cars/:id/totals");
  const [allCarsRoute] = useRoute("/admin/totals/all");
  const [standaloneTotalsRoute] = useRoute("/admin/totals");
  const [, setLocation] = useLocation();

  const isStandalonePage = !!standaloneTotalsRoute;
  const urlCarId = individualParams?.id ? parseInt(individualParams.id, 10) : null;

  const { data: authData } = useQuery<{ user?: { isClient?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
  });
  const isClient = authData?.user?.isClient === true;

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowQuarter = Math.ceil(nowMonth / 3);

  const [filterType, setFilterType] = useState<string>("Year");
  const [fromYear, setFromYear] = useState<string>(nowYear.toString());
  const [toYear, setToYear] = useState<string>(nowYear.toString());
  // Month mode: single "from" month picker → auto "to" = now
  const [pickedMonth, setPickedMonth] = useState<number>(nowMonth);
  const [pickedMonthYear, setPickedMonthYear] = useState<number>(nowYear);
  // Quarter mode: single "from" quarter picker → auto "to" = now
  const [pickedQuarter, setPickedQuarter] = useState<number>(nowQuarter);
  const [pickedQuarterYear, setPickedQuarterYear] = useState<number>(nowYear);

  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);

  // Compute the effective from/to values sent to the API based on filter type
  const effectiveFilters = (() => {
    if (filterType === "Month") {
      return {
        filterType: "Month",
        fromYear: pickedMonthYear.toString(),
        toYear: nowYear.toString(),
        fromMonth: pickedMonth.toString(),
        toMonth: nowMonth.toString(),
      };
    }
    if (filterType === "Quarter") {
      const qStartMonth = (pickedQuarter - 1) * 3 + 1;
      const nowQEndMonth = Math.min(nowQuarter * 3, 12);
      return {
        filterType: "Quarter",
        fromYear: pickedQuarterYear.toString(),
        toYear: nowYear.toString(),
        fromMonth: qStartMonth.toString(),
        toMonth: nowQEndMonth.toString(),
      };
    }
    // Year mode
    return {
      filterType: "Year",
      fromYear,
      toYear,
      fromMonth: "1",
      toMonth: "12",
    };
  })();

  // Debounce filter values so rapid dropdown changes don't fire many requests
  const [debouncedFilters, setDebouncedFilters] = useState(effectiveFilters);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(effectiveFilters);
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, fromYear, toYear, pickedMonth, pickedMonthYear, pickedQuarter, pickedQuarterYear]);

  const isAllCarsReport = !!allCarsRoute || (isStandalonePage && selectedCarId === null);
  const carId = urlCarId || (isStandalonePage ? selectedCarId : null);

  const { data: carsListData } = useQuery<{ data: Array<{ id: number; makeModel: string; vin: string; licensePlate: string | null }> }>({
    queryKey: ["/api/cars", "totals-car-selector"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/cars?status=ACTIVE&limit=500"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
    enabled: isStandalonePage,
    staleTime: 1000 * 60 * 5,
  });
  const carsList = carsListData?.data || [];

  const { data, isLoading, error } = useQuery<{ success: boolean; data: CarDetail }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(buildApiUrl(`/api/cars/${carId}`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId && !isAllCarsReport,
    retry: false,
  });
  const car: CarDetail | undefined = data?.data;

  const { data: onboardingData } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const response = await fetch(buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`), { credentials: "include" });
      if (!response.ok) {
        if (response.status === 404) return { success: false, data: null };
        throw new Error("Failed to fetch onboarding");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });
  const onboarding = onboardingData?.success ? onboardingData?.data : null;

  const { data: totalsData, isLoading: totalsLoading, isFetching: totalsFetching } = useQuery<{ success: boolean; data: any }>({
    queryKey: isAllCarsReport
      ? ["/api/cars/totals/all", debouncedFilters.filterType, debouncedFilters.fromYear, debouncedFilters.toYear, debouncedFilters.fromMonth, debouncedFilters.toMonth]
      : ["/api/cars", carId, "totals", debouncedFilters.filterType, debouncedFilters.fromYear, debouncedFilters.toYear, debouncedFilters.fromMonth, debouncedFilters.toMonth],
    queryFn: async () => {
      const params = new URLSearchParams({
        filter: debouncedFilters.filterType,
        from: debouncedFilters.fromYear,
        to: debouncedFilters.toYear,
        fromMonth: debouncedFilters.fromMonth,
        toMonth: debouncedFilters.toMonth,
      });
      const url = isAllCarsReport
        ? buildApiUrl(`/api/cars/totals/all?${params.toString()}`)
        : buildApiUrl(`/api/cars/${carId}/totals?${params.toString()}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch totals");
      return response.json();
    },
    enabled: isAllCarsReport || !!carId,
    retry: false,
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  });
  const totals = totalsData?.data || null;

  if ((isLoading || totalsLoading) && !isAllCarsReport && !isStandalonePage) {
    return <AdminLayout><CarDetailSkeleton /></AdminLayout>;
  }

  if (!isAllCarsReport && !isStandalonePage && (error || !car)) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button onClick={() => setLocation("/admin/cars")} className="mt-4 text-blue-700 hover:underline">
            Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  const carName = car ? (car.makeModel || `${car.year || ""} ${car.vin}`.trim()) : "";
  const ownerName = car?.owner ? `${car.owner.firstName} ${car.owner.lastName}` : "N/A";
  const fuelType = onboarding?.fuelType || car?.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car?.tireSize || "N/A";
  const oilType = onboarding?.oilType || car?.oilType || "N/A";

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-4">
          {!isAllCarsReport && !isStandalonePage && (
            <button
              onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to View Car</span>
            </button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">
                {isStandalonePage ? "Totals" : isAllCarsReport ? "All Cars Report - Totals" : "Individual Car Report - Totals"}
              </h1>
              {isStandalonePage && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedCarId === null
                    ? "Aggregated totals for all active cars"
                    : `Showing totals for: ${car?.makeModel || "selected car"}`}
                </p>
              )}
              {!isStandalonePage && !isAllCarsReport && car && (
                <p className="text-sm text-muted-foreground mt-0.5">Car: {car.makeModel}</p>
              )}
            </div>
            <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Car Selector (standalone page) */}
        {isStandalonePage && (
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">Car</label>
            <Select
              value={selectedCarId === null ? "all" : selectedCarId.toString()}
              onValueChange={(val) => setSelectedCarId(val === "all" ? null : parseInt(val, 10))}
            >
              <SelectTrigger className="bg-card border-border text-foreground max-w-md">
                <SelectValue placeholder="All Cars" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground max-h-[300px]">
                <SelectItem value="all">All Cars (Aggregated)</SelectItem>
                {carsList.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.makeModel}{c.licensePlate ? ` — #${c.licensePlate}` : ""}{c.vin ? ` (${c.vin.slice(-6)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Car & Owner Info */}
        {!isAllCarsReport && car && (
          <div className="bg-card border border-border rounded-lg p-4 sm:p-5 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Car Information</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name: </span><span className="text-foreground">{carName}</span></div>
                  <div><span className="text-muted-foreground">VIN: </span><span className="text-foreground font-mono text-xs">{car.vin}</span></div>
                  <div><span className="text-muted-foreground">Plate: </span><span className="text-foreground">{car.licensePlate || "N/A"}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Owner Information</h3>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name: </span>
                    {car.clientId ? (
                      <button onClick={() => setLocation(`/admin/clients/${car.clientId}`)} className="text-[#B8860B] hover:underline font-semibold">
                        {ownerName}
                      </button>
                    ) : (
                      <span className="text-foreground">{ownerName}</span>
                    )}
                  </div>
                  <div><span className="text-muted-foreground">Phone: </span><span className="text-foreground">{car.owner?.phone || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Email: </span><span className="text-foreground break-all">{car.owner?.email || "N/A"}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Specifications</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Fuel: </span><span className="text-foreground">{fuelType}</span></div>
                  <div><span className="text-muted-foreground">Tires: </span><span className="text-foreground">{tireSize}</span></div>
                  <div><span className="text-muted-foreground">Oil: </span><span className="text-foreground">{oilType}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Turo Links</h3>
                <div className="space-y-1 text-sm">
                  {car.turoLink && (
                    <a href={car.turoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      Turo Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {car.adminTuroLink && (
                    <a href={car.adminTuroLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                      Admin Turo Link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!car.turoLink && !car.adminTuroLink && <span className="text-muted-foreground">N/A</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">Filter</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-card border-border text-foreground w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="Year">Year</SelectItem>
                  <SelectItem value="Month">Month</SelectItem>
                  <SelectItem value="Quarter">Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year mode: From Year / To Year */}
            {filterType === "Year" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">From Year</label>
                  <Select value={fromYear} onValueChange={setFromYear}>
                    <SelectTrigger className="bg-card border-border text-foreground w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {Array.from({ length: 10 }, (_, i) => nowYear - i).map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">To Year</label>
                  <Select value={toYear} onValueChange={setToYear}>
                    <SelectTrigger className="bg-card border-border text-foreground w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {Array.from({ length: 10 }, (_, i) => nowYear - i).map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Month mode: Month picker → Now */}
            {filterType === "Month" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">Month</label>
                  <MonthPicker
                    month={pickedMonth}
                    year={pickedMonthYear}
                    onChange={(m, y) => { setPickedMonth(m); setPickedMonthYear(y); }}
                  />
                </div>
                <div className="flex items-end h-9">
                  <span className="text-sm text-muted-foreground px-2">→</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">To</label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/50 text-sm text-muted-foreground min-w-[140px]">
                    {MONTH_FULL[nowMonth - 1]} {nowYear}
                  </div>
                </div>
              </>
            )}

            {/* Quarter mode: Quarter picker → Now */}
            {filterType === "Quarter" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">Quarter</label>
                  <QuarterPicker
                    quarter={pickedQuarter}
                    year={pickedQuarterYear}
                    onChange={(q, y) => { setPickedQuarter(q); setPickedQuarterYear(y); }}
                  />
                </div>
                <div className="flex items-end h-9">
                  <span className="text-sm text-muted-foreground px-2">→</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5 block">To</label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/50 text-sm text-muted-foreground min-w-[100px]">
                    {QUARTER_SHORT[nowQuarter - 1]} {nowYear}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Range description */}
          <div className="mt-2 text-xs text-muted-foreground">
            {filterType === "Year" && (
              fromYear === toYear
                ? <span>Showing all months of {fromYear}</span>
                : <span>Showing Jan {fromYear} — Dec {toYear}</span>
            )}
            {filterType === "Month" && (
              <span>
                Showing {MONTH_FULL[pickedMonth - 1]} {pickedMonthYear} — {MONTH_FULL[nowMonth - 1]} {nowYear}
                {` (${(() => {
                  const totalMonths = (nowYear - pickedMonthYear) * 12 + (nowMonth - pickedMonth) + 1;
                  return totalMonths === 1 ? "1 month" : `${totalMonths} months`;
                })()})`}
              </span>
            )}
            {filterType === "Quarter" && (
              <span>
                Showing {QUARTER_SHORT[pickedQuarter - 1]} {pickedQuarterYear} — {QUARTER_SHORT[nowQuarter - 1]} {nowYear}
              </span>
            )}
          </div>
        </div>

        {/* Loading state for totals — only full spinner on first load */}
        {totalsLoading && !totals && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading totals...</span>
          </div>
        )}

        {/* Totals Sections — show stale data with subtle refetch indicator */}
        {(totals || !totalsLoading) && (
          <div className="relative">
            {totalsFetching && totals && (
              <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-bl-lg border-b border-l border-border">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Updating...</span>
              </div>
            )}
          </div>
        )}
        {(totals || (!totalsLoading && !totalsFetching)) && (
          <div className="space-y-2 pb-4">
            {/* 1. Car Management and Car Owner Split */}
            <Section
              title="EXPENSES — Car Management & Owner Split"
              totalValue={(Number(totals?.carManagementSplit || 0) + Number(totals?.carOwnerSplit || 0))}
            >
              <TotalRow label="Car Management Split" value={totals?.carManagementSplit} />
              <TotalRow label="Car Owner Split" value={totals?.carOwnerSplit} />
            </Section>

            {/* 2. Income / Profit & Loss */}
            <Section
              title="INCOME / PROFIT & LOSS"
              totalValue={totals?.income?.totalProfit}
            >
              <TotalRow label="Rental Income" value={totals?.income?.rentalIncome} />
              <TotalRow label="Delivery Income" value={totals?.income?.deliveryIncome} />
              <TotalRow label="Electric Prepaid Income" value={totals?.income?.electricPrepaidIncome} />
              <TotalRow label="Smoking Fines" value={totals?.income?.smokingFines} />
              <TotalRow label="Gas Prepaid Income" value={totals?.income?.gasPrepaidIncome} />
              <TotalRow label="Miles Income" value={totals?.income?.milesIncome} />
              <TotalRow label="Ski Racks Income" value={totals?.income?.skiRacksIncome} />
              <TotalRow label="Child Seat Income" value={totals?.income?.childSeatIncome} />
              <TotalRow label="Coolers Income" value={totals?.income?.coolersIncome} />
              <TotalRow label="Income Insurance & Client Wrecks" value={totals?.income?.incomeInsurance} />
              <TotalRow label="Other Income" value={totals?.income?.otherIncome} />
              <TotalRow label="Negative Balance Carry Over" value={totals?.income?.negativeBalance} negative />
              <TotalRow label="Car Management Total Expenses" value={totals?.income?.carManagementTotalExpenses} separator bold />
              <TotalRow label="Car Owner Total Expenses" value={totals?.income?.carOwnerTotalExpenses} bold />
              <TotalRow label="Total Expenses" value={totals?.income?.totalExpenses} separator bold />
              <TotalRow label="Car Payment" value={totals?.income?.carPayment} bold />
              <TotalRow label="Total Profit" value={totals?.income?.totalProfit} bold />
            </Section>

            {/* 3. Operating Expenses — Direct Delivery */}
            <Section
              title="OPERATING EXPENSES (Direct Delivery)"
              totalValue={totals?.operatingExpensesDirect?.total}
            >
              <TotalRow label="Labor - Car Cleaning" value={totals?.operatingExpensesDirect?.laborCarCleaning} />
              <TotalRow label="Labor - Driver" value={totals?.operatingExpensesDirect?.laborDriver} />
              <TotalRow label="Parking - Airport" value={totals?.operatingExpensesDirect?.parkingAirport} />
              <TotalRow label="Taxi/Uber/Lyft/Lime" value={totals?.operatingExpensesDirect?.taxiUberLyftLime} />
              <TotalRow label="Total Operating Expenses (Direct Delivery)" value={totals?.operatingExpensesDirect?.total} separator bold />
            </Section>

            {/* 4. Operating Expenses — COGS Per Vehicle */}
            <Section
              title="OPERATING EXPENSES (COGS — Per Vehicle)"
              totalValue={totals?.expenses?.totalOperatingExpenses}
            >
              <TotalRow label="Auto Body Shop / Wreck" value={totals?.expenses?.autoBodyShop} />
              <TotalRow label="Alignment" value={totals?.expenses?.alignment} />
              <TotalRow label="Battery" value={totals?.expenses?.battery} />
              <TotalRow label="Brakes" value={totals?.expenses?.brakes} />
              <TotalRow label="Car Payment" value={totals?.expenses?.carPayment} />
              <TotalRow label="Car Insurance" value={totals?.expenses?.carInsurance} />
              <TotalRow label="Car Seats" value={totals?.expenses?.carSeats} />
              <TotalRow label="Cleaning Supplies / Tools" value={totals?.expenses?.cleaningSupplies} />
              <TotalRow label="Emissions" value={totals?.expenses?.emissions} />
              <TotalRow label="GPS System" value={totals?.expenses?.gpsSystem} />
              <TotalRow label="Keys & Fob" value={totals?.expenses?.keysFob} />
              <TotalRow label="Labor - Cleaning" value={totals?.expenses?.laborDetailing} />
              <TotalRow label="License & Registration" value={totals?.expenses?.licenseRegistration} />
              <TotalRow label="Mechanic" value={totals?.expenses?.mechanic} />
              <TotalRow label="Oil/Lube" value={totals?.expenses?.oilLube} />
              <TotalRow label="Parts" value={totals?.expenses?.parts} />
              <TotalRow label="Ski Racks" value={totals?.expenses?.skiRacks} />
              <TotalRow label="Tickets & Tolls" value={totals?.expenses?.ticketsTolls} />
              <TotalRow label="Tire Air Station" value={totals?.expenses?.tiredAirStation} />
              <TotalRow label="Tires" value={totals?.expenses?.tires} />
              <TotalRow label="Towing / Impound Fees" value={totals?.expenses?.towingImpoundFees} />
              <TotalRow label="Uber/Lyft/Lime" value={totals?.expenses?.uberLyftLime} />
              <TotalRow label="Windshield" value={totals?.expenses?.windshield} />
              <TotalRow label="Wipers" value={totals?.expenses?.wipers} />
              <TotalRow label="Total COGS (Per Vehicle)" value={totals?.expenses?.totalOperatingExpenses} separator bold />
            </Section>

            {/* 5. GLA Parking Fee & Labor Cleaning */}
            <Section
              title="GLA PARKING FEE & LABOR CLEANING"
              totalValue={totals?.gla?.total}
            >
              <TotalRow label="GLA Labor - Cleaning" value={totals?.gla?.laborCleaning} />
              <TotalRow label="GLA Parking Fee" value={totals?.gla?.parkingFee} />
              <TotalRow label="Total GLA Parking Fee & Labor Cleaning" value={totals?.gla?.total} separator bold />
            </Section>

            {/* 6. Office Support — only for all-cars view */}
            {isAllCarsReport && (
              <Section
                title="OPERATING EXPENSES (Office Support)"
                totalValue={totals?.operatingExpensesOffice?.total}
              >
                <TotalRow label="Accounting & Professional Fees" value={totals?.operatingExpensesOffice?.accountingProfessionalFees} />
                <TotalRow label="Advertising" value={totals?.operatingExpensesOffice?.advertizing} />
                <TotalRow label="Bank Charges" value={totals?.operatingExpensesOffice?.bankCharges} />
                <TotalRow label="Detail Mobile" value={totals?.operatingExpensesOffice?.detailMobile} />
                <TotalRow label="Charitable Contributions" value={totals?.operatingExpensesOffice?.charitableContributions} />
                <TotalRow label="Computer & Internet" value={totals?.operatingExpensesOffice?.computerInternet} />
                <TotalRow label="Delivery, Postage & Freight" value={totals?.operatingExpensesOffice?.deliveryPostageFreight} />
                <TotalRow label="Detail Shop Equipment" value={totals?.operatingExpensesOffice?.detailShopEquipment} />
                <TotalRow label="Dues & Subscription" value={totals?.operatingExpensesOffice?.duesSubscription} />
                <TotalRow label="General & Administrative (G&A)" value={totals?.operatingExpensesOffice?.generalAdministrative} />
                <TotalRow label="Health & Wellness" value={totals?.operatingExpensesOffice?.healthWellness} />
                <TotalRow label="Labor - Human Resources" value={totals?.operatingExpensesOffice?.laborHumanResources} />
                <TotalRow label="Labor - Marketing" value={totals?.operatingExpensesOffice?.laborMarketing} />
                <TotalRow label="Labor - Sales" value={totals?.operatingExpensesOffice?.laborSales} />
                <TotalRow label="Labor - Software" value={totals?.operatingExpensesOffice?.laborSoftware} />
                <TotalRow label="Legal & Professional" value={totals?.operatingExpensesOffice?.legalProfessional} />
                <TotalRow label="Marketing" value={totals?.operatingExpensesOffice?.marketing} />
                <TotalRow label="Meals & Entertainment" value={totals?.operatingExpensesOffice?.mealsEntertainment} />
                <TotalRow label="Office Expense" value={totals?.operatingExpensesOffice?.officeExpense} />
                <TotalRow label="Office Rent" value={totals?.operatingExpensesOffice?.officeRent} />
                <TotalRow label="Outside & Staff Contractors" value={totals?.operatingExpensesOffice?.outsideStaffContractors} />
                <TotalRow label="Park n Jet Booth" value={totals?.operatingExpensesOffice?.parknJetBooth} />
                <TotalRow label="Printing" value={totals?.operatingExpensesOffice?.printing} />
                <TotalRow label="Referral" value={totals?.operatingExpensesOffice?.referral} />
                <TotalRow label="Repairs & Maintenance" value={totals?.operatingExpensesOffice?.repairsMaintenance} />
                <TotalRow label="Sales Tax" value={totals?.operatingExpensesOffice?.salesTax} />
                <TotalRow label="Security Cameras" value={totals?.operatingExpensesOffice?.securityCameras} />
                <TotalRow label="Supplies & Materials" value={totals?.operatingExpensesOffice?.suppliesMaterials} />
                <TotalRow label="Taxes & License" value={totals?.operatingExpensesOffice?.taxesLicense} />
                <TotalRow label="Telephone" value={totals?.operatingExpensesOffice?.telephone} />
                <TotalRow label="Travel" value={totals?.operatingExpensesOffice?.travel} />
                <TotalRow label="Total Office Support" value={totals?.operatingExpensesOffice?.total} separator bold />
              </Section>
            )}

            {/* 7. Reimbursed Bills */}
            <Section
              title="REIMBURSED & NON-REIMBURSED BILLS"
              totalValue={
                Number(totals?.reimbursedBills?.electricReimbursed || 0) +
                Number(totals?.reimbursedBills?.electricNotReimbursed || 0) +
                Number(totals?.reimbursedBills?.gasReimbursed || 0) +
                Number(totals?.reimbursedBills?.gasNotReimbursed || 0) +
                Number(totals?.reimbursedBills?.gasServiceRun || 0) +
                Number(totals?.reimbursedBills?.parkingAirport || 0) +
                Number(totals?.reimbursedBills?.uberLyftLimeReimbursed || 0) +
                Number(totals?.reimbursedBills?.uberLyftLimeNotReimbursed || 0)
              }
            >
              <TotalRow label="Electric - Reimbursed" value={totals?.reimbursedBills?.electricReimbursed} />
              <TotalRow label="Electric - Not Reimbursed" value={totals?.reimbursedBills?.electricNotReimbursed} />
              <TotalRow label="Gas - Reimbursed" value={totals?.reimbursedBills?.gasReimbursed} />
              <TotalRow label="Gas - Not Reimbursed" value={totals?.reimbursedBills?.gasNotReimbursed} />
              <TotalRow label="Gas - Service Run" value={totals?.reimbursedBills?.gasServiceRun} />
              <TotalRow label="Parking Airport" value={totals?.reimbursedBills?.parkingAirport} />
              <TotalRow label="Uber/Lyft/Lime - Reimbursed" value={totals?.reimbursedBills?.uberLyftLimeReimbursed} />
              <TotalRow label="Uber/Lyft/Lime - Not Reimbursed" value={totals?.reimbursedBills?.uberLyftLimeNotReimbursed} />
            </Section>

            {/* 8. Vehicle History */}
            <Section
              title="VEHICLE HISTORY"
              totalIsCurrency={false}
            >
              <TotalRow label="Days Rented" value={totals?.history?.daysRented} isCurrency={false} />
              <TotalRow label="Cars Available For Rent" value={totals?.history?.carsAvailableForRent} isCurrency={false} />
              <TotalRow label="Trips Taken" value={totals?.history?.tripsTaken} isCurrency={false} />
            </Section>

            {/* 9. Payment History */}
            <Section
              title="PAYMENT HISTORY"
              totalValue={totals?.payments?.total}
            >
              <TotalRow label={`${effectiveFilters.fromYear}${effectiveFilters.fromYear !== effectiveFilters.toYear ? ` — ${effectiveFilters.toYear}` : ""}`} value={totals?.payments?.total} bold />
            </Section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
