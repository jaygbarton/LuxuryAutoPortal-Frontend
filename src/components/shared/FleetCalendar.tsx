import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { useTimezone } from "@/hooks/use-timezone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingNavigation } from "@/components/shared/BookingNavigation";
import { cn } from "@/lib/utils";
import { addUtcDays, dayKeyToUtcDate, mtDayKey, mtTodayKey, utcDateToDayKey } from "@/lib/mt-datetime";
import { calendarBarPosition, calendarInstant, calendarRangeDays, MAX_CALENDAR_DAYS } from "@/lib/fleetCalendarDates";
import { laneCountOf, packLanes } from "@/lib/lanePack";
import {
  eventBlocksAvailability, FLEET_CALENDAR_SOURCES, FLEET_SOURCE_LABELS,
  isCancelledCalendarEvent, normalizeFleetCalendarResponse, type FleetCalendarCar, type FleetCalendarEvent,
  type FleetCalendarResponse, type FleetCalendarSource,
} from "@/lib/fleetCalendar";

const COLUMN_WIDTH = 48;
const LABEL_WIDTH = 190;
const LANE_HEIGHT = 34;
const SOURCE_COLORS: Record<FleetCalendarSource, string> = {
  turo: "border-[#BD9C5D] bg-[#D3BC8D] text-black",
  owner_rental: "border-blue-400 bg-blue-100 text-blue-950",
  block_off: "border-amber-400 bg-amber-100 text-amber-950",
  maintenance: "border-purple-400 bg-purple-100 text-purple-950",
  direct_booking: "border-emerald-400 bg-emerald-100 text-emerald-950",
};

