import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search, ChevronDown, Check } from "lucide-react";

export type CarActivityFilter = "all" | "active" | "inactive";

export interface PaymentFilterCar {
  id: number;
  makeModel: string;
  licensePlate?: string;
  vin?: string;
  year?: number;
  /** /api/cars `status`: ACTIVE when car_status is available|in_use. */
  status?: string;
}

export interface PaymentFilterStatus {
  payment_status_aid: number;
  payment_status_name: string;
}

/**
 * Active/Inactive follows car_status (surfaced as /api/cars `status`), the
 * same definition /api/payments/search filters rows by. The `isActive` field
 * on /api/cars is the legacy car_is_active management flag (0 own /
 * 1 management / 2-3 off ride) and must not be read as activity — doing so
 * listed active co-hosted cars (e.g. the BMW X2) as Inactive.
 */
export function isPaymentFilterCarActive(c: PaymentFilterCar): boolean {
  return (c.status || "").toUpperCase() === "ACTIVE";
}

function carLabel(c: PaymentFilterCar): string {
  const nameYear = [c.makeModel, c.year ? String(c.year) : ""].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (nameYear) parts.push(nameYear);
  if (c.licensePlate) parts.push(`#${c.licensePlate}`);
  if (c.vin) parts.push(c.vin);
  return parts.join(" - ");
}

interface PaymentFilterBarProps {
  statuses: PaymentFilterStatus[];
  cars: PaymentFilterCar[];
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  startMonth: string;
  onStartMonthChange: (v: string) => void;
  endMonth: string;
  onEndMonthChange: (v: string) => void;
  carActivityFilter: CarActivityFilter;
  onCarActivityFilterChange: (v: CarActivityFilter) => void;
  carFilter: string;
  onCarFilterChange: (v: string) => void;
  hasFilters: boolean;
  onClear: () => void;
}

/** Filter bar shared by the Client Payments and Co-Host Payments pages. */
export function PaymentFilterBar({
  statuses,
  cars,
  filterStatus,
  onFilterStatusChange,
  startMonth,
  onStartMonthChange,
  endMonth,
  onEndMonthChange,
  carActivityFilter,
  onCarActivityFilterChange,
  carFilter,
  onCarFilterChange,
  hasFilters,
  onClear,
}: PaymentFilterBarProps) {
  const [carSearch, setCarSearch] = useState<string>("");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);
  const carDropdownRef = useRef<HTMLDivElement>(null);

  const carsList = cars.filter((c) => {
    if (carActivityFilter === "all") return true;
    if (carActivityFilter === "active") return isPaymentFilterCarActive(c);
    return !isPaymentFilterCarActive(c);
  });

  // Close the car dropdown when the user clicks outside it
  useEffect(() => {
    if (!carDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (carDropdownRef.current && !carDropdownRef.current.contains(e.target as Node)) {
        setCarDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [carDropdownOpen]);

  const selectedCar = carFilter ? carsList.find((c) => String(c.id) === carFilter) : undefined;

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end gap-3">
        <div className="col-span-full lg:col-auto flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider lg:mr-1 lg:pb-2 lg:self-end">
          <Filter className="w-3.5 h-3.5" />
          Filters
        </div>
        <div className="flex flex-col">
          <label className="text-muted-foreground text-xs font-medium mb-1.5">Status</label>
          <Select
            value={filterStatus || "__all__"}
            onValueChange={(v) => onFilterStatusChange(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="bg-background border-border text-foreground w-full lg:w-[140px] h-9 focus:ring-1 focus:ring-primary">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="__all__">All</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.payment_status_aid} value={s.payment_status_name}>
                  {s.payment_status_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <label className="text-muted-foreground text-xs font-medium mb-1.5">From</label>
          <Input
            type="month"
            value={startMonth}
            onChange={(e) => onStartMonthChange(e.target.value)}
            className="bg-background border-border text-foreground w-full lg:w-[160px] h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-muted-foreground text-xs font-medium mb-1.5">To</label>
          <Input
            type="month"
            value={endMonth}
            onChange={(e) => onEndMonthChange(e.target.value)}
            className="bg-background border-border text-foreground w-full lg:w-[160px] h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-muted-foreground text-xs font-medium mb-1.5">Cars</label>
          <Select
            value={carActivityFilter}
            onValueChange={(v) => onCarActivityFilterChange(v as CarActivityFilter)}
          >
            <SelectTrigger className="bg-background border-border text-foreground w-full lg:w-[104px] h-9 focus:ring-1 focus:ring-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground min-w-[104px]">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-full sm:col-span-2 lg:col-auto flex flex-col lg:flex-1 lg:min-w-[260px]" ref={carDropdownRef}>
          <label className="text-muted-foreground text-xs font-medium mb-1.5">Car</label>
          {/* Custom searchable car combobox */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCarDropdownOpen((prev) => !prev);
                setCarSearch("");
              }}
              className="flex items-center justify-between w-full h-9 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              <span className="truncate">{selectedCar ? carLabel(selectedCar) : "All Cars"}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform duration-150 ${carDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {carDropdownOpen && (
              <div
                className="absolute z-50 top-full mt-1 w-full lg:min-w-[320px] bg-card border border-border rounded-md shadow-lg overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Search input */}
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      autoFocus
                      type="text"
                      value={carSearch}
                      onChange={(e) => setCarSearch(e.target.value)}
                      placeholder="Search make, plate, VIN…"
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Options list */}
                <div className="max-h-56 overflow-y-auto">
                  {/* All Cars option */}
                  {!carSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        onCarFilterChange("");
                        setCarDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors ${!carFilter ? "text-primary font-medium" : "text-foreground"}`}
                    >
                      <span>All Cars</span>
                      {!carFilter && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                    </button>
                  )}

                  {(() => {
                    const lower = carSearch.toLowerCase();
                    const filtered = carsList.filter((c) => {
                      if (!lower) return true;
                      const nameYear = [c.makeModel, c.year ? String(c.year) : ""].filter(Boolean).join(" ").toLowerCase();
                      return (
                        nameYear.includes(lower) ||
                        (c.licensePlate || "").toLowerCase().includes(lower) ||
                        (c.vin || "").toLowerCase().includes(lower)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <p className="px-3 py-4 text-xs text-center text-muted-foreground">
                          {carSearch ? `No cars match "${carSearch}"` : "No cars"}
                        </p>
                      );
                    }

                    return filtered.map((c) => {
                      const isSelected = carFilter === String(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onCarFilterChange(String(c.id));
                            setCarDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors ${isSelected ? "text-primary font-medium" : "text-foreground"}`}
                        >
                          <span className="truncate pr-2">{carLabel(c)}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={onClear}
            className="col-span-full lg:col-auto text-red-600 hover:text-red-700 hover:bg-red-500/10 h-9 font-medium w-full lg:w-auto"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
