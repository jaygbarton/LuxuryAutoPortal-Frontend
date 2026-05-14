import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Phone,
  MapPin,
  Car,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
} from "lucide-react";
import { format, differenceInHours } from "date-fns";

interface TuroTrip {
  id: number;
  reservationId: string;
  dateBooked: string;
  guestName: string | null;
  guestLink: string | null;
  phoneNumber: string | null;
  carName: string | null;
  carLink: string | null;
  plateNumber: string | null;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: "booked" | "cancelled" | "completed";
  calendarEventId: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
  totalDistance: string | null;
  extras: string | null;
  milesIncluded: string | null;
  milesDriven: string | null;
  tripStartOdometer: number | null;
  tripEndOdometer: number | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TripsSummary {
  totalTrips: number;
  bookedTrips: number;
  cancelledTrips: number;
  completedTrips: number;
  totalEarnings: number;
  cancelledEarnings: number;
}

function calculateDaysRented(tripStart: string, tripEnd: string, status: string): number | null {
  if (status === "cancelled") return null; // Show "-" for cancelled
  try {
    const start = new Date(tripStart);
    const end = new Date(tripEnd);
    const hours = differenceInHours(end, start);
    // Round up: any partial day counts as a day
    return Math.max(1, Math.ceil(hours / 24));
  } catch {
    return 0;
  }
}

export default function TuroTripsPage() {
  const [selectedTrip, setSelectedTrip] = useState<TuroTrip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "booked" | "cancelled" | "completed">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  // Inline odometer editing: tripId → { start, end }
  const [odometerEdits, setOdometerEdits] = useState<Record<number, { start: string; end: string }>>({});
  const [savingOdometer, setSavingOdometer] = useState<number | null>(null);
  // Inline extras editing: tripId → string
  const [extrasEdits, setExtrasEdits] = useState<Record<number, string>>({});
  const [savingExtras, setSavingExtras] = useState<number | null>(null);
  // Inline plate # editing: tripId → string
  const [plateEdits, setPlateEdits] = useState<Record<number, string>>({});
  const [savingPlate, setSavingPlate] = useState<number | null>(null);
  // Bulk paste-import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const itemsPerPage = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch trips with pagination
  const { data: tripsData, isLoading: isLoadingTrips } = useQuery<{
    success: boolean;
    data: TuroTrip[];
    total: number;
  }>({
    queryKey: ["/api/turo-trips", statusFilter, debouncedSearchQuery, currentPage, itemsPerPage, startDate, endDate],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;
      let url = buildApiUrl(`/api/turo-trips?limit=${itemsPerPage}&offset=${offset}`);
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (debouncedSearchQuery) {
        url += `&guestName=${encodeURIComponent(debouncedSearchQuery)}`;
      }
      if (startDate) {
        url += `&startDate=${encodeURIComponent(startDate)}`;
      }
      if (endDate) {
        url += `&endDate=${encodeURIComponent(endDate)}`;
      }
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  // Fetch summary (responds to date filters)
  const { data: summaryData } = useQuery<{
    success: boolean;
    data: TripsSummary;
  }>({
    queryKey: ["/api/turo-trips/summary", startDate, endDate],
    queryFn: async () => {
      let url = buildApiUrl("/api/turo-trips/summary");
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (params.toString()) url += `?${params.toString()}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
  });

  // Sync emails mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips/sync"), {
        method: "POST",
        credentials: "include",
      });
      // The backend always returns JSON ({ success, message, error? }); surface
      // its real `error` field on failure instead of a generic message so the
      // admin can see "invalid_grant" / "GMAIL_REFRESH_TOKEN missing" / etc.
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason = data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips/summary"] });
      toast({
        title: "Sync completed",
        description: `${data.data.newBookings} bookings, ${data.data.newCancellations} cancellations, ${data.data.tripChanges || 0} changes, ${data.data.vehicleReturns || 0} returns.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save odometer readings for a trip
  const saveOdometers = async (trip: TuroTrip) => {
    const edit = odometerEdits[trip.id];
    const startVal = edit?.start !== undefined ? edit.start : String(trip.tripStartOdometer ?? "");
    const endVal = edit?.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");

    setSavingOdometer(trip.id);
    try {
      const response = await fetch(buildApiUrl(`/api/turo-trips/${trip.id}/odometers`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripStartOdometer: startVal !== "" ? parseInt(startVal) : null,
          tripEndOdometer: endVal !== "" ? parseInt(endVal) : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      // Clear edit state for this trip
      setOdometerEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({ title: "Odometer saved", description: `Reservation #${trip.reservationId}` });
    } catch {
      toast({ title: "Failed to save odometer", variant: "destructive" });
    } finally {
      setSavingOdometer(null);
    }
  };

  // Save manually-entered extras for a trip
  const saveExtras = async (trip: TuroTrip) => {
    const edited = extrasEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingExtras(trip.id);
    try {
      const response = await fetch(buildApiUrl(`/api/turo-trips/${trip.id}/extras`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extras: trimmed === "" ? null : trimmed }),
      });
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setExtrasEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({ title: "Extras saved", description: `Reservation #${trip.reservationId}` });
    } catch {
      toast({ title: "Failed to save extras", variant: "destructive" });
    } finally {
      setSavingExtras(null);
    }
  };

  // Save plate # for a trip (inline edit). The Turo email doesn't include the
  // plate so this is purely admin-driven — either here or via the bulk import.
  const savePlate = async (trip: TuroTrip) => {
    const edited = plateEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingPlate(trip.id);
    try {
      const response = await fetch(buildApiUrl(`/api/turo-trips/${trip.id}/plate`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: trimmed === "" ? null : trimmed }),
      });
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setPlateEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({ title: "Plate # saved", description: `Reservation #${trip.reservationId}` });
    } catch {
      toast({ title: "Failed to save plate #", variant: "destructive" });
    } finally {
      setSavingPlate(null);
    }
  };

  // Parse the user's paste (tab or multi-space separated rows from Excel) and
  // POST it to the bulk-import endpoint. We accept either a header row or none
  // — column order is fixed: Reservation ID, Plate#, Trip Start Odometer,
  // Trip Ends Odometer.
  const runImport = async () => {
    const raw = importText.trim();
    if (!raw) {
      toast({ title: "Nothing to import", description: "Paste rows from your Turo export first.", variant: "destructive" });
      return;
    }

    const rows: any[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      // Split on tabs first (Excel paste); fall back to runs of 2+ spaces.
      const cols = trimmedLine.includes("\t")
        ? trimmedLine.split("\t")
        : trimmedLine.split(/ {2,}/);
      const reservationId = (cols[0] ?? "").trim();
      if (!reservationId) continue;
      // Skip header row.
      if (/reservation/i.test(reservationId)) continue;
      // Plate may carry a leading '#' from the export — strip it.
      const plateRaw = (cols[1] ?? "").trim();
      const plateNumber = plateRaw === "" ? null : plateRaw.replace(/^#/, "");
      const startRaw = (cols[2] ?? "").trim();
      const endRaw = (cols[3] ?? "").trim();
      const row: any = { reservationId };
      // Only include fields the user actually filled in so we don't clobber
      // existing values with blanks.
      if (cols.length >= 2) row.plateNumber = plateNumber;
      if (startRaw !== "") row.tripStartOdometer = startRaw;
      if (endRaw !== "") row.tripEndOdometer = endRaw;
      rows.push(row);
    }

    if (rows.length === 0) {
      toast({ title: "No valid rows found", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(buildApiUrl("/api/turo-trips/import"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Import failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      toast({
        title: "Import complete",
        description: data.skipped?.length
          ? `Updated ${data.updated}. Skipped ${data.skipped.length} unknown reservation ID(s).`
          : `Updated ${data.updated} trip(s).`,
      });
      setImportOpen(false);
      setImportText("");
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const trips = tripsData?.data || [];
  const totalTrips = tripsData?.total || 0;
  const summary = summaryData?.data;
  const totalPages = Math.ceil(totalTrips / itemsPerPage);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, startDate, endDate]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery("");
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [searchQuery]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return dateStr;
    }
  };

  // Highlight search terms in text
  const highlightText = (text: string | null, searchTerm: string) => {
    if (!text || !searchTerm) return text || "";
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === searchTerm.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "booked":
        return <Badge className="bg-green-500">Booked</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">Completed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Turo Trips</h1>
            <p className="text-muted-foreground mt-1">
              Automated trip tracking from Turo emails
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import from Turo
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalTrips}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Booked Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.bookedTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Completed Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {summary.completedTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Cancelled Trips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summary.cancelledTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalEarnings)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Lost Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.cancelledEarnings)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Trips</CardTitle>
            <CardDescription>View and manage all Turo trips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search by guest, car, or reservation ID... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                    title="Clear search (Esc)"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">From:</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">To:</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value: any) => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "all" || startDate || endDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="whitespace-nowrap"
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Search Results Info */}
            {debouncedSearchQuery && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Found <span className="font-semibold text-foreground">{totalTrips}</span> result{totalTrips !== 1 ? 's' : ''} for{" "}
                  <span className="font-semibold text-foreground">"{debouncedSearchQuery}"</span>
                  {statusFilter !== "all" && (
                    <> in <span className="font-semibold text-foreground">{statusFilter}</span> trips</>
                  )}
                </p>
              </div>
            )}

            {/* Trips Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="whitespace-nowrap font-semibold">Reservation #</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">CAR Name</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Plate #</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Start</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Pick Up Location</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Ends</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Days Rented</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Drop Off Location</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Extras</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Miles Included</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Start Odometer</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Ends Odometer</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Total Miles</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTrips ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : trips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          {debouncedSearchQuery || statusFilter !== "all" ? (
                            <>
                              <Calendar className="w-12 h-12 opacity-20" />
                              <div>
                                <p className="font-medium text-foreground">No trips found</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSearchQuery("");
                                  setStatusFilter("all");
                                }}
                              >
                                Clear all filters
                              </Button>
                            </>
                          ) : (
                            <>
                              <Calendar className="w-12 h-12 opacity-20" />
                              <div>
                                <p className="font-medium text-foreground">No trips yet</p>
                                <p className="text-sm">Click "Sync Now" to fetch trips from your emails</p>
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    trips.map((trip) => {
                      const edit = odometerEdits[trip.id];
                      const startOdoVal = edit?.start !== undefined ? edit.start : String(trip.tripStartOdometer ?? "");
                      const endOdoVal = edit?.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");
                      const startOdoNum = startOdoVal !== "" ? parseInt(startOdoVal) : null;
                      const endOdoNum = endOdoVal !== "" ? parseInt(endOdoVal) : null;
                      const totalMiles = startOdoNum != null && endOdoNum != null && endOdoNum >= startOdoNum
                        ? endOdoNum - startOdoNum
                        : null;
                      const hasUnsavedEdits = edit !== undefined;
                      const extrasVal = extrasEdits[trip.id] !== undefined
                        ? extrasEdits[trip.id]
                        : (trip.extras ?? "");
                      const hasExtrasEdit = extrasEdits[trip.id] !== undefined;

                      return (
                        <TableRow
                          key={trip.id}
                          className="hover:bg-muted/50"
                        >
                          {/* Reservation # */}
                          <TableCell
                            className="font-mono text-sm cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            #{debouncedSearchQuery ? highlightText(trip.reservationId, debouncedSearchQuery) : trip.reservationId}
                          </TableCell>

                          {/* CAR */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm whitespace-nowrap">
                              {debouncedSearchQuery ? highlightText(trip.carName, debouncedSearchQuery) : (trip.carName || "-")}
                            </div>
                          </TableCell>

                          {/* Plate # — inline editable. Turo doesn't expose
                              this in the booking email, so admins fill it in
                              here (or via the bulk Import button). */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                value={
                                  plateEdits[trip.id] !== undefined
                                    ? plateEdits[trip.id]
                                    : trip.plateNumber ?? ""
                                }
                                placeholder="-"
                                className="h-8 w-24 text-sm font-mono"
                                onChange={(e) =>
                                  setPlateEdits((prev) => ({ ...prev, [trip.id]: e.target.value }))
                                }
                                onBlur={() => {
                                  if (plateEdits[trip.id] === undefined) return;
                                  const current = trip.plateNumber ?? "";
                                  if (plateEdits[trip.id].trim() === current.trim()) {
                                    setPlateEdits((prev) => {
                                      const next = { ...prev };
                                      delete next[trip.id];
                                      return next;
                                    });
                                    return;
                                  }
                                  savePlate(trip);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") {
                                    setPlateEdits((prev) => {
                                      const next = { ...prev };
                                      delete next[trip.id];
                                      return next;
                                    });
                                  }
                                }}
                              />
                              {savingPlate === trip.id && <Loader2 className="w-3 h-3 animate-spin" />}
                            </div>
                          </TableCell>

                          {/* Trip Start */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm whitespace-nowrap">
                              {formatDateTime(trip.tripStart)}
                            </div>
                          </TableCell>

                          {/* Pick Up Location */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm max-w-[160px] truncate" title={trip.pickupLocation || trip.deliveryLocation || ""}>
                              {trip.pickupLocation || trip.deliveryLocation || "-"}
                            </div>
                          </TableCell>

                          {/* Trip Ends */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm whitespace-nowrap">
                              {formatDateTime(trip.tripEnd)}
                            </div>
                          </TableCell>

                          {/* Days Rented — null for cancelled trips, ceil(hours/24) otherwise */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {(() => {
                              const days = calculateDaysRented(trip.tripStart, trip.tripEnd, trip.status);
                              return (
                                <span className={`text-sm tabular-nums ${days != null ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                                  {days != null ? days : "-"}
                                </span>
                              );
                            })()}
                          </TableCell>

                          {/* Drop Off Location */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm max-w-[160px] truncate" title={trip.returnLocation || ""}>
                              {trip.returnLocation || "-"}
                            </div>
                          </TableCell>

                          {/* Extras — manual entry */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                value={extrasVal}
                                onChange={(e) =>
                                  setExtrasEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && hasExtrasEdit) {
                                    e.preventDefault();
                                    saveExtras(trip);
                                  }
                                }}
                                placeholder="-"
                                className="w-36 h-8 text-sm"
                                title={extrasVal || ""}
                              />
                              {hasExtrasEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingExtras === trip.id}
                                  onClick={() => saveExtras(trip)}
                                >
                                  {savingExtras === trip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Miles Included */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <span className="text-sm whitespace-nowrap">
                              {trip.milesIncluded || trip.totalDistance || "-"}
                            </span>
                          </TableCell>

                          {/* Trip Start Odometer — inline editable */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              value={startOdoVal}
                              onChange={(e) =>
                                setOdometerEdits((prev) => ({
                                  ...prev,
                                  [trip.id]: { start: e.target.value, end: prev[trip.id]?.end ?? String(trip.tripEndOdometer ?? "") },
                                }))
                              }
                              placeholder="0"
                              className="w-24 h-8 text-sm"
                            />
                          </TableCell>

                          {/* Trip Ends Odometer — inline editable */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={endOdoVal}
                                onChange={(e) =>
                                  setOdometerEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: { start: prev[trip.id]?.start ?? String(trip.tripStartOdometer ?? ""), end: e.target.value },
                                  }))
                                }
                                placeholder="0"
                                className="w-24 h-8 text-sm"
                              />
                              {hasUnsavedEdits && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingOdometer === trip.id}
                                  onClick={() => saveOdometers(trip)}
                                >
                                  {savingOdometer === trip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Total Miles (auto-calculated) */}
                          <TableCell>
                            <span className={`text-sm font-semibold ${totalMiles != null ? "text-foreground" : "text-muted-foreground"}`}>
                              {totalMiles != null ? totalMiles.toLocaleString() : "-"}
                            </span>
                          </TableCell>

                          {/* Earnings */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {trip.status === "cancelled" ? (
                              <span className="text-red-600 font-semibold whitespace-nowrap text-sm">
                                ({formatCurrency(trip.cancelledEarnings)})
                              </span>
                            ) : (
                              <span className="text-green-600 font-semibold whitespace-nowrap text-sm">
                                {formatCurrency(trip.earnings)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalTrips)}</span> of{" "}
                  <span className="font-medium">{totalTrips}</span> trips
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Details Modal */}
      <Dialog open={!!selectedTrip} onOpenChange={() => setSelectedTrip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trip Details</DialogTitle>
            <DialogDescription>
              Reservation #{selectedTrip?.reservationId}
            </DialogDescription>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedTrip.status)}
                {selectedTrip.calendarEventId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Added to Calendar
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Guest Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {selectedTrip.guestName || "Unknown"}
                    </div>
                    {selectedTrip.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {selectedTrip.phoneNumber}
                      </div>
                    )}
                    {selectedTrip.guestLink && (
                      <a
                        href={selectedTrip.guestLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on Turo
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Car Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      {selectedTrip.carName || "Unknown"}
                    </div>
                    {selectedTrip.carLink && (
                      <a
                        href={selectedTrip.carLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Listing
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Trip Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Booked:</span>
                    {formatDate(selectedTrip.dateBooked)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Start:</span>
                    {formatDate(selectedTrip.tripStart)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">End:</span>
                    {formatDate(selectedTrip.tripEnd)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Days Rented:</span>
                    {(() => {
                      const days = calculateDaysRented(selectedTrip.tripStart, selectedTrip.tripEnd, selectedTrip.status);
                      return days === null ? "-" : days;
                    })()}
                  </div>
                  {(selectedTrip.pickupLocation || selectedTrip.deliveryLocation) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Pickup:</span>
                      {selectedTrip.pickupLocation || selectedTrip.deliveryLocation}
                    </div>
                  )}
                  {selectedTrip.returnLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Return:</span>
                      {selectedTrip.returnLocation}
                    </div>
                  )}
                  {selectedTrip.totalDistance && (
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Distance:</span>
                      {selectedTrip.totalDistance}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Earnings</h4>
                <div className="text-2xl font-bold">
                  {selectedTrip.status === "cancelled" ? (
                    <span className="text-red-600">
                      {formatCurrency(selectedTrip.cancelledEarnings)} (Lost)
                    </span>
                  ) : (
                    <span className="text-green-600">
                      {formatCurrency(selectedTrip.earnings)}
                    </span>
                  )}
                </div>
              </div>

              {selectedTrip.cancellationReason && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Cancellation Reason</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTrip.cancellationReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk import from Turo export. The user pastes rows straight from
          their Excel export (tab-separated). We update plate # and odometers
          by reservation_id; unknown reservation IDs are reported back. */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!importing) setImportOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from Turo Export</DialogTitle>
            <DialogDescription>
              Paste rows directly from your Turo Excel export. Column order:
              <span className="font-mono"> Reservation ID, Plate#, Trip Start Odometer, Trip Ends Odometer</span>.
              Plate # is required to fill the column; odometer values are optional and can be left blank. Unknown
              reservation IDs are reported, not created.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"41899967\t#G022VR\t\t\n43472991\t#H868CW\t\t\n49053682\t#H516HL\t23044\t23144"}
            className="font-mono text-xs h-64"
            disabled={importing}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>) : (<><Upload className="w-4 h-4 mr-2" />Import</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
