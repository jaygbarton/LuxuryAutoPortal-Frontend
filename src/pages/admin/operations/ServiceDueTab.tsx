import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { getActiveTimezone } from "@/hooks/use-timezone";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { operationLocationMatches, useOperationLocationFilter } from "./OperationLocationFilter";
import { OperationEditHistoryList } from "@/components/admin/OperationEditHistory";
import type { CarServiceDue } from "./types";

type ServiceKind = "oil_change" | "tires" | "brakes" | "windshield" | "mechanic" | "license_registration";
type SortDirection = "asc" | "desc";
type SortKey =
  | "car"
  | "last_oil_change"
  | "last_tires"
  | "last_brakes"
  | "last_windshield"
  | "last_mechanic"
  | "last_license_registration"
  | "registration_expiration"
  | "last_any_service";

const DATE_SORT_KEYS = new Set<SortKey>([
  "last_oil_change",
  "last_tires",
  "last_brakes",
  "last_windshield",
  "last_mechanic",
  "last_license_registration",
  "registration_expiration",
  "last_any_service",
]);

// camelCase `field` value expenseFormSubmission/income_expense_service_dates
// use for each category — matches SERVICE_DUE_COGS_COLUMNS in
// operationsService.ts. Needed to write to the same cell the report reads.
const SERVICE_KIND_FIELD: Record<ServiceKind, string> = {
  oil_change: "oilLube",
  tires: "tires",
  brakes: "brakes",
  windshield: "windshield",
  mechanic: "mechanic",
  license_registration: "licenseRegistration",
};

// Staleness thresholds (days) per service type. Anything past DUE reads amber;
// past OVERDUE reads red; never-serviced always reads red. Brakes/windshield/
// mechanic/license wear much slower than oil/tires, so they get longer
// windows — flag for Cathy to adjust if these defaults don't match real
// service intervals.
const THRESHOLDS: Record<ServiceKind, { due: number; overdue: number }> = {
  oil_change: { due: 90, overdue: 180 },          // ~3mo / ~6mo
  tires: { due: 180, overdue: 365 },              // ~6mo / ~1yr
  brakes: { due: 180, overdue: 365 },             // ~6mo / ~1yr
  windshield: { due: 365, overdue: 730 },         // ~1yr / ~2yr
  mechanic: { due: 180, overdue: 365 },           // ~6mo / ~1yr
  license_registration: { due: 365, overdue: 400 }, // ~1yr, matches annual renewal
};

// Registration is a countdown to a future expiration date, not a "days
// since" figure — inverted sense from THRESHOLDS above.
const REGISTRATION_THRESHOLDS = { overdue: 0, due: 30 } as const; // expired, or expiring within 30 days

// Category filter options — "all" shows every car; any other value narrows
// the table down to cars that are due or overdue (amber/red) in that one
// category, using the same days_since_*/staleness() logic as its column.
type CategoryFilter = "all" | ServiceKind | "registration";
const CATEGORY_FILTER_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "oil_change", label: "Oil Change" },
  { value: "tires", label: "Tires" },
  { value: "brakes", label: "Brakes" },
  { value: "windshield", label: "Windshield" },
  { value: "mechanic", label: "Mechanic" },
  { value: "license_registration", label: "License & Registration" },
  { value: "registration", label: "Registration Expiration" },
];

/** True if the row is due/overdue (amber or red) in the selected category. */
function matchesCategoryFilter(r: CarServiceDue, category: CategoryFilter): boolean {
  if (category === "all") return true;
  if (category === "registration") return registrationStatus(r.days_until_registration_expiration) !== "green";
  const daysByKind: Record<ServiceKind, number | null> = {
    oil_change: r.days_since_oil_change,
    tires: r.days_since_tires,
    brakes: r.days_since_brakes,
    windshield: r.days_since_windshield,
    mechanic: r.days_since_mechanic,
    license_registration: r.days_since_license_registration,
  };
  return staleness(daysByKind[category], category) !== "green";
}

function formatDate(iso: string | null): string {
  if (!iso) return "No Data";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "No Data";
    return d.toLocaleDateString("en-US", {
      timeZone: getActiveTimezone(),
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return "No Data";
  }
}

function dateSortValue(iso: string | null): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? null : value;
}

function compareNullableDates(a: string | null, b: string | null, direction: SortDirection): number {
  const aValue = dateSortValue(a);
  const bValue = dateSortValue(b);
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return direction === "asc" ? aValue - bValue : bValue - aValue;
}

function sortArrow(key: SortKey, activeKey: SortKey, direction: SortDirection): string {
  if (key !== activeKey) return "";
  return direction === "asc" ? " ▲" : " ▼";
}