function eventColor(event: FleetCalendarEvent): string {
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
export function FleetCalendar() {
  const queryClient = useQueryClient();
  const activeTimezone = useTimezone();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const linkedBooking = new URLSearchParams(searchParams).get("booking");
  const initialRange = () => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    return from && to && calendarRangeDays(from, to) !== null ? { from, to } : null;
  };
  const [from, setFrom] = useState(() => initialRange()?.from ?? utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(activeTimezone)), -3)));
  const [to, setTo] = useState(() => initialRange()?.to ?? utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(activeTimezone)), 20)));
  const [search, setSearch] = useState("");
  const [fleet, setFleet] = useState<"all" | "active" | "inactive">("all");
  const [occupancy, setOccupancy] = useState<"all" | "blocking" | "none">("all");
  const [status, setStatus] = useState("all");
  const [sources, setSources] = useState<FleetCalendarSource[]>([...FLEET_CALENDAR_SOURCES]);
  const [showCancelled, setShowCancelled] = useState(true);
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [selected, setSelected] = useState<FleetCalendarEvent | null>(null);
  const [mappingCar, setMappingCar] = useState("unmatched");
  const days = calendarRangeDays(from, to);
  const { data: auth } = useQuery<{ user?: { isSuperAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"], queryFn: authMeQueryFn, staleTime: 300_000,
  });
  const isDeveloper = auth?.user?.isSuperAdmin === true;

  const { data, error, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useQuery<FleetCalendarResponse>({
    queryKey: ["/api/internal-calendar/events", from, to, activeTimezone],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/internal-calendar/events?${new URLSearchParams({ from, to, timezone: activeTimezone })}`), { credentials: "include" });
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
  const sourceCounts = useMemo(() => Object.fromEntries(FLEET_CALENDAR_SOURCES.map((source) => [source, allEvents.filter((event) => event.source === source).length])) as Record<FleetCalendarSource, number>, [allEvents]);
  const statuses = useMemo(() => Array.from(new Set(allEvents.map((event) => event.status))).sort(), [allEvents]);

  const visibleEvents = useMemo(() => allEvents.filter((event) => sources.includes(event.source) && (showCancelled || !isCancelledCalendarEvent(event)) && (status === "all" || event.status === status)), [allEvents, sources, showCancelled, status]);
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
    const blockingCars = new Set(allEvents.filter(eventBlocksAvailability).map((event) => event.carId));
    const q = search.trim().toLowerCase();
    return [...carMap.values(), ...unmatched.values()].filter((car) => {
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
  }, [data?.cars, visibleEvents, allEvents, search, fleet, occupancy]);
  const listedEvents = rows.flatMap((row) => row.events);
  const needsReview = listedEvents.filter((event) => calendarInstant(event.start) === null || (event.end !== null && (calendarInstant(event.end) === null || calendarInstant(event.end)! < calendarInstant(event.start)!)));
  const dayList = useMemo(() => days ? Array.from({ length: days }, (_, index) => addUtcDays(dayKeyToUtcDate(from), index)) : [], [from, days]);
  const hasFilters = search !== "" || fleet !== "all" || occupancy !== "all" || status !== "all" || sources.length !== FLEET_CALENDAR_SOURCES.length || !showCancelled;
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
    setSearch(""); setFleet("all"); setOccupancy("all"); setStatus("all"); setSources([...FLEET_CALENDAR_SOURCES]); setShowCancelled(true);
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

  function eventButton(event: FleetCalendarEvent) {
    return <button type="button" className="text-left text-sm font-medium underline-offset-4 hover:underline" onClick={() => selectEvent(event)}>{eventLabel(event)}</button>;
  }

  return (
    <div className="space-y-4" data-testid="fleet-calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5" /> Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Turo trips, owner rentals, blocked-off dates, and scheduled maintenance.</p>
        </div>
        <Button variant="outline" onClick={() => { void refetch(); if (pointError) void refetchPoint(); }} disabled={isFetching || !days} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="space-y-1"><Label htmlFor="fleet-calendar-from">From</Label><Input id="fleet-calendar-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label htmlFor="fleet-calendar-to">To</Label><Input id="fleet-calendar-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" /></div>
        <div className="flex gap-1">
          <Button variant="outline" aria-label="Previous week" onClick={() => shift(-7)} disabled={!days}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => { const today = dayKeyToUtcDate(mtTodayKey(timezone)); setFrom(utcDateToDayKey(addUtcDays(today, -3))); setTo(utcDateToDayKey(addUtcDays(today, 20))); }}>Today</Button>
          <Button variant="outline" aria-label="Next week" onClick={() => shift(7)} disabled={!days}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="ml-auto flex gap-1" aria-label="Calendar view">
          <Button variant={view === "timeline" ? "default" : "outline"} onClick={() => setView("timeline")} aria-pressed={view === "timeline"}>Timeline</Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")} aria-pressed={view === "list"}>List</Button>
        </div>
      </div>
      {!days && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Choose valid dates in order, spanning no more than {MAX_CALENDAR_DAYS} days.</div>}

      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Search vehicle or plate" placeholder="Search vehicle or plate…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-60" />
        <Select value={fleet} onValueChange={(value) => setFleet(value as typeof fleet)}><SelectTrigger className="w-40" aria-label="Fleet filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vehicles</SelectItem><SelectItem value="active">Active vehicles</SelectItem><SelectItem value="inactive">Inactive vehicles</SelectItem></SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Event status filter"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((value) => <SelectItem key={value} value={value}>{value.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
        <Select value={occupancy} onValueChange={(value) => setOccupancy(value as typeof occupancy)}><SelectTrigger className="w-64" aria-label="Blocking event filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All activity</SelectItem><SelectItem value="blocking">Blocking events in view</SelectItem><SelectItem value="none">No blocking events in view</SelectItem></SelectContent></Select>
        {hasFilters && <Button variant="ghost" onClick={resetFilters}>Clear filters</Button>}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-3 rounded-lg border border-border p-3">
        {FLEET_CALENDAR_SOURCES.map((source) => <label key={source} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={sources.includes(source)} onCheckedChange={(checked) => setSources((current) => checked === true ? [...current, source] : current.filter((value) => value !== source))} aria-label={FLEET_SOURCE_LABELS[source]} />
          <span className={cn("h-3 w-4 rounded border", SOURCE_COLORS[source])} /> {FLEET_SOURCE_LABELS[source]} ({sourceCounts[source]})
        </label>)}
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={showCancelled} onCheckedChange={(checked) => setShowCancelled(checked === true)} aria-label="Show cancelled trips" /><span className="h-3 w-4 rounded border border-dashed border-slate-400 bg-slate-100" /> Show cancelled trips</label>
      </div>

      {isError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><p className="font-medium">Calendar could not be refreshed.</p><p>{error instanceof Error ? error.message : "Please retry."}</p>{data && <p className="mt-1">Previously loaded records remain visible. They may be out of date.</p>}</div>}
      {data && (data.complete === false || data.availabilityComplete === false || warnings.length > 0) && (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Calendar coverage needs attention.</p>
            {warnings.map((warning, index) => <p key={index} className="mt-1">{warning}</p>)}
            <p className="mt-1">An empty period does not confirm that a vehicle is available for booking.</p>
          </div>
        </div>
      )}
      {data?.sync && (data.sync.configured === false || data.sync.pending > 0 || data.sync.failed > 0 || data.sync.lastError || data.sync.status === "not_started") && (
        <div role="status" className="rounded-lg border border-amber-300 p-3 text-sm">
          <p className="font-medium">Google Calendar sync: {data.sync.status.replace(/_/g, " ")}</p>
          <p>{data.sync.configured === false ? "Google Calendar is not connected." : data.sync.status === "not_started" ? "No successful Google synchronization has been recorded." : `${data.sync.pending} pending · ${data.sync.failed} failed`}</p>
          {data.sync.lastError && <p className="mt-1 text-xs text-destructive">{data.sync.lastError}</p>}
          <p className="mt-1 text-xs text-muted-foreground">This internal calendar reads the software's records. Google changes may still be pending.</p>
        </div>
      )}
      {linkedBooking && pointLoading && <p role="status" className="text-sm text-muted-foreground">Loading linked booking…</p>}
      {linkedBooking && pointError && !windowBooking && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">The linked booking could not be loaded: {pointError instanceof Error ? pointError.message : "Please retry."}</p>}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{listedEvents.length} of {allEvents.length} events shown · {rows.length} vehicles · {timezone}</span><span>{isFetching ? "Refreshing…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span></div>

      {isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…</div> : !days || !data ? null : view === "list" ? (
        <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Vehicle", "Event", "Starts", "Ends", "Status", "Booking impact"].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{listedEvents.map((event) => <tr key={event.id} className="border-t border-border"><td className="p-3">{event.carName || "Unmatched vehicle"}<div className="text-xs text-muted-foreground">{event.plateNumber}</div></td><td className="p-3">{eventButton(event)}<div className="text-xs text-muted-foreground">{FLEET_SOURCE_LABELS[event.source]}</div></td><td className="whitespace-nowrap p-3">{formatInstant(event.start, timezone)}</td><td className="whitespace-nowrap p-3">{event.end === null && event.start ? "Ongoing / no end recorded" : formatInstant(event.end, timezone)}</td><td className="p-3">{event.status.replace(/_/g, " ")}</td><td className="p-3">{eventBlocksAvailability(event) ? "Blocks vehicle" : "Does not block"}</td></tr>)}</tbody></table>{listedEvents.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No events match the current filters.</p>}</div>
      ) : rows.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No vehicles match the current filters.</p> : (
        <div className="overflow-auto rounded-lg border border-border" style={{ maxHeight: "calc(100vh - 340px)" }} data-testid="fleet-calendar-timeline">
          <div style={{ minWidth: LABEL_WIDTH + dayList.length * COLUMN_WIDTH }}>
            <div className="sticky top-0 z-20 flex bg-muted"><div className="sticky left-0 z-30 shrink-0 border-r border-border bg-muted px-3 py-2 text-xs font-semibold" style={{ width: LABEL_WIDTH }}>Vehicle</div>{dayList.map((day) => <div key={utcDateToDayKey(day)} className={cn("shrink-0 border-l border-border py-1 text-center text-[11px]", utcDateToDayKey(day) === mtTodayKey(timezone) && "bg-primary/15")} style={{ width: COLUMN_WIDTH }}><div>{day.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" })}</div><div className="font-medium">{day.getUTCDate()}</div><div>{day.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })}</div></div>)}</div>
            {rows.map((row) => {
              const placed = packLanes(row.events, (event) => calendarBarPosition(event.start, event.end, from, to, timezone, COLUMN_WIDTH));
              const height = Math.max(54, laneCountOf(placed) * LANE_HEIGHT + 10);
              return <div key={row.key} className="flex border-t border-border" style={{ height }}><div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card p-3" style={{ width: LABEL_WIDTH }}><p className="truncate text-xs font-medium">{row.carName || `Vehicle #${row.carId}`}</p><p className="truncate text-[10px] text-muted-foreground">{row.plateNumber || "No plate"}{row.unmatched ? " · Needs matching" : ""}</p></div><div className="relative" style={{ width: days * COLUMN_WIDTH }}><div className="absolute inset-0 flex">{dayList.map((day) => <div key={utcDateToDayKey(day)} className={cn("h-full shrink-0 border-l border-border/50", [0, 6].includes(day.getUTCDay()) && "bg-muted/35")} style={{ width: COLUMN_WIDTH }} />)}</div>{placed.map(({ item: event, pos, lane }) => <button key={event.id} type="button" onClick={() => selectEvent(event)} aria-label={`${eventLabel(event)} · ${row.carName}`} title={`${eventLabel(event)}\n${formatInstant(event.start, timezone)} → ${event.end ? formatInstant(event.end, timezone) : "Ongoing / no end recorded"}\n${eventBlocksAvailability(event) ? "Blocks vehicle" : "Does not block availability"}`} className={cn("absolute truncate rounded border px-2 text-left text-[10px] font-medium hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", eventColor(event), pos.clippedLeft && "rounded-l-none", pos.clippedRight && "rounded-r-none")} style={{ left: pos.left + 3, width: pos.width, top: 6 + lane * LANE_HEIGHT, height: 28 }}>{eventLabel(event)}</button>)}</div></div>;
            })}
          </div>
        </div>
      )}
      {attentionEvents.length > 0 && <div className="rounded-lg border border-amber-300 p-3"><h2 className="text-sm font-medium">Records needing attention ({attentionEvents.length})</h2><p className="mb-2 text-xs text-muted-foreground">Review vehicle matching, missing dates, and open-ended periods before making a booking decision.</p>{attentionEvents.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-t border-border py-2">{eventButton(event)}<span className="text-xs text-muted-foreground">{event.carId === null ? "Unmatched vehicle" : event.timeStatus === "open_ended" ? "No end recorded" : "Dates need review"}</span></div>)}</div>}
      <p className="text-xs text-muted-foreground">Cancelled trips are shown as history and do not block availability. Timeline bars show calendar days; open an event for its exact times.</p>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) selectEvent(null); }}><DialogContent><DialogHeader className="pr-8"><DialogTitle>{selected ? eventLabel(selected) : "Calendar event"}</DialogTitle><DialogDescription>{selected ? `${selected.carName || "Unmatched vehicle"}${selected.plateNumber ? ` · ${selected.plateNumber}` : ""}` : ""}</DialogDescription></DialogHeader><Button variant="ghost" size="icon" className="absolute right-2 top-2" aria-label="Close" onClick={() => selectEvent(null)}><X className="h-4 w-4" /></Button>{selected && <div className="space-y-3 text-sm"><dl className="space-y-2">{[
        ["Source", FLEET_SOURCE_LABELS[selected.source]], ["Status", selected.status.replace(/_/g, " ")], ["Starts", formatInstant(selected.start, timezone)], ["Ends", selected.end === null && selected.start ? "Ongoing / no end recorded" : formatInstant(selected.end, timezone)],
        ["Booking impact", eventBlocksAvailability(selected) ? "Blocks vehicle" : "Does not block availability"], ...(selected.reservationId ? [["Reservation", selected.reservationId]] : []),
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
        <div className="flex flex-wrap gap-2">
          {calendarInstant(selected.start) !== null && <Button variant="outline" onClick={() => jumpToEvent(selected)}>Show event in calendar</Button>}
          <BookingNavigation bookingKey={selected.bookingKey} currentView="calendar" developerAccess={isDeveloper} date={calendarInstant(selected.start) === null ? undefined : mtDayKey(selected.start!, timezone)} />
          {selected.detailUrl?.startsWith("/") && !selected.detailUrl.startsWith("//") && (!selected.detailUrl.startsWith("/admin/developer/") || isDeveloper) && (data?.role !== "employee" || selected.detailUrl.startsWith("/admin/operations")) && <a className="inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground" href={selected.detailUrl}>Open source record</a>}
        </div>
      </div>}</DialogContent></Dialog>
    </div>
  );
}
