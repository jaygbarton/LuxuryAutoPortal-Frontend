import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      if (!response.ok) throw new Error("Failed to sync emails");
      return response.json();
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
                    <TableHead className="whitespace-nowrap font-semibold">CAR</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Plate #</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Start</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Pick Up Location</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Trip Ends</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Drop Off Location</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Extras</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Miles Included</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Miles Driven</TableHead>
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

                          {/* Plate # */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <span className="text-sm font-mono">
                              {trip.plateNumber || "-"}
                            </span>
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

                          {/* Drop Off Location */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm max-w-[160px] truncate" title={trip.returnLocation || ""}>
                              {trip.returnLocation || "-"}
                            </div>
                          </TableCell>

                          {/* Extras */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm max-w-[120px] truncate" title={trip.extras || ""}>
                              {trip.extras || "-"}
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

                          {/* Miles Driven */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <span className="text-sm whitespace-nowrap">
                              {trip.milesDriven || "-"}
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
    </AdminLayout>
  );
}