function nextSortDirection(key: SortKey, activeKey: SortKey, direction: SortDirection): SortDirection {
  if (key === activeKey) return direction === "asc" ? "desc" : "asc";
  return DATE_SORT_KEYS.has(key) ? "desc" : "asc";
}

function SortableTableHead({
  sortKey,
  activeKey,
  direction,
  onSort,
  children,
}: {
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  children: ReactNode;
}) {
  return (
    <TableHead
      className="sticky top-0 z-20 bg-muted whitespace-nowrap cursor-pointer select-none hover:bg-muted/70"
      onClick={() => onSort(sortKey)}
    >
      {children}
      {sortArrow(sortKey, activeKey, direction)}
    </TableHead>
  );
}

function staleness(days: number | null, kind: ServiceKind): "red" | "amber" | "green" {
  if (days == null) return "red";
  const t = THRESHOLDS[kind];
  if (days >= t.overdue) return "red";
  if (days >= t.due) return "amber";
  return "green";
}

// Registration counts DOWN to a future expiration date (negative = expired),
// the inverse of staleness() above which counts UP from a past service date.
function registrationStatus(daysUntil: number | null): "red" | "amber" | "green" {
  if (daysUntil == null) return "red";
  if (daysUntil <= REGISTRATION_THRESHOLDS.overdue) return "red";
  if (daysUntil <= REGISTRATION_THRESHOLDS.due) return "amber";
  return "green";
}

const STALE_CLASSES: Record<"red" | "amber" | "green", string> = {
  red: "bg-red-500/15 text-red-500 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  green: "bg-green-500/15 text-green-500 border-green-500/30",
};

/**
 * Pencil + history popover for one Service Due COGS cell. Edits go through the
 * same income_expense_service_dates row the Income & Expenses page's
 * ServiceDateEditor writes (source: "manual", the highest-precedence date),
 * so a correction made here is identical to correcting it from the receipt.
 *
 * Only rendered when the cell already resolves to a date — "Never serviced"
 * means no car_cogs_expenses row exists for this category yet (the report
 * derives entirely from COGS entries), so there's no (year, month) cell to
 * attach a service date to. Fix that by entering the I&E expense first.
 */
