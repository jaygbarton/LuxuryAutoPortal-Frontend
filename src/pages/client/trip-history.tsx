import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  if (status === "completed") return "bg-green-500/10 text-green-700 border-green-500/30";
  if (status === "booked") return "bg-blue-500/10 text-blue-700 border-blue-500/30";
  if (status === "cancelled") return "bg-red-500/10 text-red-700 border-red-500/30";
  return "bg-gray-500/10 text-gray-600 border-gray-500/30";
}

const LIMIT = 20;

export default function ClientTripHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tripFrom, setTripFrom] = useState("");
  const [tripTo, setTripTo] = useState("");

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearchChange as any)._timer);
    (handleSearchChange as any)._timer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const hasFilters = debouncedSearch || statusFilter !== "all" || tripFrom || tripTo;

  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (tripFrom) params.set("tripFrom", tripFrom);
  if (tripTo) params.set("tripTo", tripTo);

  const { data, isLoading } = useQuery<{ success: boolean; data: ClientTrip[]; total: number }>({
    queryKey: ["/api/client/trips", page, debouncedSearch, statusFilter, tripFrom, tripTo],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/client/trips?${params}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });

  const trips = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
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
          <CardHeader className="pb-3">
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

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Date range */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">From:</span>
                <Input
                  type="date"
                  value={tripFrom}
                  onChange={(e) => { setTripFrom(e.target.value); setPage(1); }}
                  className="h-8 w-36 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">To:</span>
                <Input
                  type="date"
                  value={tripTo}
                  onChange={(e) => { setTripTo(e.target.value); setPage(1); }}
                  className="h-8 w-36 text-sm"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 hover:text-red-700 h-8 px-2 text-xs">
                  Clear
                </Button>
              )}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="whitespace-nowrap">Reservation</TableHead>
                        <TableHead>Car</TableHead>
                        <TableHead className="whitespace-nowrap">VIN #</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead className="whitespace-nowrap">Trip Start</TableHead>
                        <TableHead className="whitespace-nowrap">Trip End</TableHead>
                        <TableHead>Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((t) => (
                        <TableRow key={t.id} className="border-border">
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {t.reservation_id || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-sm whitespace-nowrap">
                            {t.car_name || "—"}
                            {t.plate_number && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({t.plate_number})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {t.vin_number || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{t.guest_name || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fmt(t.trip_start)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fmt(t.trip_end)}</TableCell>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {t.earnings != null ? `$${Number(t.earnings).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadgeClass(t.status)}>
                              {t.status ?? "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <span>Page {page} of {totalPages} ({total} trips)</span>
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
