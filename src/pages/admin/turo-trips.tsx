import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
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
  ChevronDown,
  Gauge,
  Repeat,
} from "lucide-react";
import { differenceInHours } from "date-fns";

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
  vinNumber: string | null;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: "booked" | "cancelled" | "ended" | "returned";
  vehicleSwap: boolean;
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
  gasLevelTripStart: string | null;
  gasLevelTripEnd: string | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TripsSummary {
  totalTrips: number;
  bookedTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalEarnings: number;
  cancelledEarnings: number;
  totalMiles: number;
}

function calculateDaysRented(
  tripStart: string,
  tripEnd: string,
  _status?: string,
): number | null {
  // Show days for every trip including cancelled — the duration is still
  // information operations may care about, and we no longer want blank cells.
  try {
    if (!tripStart || !tripEnd) return null;
    const start = new Date(tripStart);
    const end = new Date(tripEnd);
    const hours = differenceInHours(end, start);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    // Round up: any partial day counts as a day
    return Math.max(1, Math.ceil(hours / 24));
  } catch {
    return null;
  }
}

export default function TuroTripsPage() {
  const [selectedTrip, setSelectedTrip] = useState<TuroTrip | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  // When true, show only reservations flagged as a vehicle swap.
  const [vehicleSwapOnly, setVehicleSwapOnly] = useState(false);
  // Single From/To date RANGE that matches trips whose trip_start OR trip_end
  // falls within [rangeFrom, rangeTo] (Mountain Time). A single day = From==To.
  // Sent to the backend as startDate/endDate/tripEndFrom/tripEndOn + startOrEnd
  // so the backend OR-s the start-side and end-side windows.
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  // Booking Date keeps its own independent range.
  const [bookingFrom, setBookingFrom] = useState("");
  const [bookingTo, setBookingTo] = useState("");
  // Sorting on the date columns (click a header to toggle asc/desc).
  const [sortBy, setSortBy] = useState<"tripStart" | "tripEnd" | "booking">("tripStart");
  // Default earliest→latest by trip time (chronological), per Cathy's request.
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  // Inline odometer editing: tripId → { start, end }
  const [odometerEdits, setOdometerEdits] = useState<
    Record<number, { start: string; end: string }>
  >({});
  const [savingOdometer, setSavingOdometer] = useState<number | null>(null);
  // Inline extras editing: tripId → string
  const [extrasEdits, setExtrasEdits] = useState<Record<number, string>>({});
  const [savingExtras, setSavingExtras] = useState<number | null>(null);
  // Inline plate # editing: tripId → string
  const [plateEdits, setPlateEdits] = useState<Record<number, string>>({});
  const [savingPlate, setSavingPlate] = useState<number | null>(null);
  // Inline CAR Name / VIN # editing (for Turo vehicle-swap trips where the
  // reservation # stays the same but the car changes). tripId → string.
  const [carNameEdits, setCarNameEdits] = useState<Record<number, string>>({});
  const [savingCarName, setSavingCarName] = useState<number | null>(null);
  const [vinEdits, setVinEdits] = useState<Record<number, string>>({});
  const [savingVin, setSavingVin] = useState<number | null>(null);
  // Inline gas level editing: tripId → { start, end }
  const [gasEdits, setGasEdits] = useState<
    Record<number, { start?: string; end?: string }>
  >({});
  const [savingGas, setSavingGas] = useState<number | null>(null);
  // Inline location editing: tripId → { pickup, dropoff, miles }
  const [locationEdits, setLocationEdits] = useState<
    Record<number, { pickup: string; dropoff: string; miles: string }>
  >({});
  const [savingLocations, setSavingLocations] = useState<number | null>(null);
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
    queryKey: [
      "/api/turo-trips",
      statusFilters,
      vehicleSwapOnly,
      debouncedSearchQuery,
      currentPage,
      itemsPerPage,
      rangeFrom, rangeTo,
      bookingFrom, bookingTo,
      sortBy,
      sortDir,
    ],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;
      let url = buildApiUrl(
        `/api/turo-trips?limit=${itemsPerPage}&offset=${offset}`,
      );
      if (statusFilters.length > 0) {
        url += `&status=${statusFilters.join(",")}`;
      }
      if (vehicleSwapOnly) {
        url += `&vehicleSwap=true`;
      }
      if (debouncedSearchQuery) {
        url += `&q=${encodeURIComponent(debouncedSearchQuery)}`;
      }
      // Search and date filters COMPOSE: a search term narrows within the
      // applied date range rather than discarding it. (Previously the date
      // params were skipped whenever a search term was present, so typing in the
      // search box silently ignored the date filter — it looked like "search
      // doesn't work when a date is set." The backend AND-s `q` with the date
      // ranges, so sending both is correct.)
      // From/To range, OR-ed across start and end: a trip matches when its
      // trip_start OR trip_end falls within [rangeFrom, rangeTo]. The backend
      // OR-s the two windows when startOrEnd=true. (A single day = From==To.)
      if (rangeFrom || rangeTo) {
        if (rangeFrom) {
          url += `&startDate=${encodeURIComponent(rangeFrom)}&tripEndFrom=${encodeURIComponent(rangeFrom)}`;
        }
        if (rangeTo) {
          url += `&endDate=${encodeURIComponent(rangeTo)}&tripEndOn=${encodeURIComponent(rangeTo)}`;
        }
        url += `&startOrEnd=true`;
      }
      if (bookingFrom) url += `&bookingFrom=${encodeURIComponent(bookingFrom)}`;
      if (bookingTo) url += `&bookingTo=${encodeURIComponent(bookingTo)}`;
      url += `&sortBy=${sortBy}&sortDir=${sortDir}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  // Fetch summary — scoped to the active date filter when one is set so the
  // stat cards match the rows shown in the table. Falls back to all-time when
  // no date range is selected.
  const { data: summaryData } = useQuery<{
    success: boolean;
    data: TripsSummary;
  }>({
    queryKey: ["/api/turo-trips/summary", rangeFrom, rangeTo, bookingFrom, bookingTo, statusFilters],
    queryFn: async () => {
      let url = buildApiUrl("/api/turo-trips/summary");
      const params = new URLSearchParams();
      if (rangeFrom || rangeTo) {
        if (rangeFrom) { params.set("startDate", rangeFrom); params.set("tripEndFrom", rangeFrom); }
        if (rangeTo) { params.set("endDate", rangeTo); params.set("tripEndOn", rangeTo); }
        params.set("startOrEnd", "true");
      }
      if (bookingFrom) params.set("bookingFrom", bookingFrom);
      if (bookingTo) params.set("bookingTo", bookingTo);
      if (statusFilters.length > 0) params.set("status", statusFilters.join(","));
      if (params.toString()) url += `?${params.toString()}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
  });

  // Fetch cars so we can enrich Turo's bare "Make Model" string with the
  // car's year (e.g. "Lexus GX" → "2023 Lexus GX"). Turo emails don't ship
  // the year; we match by license plate first (unique) and fall back to a
  // make+model substring match.
  const { data: carsData } = useQuery<{
    success: boolean;
    data: Array<{
      id: number;
      make?: string | null;
      model?: string | null;
      year?: number | null;
      makeModel?: string | null;
      plateNumber?: string | null;
      licensePlate?: string | null;
    }>;
  }>({
    queryKey: ["/api/cars", "name-year-lookup"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/cars?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });
  const carsByMakeModel = React.useMemo(() => {
    const map = new Map<
      string,
      {
        year?: number | null;
        plateNumber?: string | null;
        licensePlate?: string | null;
      }
    >();
    for (const c of carsData?.data || []) {
      const key = `${c.make || ""} ${c.model || ""}`.trim().toLowerCase();
      if (key) map.set(key, c);
    }
    return map;
  }, [carsData]);

  // Resolve a plate # for a trip when Turo's email didn't ship one.
  // We try to match the trip's car name (e.g. "GMC HUMMER EV SUV 2025") to a
  // row in the Cars table by make+model substring and return its plate. This
  // keeps the column from showing "-" for cars we already have in the system.
  const resolvePlate = React.useCallback(
    (carName: string | null, currentPlate: string | null): string | null => {
      if (currentPlate && currentPlate.trim()) return currentPlate;
      if (!carName) return null;
      const lower = carName.toLowerCase();
      for (const [key, c] of carsByMakeModel.entries()) {
        if (key && lower.includes(key)) {
          const plate = (c.plateNumber || c.licensePlate || "").trim();
          if (plate) return plate;
        }
      }
      return null;
    },
    [carsByMakeModel],
  );

  // Shared hook (same implementation as before, now lives in one place so
  // every operations tab uses the same matching logic).
  const carNameWithYear = useCarNameWithYear();

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
        const reason =
          data?.error || data?.message || `HTTP ${response.status}`;
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

  // Backfill Locations — re-fetches Turo booking emails from Gmail and fills
  // pickup/return/delivery columns ONLY where they are currently empty. The
  // cron-driven ingestion at /api/turo-trips/sync never updates an existing
  // row, so trips that landed in the DB before the parser could recognize a
  // given email format stay blank forever without this.
  const backfillLocationsMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      // Scope the backfill to the active Trip Start/End range when one is set
      // (trips whose start OR end falls within [rangeFrom, rangeTo]).
      if (rangeFrom || rangeTo) {
        if (rangeFrom) { params.set("startDate", rangeFrom); params.set("tripEndFrom", rangeFrom); }
        if (rangeTo) { params.set("endDate", rangeTo); params.set("tripEndOn", rangeTo); }
        params.set("startOrEnd", "true");
      }
      const qs = params.toString();
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/backfill-locations${qs ? `?${qs}` : ""}`),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason =
          data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      const d = data.data ?? {};
      toast({
        title: "Backfill complete",
        description:
          data.message ||
          `Updated ${d.updated ?? 0} of ${d.candidates ?? 0} trip(s) missing locations.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Backfill failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Repair Dates — re-parses Turo booking + change-request emails and rewrites
  // trip_start / trip_end on rows where the historical TZ-naive parsing got
  // them wrong. Safe to run any time; rows that already match a fresh parse
  // are no-ops at the SQL level (changedRows = 0).
  const repairDatesMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      // Scope the repair to the active Trip Start/End range when one is set
      // (trips whose start OR end falls within [rangeFrom, rangeTo]).
      if (rangeFrom || rangeTo) {
        if (rangeFrom) { params.set("startDate", rangeFrom); params.set("tripEndFrom", rangeFrom); }
        if (rangeTo) { params.set("endDate", rangeTo); params.set("tripEndOn", rangeTo); }
        params.set("startOrEnd", "true");
      }
      const qs = params.toString();
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/repair-dates${qs ? `?${qs}` : ""}`),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason =
          data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      const d = data.data ?? {};
      toast({
        title: "Repair complete",
        description:
          data.message ||
          `Rewrote dates on ${d.updated ?? 0} of ${d.candidates ?? 0} trip(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Repair failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Backfill Plates — for trips missing plate_number, resolve the car via
  // single-candidate name match first, then Bouncie GPS overlap for ambiguous cases.
  const backfillPlatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/backfill-plates`),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason = data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      const d = data.data ?? {};
      toast({
        title: "Plate backfill complete",
        description: `Fixed ${d.fixed ?? 0} of ${d.total ?? 0} trips. ${d.noDevice ?? 0} no device, ${d.noMatch ?? 0} no GPS match.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Plate backfill failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // TEMPORARY — Fix Location Masking. Trips where a guest changed the RETURN
  // location mid-trip (ingested before the change-email parser read the HTML
  // Delivery block) lost the original Pick Up: pickup+return went NULL with only
  // the new drop-off in delivery_location, so the table shows the new address for
  // BOTH columns. This runs server-side (needs Gmail + OpenAI), audits the
  // candidates, and — with apply:true — freezes Pick Up to the original delivered
  // location and moves only Drop Off. Two-step: audit first, then confirm apply.
  const fixMaskingMutation = useMutation({
    mutationFn: async (apply: boolean) => {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/fix-location-masking`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ apply }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      const confirmed = data?.confirmed?.length ?? 0;
      if (!data?.apply) {
        // Audit run — show what would be fixed, then ask to apply.
        const list = (data?.confirmed ?? [])
          .map((c: any) => `${c.rid}: Pick Up "${c.originalPickup}" / Drop Off "${c.changedDropoff}"`)
          .join("\n");
        toast({
          title: `Audit: ${confirmed} masked trip(s) found`,
          description:
            confirmed === 0
              ? `No masked trips. (${data?.candidates ?? 0} candidates checked, ${data?.okSameLocation?.length ?? 0} legit same-location.)`
              : `Click "Apply Masking Fix" to fix them.`,
        });
        if (confirmed > 0) {
          // eslint-disable-next-line no-console
          console.log("[fix-location-masking] confirmed:\n" + list);
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
        const verified = (data?.fixes ?? []).filter((f: any) => f.verified).length;
        toast({
          title: "Masking fix applied",
          description: `Fixed ${verified} of ${data?.fixes?.length ?? 0} trip(s). See console for before/after.`,
        });
        // eslint-disable-next-line no-console
        console.log("[fix-location-masking] fixes:", data?.fixes);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Masking fix failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Per-trip re-parse — re-fetches the original Turo email for ONE trip by
  // reservation ID and rewrites its trip_start/trip_end. Used as the fallback
  // when the bulk Repair Dates pass left a single row wrong (its email used a
  // format the parser regex didn't match at the time of bulk repair).
  const reparseSingleMutation = useMutation({
    mutationFn: async (tripId: number) => {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${tripId}/reparse`),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason =
          data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      const d = data.data ?? {};
      const reservationId = d.reservationId ?? "—";
      const beforeStart = d.before?.tripStart ?? "—";
      const beforeEnd = d.before?.tripEnd ?? "—";
      const parsedStart = d.parsed?.tripStart ?? "(none)";
      const parsedEnd = d.parsed?.tripEnd ?? "(none)";
      const afterStart = d.after?.tripStart ?? "—";
      const afterEnd = d.after?.tripEnd ?? "—";
      const snippet = d.bodySnippet ? `\n\nEmail snippet:\n${d.bodySnippet.slice(0, 240)}…` : "";

      toast({
        title: `Re-parsed #${reservationId} (${d.updated ? "updated" : "no change"})`,
        description:
          `${data.message}\n` +
          `\nBefore  start=${beforeStart}, end=${beforeEnd}` +
          `\nParsed  start=${parsedStart}, end=${parsedEnd}` +
          `\nAfter   start=${afterStart}, end=${afterEnd}` +
          snippet,
        // Keep the toast up longer than usual — there's a lot to read.
        duration: 20000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Re-parse failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch-by-reservation-ID: pull a specific trip from Gmail and create/update it.
  // Used for booking emails the incremental sync missed.
  const [fetchResId, setFetchResId] = React.useState("");
  const [fetchResIdOpen, setFetchResIdOpen] = React.useState(false);
  const fetchByReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const response = await fetch(
        buildApiUrl("/api/turo-trips/fetch-by-reservation"),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId }),
        },
      );
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
      const action = data.action as string;
      const actionLabel =
        action === "created" ? "Created" :
        action === "updated" ? "Dates updated" :
        action === "unchanged" ? "Already up to date" :
        action === "not_found" ? "Not found in Gmail" :
        action === "parse_failed" ? "Email found but parse failed" :
        action;
      toast({
        title: `Reservation #${data.data?.reservationId ?? fetchResId}: ${actionLabel}`,
        description: data.message,
        duration: 10000,
      });
      if (action === "created" || action === "updated") {
        setFetchResId("");
        setFetchResIdOpen(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Fetch failed", description: error.message, variant: "destructive" });
    },
  });

  // Refresh-calendar mutation — pushes updated title/description into existing Google Calendar events.
  // Useful after a format change (e.g. adding plate # or year/model to titles).
  const refreshCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        buildApiUrl("/api/turo-trips/refresh-calendar"),
        { method: "POST", credentials: "include" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const reason =
          data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(reason);
      }
      return data;
    },
    onSuccess: (data) => {
      const d = data.data ?? {};
      const seconds =
        typeof d.durationMs === "number"
          ? `${(d.durationMs / 1000).toFixed(1)}s`
          : "—";
      toast({
        title: "Calendar refresh complete",
        description: `${d.updated ?? 0} updated, ${d.skipped ?? 0} skipped, ${d.errors ?? 0} errors in ${seconds}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Calendar refresh failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save odometer readings for a trip
  const saveOdometers = async (trip: TuroTrip) => {
    const edit = odometerEdits[trip.id];
    const startVal =
      edit?.start !== undefined
        ? edit.start
        : String(trip.tripStartOdometer ?? "");
    const endVal =
      edit?.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");

    setSavingOdometer(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/odometers`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripStartOdometer: startVal !== "" ? parseInt(startVal) : null,
            tripEndOdometer: endVal !== "" ? parseInt(endVal) : null,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      // Clear edit state for this trip
      setOdometerEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Odometer saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save odometer", variant: "destructive" });
    } finally {
      setSavingOdometer(null);
    }
  };

  const saveGasLevels = async (trip: TuroTrip) => {
    const edit = gasEdits[trip.id];
    const startVal = edit?.start !== undefined ? edit.start : (trip.gasLevelTripStart ?? "");
    const endVal = edit?.end !== undefined ? edit.end : (trip.gasLevelTripEnd ?? "");
    setSavingGas(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/gas-levels`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gasLevelTripStart: startVal || null,
            gasLevelTripEnd: endVal || null,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setGasEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({ title: "Gas level saved", description: `Reservation #${trip.reservationId}` });
    } catch {
      toast({ title: "Failed to save gas level", variant: "destructive" });
    } finally {
      setSavingGas(null);
    }
  };

  // Save manually-entered extras for a trip
  const saveExtras = async (trip: TuroTrip) => {
    const edited = extrasEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingExtras(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/extras`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extras: trimmed === "" ? null : trimmed }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setExtrasEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Extras saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save extras", variant: "destructive" });
    } finally {
      setSavingExtras(null);
    }
  };

  const saveLocations = async (trip: TuroTrip) => {
    const edited = locationEdits[trip.id];
    if (!edited) return;
    setSavingLocations(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/locations`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupLocation: edited.pickup,
            returnLocation: edited.dropoff,
            milesIncluded: edited.miles,
          }),
        },
      );
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
        const next = { ...locationEdits };
        delete next[trip.id];
        setLocationEdits(next);
        toast({ title: "Locations updated", description: "Trip locations have been saved." });
      } else {
        toast({ title: "Error", description: "Failed to save locations.", variant: "destructive" });
      }
    } finally {
      setSavingLocations(null);
    }
  };

  // Save plate # for a trip (inline edit). The Turo email doesn't include the
  // plate so this is purely admin-driven — either here or via the bulk import.
  const savePlate = async (trip: TuroTrip, valueOverride?: string) => {
    const edited =
      valueOverride !== undefined ? valueOverride : plateEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingPlate(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/plate`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plateNumber: trimmed === "" ? null : trimmed,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setPlateEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Plate # saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save plate #", variant: "destructive" });
    } finally {
      setSavingPlate(null);
    }
  };

  // Save CAR Name for a trip (inline edit). Needed for Turo vehicle-swap
  // reservations where the reservation # is reused but the car changes, so the
  // car name must be entered manually to match the new Turo listing.
  const saveCarName = async (trip: TuroTrip) => {
    const edited = carNameEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingCarName(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/car-info`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ carName: trimmed === "" ? null : trimmed }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setCarNameEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "CAR Name saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save CAR Name", variant: "destructive" });
    } finally {
      setSavingCarName(null);
    }
  };

  // Save VIN # for a trip (inline edit). Same swap use-case as saveCarName.
  const saveVin = async (trip: TuroTrip) => {
    const edited = vinEdits[trip.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingVin(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/car-info`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vinNumber: trimmed === "" ? null : trimmed }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setVinEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "VIN # saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save VIN #", variant: "destructive" });
    } finally {
      setSavingVin(null);
    }
  };

  // Flag/unflag a reservation as a vehicle swap (same reservation #, the guest
  // was moved to a different car). Display-only flag.
  const [savingSwap, setSavingSwap] = useState<number | null>(null);
  const toggleVehicleSwap = async (trip: TuroTrip) => {
    const next = !trip.vehicleSwap;
    setSavingSwap(trip.id);
    try {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/vehicle-swap`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleSwap: next }),
        },
      );
      if (!response.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      toast({
        title: next ? "Flagged as Vehicle Swap" : "Vehicle Swap flag removed",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to update Vehicle Swap", variant: "destructive" });
    } finally {
      setSavingSwap(null);
    }
  };

  // Parse the user's paste (tab or multi-space separated rows from Excel) and
  // POST it to the bulk-import endpoint. We accept either a header row or none
  // — column order is fixed: Reservation ID, Plate#, VIN#, Trip Start Odometer,
  // Trip Ends Odometer.
  const runImport = async () => {
    const raw = importText.trim();
    if (!raw) {
      toast({
        title: "Nothing to import",
        description: "Paste rows from your Turo export first.",
        variant: "destructive",
      });
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
      const vinRaw = (cols[2] ?? "").trim();
      const startRaw = (cols[3] ?? "").trim();
      const endRaw = (cols[4] ?? "").trim();
      const row: any = { reservationId };
      // Only include fields the user actually filled in so we don't clobber
      // existing values with blanks.
      if (plateRaw !== "" && plateNumber !== null) row.plateNumber = plateNumber;
      if (vinRaw !== "") row.vinNumber = vinRaw;
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
      toast({
        title: "Import failed",
        description: e.message,
        variant: "destructive",
      });
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
  }, [statusFilters, vehicleSwapOnly, debouncedSearchQuery, rangeFrom, rangeTo, bookingFrom, bookingTo, sortBy, sortDir]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder*="Search"]',
        ) as HTMLInputElement;
        searchInput?.focus();
      }
      if (e.key === "Escape" && searchQuery) {
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [searchQuery]);

  const formatCurrency = (amount: number) => {
    const safe = isNaN(amount) || amount == null ? 0 : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(safe);
  };

  // Turo emails express all trip times in Mountain Time (Salt Lake City).
  // The backend stores the resulting UTC instant; render it back in MT so the
  // table matches what the Turo email and the Turo app show, regardless of
  // the admin's browser timezone.
  const MT_DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const MT_DATE_FMT = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  });

  const formatInMt = (dateStr: string, fmt: Intl.DateTimeFormat) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return fmt.format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => formatInMt(dateStr, MT_DATETIME_FMT);
  const formatDateShort = (dateStr: string) => formatInMt(dateStr, MT_DATE_FMT);
  const formatDateTime = (dateStr: string) => formatInMt(dateStr, MT_DATETIME_FMT);

  // Highlight search terms in text
  const highlightText = (text: string | null, searchTerm: string) => {
    if (!text || !searchTerm) return text || "";

    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === searchTerm.toLowerCase() ? (
            <mark
              key={index}
              className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          ),
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
      case "ended":
        return <Badge className="bg-blue-500">Ended</Badge>;
      case "returned":
        return <Badge className="bg-purple-500">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Click a date-column header to sort by it. Clicking the active column flips
  // asc/desc; clicking a new column starts at desc (newest first — the usual
  // default for trip tables).
  const toggleSort = (col: "tripStart" | "tripEnd" | "booking") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };
  const sortArrow = (col: "tripStart" | "tripEnd" | "booking") =>
    sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
              Turo Trips
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated trip tracking from Turo emails
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import from Turo
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => refreshCalendarMutation.mutate()}
              disabled={refreshCalendarMutation.isPending}
              title="Push updated title format (plate, year) into all existing Google Calendar events"
            >
              {refreshCalendarMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Refresh Calendar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => backfillLocationsMutation.mutate()}
              disabled={backfillLocationsMutation.isPending}
              title="Re-scan Turo booking emails and fill in Pick Up / Drop Off for trips where these columns are still empty. Never overwrites a value you've already entered."
            >
              {backfillLocationsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Backfilling...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Backfill Locations
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => backfillPlatesMutation.mutate()}
              disabled={backfillPlatesMutation.isPending}
              title="For trips with no plate number, resolve the car via GPS overlap with Bouncie trip history. Fills plate + VIN. Never overwrites existing values."
            >
              {backfillPlatesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <Car className="w-4 h-4 mr-2" />
                  Backfill Plates
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => repairDatesMutation.mutate()}
              disabled={repairDatesMutation.isPending}
              title="Re-parse the original Turo emails and rewrite Trip Start / Trip Ends as Mountain Time. Fixes rows that were imported before the timezone fix."
            >
              {repairDatesMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Repairing...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Repair Dates
                </>
              )}
            </Button>
            {/* TEMPORARY — Fix Location Masking (audit + apply). Remove once
                historical mid-trip relocation rows are cleaned up. */}
            <Button
              variant="outline"
              className="w-full sm:w-auto border-amber-400 text-amber-700 hover:bg-amber-50"
              onClick={() => fixMaskingMutation.mutate(false)}
              disabled={fixMaskingMutation.isPending}
              title="AUDIT (read-only): find trips where a mid-trip Drop Off change masked the original Pick Up. Shows the list, writes nothing."
            >
              {fixMaskingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Audit Masking
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto border-amber-500 text-amber-800 hover:bg-amber-100"
              onClick={() => {
                if (
                  window.confirm(
                    "Apply the location-masking fix? This freezes Pick Up to the original delivered location and moves only Drop Off for trips where a guest changed the return location mid-trip. Run Audit Masking first to review the list.",
                  )
                ) {
                  fixMaskingMutation.mutate(true);
                }
              }}
              disabled={fixMaskingMutation.isPending}
              title="APPLY: fix the masked trips found by the audit. Freezes Pick Up, moves only Drop Off. Verifies each row after writing."
            >
              {fixMaskingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Apply Masking Fix
                </>
              )}
            </Button>
            {/* Fetch by reservation ID — inline expandable form */}
            {fetchResIdOpen ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  value={fetchResId}
                  onChange={(e) => setFetchResId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && fetchResId.trim()) {
                      fetchByReservationMutation.mutate(fetchResId.trim());
                    } else if (e.key === "Escape") {
                      setFetchResIdOpen(false);
                      setFetchResId("");
                    }
                  }}
                  placeholder="Reservation ID…"
                  className="h-9 w-[160px] sm:w-[180px]"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => fetchResId.trim() && fetchByReservationMutation.mutate(fetchResId.trim())}
                  disabled={!fetchResId.trim() || fetchByReservationMutation.isPending}
                >
                  {fetchByReservationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Go"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFetchResIdOpen(false); setFetchResId(""); }}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setFetchResIdOpen(true)}
                title="Search Gmail for a specific reservation ID and add it to the database if missing"
              >
                <User className="w-4 h-4 mr-2" />
                Fetch by ID
              </Button>
            )}
            <Button
              className="w-full sm:w-auto"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Total Trips
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{summary.totalTrips}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                  <span className="truncate">Booked Trips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {summary.bookedTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground flex-shrink-0" />
                  <span className="truncate">Completed Trips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-foreground">
                  {summary.completedTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive flex-shrink-0" />
                  <span className="truncate">Cancelled Trips</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-destructive">
                  {summary.cancelledTrips}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                  <span className="truncate">Total Earnings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-primary truncate">
                  {formatCurrency(summary.totalEarnings)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive flex-shrink-0" />
                  <span className="truncate">Lost Earnings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-destructive truncate">
                  {formatCurrency(summary.cancelledEarnings)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                  <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground flex-shrink-0" />
                  <span className="truncate">Total Miles</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-foreground truncate">
                  {summary.totalMiles > 0 ? summary.totalMiles.toLocaleString() : "—"}
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
            {/* Row 1: search + status + clear */}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Search any column — guest, car, plate, location... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 w-full"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[180px] justify-between font-normal">
                    <span>
                      {statusFilters.length === 0
                        ? "All Status"
                        : statusFilters.length <= 2
                          ? statusFilters.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" + ")
                          : `${statusFilters.length} selected`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  {(["booked", "ended", "returned", "cancelled"] as const).map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilters.includes(status)}
                      onCheckedChange={(checked) => {
                        setStatusFilters(prev =>
                          checked ? [...prev, status] : prev.filter(s => s !== status)
                        );
                      }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Vehicle Swap filter — show only flagged reservations. */}
              <Button
                variant={vehicleSwapOnly ? "default" : "outline"}
                onClick={() => setVehicleSwapOnly((v) => !v)}
                className="whitespace-nowrap w-full sm:w-auto"
                title="Show only reservations flagged as a vehicle swap"
              >
                <Repeat className="mr-2 h-4 w-4" />
                Vehicle Swap
              </Button>
              {(searchQuery ||
                statusFilters.length > 0 ||
                vehicleSwapOnly ||
                rangeFrom || rangeTo ||
                bookingFrom || bookingTo) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilters([]);
                    setVehicleSwapOnly(false);
                    setRangeFrom(""); setRangeTo("");
                    setBookingFrom(""); setBookingTo("");
                  }}
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  Clear All
                </Button>
              )}
            </div>
            {/* Row 2: single Trip Start/End From–To range + Booking Date. A trip
                matches when its Trip Start OR Trip Ends falls within the
                selected range. Set both boxes to the same date for a single
                day. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
              {/* Trip Start/End range (start OR end within range) */}
              <div className="flex items-center gap-2">
                <label
                  className="text-sm font-medium whitespace-nowrap"
                  title="Show trips whose Trip Start or Trip Ends falls on/after this date."
                >
                  Trip Start/End From:
                </label>
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-[145px]"
                  aria-label="Trip Start/End from"
                />
                <label
                  className="text-sm font-medium whitespace-nowrap ml-2"
                  title="Show trips whose Trip Start or Trip Ends falls on/before this date."
                >
                  To:
                </label>
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-[145px]"
                  aria-label="Trip Start/End to"
                />
              </div>
              {/* Booking Date */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap w-[90px]">Booking:</label>
                <Input
                  type="date"
                  value={bookingFrom}
                  onChange={(e) => setBookingFrom(e.target.value)}
                  className="w-[145px]"
                  aria-label="Booking Date from"
                />
                <span className="text-sm text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={bookingTo}
                  onChange={(e) => setBookingTo(e.target.value)}
                  className="w-[145px]"
                  aria-label="Booking Date to"
                />
              </div>
              {/* Today shortcut — trips starting or ending today */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Denver",
                  }).format(new Date());
                  setRangeFrom(today); setRangeTo(today);
                  setBookingFrom(""); setBookingTo("");
                }}
                className="whitespace-nowrap"
              >
                Today
              </Button>
            </div>

            {/* Search Results Info */}
            {debouncedSearchQuery && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Found{" "}
                  <span className="font-semibold text-foreground">
                    {totalTrips}
                  </span>{" "}
                  result{totalTrips !== 1 ? "s" : ""} for{" "}
                  <span className="font-semibold text-foreground">
                    "{debouncedSearchQuery}"
                  </span>
                  {statusFilters.length > 0 && (
                    <>
                      {" "}
                      in{" "}
                      <span className="font-semibold text-foreground">
                        {statusFilters.join(" + ")}
                      </span>{" "}
                      trips
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Trips Table — freeze panes:
                  • header row sticks to the top while scrolling vertically
                  • first column (Reservation #) stays pinned while scrolling horizontally
                Tailwind `[&>div]:…` targets the shadcn Table's internal scroll
                wrapper so the body scrolls inside the table instead of moving
                the whole page. */}
            <div className="rounded-md border [&>div]:max-h-[calc(100vh-280px)] [&>div]:overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 md:left-0 z-30 bg-muted whitespace-nowrap font-semibold w-[140px] min-w-[140px]">
                      Reservation #
                    </TableHead>
                    <TableHead className="sticky top-0 md:left-[140px] z-30 bg-muted whitespace-nowrap font-semibold w-[200px] min-w-[200px] border-r">
                      CAR Name
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Plate #
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      VIN #
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold cursor-pointer select-none hover:bg-muted/70"
                      onClick={() => toggleSort("booking")}
                      title="Date the booking email was received — not necessarily the exact moment the guest booked on Turo. Click to sort."
                    >
                      Booking Date{sortArrow("booking")}
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold cursor-pointer select-none hover:bg-muted/70"
                      onClick={() => toggleSort("tripStart")}
                      title="Click to sort by Trip Start"
                    >
                      Trip Start{sortArrow("tripStart")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Pick Up Location
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold cursor-pointer select-none hover:bg-muted/70"
                      onClick={() => toggleSort("tripEnd")}
                      title="Click to sort by Trip Ends"
                    >
                      Trip Ends{sortArrow("tripEnd")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Drop Off Location
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Days Rented
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      <span title="Days from booking email received to trip start. May understate true lead time if email was synced late.">
                        Lead Time
                      </span>
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Extras
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Miles Included
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Trip Start Odometer
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Trip Ends Odometer
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Total Miles
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Gas Level Start
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Gas Level End
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Earnings
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Vehicle Swap
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTrips ? (
                    <TableRow>
                      <TableCell colSpan={21} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : trips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={21} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          {debouncedSearchQuery || statusFilters.length > 0 ? (
                            <>
                              <Calendar className="w-12 h-12 opacity-20" />
                              <div>
                                <p className="font-medium text-foreground">
                                  No trips found
                                </p>
                                <p className="text-sm">
                                  Try adjusting your search or filters
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSearchQuery("");
                                  setStatusFilters([]);
                                }}
                              >
                                Clear all filters
                              </Button>
                            </>
                          ) : (
                            <>
                              <Calendar className="w-12 h-12 opacity-20" />
                              <div>
                                <p className="font-medium text-foreground">
                                  No trips yet
                                </p>
                                <p className="text-sm">
                                  Click "Sync Now" to fetch trips from your
                                  emails
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    trips.map((trip) => {
                      const edit = odometerEdits[trip.id];
                      const startOdoVal =
                        edit?.start !== undefined
                          ? edit.start
                          : String(trip.tripStartOdometer ?? "");
                      const endOdoVal =
                        edit?.end !== undefined
                          ? edit.end
                          : String(trip.tripEndOdometer ?? "");
                      const startOdoNum =
                        startOdoVal !== "" ? parseInt(startOdoVal) : null;
                      const endOdoNum =
                        endOdoVal !== "" ? parseInt(endOdoVal) : null;
                      const totalMiles =
                        startOdoNum != null &&
                        endOdoNum != null &&
                        endOdoNum >= startOdoNum
                          ? endOdoNum - startOdoNum
                          : null;
                      const hasUnsavedEdits = edit !== undefined;
                      const extrasVal =
                        extrasEdits[trip.id] !== undefined
                          ? extrasEdits[trip.id]
                          : (trip.extras ?? "");
                      const hasExtrasEdit = extrasEdits[trip.id] !== undefined;

                      return (
                        <TableRow key={trip.id} className="group hover:bg-muted/50">
                          {/* Reservation # — pinned to the left on md+ so it
                              stays visible while scrolling horizontally. On
                              mobile the pin is dropped because two pinned
                              columns (140px + 200px = 340px) leave almost no
                              room on a ~375px phone viewport. Needs an opaque
                              background or other cells bleed through. */}
                          <TableCell
                            className="md:sticky md:left-0 md:z-10 bg-background group-hover:bg-muted/50 font-mono text-sm cursor-pointer w-[140px] min-w-[140px]"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            #
                            {debouncedSearchQuery
                              ? highlightText(
                                  trip.reservationId,
                                  debouncedSearchQuery,
                                )
                              : trip.reservationId}
                            {trip.vehicleSwap && (
                              <Badge className="mt-1 block w-fit bg-amber-500 hover:bg-amber-500 text-[10px] font-semibold">
                                <Repeat className="mr-1 h-3 w-3" />
                                VEHICLE SWAP
                              </Badge>
                            )}
                          </TableCell>

                          {/* CAR — also pinned to the left on md+ so admins
                              keep the car identity in view while scrolling
                              horizontally. Unpinned on mobile (see Reservation
                              # comment above). */}
                          <TableCell
                            className="md:sticky md:left-[140px] md:z-10 bg-background group-hover:bg-muted/50 w-[200px] min-w-[200px] border-r"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(() => {
                              const editing =
                                carNameEdits[trip.id] !== undefined;
                              const current = trip.carName ?? "";
                              const inputValue = editing
                                ? carNameEdits[trip.id]
                                : current;
                              return (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={inputValue}
                                    placeholder="Car name"
                                    title="Enter the car name exactly as it appears on the Turo listing"
                                    className="h-8 w-[170px] text-sm"
                                    onChange={(e) =>
                                      setCarNameEdits((prev) => ({
                                        ...prev,
                                        [trip.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      if (carNameEdits[trip.id] === undefined)
                                        return;
                                      if (
                                        carNameEdits[trip.id].trim() ===
                                        current.trim()
                                      ) {
                                        setCarNameEdits((prev) => {
                                          const next = { ...prev };
                                          delete next[trip.id];
                                          return next;
                                        });
                                        return;
                                      }
                                      saveCarName(trip);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        (e.target as HTMLInputElement).blur();
                                      if (e.key === "Escape") {
                                        setCarNameEdits((prev) => {
                                          const next = { ...prev };
                                          delete next[trip.id];
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  {savingCarName === trip.id && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* Plate # — inline editable. Turo doesn't expose
                              this in the booking email, so admins fill it in
                              here (or via the bulk Import button).
                              When the trip has no plate but the car exists in
                              our Cars table, we suggest that plate inline so
                              the admin can one-click apply it. */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const editing = plateEdits[trip.id] !== undefined;
                              const current = trip.plateNumber ?? "";
                              const inputValue = editing
                                ? plateEdits[trip.id]
                                : current;
                              const suggestion =
                                !current && !editing
                                  ? resolvePlate(trip.carName, current)
                                  : null;
                              return (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={inputValue}
                                    placeholder={suggestion ?? "-"}
                                    className="h-8 w-24 text-sm font-mono"
                                    onChange={(e) =>
                                      setPlateEdits((prev) => ({
                                        ...prev,
                                        [trip.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      if (plateEdits[trip.id] === undefined) return;
                                      if (
                                        plateEdits[trip.id].trim() ===
                                        current.trim()
                                      ) {
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
                                      if (e.key === "Enter")
                                        (e.target as HTMLInputElement).blur();
                                      if (e.key === "Escape") {
                                        setPlateEdits((prev) => {
                                          const next = { ...prev };
                                          delete next[trip.id];
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  {suggestion && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[10px] text-amber-700 hover:bg-amber-100"
                                      title={`Apply plate ${suggestion} from Cars`}
                                      disabled={savingPlate === trip.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        savePlate(trip, suggestion);
                                      }}
                                    >
                                      Use {suggestion}
                                    </Button>
                                  )}
                                  {savingPlate === trip.id && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* VIN # — inline editable for vehicle-swap trips. */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const editing = vinEdits[trip.id] !== undefined;
                              const current = trip.vinNumber ?? "";
                              const inputValue = editing
                                ? vinEdits[trip.id]
                                : current;
                              return (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={inputValue}
                                    placeholder="-"
                                    className="h-8 w-40 text-sm font-mono"
                                    onChange={(e) =>
                                      setVinEdits((prev) => ({
                                        ...prev,
                                        [trip.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      if (vinEdits[trip.id] === undefined) return;
                                      if (
                                        vinEdits[trip.id].trim() ===
                                        current.trim()
                                      ) {
                                        setVinEdits((prev) => {
                                          const next = { ...prev };
                                          delete next[trip.id];
                                          return next;
                                        });
                                        return;
                                      }
                                      saveVin(trip);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        (e.target as HTMLInputElement).blur();
                                      if (e.key === "Escape") {
                                        setVinEdits((prev) => {
                                          const next = { ...prev };
                                          delete next[trip.id];
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  {savingVin === trip.id && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* Booking Date — when the guest reserved the trip
                              on Turo. Parsed from the booking confirmation
                              email and stored in turo_trips.date_booked. */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            <div className="text-sm whitespace-nowrap text-muted-foreground">
                              {trip.dateBooked
                                ? formatDateTime(trip.dateBooked)
                                : "-"}
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

                          {/* Pick Up Location — inline editable */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                value={
                                  locationEdits[trip.id]?.pickup !== undefined
                                    ? locationEdits[trip.id].pickup
                                    : (trip.pickupLocation ??
                                      trip.deliveryLocation ??
                                      "")
                                }
                                placeholder={
                                  trip.deliveryLocation && !trip.pickupLocation
                                    ? "(delivery fallback)"
                                    : "-"
                                }
                                className="h-8 w-36 text-sm"
                                onChange={(e) =>
                                  setLocationEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: {
                                      pickup: e.target.value,
                                      dropoff:
                                        prev[trip.id]?.dropoff !== undefined
                                          ? prev[trip.id].dropoff
                                          : (trip.returnLocation ??
                                            trip.deliveryLocation ??
                                            trip.pickupLocation ??
                                            ""),
                                      miles:
                                        prev[trip.id]?.miles !== undefined
                                          ? prev[trip.id].miles
                                          : (trip.milesIncluded ??
                                            trip.totalDistance ??
                                            ""),
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") {
                                    setLocationEdits((prev) => {
                                      const n = { ...prev };
                                      delete n[trip.id];
                                      return n;
                                    });
                                  }
                                }}
                              />
                              {locationEdits[trip.id] !== undefined && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingLocations === trip.id}
                                  onClick={() => saveLocations(trip)}
                                >
                                  {savingLocations === trip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              )}
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

                          {/* Drop Off Location — inline editable */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                value={
                                  locationEdits[trip.id]?.dropoff !== undefined
                                    ? locationEdits[trip.id].dropoff
                                    : (trip.returnLocation ??
                                      trip.deliveryLocation ??
                                      trip.pickupLocation ??
                                      "")
                                }
                                placeholder={
                                  (trip.deliveryLocation || trip.pickupLocation) && !trip.returnLocation
                                    ? "(delivery fallback)"
                                    : "-"
                                }
                                className="h-8 w-36 text-sm"
                                onChange={(e) =>
                                  setLocationEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: {
                                      pickup:
                                        prev[trip.id]?.pickup !== undefined
                                          ? prev[trip.id].pickup
                                          : (trip.pickupLocation ??
                                            trip.deliveryLocation ??
                                            ""),
                                      dropoff: e.target.value,
                                      miles:
                                        prev[trip.id]?.miles !== undefined
                                          ? prev[trip.id].miles
                                          : (trip.milesIncluded ??
                                            trip.totalDistance ??
                                            ""),
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") {
                                    setLocationEdits((prev) => {
                                      const n = { ...prev };
                                      delete n[trip.id];
                                      return n;
                                    });
                                  }
                                }}
                              />
                              {locationEdits[trip.id] !== undefined && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingLocations === trip.id}
                                  onClick={() => saveLocations(trip)}
                                >
                                  {savingLocations === trip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Days Rented — null for cancelled trips, ceil(hours/24) otherwise */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {(() => {
                              const days = calculateDaysRented(
                                trip.tripStart,
                                trip.tripEnd,
                                trip.status,
                              );
                              return (
                                <span
                                  className={`text-sm tabular-nums ${days != null ? "font-medium text-foreground" : "text-muted-foreground"}`}
                                >
                                  {days != null ? days : "-"}
                                </span>
                              );
                            })()}
                          </TableCell>

                          {/* Lead Time — days between booking date and trip
                              start. Mirrors the backend KPI used by the
                              dashboard's "Avg lead time" column. Same
                              ceil(hours/24) rule as Days Rented so a 23h
                              same-day booking shows as 1 day, not 0. */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {(() => {
                              if (!trip.dateBooked || !trip.tripStart) {
                                return (
                                  <span className="text-sm text-muted-foreground">-</span>
                                );
                              }
                              const hours = differenceInHours(
                                new Date(trip.tripStart),
                                new Date(trip.dateBooked),
                              );
                              if (!Number.isFinite(hours) || hours < 0) {
                                return (
                                  <span className="text-sm text-muted-foreground">-</span>
                                );
                              }
                              const days = Math.max(1, Math.ceil(hours / 24));
                              return (
                                <span className="text-sm tabular-nums font-medium text-foreground">
                                  {days}
                                </span>
                              );
                            })()}
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

                          {/* Miles Included — inline editable; Save button appears after any location field is edited */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Input
                                value={
                                  locationEdits[trip.id]?.miles !== undefined
                                    ? locationEdits[trip.id].miles
                                    : (trip.milesIncluded ??
                                      trip.totalDistance ??
                                      "")
                                }
                                placeholder="-"
                                className="h-8 w-24 text-sm"
                                onChange={(e) =>
                                  setLocationEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: {
                                      pickup:
                                        prev[trip.id]?.pickup !== undefined
                                          ? prev[trip.id].pickup
                                          : (trip.pickupLocation ??
                                            trip.deliveryLocation ??
                                            ""),
                                      dropoff:
                                        prev[trip.id]?.dropoff !== undefined
                                          ? prev[trip.id].dropoff
                                          : (trip.returnLocation ??
                                          trip.deliveryLocation ??
                                          trip.pickupLocation ??
                                          ""),
                                      miles: e.target.value,
                                    },
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    locationEdits[trip.id]
                                  ) {
                                    e.preventDefault();
                                    saveLocations(trip);
                                  }
                                  if (e.key === "Escape") {
                                    setLocationEdits((prev) => {
                                      const n = { ...prev };
                                      delete n[trip.id];
                                      return n;
                                    });
                                  }
                                }}
                              />
                              {locationEdits[trip.id] !== undefined && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingLocations === trip.id}
                                  onClick={() => saveLocations(trip)}
                                >
                                  {savingLocations === trip.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>

                          {/* Trip Start Odometer — inline editable */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              value={startOdoVal}
                              onChange={(e) =>
                                setOdometerEdits((prev) => ({
                                  ...prev,
                                  [trip.id]: {
                                    start: e.target.value,
                                    end:
                                      prev[trip.id]?.end ??
                                      String(trip.tripEndOdometer ?? ""),
                                  },
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
                                    [trip.id]: {
                                      start:
                                        prev[trip.id]?.start ??
                                        String(trip.tripStartOdometer ?? ""),
                                      end: e.target.value,
                                    },
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
                            <span
                              className={`text-sm font-semibold ${totalMiles != null ? "text-foreground" : "text-muted-foreground"}`}
                            >
                              {totalMiles != null
                                ? totalMiles.toLocaleString()
                                : "-"}
                            </span>
                          </TableCell>

                          {/* Gas Level Trip Start */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const edit = gasEdits[trip.id];
                              const val = edit?.start !== undefined ? edit.start : (trip.gasLevelTripStart ?? "");
                              const dirty = edit !== undefined;
                              return (
                                <div className="flex items-center gap-1">
                                  <Select
                                    value={val || "__none__"}
                                    onValueChange={(v) =>
                                      setGasEdits((prev) => ({
                                        ...prev,
                                        [trip.id]: { ...prev[trip.id], start: v === "__none__" ? "" : v },
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[100px] text-xs">
                                      <SelectValue placeholder="--" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">--</SelectItem>
                                      <SelectItem value="empty">Empty</SelectItem>
                                      <SelectItem value="quarter">1/4</SelectItem>
                                      <SelectItem value="half">1/2</SelectItem>
                                      <SelectItem value="three_quarters">3/4</SelectItem>
                                      <SelectItem value="full">Full</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {dirty && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => saveGasLevels(trip)}
                                      disabled={savingGas === trip.id}
                                    >
                                      {savingGas === trip.id ? "…" : "Save"}
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* Gas Level Trip End */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const edit = gasEdits[trip.id];
                              const val = edit?.end !== undefined ? edit.end : (trip.gasLevelTripEnd ?? "");
                              const dirty = edit !== undefined;
                              return (
                                <div className="flex items-center gap-1">
                                  <Select
                                    value={val || "__none__"}
                                    onValueChange={(v) =>
                                      setGasEdits((prev) => ({
                                        ...prev,
                                        [trip.id]: { ...prev[trip.id], end: v === "__none__" ? "" : v },
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[100px] text-xs">
                                      <SelectValue placeholder="--" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">--</SelectItem>
                                      <SelectItem value="empty">Empty</SelectItem>
                                      <SelectItem value="quarter">1/4</SelectItem>
                                      <SelectItem value="half">1/2</SelectItem>
                                      <SelectItem value="three_quarters">3/4</SelectItem>
                                      <SelectItem value="full">Full</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {dirty && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => saveGasLevels(trip)}
                                      disabled={savingGas === trip.id}
                                    >
                                      {savingGas === trip.id ? "…" : "Save"}
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* Earnings */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {trip.status === "cancelled" ? (
                              <span className="text-destructive font-semibold whitespace-nowrap text-sm">
                                ({formatCurrency(trip.cancelledEarnings)})
                              </span>
                            ) : (
                              <span className="text-primary font-semibold whitespace-nowrap text-sm">
                                {formatCurrency(trip.earnings)}
                              </span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell
                            className="cursor-pointer"
                            onClick={() => setSelectedTrip(trip)}
                          >
                            {getStatusBadge(trip.status)}
                          </TableCell>

                          {/* Vehicle Swap toggle — flag this reservation as a
                              vehicle swap (same reservation #, different car). */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant={trip.vehicleSwap ? "default" : "outline"}
                              size="sm"
                              disabled={savingSwap === trip.id}
                              onClick={() => toggleVehicleSwap(trip)}
                              className={`whitespace-nowrap text-xs ${trip.vehicleSwap ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                              title={trip.vehicleSwap ? "Remove Vehicle Swap flag" : "Flag as Vehicle Swap"}
                            >
                              {savingSwap === trip.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Repeat className="mr-1 h-3.5 w-3.5" />
                                  {trip.vehicleSwap ? "Swap" : "Mark Swap"}
                                </>
                              )}
                            </Button>
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
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, totalTrips)}
                  </span>{" "}
                  of <span className="font-medium">{totalTrips}</span> trips
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
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
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
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
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
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
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
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedTrip.status)}
                  {selectedTrip.vehicleSwap && (
                    <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px] font-semibold">
                      <Repeat className="mr-1 h-3 w-3" />
                      VEHICLE SWAP
                    </Badge>
                  )}
                </div>
                {selectedTrip.calendarEventId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Added to Calendar
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Guest Information
                  </h4>
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
                  <h4 className="text-sm font-semibold mb-2">
                    Car Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      {carNameWithYear(
                        selectedTrip.carName,
                        selectedTrip.plateNumber,
                      )}
                    </div>
                    {selectedTrip.vinNumber && (
                      <div className="text-xs text-muted-foreground font-mono">
                        VIN: {selectedTrip.vinNumber}
                      </div>
                    )}
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
                    {selectedTrip.dateBooked ? formatDate(selectedTrip.dateBooked) : '-'}
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
                      const days = calculateDaysRented(
                        selectedTrip.tripStart,
                        selectedTrip.tripEnd,
                        selectedTrip.status,
                      );
                      return days === null ? "-" : days;
                    })()}
                  </div>
                  {(selectedTrip.pickupLocation ||
                    selectedTrip.deliveryLocation) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Pickup:</span>
                      {selectedTrip.pickupLocation ||
                        selectedTrip.deliveryLocation}
                    </div>
                  )}
                  {(selectedTrip.returnLocation ||
                    selectedTrip.deliveryLocation ||
                    selectedTrip.pickupLocation) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Return:</span>
                      {selectedTrip.returnLocation ||
                        selectedTrip.deliveryLocation ||
                        selectedTrip.pickupLocation}
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
                    <span className="text-destructive">
                      {formatCurrency(selectedTrip.cancelledEarnings)} (Lost)
                    </span>
                  ) : (
                    <span className="text-primary">
                      {formatCurrency(selectedTrip.earnings)}
                    </span>
                  )}
                </div>
              </div>

              {selectedTrip.cancellationReason && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Cancellation Reason
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTrip.cancellationReason}
                  </p>
                </div>
              )}

              {/* Per-trip "Re-parse from Turo email" action */}
              <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-muted-foreground text-xs leading-snug max-w-md">
                  Trip Start / Trip Ends look wrong? Re-parse the original
                  Turo email for this reservation. Times will be interpreted
                  as Mountain Time.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    reparseSingleMutation.mutate(selectedTrip.id)
                  }
                  disabled={reparseSingleMutation.isPending}
                >
                  {reparseSingleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Re-parsing…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-parse from Turo email
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk import from Turo export. The user pastes rows straight from
          their Excel export (tab-separated). We update plate # and odometers
          by reservation_id; unknown reservation IDs are reported back. */}
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (!importing) setImportOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from Turo Export</DialogTitle>
            <DialogDescription>
              Paste rows directly from your Turo Excel export. Column order:
              <span className="font-mono">
                {" "}
                Reservation ID, Plate#, VIN#, Trip Start Odometer, Trip Ends Odometer
              </span>
              . Plate # is required to fill the column; VIN# and odometer values are
              optional and can be left blank. Unknown reservation IDs are
              reported, not created.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={
              "41899967\t#G022VR\t1HGCM82633A004352\t\t\n43472991\t#H868CW\t\t\t\n49053682\t#H516HL\t\t23044\t23144"
            }
            className="font-mono text-xs h-64"
            disabled={importing}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AdminPageLinks />
    </AdminLayout>
  );
}
