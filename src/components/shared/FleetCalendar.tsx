import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { useTimezone } from "@/hooks/use-timezone";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingNavigation } from "@/components/shared/BookingNavigation";
import { WorkScheduleNavigation } from "@/components/shared/WorkScheduleNavigation";
import { cn } from "@/lib/utils";
import { addUtcDays, dayKeyToUtcDate, mtDayKey, mtTodayKey, utcDateToDayKey } from "@/lib/mt-datetime";
import { calendarBarPosition, calendarInstant, calendarRangeDays, MAX_CALENDAR_DAYS } from "@/lib/fleetCalendarDates";
import { laneCountOf, packLanes } from "@/lib/lanePack";
import {
  eventBlocksAvailability, FLEET_CALENDAR_SOURCES, FLEET_SOURCE_LABELS,
  isCancelledCalendarEvent, normalizeFleetCalendarResponse, normalizeFleetCalendarSync, type FleetCalendarCar, type FleetCalendarEvent,
  type FleetCalendarSyncHealth,
  type FleetCalendarResponse, type FleetCalendarSource,
} from "@/lib/fleetCalendar";

const MIN_DAY_WIDTH = 48;
const MAX_DAY_WIDTH = 400;
const DAY_WIDTH_STEP = 16;
const LABEL_WIDTH = 190;
const LANE_HEIGHT = 34;
const SYNC_REQUEST_KEY = "gla:internal-calendar:last-sync-request";
const SOURCE_COLORS: Record<FleetCalendarSource, string> = {
  turo: "border-[#BD9C5D] bg-[#D3BC8D] text-black",
  owner_rental: "border-blue-400 bg-blue-100 text-blue-950",
  block_off: "border-amber-400 bg-amber-100 text-amber-950",
  maintenance: "border-slate-400 bg-slate-100 text-slate-800",
  direct_booking: "border-emerald-400 bg-emerald-100 text-emerald-950",
};

function eventColor(event: FleetCalendarEvent): string {
  if (event.serviceEventKind === "receipt") return "border-blue-300 bg-blue-50 text-blue-950";
  if (event.serviceEventKind === "history") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (event.serviceEventKind === "due") return event.status === "overdue" ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-950";
  return isCancelledCalendarEvent(event)
    ? "border-dashed border-slate-400 bg-slate-100 text-slate-700"
    : SOURCE_COLORS[event.source];
}