function ServiceCellEditPopover({
  carId,
  date,
  category,
  entityId,
  onSaved,
}: {
  carId: number;
  /** The resolved ISO date this cell currently shows — its own year/month IS
   *  the underlying car_cogs_expenses cell's (year, month), since
   *  getLastCogsServiceDates never lets a receipt/service-date sharpen a date
   *  across a month boundary. */
  date: string;
  category: ServiceKind;
  /** income_expense_service_dates.id for this cell, if an explicit override
   *  already exists — needed to look up its edit history. Null when the
   *  report is still falling back to the recorded COGS month (no override
   *  row yet), in which case there's no history to show. */
  entityId: number | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const [value, setValue] = useState(date.slice(0, 10));

  const save = async (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl("/api/income-expense/service-date"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId,
          year,
          month,
          category: "cogs",
          field: SERVICE_KIND_FIELD[category],
          serviceDate: next,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save service date");
      toast({ title: "Service date updated" });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save service date", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-primary"
          title="Edit service date"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Service date</label>
          <Input
            type="date"
            value={value}
            min={monthStart}
            max={monthEnd}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
          <p className="text-[11px] text-muted-foreground">
            Must fall within {monthStart.slice(0, 7)} — this cell's recorded month.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" disabled={saving || value === date.slice(0, 10)} onClick={() => save(value)}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {entityId != null && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit history">
                  <History className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-80 overflow-y-auto">
                <OperationEditHistoryList entityType="service_date" entityId={entityId} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ServiceCell({
  carId,
  date,
  days,
  kind,
  serviceDateId,
  onSaved,
}: {
  carId: number;
  date: string | null;
  days: number | null;
  kind: ServiceKind;
  /** income_expense_service_dates.id, when an explicit override exists for
   *  this cell (see CarServiceDue's per-category *_service_date_id fields). */
  serviceDateId: number | null;
  onSaved: () => void;
}) {
  const level = staleness(days, kind);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STALE_CLASSES[level]}`}>
          {days == null ? "No Data" : `${days} day${days === 1 ? "" : "s"} ago`}
        </span>
        {date && (
          <ServiceCellEditPopover
            carId={carId}
            date={date}
            category={kind}
            entityId={serviceDateId}
            onSaved={onSaved}
          />
        )}
      </div>
      <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
    </div>
  );
}

/** Pencil + history popover for the Registration Expiration cell — a plain
 *  car-table field (car.car_registration_expiration), not an I&E date, so it
 *  writes through its own small PATCH endpoint rather than service-date. */
function RegistrationEditPopover({
  carId,
  date,
  onSaved,
}: {
  carId: number;
  date: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(date ? date.slice(0, 10) : "");

  const save = async (next: string) => {
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/cars/${carId}/registration-expiration`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registrationExpiration: next || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save registration expiration");
      toast({ title: next ? "Registration expiration updated" : "Registration expiration cleared" });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save registration expiration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-primary" title="Edit registration expiration">
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Registration expiration</label>
          <Input
            type="date"
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" disabled={saving || value === (date ? date.slice(0, 10) : "")} onClick={() => save(value)}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit history">
                <History className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-80 overflow-y-auto">
              <OperationEditHistoryList entityType="car_registration" entityId={carId} />
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RegistrationCell({
  carId,
  date,
  daysUntil,
  onSaved,
}: {
  carId: number;
  date: string | null;
  daysUntil: number | null;
  onSaved: () => void;
}) {
  const level = registrationStatus(daysUntil);
  const label =
    daysUntil == null
      ? "No Data"
      : daysUntil < 0
        ? `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`
        : `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STALE_CLASSES[level]}`}>
          {label}
        </span>
        <RegistrationEditPopover carId={carId} date={date} onSaved={onSaved} />
      </div>
      <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
    </div>
  );
}

export function ServiceDueTab() {
  const locationFilter = useOperationLocationFilter();
  const queryClient = useQueryClient();
  const onSaved = () => queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance/service-due"] });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE">("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "car", direction: "asc" });

  const { data, isLoading, error } = useQuery<{ success: boolean; data: CarServiceDue[] }>({
    queryKey: ["/api/operations/maintenance/service-due"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance/service-due"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load service-due report");
      return res.json();
    },
  });

  const rows = data?.data ?? [];

  const hasActiveFilters = statusFilter !== "all" || categoryFilter !== "all" || !!dateFrom || !!dateTo;
  function clearFilters() {
    setStatusFilter("all");
    setCategoryFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!operationLocationMatches(locationFilter, [r.locationTag, r.car_name, r.car_plate, r.car_vin])) return false;
      if (q && ![r.car_name, r.car_plate, r.car_vin].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && r.car_status !== statusFilter) return false;
      if (!matchesCategoryFilter(r, categoryFilter)) return false;
      if (dateFrom || dateTo) {
        // Date range applies to the category's own "last serviced" date when
        // one is picked; otherwise to Last Any Service, matching whichever
        // date column is the meaningful one for the current view.
        const iso = categoryFilter === "all"
          ? r.last_any_service
          : categoryFilter === "registration"
            ? r.registration_expiration
            : ({
                oil_change: r.last_oil_change,
                tires: r.last_tires,
                brakes: r.last_brakes,
                windshield: r.last_windshield,
                mechanic: r.last_mechanic,
                license_registration: r.last_license_registration,
              } as Record<ServiceKind, string | null>)[categoryFilter];
        if (!iso) return false;
        const day = iso.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, categoryFilter, dateFrom, dateTo, locationFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "car":
          cmp = (a.car_name || "").localeCompare(b.car_name || "");
          break;
        case "last_oil_change":
          cmp = compareNullableDates(a.last_oil_change, b.last_oil_change, sort.direction);
          break;
        case "last_tires":
          cmp = compareNullableDates(a.last_tires, b.last_tires, sort.direction);
          break;
        case "last_brakes":
          cmp = compareNullableDates(a.last_brakes, b.last_brakes, sort.direction);
          break;
        case "last_windshield":
          cmp = compareNullableDates(a.last_windshield, b.last_windshield, sort.direction);
          break;
        case "last_mechanic":
          cmp = compareNullableDates(a.last_mechanic, b.last_mechanic, sort.direction);
          break;
        case "last_license_registration":
          cmp = compareNullableDates(a.last_license_registration, b.last_license_registration, sort.direction);
          break;
        case "registration_expiration":
          cmp = compareNullableDates(a.registration_expiration, b.registration_expiration, sort.direction);
          break;
        case "last_any_service":
          cmp = compareNullableDates(a.last_any_service, b.last_any_service, sort.direction);
          break;
      }
      if (cmp !== 0) return sort.key === "car" && sort.direction === "desc" ? -cmp : cmp;
      return (a.car_name || "").localeCompare(b.car_name || "");
    });
    return copy;
  }, [filtered, sort]);

  const handleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: nextSortDirection(key, current.key, current.direction),
    }));
  };

  const overdueOilCount = rows.filter((r) => staleness(r.days_since_oil_change, "oil_change") === "red").length;
  const overdueTireCount = rows.filter((r) => staleness(r.days_since_tires, "tires") === "red").length;
  const overdueBrakesCount = rows.filter((r) => staleness(r.days_since_brakes, "brakes") === "red").length;
  const overdueWindshieldCount = rows.filter((r) => staleness(r.days_since_windshield, "windshield") === "red").length;
  const overdueMechanicCount = rows.filter((r) => staleness(r.days_since_mechanic, "mechanic") === "red").length;
  const overdueLicenseRegCount = rows.filter((r) => staleness(r.days_since_license_registration, "license_registration") === "red").length;
  const expiringRegistrationCount = rows.filter((r) => registrationStatus(r.days_until_registration_expiration) !== "green").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Service Due"
          subtitle="Last serviced per car, from Income & Expenses records."
          variant="plain"
          className="mb-0"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <SummaryCard label="Cars Tracked" value={String(rows.length)} variant="dark" />
        <SummaryCard label="Oil Change Overdue" value={String(overdueOilCount)} variant="gold" />
        <SummaryCard label="Tires Overdue" value={String(overdueTireCount)} variant="white" />
        <SummaryCard label="Brakes Overdue" value={String(overdueBrakesCount)} variant="gold" />
        <SummaryCard label="Windshield Overdue" value={String(overdueWindshieldCount)} variant="white" />
        <SummaryCard label="Mechanic Overdue" value={String(overdueMechanicCount)} variant="gold" />
        <SummaryCard label="License & Reg. Overdue" value={String(overdueLicenseRegCount)} variant="white" />
        <SummaryCard label="Registration Expiring" value={String(expiringRegistrationCount)} variant="gold" />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end gap-3">
          <div className="space-y-1 col-span-full lg:col-auto lg:min-w-[220px] lg:flex-1">
            <label className="text-muted-foreground text-xs">Search</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Car name, plate, or VIN..."
              className="bg-card border-border text-foreground h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Category</label>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Serviced From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-card border-border text-foreground h-9 w-full lg:w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-xs">Serviced To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-card border-border text-foreground h-9 w-full lg:w-40"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading service history...</p>
        ) : error ? (
          <p className="text-center py-12 text-destructive">Failed to load service-due report.</p>
        ) : sorted.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No cars found.</p>
        ) : (
          <div className="rounded-md border [&>div]:max-h-[calc(100vh-360px)] [&>div]:overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap">Status</TableHead>
                  <SortableTableHead sortKey="car" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Car</SortableTableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap">Plate</TableHead>
                  <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap">VIN #</TableHead>
                  <SortableTableHead sortKey="last_oil_change" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Oil Change</SortableTableHead>
                  <SortableTableHead sortKey="last_tires" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Tires</SortableTableHead>
                  <SortableTableHead sortKey="last_brakes" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Brakes</SortableTableHead>
                  <SortableTableHead sortKey="last_windshield" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Windshield</SortableTableHead>
                  <SortableTableHead sortKey="last_mechanic" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Mechanic</SortableTableHead>
                  <SortableTableHead sortKey="last_license_registration" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last License &amp; Reg.</SortableTableHead>
                  <SortableTableHead sortKey="registration_expiration" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Registration Expiration</SortableTableHead>
                  <SortableTableHead sortKey="last_any_service" activeKey={sort.key} direction={sort.direction} onSort={handleSort}>Last Any Service</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.car_id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-medium",
                          r.car_status === "ACTIVE"
                            ? "bg-green-500/20 text-green-700 border-green-500/30"
                            : "bg-gray-500/20 text-gray-700 border-gray-500/30"
                        )}
                      >
                        {r.car_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/admin/cars/${r.car_id}/income-expense`} className="text-[#D3BC8D] hover:underline">
                        {r.car_name || `Car #${r.car_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.car_plate || "--"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{r.car_vin || "--"}</TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_oil_change} days={r.days_since_oil_change} kind="oil_change" serviceDateId={r.oil_change_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_tires} days={r.days_since_tires} kind="tires" serviceDateId={r.tires_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_brakes} days={r.days_since_brakes} kind="brakes" serviceDateId={r.brakes_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_windshield} days={r.days_since_windshield} kind="windshield" serviceDateId={r.windshield_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_mechanic} days={r.days_since_mechanic} kind="mechanic" serviceDateId={r.mechanic_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <ServiceCell carId={r.car_id} date={r.last_license_registration} days={r.days_since_license_registration} kind="license_registration" serviceDateId={r.license_registration_service_date_id} onSaved={onSaved} />
                    </TableCell>
                    <TableCell>
                      <RegistrationCell carId={r.car_id} date={r.registration_expiration} daysUntil={r.days_until_registration_expiration} onSaved={onSaved} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.last_any_service)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
