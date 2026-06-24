import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { DashboardRecordCard } from "@/components/admin/dashboard";

interface ClientTrip {
  id: number;
  reservation_id: string;
  car_name: string | null;
  plate_number: string | null;
  vin_number: string | null;
  guest_name: string | null;
  trip_start: string | null;
  trip_end: string | null;
  earnings: number | null;
  status: string | null;
  delivery_location: string | null;
}

interface CarOption {
  name: string;
  plate: string;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string | null) {
  if (status === "completed" || status === "ended")
    return "bg-green-500/10 text-green-700 border-green-500/30";
  if (status === "booked") return "bg-blue-500/10 text-blue-700 border-blue-500/30";
  if (status === "cancelled") return "bg-red-500/10 text-red-700 border-red-500/30";
  return "bg-gray-500/10 text-gray-600 border-gray-500/30";
}

/** Left accent bar color per trip status, mirroring the dashboard record cards. */
function accentFor(status: string | null): { bg: string; border: string } {
  if (status === "cancelled") return { bg: "bg-red-500", border: "border-red-300" };
  if (status === "booked") return { bg: "bg-blue-500", border: "border-blue-300" };
  if (status === "completed" || status === "ended")
    return { bg: "bg-green-500", border: "border-green-300" };
  return { bg: "bg-slate-400", border: "border-slate-300" };
}

// Quick-filter status tabs shown above the list (in addition to the dropdown).
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "ended", label: "Ended" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const LIMIT = 20;

export default function ClientTripHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carFilter, setCarFilter] = useState("all");
  const [tripFrom, setTripFrom] = useState("");
  const [tripTo, setTripTo] = useState("");

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const hasFilters =
    debouncedSearch || statusFilter !== "all" || carFilter !== "all" || tripFrom || tripTo;

  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (carFilter !== "all") params.set("car", carFilter);
  if (tripFrom) params.set("tripFrom", tripFrom);
  if (tripTo) params.set("tripTo", tripTo);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: ClientTrip[];
    total: number;
    cars?: CarOption[];
  }>({
    queryKey: ["/api/client/trips", page, debouncedSearch, statusFilter, carFilter, tripFrom, tripTo],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/client/trips?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });

  const trips = data?.data ?? [];
  const total = data?.total ?? 0;
  const cars = data?.cars ?? [];
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setCarFilter("all");
    setTripFrom("");
    setTripTo("");
    setPage(1);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-primary leading-tight">
            Trip History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Turo rental history for your vehicle{total !== 1 ? "s" : ""}.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-base shrink-0">
                {total > 0 ? `${total} trip${total !== 1 ? "s" : ""}` : "Trips"}
              </CardTitle>

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Reservation, car, guest, plate…"
                  className="pl-8 h-8 text-sm"
                />
                {search && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Car filter */}
              {cars.length > 1 && (
                <Select
                  value={carFilter}
                  onValueChange={(v) => {
                    setCarFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-44 text-sm">
                    <SelectValue placeholder="All Cars" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cars</SelectItem>
                    {cars.map((c) => (
                      <SelectItem key={c.plate} value={c.plate}>
                        {c.name}
                        {c.plate ? ` (${c.plate})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_TABS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value === "all" ? "All Status" : s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">From:</span>
                <Input
                  type="date"
                  value={tripFrom}
                  onChange={(e) => {
                    setTripFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-36 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">To:</span>
                <Input
                  type="date"
                  value={tripTo}
                  onChange={(e) => {
                    setTripTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-red-600 hover:text-red-700 h-8 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Quick status tabs */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((s) => {
                const active = statusFilter === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s.value);
                      setPage(1);
                    }}
                    className={
                      "px-3 py-1 text-xs font-medium rounded-full border transition-colors " +
                      (active
                        ? "bg-[#B8860B] text-white border-[#B8860B]"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : trips.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                {hasFilters ? "No trips match your search." : "No trips found for your vehicle."}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {trips.map((t) => {
                    const accent = accentFor(t.status);
                    return (
                      <DashboardRecordCard
                        key={t.id}
                        accentBg={accent.bg}
                        accentBorder={accent.border}
                        typeLabel="Trip"
                        reservationId={t.reservation_id}
                        carName={t.car_name}
                        plate={t.plate_number}
                        guestName={t.guest_name}
                        tripStart={fmt(t.trip_start)}
                        tripEnd={fmt(t.trip_end)}
                        details={[
                          { label: "VIN #", value: t.vin_number || "—" },
                          {
                            label: "Earnings",
                            value:
                              t.earnings != null ? `$${Number(t.earnings).toFixed(2)}` : "—",
                          },
                          { label: "Delivery", value: t.delivery_location || "—" },
                        ]}
                        statusControl={
                          <Badge variant="outline" className={statusBadgeClass(t.status)}>
                            {t.status ?? "—"}
                          </Badge>
                        }
                      />
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <span>
                      Page {page} of {totalPages} ({total} trips)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <ClientPageLinks />
    </AdminLayout>
  );
}