function formatInstant(value: string | null, timezone: string): string {
  if (value === null) return "Not specified";
  if (calendarInstant(value) === null) return "Date needs review";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

function eventLabel(event: FleetCalendarEvent): string {
  return `${isCancelledCalendarEvent(event) ? "Cancelled · " : ""}${event.title || FLEET_SOURCE_LABELS[event.source]}`;
}

type VehicleRow = FleetCalendarCar & { key: string; events: FleetCalendarEvent[]; unmatched?: boolean };

/** Internal planning calendar. Customer booking views keep their separate feed. */
export type CalendarScope = "trips" | "services" | "master";
export function FleetCalendar({ calendarScope = "trips", embedded = false, activeVehiclesOnly = false }: { calendarScope?: CalendarScope; embedded?: boolean; activeVehiclesOnly?: boolean }) {
  const params = new URLSearchParams(useSearch());
  const historyMode = params.get("view") === "history";
  // Query-only tab navigation stays on this route; each mode gets its own date defaults.
  return <FleetCalendarContent key={`${calendarScope}:${historyMode ? "history" : "calendar"}`} historyMode={historyMode} calendarScope={calendarScope} embedded={embedded} activeVehiclesOnly={activeVehiclesOnly} />;
}

function FleetCalendarContent({ historyMode, calendarScope, embedded, activeVehiclesOnly }: { historyMode: boolean; calendarScope: CalendarScope; embedded: boolean; activeVehiclesOnly: boolean }) {
  const allowedSources = calendarScope === "services" ? ["maintenance"] as FleetCalendarSource[] : calendarScope === "trips" ? FLEET_CALENDAR_SOURCES.filter(s => s !== "maintenance") : [...FLEET_CALENDAR_SOURCES];
  const [serviceKind, setServiceKind] = useState("all");
  const queryClient = useQueryClient();
  const activeTimezone = useTimezone();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const linkedBooking = new URLSearchParams(searchParams).get("booking");
  const initialRange = () => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    return from && to && calendarRangeDays(from, to) !== null ? { from, to } : null;
  };
  const [from, setFrom] = useState(() => initialRange()?.from ?? utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(activeTimezone)), historyMode || calendarScope === "services" ? -29 : -3)));
  const [to, setTo] = useState(() => initialRange()?.to ?? utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(activeTimezone)), historyMode ? 0 : 20)));
  const [search, setSearch] = useState("");
  const [fleet, setFleet] = useState<"all" | "active" | "inactive">("all");
  const [occupancy, setOccupancy] = useState<"all" | "blocking" | "none">("all");
  const [status, setStatus] = useState("all");
  const [sources, setSources] = useState<FleetCalendarSource[]>(allowedSources);
  const [showCancelled, setShowCancelled] = useState(true);
  const [chosenView, setView] = useState<"timeline" | "list" | null>(null);
  const view = chosenView ?? (isMobile || historyMode ? "list" : "timeline");
  const [columnWidth, setColumnWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`gla:calendar:${calendarScope}:day-width`));
      if (Number.isFinite(saved) && saved >= MIN_DAY_WIDTH && saved <= MAX_DAY_WIDTH) return saved;
    } catch { /* Use the default when browser storage is unavailable. */ }
    return calendarScope === "services" ? 160 : MIN_DAY_WIDTH;
  });
  useEffect(() => {
    try { localStorage.setItem(`gla:calendar:${calendarScope}:day-width`, String(columnWidth)); } catch { /* Resizing still works without storage. */ }
  }, [calendarScope, columnWidth]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [selected, setSelected] = useState<FleetCalendarEvent | null>(null);
  const [mappingCar, setMappingCar] = useState("unmatched");
  const [syncRequestedAt, setSyncRequestedAt] = useState<number | null>(() => {
    try {
      const stored = Number(sessionStorage.getItem(SYNC_REQUEST_KEY));
      return stored > 0 && stored <= Date.now() && Date.now() - stored < 600_000 ? stored : null;
    } catch { return null; }
  });
  const days = calendarRangeDays(from, to);
  const { data: auth } = useQuery<{ user?: { isSuperAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"], queryFn: authMeQueryFn, staleTime: 300_000,
  });
  const isDeveloper = auth?.user?.isSuperAdmin === true;
  const [recoveryRequestedAt, setRecoveryRequestedAt] = useState<number | null>(null);

  const { data, error, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useQuery<FleetCalendarResponse>({
    queryKey: ["/api/internal-calendar/events", from, to, activeTimezone, calendarScope],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/internal-calendar/events?${new URLSearchParams({ from, to, timezone: activeTimezone, calendar: calendarScope })}`), { credentials: "include" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Calendar request failed (${response.status})`);
      }
      return normalizeFleetCalendarResponse(await response.json());
    },
    enabled: days !== null,
    retry: 1,
    staleTime: 10_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const timezone = data?.timezone || activeTimezone;
  const allEvents = data?.events ?? [];
  const warnings = data?.warnings ?? [];
  const historyNow = Date.now();
  const scopedEvents = useMemo(() => historyMode ? allEvents.filter((event) => {
    const start = calendarInstant(event.start);
    const end = calendarInstant(event.end);
    if (event.timeStatus !== "confirmed" || start === null || end === null || end <= start || end > historyNow) return false;
    const endedOn = mtDayKey(end, timezone);
    return endedOn >= from && endedOn <= to;
  }) : allEvents, [allEvents, historyMode, historyNow, timezone, from, to]);
  const uncertainHistoryCount = historyMode ? allEvents.filter((event) => {
    const start = calendarInstant(event.start);
    const end = calendarInstant(event.end);
    return event.timeStatus !== "confirmed" || start === null || end === null || end <= start;
  }).length : 0;
  const needsDateRecovery = warnings.some(warning => /turo records have.*(?:start|end)/i.test(warning));
  const { data: dateRecovery, error: recoveryReadError, refetch: refetchRecovery } = useQuery<{ issues: { tripId: number; reservationId: string; result: string | null; error: string | null }[] }>({
    queryKey: ["/api/internal-calendar/date-recovery"],
    enabled: needsDateRecovery,
    queryFn: async () => {
      const response = await fetch(buildApiUrl('/api/internal-calendar/date-recovery'), { credentials: 'include' });
      if (!response.ok) throw new Error('Date recovery details could not be loaded.');
      const payload = await response.json();
      if (!Array.isArray(payload.issues)) throw new Error('Date recovery returned an incomplete response.');
      return payload;
    },
    refetchInterval: needsDateRecovery ? 15_000 : false,
  });
  useEffect(() => {
    if (dateRecovery && dateRecovery.issues.length === 0 && needsDateRecovery) void refetch();
  }, [dateRecovery, needsDateRecovery, refetch]);
  const recoverDates = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl('/api/internal-calendar/date-recovery'), { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Date recovery could not be started.');
    },
    onSuccess: () => { setRecoveryRequestedAt(Date.now()); void refetchRecovery(); },
  });
  const { data: liveSync, error: syncStatusError, isFetching: syncStatusLoading, refetch: refetchSync } = useQuery<FleetCalendarSyncHealth>({
    queryKey: ["/api/internal-calendar/sync"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/internal-calendar/sync"), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Google status could not be loaded (${response.status})`);
      const normalized = normalizeFleetCalendarSync(payload?.sync, payload?.import);
      if (!normalized) throw new Error("Google Calendar returned an incomplete status response.");
      return normalized;
    },
    enabled: calendarScope !== "services",
    retry: 1, staleTime: 10_000,
    refetchInterval: () => syncRequestedAt !== null && Date.now() - syncRequestedAt < 120_000 ? 3_000 : 30_000,
  });
  const syncHealth = liveSync ?? data?.sync;
  useEffect(() => {
    if (syncRequestedAt === null) return;
    const importedAt = liveSync?.import.lastSuccessAt ? Date.parse(liveSync.import.lastSuccessAt) : 0;
    const updatedAt = liveSync?.lastSuccessAt ? Date.parse(liveSync.lastSuccessAt) : 0;
    if (importedAt >= syncRequestedAt || updatedAt >= syncRequestedAt) {
      void queryClient.invalidateQueries({ queryKey: ["/api/internal-calendar/events"] });
    }
  }, [syncRequestedAt, liveSync?.import.lastSuccessAt, liveSync?.lastSuccessAt, queryClient]);
  const syncNow = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/internal-calendar/sync"), { method: "POST", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (response.status !== 202 || payload?.accepted !== true) {
        throw new Error(payload?.error || `Google synchronization was not accepted (${response.status})`);
      }
    },
    onSuccess: async () => {
      const requestedAt = Date.now();
      setSyncRequestedAt(requestedAt);
      try { sessionStorage.setItem(SYNC_REQUEST_KEY, String(requestedAt)); } catch { /* Status polling also works without browser storage. */ }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/internal-calendar/sync"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/internal-calendar/events"] }),
      ]);
    },
  });
  const windowBooking = linkedBooking ? allEvents.find((event) => event.bookingKey === linkedBooking) : null;
  const { data: pointBooking, error: pointError, isFetching: pointLoading, refetch: refetchPoint } = useQuery<FleetCalendarEvent>({
    queryKey: ["/api/internal-calendar/bookings", linkedBooking, activeTimezone],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/internal-calendar/bookings/${encodeURIComponent(linkedBooking!)}?${new URLSearchParams({ timezone: activeTimezone })}`), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Booking request failed (${response.status})`);
      return normalizeFleetCalendarResponse({ cars: [], events: [payload?.event] }).events[0];
    },
    enabled: Boolean(linkedBooking && data && !windowBooking),
    retry: 1, staleTime: 10_000,
  });
  const sourceCounts = useMemo(() => Object.fromEntries(FLEET_CALENDAR_SOURCES.map((source) => [source, scopedEvents.filter((event) => event.source === source).length])) as Record<FleetCalendarSource, number>, [scopedEvents]);
  const statuses = useMemo(() => Array.from(new Set(scopedEvents.map((event) => event.status))).sort(), [scopedEvents]);

  const visibleEvents = useMemo(() => scopedEvents.filter((event) => (serviceKind === "all" || event.serviceEventKind === serviceKind) && sources.includes(event.source) && (showCancelled || !isCancelledCalendarEvent(event)) && (status === "all" || event.status === status)), [scopedEvents, sources, showCancelled, status, serviceKind]);
  const rows = useMemo(() => {
    const carMap = new Map<number, VehicleRow>();
    for (const car of data?.cars ?? []) carMap.set(car.carId, { ...car, key: `car-${car.carId}`, events: [] });
    const unmatched = new Map<string, VehicleRow>();
    for (const event of visibleEvents) {
      if (event.carId !== null && carMap.has(event.carId)) {
        carMap.get(event.carId)!.events.push(event);
      } else {
        const key = `unmatched-${event.carId ?? "none"}-${event.carName || "Unknown vehicle"}-${event.plateNumber ?? ""}`;
        if (!unmatched.has(key)) unmatched.set(key, {
          key, carId: event.carId ?? 0, carName: event.carName || "Unmatched vehicle",
          plateNumber: event.plateNumber, carStatus: null, unmatched: true, events: [],
        });
        unmatched.get(key)!.events.push(event);
      }
    }
    // Occupancy uses all sources, even if their bars are filtered out.
    const blockingCars = new Set(scopedEvents.filter(eventBlocksAvailability).map((event) => event.carId));
    const q = search.trim().toLowerCase();
    return [...carMap.values(), ...unmatched.values()].filter((car) => {
      if (activeVehiclesOnly && !['active', 'available', 'in_use'].includes(String(car.carStatus).toLowerCase())) return false;
      if (q && !`${car.carName} ${car.plateNumber ?? ""}`.toLowerCase().includes(q)) return false;
      if (fleet !== "all" && !car.unmatched) {
        const inactive = car.carStatus === "off_fleet";
        if ((fleet === "active" && inactive) || (fleet === "inactive" && !inactive)) return false;
      }
      if (occupancy !== "all") {
        const hasBlocking = car.unmatched ? car.events.some(eventBlocksAvailability) : blockingCars.has(car.carId);
        if ((occupancy === "blocking" && !hasBlocking) || (occupancy === "none" && hasBlocking)) return false;
      }
      return true;
    });
  }, [data?.cars, visibleEvents, scopedEvents, search, fleet, occupancy, activeVehiclesOnly]);
  const listedEvents = useMemo(() => {
    const events = rows.flatMap((row) => row.events);
    return historyMode ? events.sort((a, b) => calendarInstant(b.end)! - calendarInstant(a.end)! || a.id.localeCompare(b.id)) : events;
  }, [rows, historyMode]);
  // A phone agenda includes every filtered record once, including ongoing and undated events.
  const agendaGroups = useMemo(() => {
    const groups = new Map<string, FleetCalendarEvent[]>();
    for (const event of historyMode ? listedEvents : [...listedEvents].sort((a, b) => (calendarInstant(a.start) ?? Infinity) - (calendarInstant(b.start) ?? Infinity) || a.id.localeCompare(b.id))) {
      const start = calendarInstant(historyMode ? event.end : event.start);
      const day = start === null ? "undated" : mtDayKey(start, timezone);
      const key = day < from ? "ongoing" : day;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }
    return [...groups.entries()];
  }, [listedEvents, from, timezone, historyMode]);
  const needsReview = listedEvents.filter((event) => calendarInstant(event.start) === null || (event.end !== null && (calendarInstant(event.end) === null || calendarInstant(event.end)! < calendarInstant(event.start)!)));
  const dayList = useMemo(() => days ? Array.from({ length: days }, (_, index) => addUtcDays(dayKeyToUtcDate(from), index)) : [], [from, days]);
  const hasFilters = search !== "" || fleet !== "all" || occupancy !== "all" || status !== "all" || sources.length !== allowedSources.length || serviceKind !== "all" || !showCancelled;
  const attentionEvents = listedEvents.filter((event) => event.carId === null || event.timeStatus !== "confirmed" || event.googleClassification === "unclassified" || needsReview.includes(event));

  useEffect(() => {
    setSelected(linkedBooking ? windowBooking ?? pointBooking ?? null : null);
  }, [linkedBooking, windowBooking, pointBooking]);

  const classification = useMutation({
    mutationFn: async (update: { event: FleetCalendarEvent; classification: "blocked" | "ignored" | "unclassified"; carId: number | null }) => {
      const response = await fetch(buildApiUrl(`/api/internal-calendar/google-blocks/${update.event.sourceId}`), {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: update.classification, carId: update.carId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Mapping could not be saved (${response.status})`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/internal-calendar/events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/internal-calendar/bookings"] }),
      ]);
    },
  });

  useEffect(() => {
    setMappingCar(selected?.carId ? String(selected.carId) : "unmatched");
    classification.reset();
  }, [selected?.bookingKey, selected?.carId]);

  function selectEvent(event: FleetCalendarEvent | null) {
    setSelected(event);
    const params = new URLSearchParams(window.location.search);
    if (event) {
      params.set("booking", event.bookingKey);
      params.set("from", from);
      params.set("to", to);
    } else {
      params.delete("booking");
    }
    setLocation(`${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function shift(daysToShift: number) {
    if (!days) return;
    setFrom(utcDateToDayKey(addUtcDays(dayKeyToUtcDate(from), daysToShift)));
    setTo(utcDateToDayKey(addUtcDays(dayKeyToUtcDate(to), daysToShift)));
  }
  function resetFilters() {
    setSearch(""); setFleet("all"); setOccupancy("all"); setStatus("all"); setSources(allowedSources); setServiceKind("all"); setShowCancelled(true);
  }

  function jumpToEvent(event: FleetCalendarEvent) {
    const start = calendarInstant(event.start);
    if (start === null) return;
    const first = addUtcDays(dayKeyToUtcDate(mtDayKey(start, timezone)), -3);
    const end = calendarInstant(event.end);
    const last = end === null ? addUtcDays(first, 23) : addUtcDays(dayKeyToUtcDate(mtDayKey(end, timezone)), 3);
    const boundedLast = last.getTime() - first.getTime() >= MAX_CALENDAR_DAYS * 86_400_000 ? addUtcDays(first, MAX_CALENDAR_DAYS - 1) : last;
    setFrom(utcDateToDayKey(first));
    setTo(utcDateToDayKey(boundedLast));
    selectEvent(null);
  }

  const verifiedGoogleAt = syncHealth?.import.lastSuccessAt ?? syncHealth?.lastSuccessAt;
  const googleConnectionLabel = syncHealth?.configured === false ? "Not connected"
    : syncHealth?.import.lastError ? "Connection needs attention"
      : verifiedGoogleAt ? "Connected"
        : syncHealth?.configured === true ? "Configured · first connection pending" : "Connection not yet verified";
  const labelWidth = isMobile ? 150 : LABEL_WIDTH;
  const syncCompleted = syncRequestedAt !== null && syncHealth?.lastSuccessAt && Date.parse(syncHealth.lastSuccessAt) >= syncRequestedAt;
  const selectedSourceUrl = selected?.detailUrl ?? (selected?.source === "maintenance" ? `/admin/operations?tab=maintenance&appointment=${selected.sourceId}` : null);

  function eventButton(event: FleetCalendarEvent) {
    return <button type="button" className="min-h-11 text-left text-sm font-medium underline-offset-4 hover:underline md:min-h-0" onClick={() => selectEvent(event)}>{eventLabel(event)}</button>;
  }

  function resetDateRange() {
    const today = dayKeyToUtcDate(mtTodayKey(timezone));
    setFrom(utcDateToDayKey(addUtcDays(today, historyMode || calendarScope === "services" ? -29 : -3)));
    setTo(utcDateToDayKey(addUtcDays(today, historyMode ? 0 : 20)));
  }
  const compactRange = days ? `${dayKeyToUtcDate(from).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })} – ${dayKeyToUtcDate(to).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}` : "Choose dates";
  const dateFields = <>
    <div className="min-w-0 space-y-1"><Label className="text-xs text-muted-foreground md:text-sm" htmlFor="fleet-calendar-from">From</Label><Input id="fleet-calendar-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-11 min-w-0 w-full text-base md:h-9 md:w-40 md:text-sm" /></div>
    <div className="min-w-0 space-y-1"><Label className="text-xs text-muted-foreground md:text-sm" htmlFor="fleet-calendar-to">To</Label><Input id="fleet-calendar-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-11 min-w-0 w-full text-base md:h-9 md:w-40 md:text-sm" /></div>
  </>;
  const viewControls = <div className="ml-auto flex rounded-lg bg-muted p-0.5" aria-label="Calendar view">
    <Button className="min-h-11 px-2 text-xs md:min-h-9 md:px-3 md:text-sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")} aria-pressed={view === "list"}>{isMobile ? "Agenda" : "List"}</Button>
    <Button className="min-h-11 px-2 text-xs md:min-h-9 md:px-3 md:text-sm" variant={view === "timeline" ? "default" : "ghost"} onClick={() => setView("timeline")} aria-pressed={view === "timeline"}>Timeline</Button>
  </div>;
  const refreshButton = <Button variant="outline" aria-label="Refresh" onClick={() => { void refetch(); if (calendarScope !== "services") void refetchSync(); if (pointError) void refetchPoint(); }} disabled={isFetching || !days} className="h-11 w-11 shrink-0 px-0 md:h-auto md:w-auto md:gap-2 md:px-4"><RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /><span className="hidden md:inline">Refresh</span></Button>;
  const filterCount = Number(fleet !== "all") + Number(status !== "all") + Number(occupancy !== "all") + allowedSources.length - sources.length + Number(serviceKind !== "all") + Number(!showCancelled);
  const filterControls = <>
    <div className="grid gap-3 md:flex md:flex-wrap md:items-center">
      {activeVehiclesOnly ? <span className="text-xs text-muted-foreground">Active vehicles only</span> : <Select value={fleet} onValueChange={(value) => setFleet(value as typeof fleet)}><SelectTrigger className="min-h-11 w-full text-base md:min-h-9 md:w-40 md:text-sm" aria-label="Fleet filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vehicles</SelectItem><SelectItem value="active">Active vehicles</SelectItem><SelectItem value="inactive">Inactive vehicles</SelectItem></SelectContent></Select>}
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="min-h-11 w-full text-base md:min-h-9 md:w-40 md:text-sm" aria-label="Event status filter"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
      <Select value={occupancy} onValueChange={(value) => setOccupancy(value as typeof occupancy)}><SelectTrigger className="min-h-11 w-full text-base md:min-h-9 md:w-64 md:text-sm" aria-label="Blocking event filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All activity</SelectItem><SelectItem value="blocking">Blocking events in view</SelectItem><SelectItem value="none">No blocking events in view</SelectItem></SelectContent></Select>
      {hasFilters && !isMobile && <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>}
    </div>
    <div className="mt-3 grid divide-y divide-border md:flex md:flex-wrap md:gap-x-5 md:gap-y-1 md:divide-y-0 md:rounded-lg md:border md:border-border md:px-3 md:py-1">
      {allowedSources.map((source) => <label key={source} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={sources.includes(source)} onCheckedChange={(checked) => setSources((current) => checked === true ? [...current, source] : current.filter((value) => value !== source))} aria-label={FLEET_SOURCE_LABELS[source]} />
        <span className={cn("h-3 w-3 shrink-0 rounded-full border", SOURCE_COLORS[source])} /> <span>{FLEET_SOURCE_LABELS[source]}</span><span className="ml-auto pl-1 text-xs text-muted-foreground md:ml-0">{sourceCounts[source]}</span>
      </label>)}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={showCancelled} onCheckedChange={(checked) => setShowCancelled(checked === true)} aria-label="Show cancelled trips" /><span className="h-3 w-3 rounded-full border border-dashed border-slate-400 bg-slate-100" /> Show cancelled trips</label>
    </div>
    {calendarScope !== "trips" && <select aria-label="Service calendar events" value={serviceKind} onChange={e => setServiceKind(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm md:w-64"><option value="all">All event types</option><option value="appointment">Scheduled service</option><option value="due">Service due reminders</option><option value="receipt">Service receipts / files</option><option value="history">Service history</option></select>}
  </>;

  return (
    <div className="min-w-0 space-y-3 md:space-y-4" data-testid="fleet-calendar">
      {!embedded && calendarScope === "trips" && <WorkScheduleNavigation />}
      <div className={cn("flex items-start justify-between gap-3", isMobile && "sr-only")}>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><CalendarDays className="h-5 w-5 text-primary" /> {historyMode ? "History" : calendarScope === "services" ? "Service Calendar" : calendarScope === "master" ? "Master Internal Calendar" : "Vehicle Trips Calendar"}</h1>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">{historyMode ? "Trips, blocks and scheduled service that ended in this date range." : calendarScope === "services" ? "Past service, receipt records, due reminders and scheduled appointments." : calendarScope === "master" ? "Vehicle trips and service calendars combined." : "Turo trips, owner rentals, direct rentals and blocked-off dates."}</p>
        </div>
        {!isMobile && refreshButton}
      </div>
      {historyMode && <p className={cn("text-xs text-muted-foreground", isMobile && "sr-only")} data-testid="history-range-description">History range · {from} through {to}</p>}
      {isMobile ? <div className="flex min-w-0 items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => shift(-7)} disabled={!days}><ChevronLeft /></Button>
        <Button variant="ghost" className="h-11 min-w-0 flex-1 gap-1 px-1 text-sm" aria-label={`Change date range, ${compactRange}`} onClick={() => setFiltersOpen(true)}><span className="truncate">{compactRange}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></Button>
        <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => shift(7)} disabled={!days}><ChevronRight /></Button>
        {refreshButton}
      </div> : <div className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border bg-card p-3 md:flex md:flex-wrap md:gap-3 md:rounded-lg">
        {dateFields}
        <div className="flex min-w-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => shift(-7)} disabled={!days}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" className="px-2" onClick={resetDateRange}>Today</Button>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => shift(7)} disabled={!days}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {viewControls}
      </div>}
      {!days && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Choose valid dates in order, spanning no more than {MAX_CALENDAR_DAYS} days.</div>}

      <div className="flex min-w-0 items-center gap-2">
        <Input aria-label="Search vehicle or plate" placeholder="Search vehicle or plate…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 min-w-0 flex-1 text-base md:h-9 md:max-w-60 md:text-sm" />
        {isMobile && <Button variant="outline" className="h-11 shrink-0 gap-2 px-3" onClick={() => setFiltersOpen(true)} aria-label={`Calendar filters${filterCount ? `, ${filterCount} active` : ""}`}><SlidersHorizontal className="h-4 w-4" />Filters{filterCount > 0 && <span className="rounded-full bg-primary/20 px-1.5 text-xs">{filterCount}</span>}</Button>}
      </div>
      {!isMobile && filterControls}
      {isMobile && <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}><DialogContent className="bottom-0 top-auto flex w-full max-w-none translate-y-0 flex-col gap-3 overflow-hidden rounded-b-none rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader className="shrink-0 pr-10 text-left"><DialogTitle>Calendar filters</DialogTitle><DialogDescription>Choose dates, vehicles and events.</DialogDescription></DialogHeader>
        <Button variant="ghost" size="icon" className="absolute right-2 top-2" style={{ position: "absolute" }} aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></Button>
        <div className="min-h-0 space-y-4 overflow-y-auto py-1"><div className="grid grid-cols-2 gap-3">{dateFields}</div>{!days && <p role="alert" className="text-xs text-destructive">Choose valid dates in order, spanning no more than {MAX_CALENDAR_DAYS} days.</p>}<div className="flex items-center justify-between gap-3"><Button variant="ghost" onClick={resetDateRange}>Today</Button>{viewControls}</div>{filterControls}</div>
        <div className="flex shrink-0 gap-2 border-t border-border pt-3"><Button variant="outline" onClick={resetFilters}>Reset</Button><Button className="flex-1" disabled={!days} onClick={() => setFiltersOpen(false)}>Show {listedEvents.length} events</Button></div>
      </DialogContent></Dialog>}


      {calendarScope !== "trips" && <p className="rounded-lg bg-primary/10 p-3 text-xs text-muted-foreground">Service due reminders and receipt/history markers do not block vehicle availability. Only confirmed service appointments reserve time.</p>}
      {isError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><p className="font-medium">Calendar could not be refreshed.</p><p>{error instanceof Error ? error.message : "Please retry."}</p>{data && <p className="mt-1">Previously loaded records remain visible. They may be out of date.</p>}</div>}
      {data && (data.complete === false || (calendarScope !== "services" && data.availabilityComplete === false) || warnings.length > 0 || uncertainHistoryCount > 0) && (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 md:p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {isMobile ? <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left font-medium" aria-expanded={coverageOpen} onClick={() => setCoverageOpen(!coverageOpen)}><span>Calendar coverage needs attention.</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", coverageOpen && "rotate-180")} /></button> : <p className="font-medium">Calendar coverage needs attention.</p>}
            {isMobile && !coverageOpen && historyMode && uncertainHistoryCount > 0 && <p className="text-xs">{uncertainHistoryCount} date records need review</p>}
            {(!isMobile || coverageOpen) && (historyMode && uncertainHistoryCount > 0 ? <p className="text-xs md:mt-1 md:text-sm">{uncertainHistoryCount} {uncertainHistoryCount === 1 ? "record has" : "records have"} unconfirmed or open-ended dates and {uncertainHistoryCount === 1 ? "is" : "are"} not classified as past. <a href="/admin/trip-calendar" className="underline">Review in Calendar</a>.</p> : <p className="text-xs md:mt-1 md:text-sm">An empty period does not confirm that a vehicle is available for booking.</p>)}
            {(!isMobile || coverageOpen) && <div className="break-words">
            {warnings.map((warning, index) => <p key={index} className="mt-1">{warning}</p>)}
            {needsDateRecovery && <div className="mt-3 space-y-2 border-t border-amber-300 pt-3">
              <p>Confirmed Turo emails are checked automatically to recover missing or invalid dates.</p>
              {data.role === 'admin' && <Button variant="outline" disabled={recoverDates.isPending} onClick={() => recoverDates.mutate()}>Recover trip dates</Button>}
              {recoveryRequestedAt && <p role="status">Recovery requested. Results will update here; confirmed dates are never guessed.</p>}
              {(recoverDates.error || recoveryReadError) && <p role="alert">{(recoverDates.error || recoveryReadError) instanceof Error ? ((recoverDates.error || recoveryReadError) as Error).message : 'Recovery needs attention.'}</p>}
              {dateRecovery?.issues.map(issue => <p key={issue.tripId}>Reservation #{issue.reservationId || issue.tripId}: {issue.error || (issue.result === 'source_changed' ? 'This record changed during recovery; it will be checked again.' : 'Waiting for a confirmed source email.')} <a className="underline" href={`/admin/turo-trips?reservation=${encodeURIComponent(issue.reservationId)}`}>Review trip</a></p>)}
            </div>}
            </div>}
          </div>
        </div>
      )}
      {calendarScope !== "services" && (
      <section className="space-y-2 rounded-lg border border-border bg-card p-2 text-sm md:p-3" aria-label="Google Calendar status">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-medium md:text-sm">Google Calendar: {googleConnectionLabel}</h2>
            {syncHealth && <p className="mt-1 text-xs text-muted-foreground">{isMobile && !syncDetailsOpen ? "" : "Google Calendar sync: "}{syncHealth.status.replace(/_/g, " ")} · {syncHealth.pending} pending · {syncHealth.failed} failed{syncHealth.attention > 0 ? ` · ${syncHealth.attention} need review` : ""}</p>}
          </div>
          {isMobile && <Button variant="ghost" size="icon" aria-label="Google sync details" aria-expanded={syncDetailsOpen} onClick={() => setSyncDetailsOpen(!syncDetailsOpen)}><ChevronDown className={cn("transition-transform", syncDetailsOpen && "rotate-180")} /></Button>}
          {data?.role === "admin" && (!isMobile || syncDetailsOpen) && <Button variant="outline" onClick={() => syncNow.mutate()} disabled={syncNow.isPending || syncHealth?.configured === false || syncHealth?.enabled === false} className="gap-2"><RefreshCw className={cn("h-4 w-4", syncNow.isPending && "animate-spin")} />{syncNow.isPending ? "Requesting sync…" : "Sync now"}</Button>}
        </div>
        {syncStatusLoading && !syncHealth && <p role="status" className="text-xs text-muted-foreground">Checking Google Calendar status…</p>}
        {syncHealth && (!isMobile || syncDetailsOpen) && <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground"><div><dt className="inline">Last Google import: </dt><dd className="inline">{syncHealth.import.lastSuccessAt ? formatInstant(syncHealth.import.lastSuccessAt, timezone) : "Not completed yet"}</dd></div><div><dt className="inline">Last Google update: </dt><dd className="inline">{syncHealth.lastSuccessAt ? formatInstant(syncHealth.lastSuccessAt, timezone) : "Not completed yet"}</dd></div></dl>}
        {syncHealth?.enabled === false && <p className="text-xs text-amber-800">Google synchronization is disabled for this environment.</p>}
        {syncHealth?.import.lastError && <p role="alert" className="text-xs text-destructive">Google import failed: {syncHealth.import.lastError}</p>}
        {syncHealth?.lastError && <p role="alert" className="text-xs text-destructive">Google update failed: {syncHealth.lastError}</p>}
        {syncStatusError && <p role="alert" className="text-xs text-destructive">Google status could not be refreshed: {syncStatusError instanceof Error ? syncStatusError.message : "Please retry."}</p>}
        {syncNow.isError && <p role="alert" className="text-xs text-destructive">{syncNow.error instanceof Error ? syncNow.error.message : "Google synchronization could not be requested."}</p>}
        {syncRequestedAt !== null && <p role="status" className="text-xs text-muted-foreground">{syncCompleted ? "Google synchronization completed." : syncHealth?.lastError || syncHealth?.import.lastError ? "Sync request accepted. Google still reports an error; review the message above." : "Sync request accepted. Checking Google import and updates…"}</p>}
      </section>
      )}
      {linkedBooking && pointLoading && <p role="status" className="text-sm text-muted-foreground">Loading linked booking…</p>}
      {linkedBooking && pointError && !windowBooking && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">The linked booking could not be loaded: {pointError instanceof Error ? pointError.message : "Please retry."}</p>}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{listedEvents.length} of {scopedEvents.length} {historyMode ? "past events" : "events"} shown · {rows.length} vehicles · {timezone}</span><span className="sr-only md:not-sr-only">{isFetching ? "Refreshing…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span></div>

      {view === "timeline" && <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2">
        <Label htmlFor={`fleet-calendar-day-width-${calendarScope}`} className="shrink-0 text-sm">Day width</Label>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Narrower days" disabled={columnWidth <= MIN_DAY_WIDTH} onClick={() => setColumnWidth(width => Math.max(MIN_DAY_WIDTH, width - DAY_WIDTH_STEP))}><ChevronLeft className="h-4 w-4" /></Button>
          <input id={`fleet-calendar-day-width-${calendarScope}`} type="range" min={MIN_DAY_WIDTH} max={MAX_DAY_WIDTH} step={DAY_WIDTH_STEP} value={columnWidth} onChange={event => setColumnWidth(Number(event.target.value))} className="h-11 min-w-0 w-full cursor-pointer accent-primary" aria-valuetext={`${columnWidth} pixels per day`} />
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Wider days" disabled={columnWidth >= MAX_DAY_WIDTH} onClick={() => setColumnWidth(width => Math.min(MAX_DAY_WIDTH, width + DAY_WIDTH_STEP))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <p className="w-full text-xs text-muted-foreground sm:w-auto">Widen days to read events. Scroll sideways for more dates.</p>
      </div>}

      {isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…</div> : !days || !data ? null : view === "list" && isMobile ? (
        <div className="space-y-5" data-testid="fleet-calendar-agenda">
          {agendaGroups.map(([day, events]) => <section key={day} aria-label={day === "undated" ? "Dates need review" : day === "ongoing" ? "Started before this range" : dayKeyToUtcDate(day).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}>
            <h2 className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
              <span>{historyMode ? "Ended " : ""}{day === "undated" ? "Dates need review" : day === "ongoing" ? "Started before this range" : dayKeyToUtcDate(day).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}</span><span className="text-xs font-normal text-muted-foreground">{events.length} {events.length === 1 ? "event" : "events"}</span>
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {events.map((event) => <button key={event.id} type="button" aria-label={`${eventLabel(event)} · ${event.carName || "Unmatched vehicle"}`} className="flex w-full min-w-0 items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => selectEvent(event)}>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border", eventColor(event))} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{event.carName || "Unmatched vehicle"}</span>
                  <span className="block text-[11px] text-muted-foreground">{FLEET_SOURCE_LABELS[event.source]}{event.plateNumber ? ` · ${event.plateNumber}` : ""}</span>
                  <span className="block text-sm leading-snug [overflow-wrap:anywhere]">{eventLabel(event)}</span>
                  <span className="flex items-start gap-1.5 pt-0.5 text-xs leading-relaxed text-muted-foreground"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="block">{formatInstant(event.start, timezone)}</span><span className="block">to {event.end === null && event.start ? "Ongoing / no end recorded" : formatInstant(event.end, timezone)}</span></span></span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px]"><span className={cn("rounded px-1.5 py-0.5", isCancelledCalendarEvent(event) ? "bg-muted text-muted-foreground" : "bg-primary/10 text-foreground")}>{event.status.replace(/_/g, " ")}</span><span className="text-muted-foreground">{eventBlocksAvailability(event) ? "Blocks vehicle" : "Does not block"}</span>{(event.carId === null || event.timeStatus !== "confirmed") && <span className="text-amber-800">Needs review</span>}</span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>)}
            </div>
          </section>)}
          {listedEvents.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center"><CalendarDays className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">No events match the current filters.</p>{hasFilters && <Button variant="ghost" onClick={resetFilters} className="mt-2">Clear filters</Button>}</div>}
        </div>
      ) : view === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Vehicle", "Event", "Starts", "Ends", "Status", "Booking impact"].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{listedEvents.map((event) => <tr key={event.id} className="border-t border-border"><td className="p-3">{event.carName || "Unmatched vehicle"}<div className="text-xs text-muted-foreground">{event.plateNumber}</div></td><td className="p-3">{eventButton(event)}<div className="text-xs text-muted-foreground">{FLEET_SOURCE_LABELS[event.source]}</div></td><td className="whitespace-nowrap p-3">{formatInstant(event.start, timezone)}</td><td className="whitespace-nowrap p-3">{event.end === null && event.start ? "Ongoing / no end recorded" : formatInstant(event.end, timezone)}</td><td className="p-3">{event.status.replace(/_/g, " ")}</td><td className="p-3">{eventBlocksAvailability(event) ? "Blocks vehicle" : "Does not block"}</td></tr>)}</tbody></table>{listedEvents.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No events match the current filters.</p>}</div>
      ) : rows.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No vehicles match the current filters.</p> : (
        <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight: isMobile ? "65dvh" : "calc(100vh - 340px)" }} data-testid="fleet-calendar-timeline" tabIndex={0} role="region" aria-label="Vehicle timeline, scroll to see more dates">
          <div style={{ minWidth: labelWidth + dayList.length * columnWidth }}>
            <div className="sticky top-0 z-20 flex bg-muted"><div className="sticky left-0 z-30 shrink-0 border-r border-border bg-muted px-3 py-2 text-xs font-semibold" style={{ width: labelWidth }}>Vehicle</div>{dayList.map((day) => <div key={utcDateToDayKey(day)} className={cn("shrink-0 border-l border-border py-1 text-center text-[11px]", utcDateToDayKey(day) === mtTodayKey(timezone) && "bg-primary/15")} style={{ width: columnWidth }}><div>{day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" })}</div><div className="font-medium">{day.getUTCDate()}</div><div>{day.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })}</div></div>)}</div>
            {rows.map((row) => {
              const placed = packLanes(row.events, (event) => calendarBarPosition(event.start, event.end, from, to, timezone, columnWidth));
              const laneHeight = isMobile ? 48 : LANE_HEIGHT;
              const height = Math.max(54, laneCountOf(placed) * laneHeight + 10);
              return <div key={row.key} className="flex border-t border-border" style={{ height }}><div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card p-3" style={{ width: labelWidth }}><p className="truncate text-xs font-medium">{row.carName || `Vehicle #${row.carId}`}</p><p className="truncate text-[10px] text-muted-foreground">{row.plateNumber || "No plate"}{row.unmatched ? " · Needs matching" : ""}</p></div><div className="relative" style={{ width: days * columnWidth }}><div className="absolute inset-0 flex">{dayList.map((day) => <div key={utcDateToDayKey(day)} className={cn("h-full shrink-0 border-l border-border/50", [0, 6].includes(day.getUTCDay()) && "bg-muted/35")} style={{ width: columnWidth }} />)}</div>{placed.map(({ item: event, pos, lane }) => <button key={event.id} type="button" onClick={() => selectEvent(event)} aria-label={`${eventLabel(event)} · ${row.carName}`} title={`${eventLabel(event)}\n${formatInstant(event.start, timezone)} → ${event.end ? formatInstant(event.end, timezone) : "Ongoing / no end recorded"}\n${eventBlocksAvailability(event) ? "Blocks vehicle" : "Does not block availability"}`} className={cn("absolute truncate rounded border px-2 text-left text-[10px] font-medium hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", columnWidth >= 128 && "text-xs", eventColor(event), pos.clippedLeft && "rounded-l-none", pos.clippedRight && "rounded-r-none")} style={{ left: pos.left + 3, width: isMobile ? Math.max(44, pos.width) : pos.width, top: 6 + lane * laneHeight, height: isMobile ? 44 : 28 }}>{eventLabel(event)}</button>)}</div></div>;
            })}
          </div>
        </div>
      )}
      {attentionEvents.length > 0 && <div className="rounded-lg border border-amber-300 p-3">{isMobile ? <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium" aria-expanded={attentionOpen} onClick={() => setAttentionOpen(!attentionOpen)}><span>Records needing attention ({attentionEvents.length})</span><ChevronDown className={cn("h-4 w-4 shrink-0", attentionOpen && "rotate-180")} /></button> : <h2 className="text-sm font-medium">Records needing attention ({attentionEvents.length})</h2>}{(!isMobile || attentionOpen) && <><p className="mb-2 text-xs text-muted-foreground">Review vehicle matching, missing dates, and open-ended periods before making a booking decision.</p>{attentionEvents.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-t border-border py-2">{eventButton(event)}<span className="text-xs text-muted-foreground">{event.carId === null ? "Unmatched vehicle" : event.timeStatus === "open_ended" ? "No end recorded" : "Dates need review"}</span></div>)}</>}</div>}
      <p className="text-xs text-muted-foreground">Cancelled trips are shown as history and do not block availability. Timeline bars show calendar days; open an event for its exact times.</p>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) selectEvent(null); }}><DialogContent className="[overflow-wrap:anywhere]"><DialogHeader className="pr-10 text-left"><DialogTitle>{selected ? eventLabel(selected) : "Calendar event"}</DialogTitle><DialogDescription>{selected ? `${selected.carName || "Unmatched vehicle"}${selected.plateNumber ? ` · ${selected.plateNumber}` : ""}` : ""}</DialogDescription></DialogHeader><Button variant="ghost" size="icon" className="absolute right-2 top-2" style={{ position: "absolute" }} aria-label="Close" onClick={() => selectEvent(null)}><X className="h-4 w-4" /></Button>{selected && <div className="space-y-3 text-sm"><dl className="space-y-2">{[
        ["Source", FLEET_SOURCE_LABELS[selected.source]], ["Status", selected.status.replace(/_/g, " ")], ["Starts", formatInstant(selected.start, timezone)], ["Ends", selected.end === null && selected.start ? "Ongoing / no end recorded" : formatInstant(selected.end, timezone)],
        ["Booking impact", eventBlocksAvailability(selected) ? "Blocks vehicle" : "Does not block availability"], ...(selected.reservationId ? [["Reservation", selected.reservationId]] : []),
        ...(selected.destination ? [["Destination", selected.destination]] : []),
        ...(selected.source === "maintenance" && selected.maintenanceWorkStatus ? [["Maintenance work", selected.maintenanceWorkStatus.replace(/_/g, " ")]] : []),
      ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>{selected.notes && <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{selected.notes}</p>}
        {selected.id.startsWith("block_off:google:") && (
          <section className="space-y-2 rounded-md border border-border p-3">
            <h3 className="font-medium">Imported Google Calendar period</h3>
            <p className="text-xs text-muted-foreground">Classification: {selected.googleClassification ?? "unclassified"}</p>
            {data?.role === "admin" ? <>
              <p className="text-xs text-muted-foreground">Choose its vehicle and whether this period blocks a rental. This saves the mapping in this software; the original Google record keeps its dates and title.</p>
              <Select value={mappingCar} onValueChange={setMappingCar} disabled={classification.isPending}>
                <SelectTrigger aria-label="Vehicle for imported Google period"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="unmatched">Unmatched vehicle</SelectItem>{data.cars.map((car) => <SelectItem key={car.carId} value={String(car.carId)}>{car.carName}{car.plateNumber ? ` · ${car.plateNumber}` : ""}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button disabled={mappingCar === "unmatched" || classification.isPending} onClick={() => classification.mutate({ event: selected, classification: "blocked", carId: Number(mappingCar) })}>Use as blocked period</Button>
                <Button variant="outline" disabled={classification.isPending} onClick={() => classification.mutate({ event: selected, classification: "ignored", carId: mappingCar === "unmatched" ? null : Number(mappingCar) })}>Ignore for availability</Button>
                <Button variant="ghost" disabled={classification.isPending} onClick={() => classification.mutate({ event: selected, classification: "unclassified", carId: mappingCar === "unmatched" ? null : Number(mappingCar) })}>Mark for review</Button>
              </div>
              {classification.isError && <p role="alert" className="text-xs text-destructive">{classification.error instanceof Error ? classification.error.message : "The mapping could not be saved."}</p>}
              {classification.isSuccess && <p role="status" className="text-xs text-muted-foreground">Calendar mapping saved.</p>}
            </> : <p className="text-xs text-muted-foreground">An administrator can review the vehicle mapping and availability classification.</p>}
          </section>
        )}
        {selected.files?.length ? <div className="space-y-2"><h3 className="font-semibold">Service receipts / files</h3>{selected.files.filter(url => /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url)).map((url, index) => <a key={`${url}:${index}`} href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-md border border-primary/30 px-3">Open receipt / file {index + 1}</a>)}</div> : null}
        <div className="flex flex-wrap gap-2">
          {calendarInstant(selected.start) !== null && <Button variant="outline" onClick={() => jumpToEvent(selected)}>Show event in calendar</Button>}
          {!selected.serviceEventKind || selected.serviceEventKind === "appointment" ? <BookingNavigation bookingKey={selected.bookingKey} currentView="calendar" developerAccess={isDeveloper} date={calendarInstant(selected.start) === null ? undefined : mtDayKey(selected.start!, timezone)} /> : null}
          {selectedSourceUrl?.startsWith("/") && !selectedSourceUrl.startsWith("//") && (!selectedSourceUrl.startsWith("/admin/developer/") || isDeveloper) && (data?.role !== "employee" || selectedSourceUrl.startsWith("/admin/operations")) && <a className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground md:min-h-9" href={selectedSourceUrl}>{selected.serviceEventKind && selected.serviceEventKind !== "appointment" ? "Open service history & receipts" : selected.source === "maintenance" ? "Open maintenance appointment" : "Open source record"}</a>}
        </div>
      </div>}</DialogContent></Dialog>
    </div>
  );
}
