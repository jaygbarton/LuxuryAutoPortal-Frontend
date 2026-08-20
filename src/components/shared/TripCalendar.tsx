import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarCar {
  carId: number;
  carName: string;
  plateNumber: string | null;
  carStatus: string | null;
  hasActivity?: boolean;
}
interface CalendarPrice {
  carId: number;
  date: string;
  amount: number;
}
interface CalendarTrip {
  id: number;
  reservationId: string | null;
  carId: number;
  guestName: string | null;
  tripStart: string;
  tripEnd: string;
  status: string;
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
  earnings: number | null;
  daysRented: number | null;
  milesIncluded: string | null;
  extras: string | null;
}
interface CalendarBlockOff {
  id: number;
  carId: number | null;
  ownerName: string;
  reason: string;
  start: string;
  end: string | null;
  status: string;
}
interface CalendarResponse {
  success: boolean;
  role: "admin" | "cohost" | "client";
  cars: CalendarCar[];
  trips: CalendarTrip[];
  blockOffs: CalendarBlockOff[];
  prices: CalendarPrice[];
  sync: { lastSyncAt: string | null; hoursSinceSync: number | null; stale: boolean };
}

const DAY_MS = 86_400_000;
const MIN_COL_W = 44; // px per day column before it is allowed to stretch
const ROW_H = 46;   // px per vehicle row
const LABEL_W = 190;
const STEP_DAYS = 7; // arrows advance a week, like Turo's calendar
const MONTH_BAND_H = 26; // must match the day-number row's sticky offset

/** Local YYYY-MM-DD (never toISOString, which shifts across the UTC boundary). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Midnight local, so day math is not thrown off by the time component. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const REASON_LABEL: Record<string, string> = {
  personal_use: "Personal use",
  maintenance: "Maintenance",
  others: "Blocked off",
};

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  // Addresses are far too long for the side-by-side layout in a max-w-sm
  // panel — they squash the label to one character per line. Stack those.
  const stacked = value.length > 28;
  return (
    <div className={stacked ? "space-y-0.5" : "flex justify-between gap-4"}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium text-foreground",
          stacked ? "break-words" : "text-right",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Turo-style vehicle timeline: one row per car, days across the top, and each
 * booking or owner block-off drawn as a bar spanning its start → end.
 *
 * The same component serves admins, co-hosts and car owners — the backend
 * decides which vehicles come back, so there is no role logic here beyond the
 * heading. That keeps the visibility rule in exactly one place.
 */
export function TripCalendar({ title }: { title?: string }) {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [days, setDays] = useState(21);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "booked" | "free">("all");
  // 227 of ~327 cars are off-fleet, so default to active or the timeline opens
  // as mostly blank rows.
  const [fleetFilter, setFleetFilter] = useState<"active" | "inactive" | "all">("active");
  const [selected, setSelected] = useState<
    | { kind: "trip"; trip: CalendarTrip; car: CalendarCar }
    | { kind: "block"; block: CalendarBlockOff; car: CalendarCar }
    | null
  >(null);

  const from = ymd(anchor);
  const to = ymd(addDays(anchor, days - 1));

  const { data, isLoading, isError } = useQuery<CalendarResponse>({
    queryKey: ["/api/turo-trips/calendar", from, to],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/turo-trips/calendar?from=${from}&to=${to}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load calendar: ${res.status}`);
      return res.json();
    },
  });

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(anchor, i)),
    [anchor, days],
  );

  // Bars are positioned by day offset from the window start. A trip that began
  // before the window is clamped to day 0 (and flagged) rather than dropped, so
  // an in-progress rental still shows the car as occupied.
  // Day columns stretch to fill the container instead of leaving dead space to
  // the right: at 7-21 days a fixed 44px column left hundreds of blank pixels.
  // Below the minimum the grid overflows and scrolls horizontally as before.
  const [viewportW, setViewportW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  // A callback ref, not useRef + useLayoutEffect([]): the scroll container is
  // rendered inside the isLoading branch, so on first paint it does not exist
  // yet. A mount-only effect measured null, bailed out, and never re-ran once
  // the grid appeared — leaving viewportW at 0 so every column fell back to the
  // 44px minimum and the grid stopped short of the right edge.
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    setViewportW(el.clientWidth);
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    roRef.current = ro;
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  const COL_W = useMemo(() => {
    const available = viewportW - LABEL_W;
    if (available <= 0) return MIN_COL_W;
    return Math.max(MIN_COL_W, Math.floor(available / days));
  }, [viewportW, days]);

  const barFor = (startIso: string, endIso: string | null) => {
    const winStart = anchor.getTime();
    const winEnd = addDays(anchor, days).getTime();
    const s = startOfDay(new Date(startIso)).getTime();
    // A null end means an open-ended block-off — draw it to the window edge.
    const e = endIso ? startOfDay(new Date(endIso)).getTime() : winEnd - DAY_MS;
    if (e < winStart || s >= winEnd) return null;
    const startIdx = Math.max(0, Math.round((s - winStart) / DAY_MS));
    const endIdx = Math.min(days - 1, Math.round((e - winStart) / DAY_MS));
    return {
      left: startIdx * COL_W,
      width: Math.max(COL_W * 0.6, (endIdx - startIdx + 1) * COL_W - 6),
      clippedLeft: s < winStart,
      clippedRight: e >= winEnd,
    };
  };

  const cars = useMemo(() => {
    let list = data?.cars ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.carName.toLowerCase().includes(q) ||
          (c.plateNumber ?? "").toLowerCase().includes(q),
      );
    }
    if (fleetFilter !== "all") {
      list = list.filter((c) => {
        const isActive = c.carStatus !== "off_fleet";
        // An off-fleet car that still has a booking in view stays visible under
        // "Active" — it is demonstrably in use, and hiding it reads as data loss.
        if (fleetFilter === "active") return isActive || c.hasActivity;
        return !isActive;
      });
    }
    if (statusFilter !== "all") {
      // "Booked" / "Free" are relative to the window on screen, matching how
      // Turo's Listing Status filter narrows the visible rows.
      const booked = new Set((data?.trips ?? []).map((t) => Number(t.carId)));
      list = list.filter((c) =>
        statusFilter === "booked" ? booked.has(Number(c.carId)) : !booked.has(Number(c.carId)),
      );
    }
    return list;
  }, [data?.cars, data?.trips, search, statusFilter, fleetFilter]);

  const tripsByCar = useMemo(() => {
    const m = new Map<number, CalendarTrip[]>();
    for (const t of data?.trips ?? []) {
      const k = Number(t.carId);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [data?.trips]);

  const blocksByCar = useMemo(() => {
    const m = new Map<number, CalendarBlockOff[]>();
    for (const b of data?.blockOffs ?? []) {
      if (b.carId == null) continue;
      const k = Number(b.carId);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    return m;
  }, [data?.blockOffs]);

  // Turo shows the window's month above the grid; span both when the range
  // crosses a month boundary so the header never lies about what's on screen.
  const rangeLabel = useMemo(() => {
    const first = anchor;
    const last = addDays(anchor, days - 1);
    const fmt = (d: Date, withYear: boolean) =>
      d.toLocaleDateString("en-US", {
        month: "long",
        ...(withYear ? { year: "numeric" } : {}),
      });
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return fmt(first, true);
    }
    const sameYear = first.getFullYear() === last.getFullYear();
    return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
  }, [anchor, days]);

  // Runs of consecutive days sharing a month, so the header can draw one
  // labelled band per month above the day numbers.
  const monthBands = useMemo(() => {
    const bands: { label: string; span: number }[] = [];
    for (const d of dayList) {
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const last = bands[bands.length - 1];
      if (last && last.label === label) last.span += 1;
      else bands.push({ label, span: 1 });
    }
    return bands;
  }, [dayList]);

  const todayKey = ymd(startOfDay(new Date()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {title ?? "Trips Calendar"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search vehicle or plate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <select
            value={fleetFilter}
            onChange={(e) => setFleetFilter(e.target.value as typeof fleetFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="active">Active cars</option>
            <option value="inactive">Inactive cars</option>
            <option value="all">All cars</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All vehicles</option>
            <option value="booked">Booked in view</option>
            <option value="free">Free in view</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={21}>21 days</option>
            <option value={30}>30 days</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            title="Previous week"
            onClick={() => setAnchor(addDays(anchor, -STEP_DAYS))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Next week"
            onClick={() => setAnchor(addDays(anchor, STEP_DAYS))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {data?.sync?.stale && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <span className="font-medium">Bookings may be out of date.</span>{" "}
            The Turo booking importer last ran{" "}
            {data.sync.hoursSinceSync != null
              ? `${data.sync.hoursSinceSync} hours ago`
              : "an unknown time ago"}
            , so reservations made since then may not appear yet.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
        {rangeLabel}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">
          Could not load the calendar. Please refresh and try again.
        </p>
      ) : cars.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {search ? "No vehicles match your search." : "No vehicles to display."}
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-auto rounded-md border border-border"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          <div style={{ width: LABEL_W + days * COL_W, minWidth: "100%" }}>
            {/* Header: day columns */}
            <div
              className="sticky top-0 z-20 flex border-b border-border bg-muted"
              style={{ height: MONTH_BAND_H }}
            >
              <div
                className="z-30 flex-shrink-0 border-r border-border bg-muted md:sticky md:left-0"
                style={{ width: LABEL_W }}
              />
              {monthBands.map((b) => (
                <div
                  key={b.label}
                  className="flex flex-shrink-0 items-center justify-center border-l border-border text-[11px] font-semibold uppercase tracking-wide text-foreground"
                  style={{ width: b.span * COL_W }}
                >
                  {b.label}
                </div>
              ))}
            </div>

            <div
              className="sticky z-20 flex border-b border-border bg-muted"
              style={{ top: MONTH_BAND_H }}
            >
              <div
                className="z-30 flex-shrink-0 border-r border-border bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground md:sticky md:left-0"
                style={{ width: LABEL_W }}
              >
                Vehicle
              </div>
              {dayList.map((d) => {
                const isToday = ymd(d) === todayKey;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={ymd(d)}
                    className={cn(
                      "flex-shrink-0 border-l border-border py-1 text-center",
                      isWeekend && "bg-muted/60",
                      isToday && "bg-primary/10",
                    )}
                    style={{ width: COL_W }}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-medium",
                        isToday ? "text-primary" : "text-foreground",
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* One row per vehicle */}
            {cars.map((car) => {
              const trips = tripsByCar.get(Number(car.carId)) ?? [];
              const blocks = blocksByCar.get(Number(car.carId)) ?? [];
              return (
                <div
                  key={car.carId}
                  className="flex border-b border-border last:border-b-0"
                  style={{ height: ROW_H }}
                >
                  <div
                    className="z-10 flex flex-shrink-0 flex-col justify-center overflow-hidden border-r border-border bg-card px-3 md:sticky md:left-0"
                    style={{ width: LABEL_W }}
                  >
                    <div className="truncate text-xs font-medium text-foreground">
                      {car.carName || `Car #${car.carId}`}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {car.plateNumber || "—"}
                    </div>
                  </div>

                  <div className="relative flex-1">
                    {/* Day cells — background grid only. Nightly prices are
                        deliberately not rendered for now (rental_daily_prices
                        covers only 64 of 89 active cars, so the strip read as
                        missing data); the API still returns them. */}
                    <div className="absolute inset-0 flex">
                      {dayList.map((d) => {
                        const key = ymd(d);
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const isToday = key === todayKey;
                        return (
                          <div
                            key={key}
                            className={cn(
                              "flex-shrink-0 border-l border-border/60",
                              isWeekend && "bg-muted/40",
                              isToday && "bg-primary/5",
                            )}
                            style={{ width: COL_W }}
                          />
                        );
                      })}
                    </div>

                    {/* Owner block-offs sit under trips: a block is context for
                        why a car is unavailable, a booking is the actual event. */}
                    {blocks.map((b) => {
                      const pos = barFor(b.start, b.end);
                      if (!pos) return null;
                      return (
                        <div
                          key={`b-${b.id}`}
                          title={`${REASON_LABEL[b.reason] ?? b.reason} — ${b.ownerName}\n${fmtDateTime(b.start)} → ${b.end ? fmtDateTime(b.end) : "ongoing"}`}
                          onClick={() => setSelected({ kind: "block", block: b, car })}
                          className="absolute flex cursor-pointer items-center overflow-hidden rounded border border-amber-400/70 bg-amber-100/80 px-2 hover:brightness-95"
                          style={{ left: pos.left + 3, width: pos.width, top: 6, height: ROW_H - 12 }}
                        >
                          <span className="truncate text-[10px] font-medium text-amber-900">
                            {REASON_LABEL[b.reason] ?? "Blocked off"}
                          </span>
                        </div>
                      );
                    })}

                    {trips.map((t) => {
                      const pos = barFor(t.tripStart, t.tripEnd);
                      if (!pos) return null;
                      return (
                        <div
                          key={`t-${t.id}`}
                          title={`${t.guestName ?? "Guest"} · ${t.reservationId ?? ""}\n${fmtDateTime(t.tripStart)} → ${fmtDateTime(t.tripEnd)}\nStatus: ${t.status}`}
                          onClick={() => setSelected({ kind: "trip", trip: t, car })}
                          className={cn(
                            "absolute flex cursor-pointer items-center overflow-hidden rounded px-2 shadow-sm hover:brightness-125",
                            t.status === "ended"
                              ? "bg-gray-700 text-white"
                              : "bg-[#1f2937] text-white",
                            pos.clippedLeft && "rounded-l-none",
                            pos.clippedRight && "rounded-r-none",
                          )}
                          style={{ left: pos.left + 3, width: pos.width, top: 8, height: ROW_H - 16 }}
                        >
                          <span className="truncate text-[10px] font-medium">
                            {t.guestName ?? "Booked"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-sm overflow-y-auto bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {selected.kind === "trip" ? "Trip details" : "Owner block-off"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selected.car.carName} · {selected.car.plateNumber || "no plate"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected.kind === "trip" ? (
              <dl className="space-y-2 text-sm">
                <Row label="Guest" value={selected.trip.guestName ?? "—"} />
                <Row label="Reservation" value={selected.trip.reservationId ?? "—"} />
                <Row label="Starts" value={fmtDateTime(selected.trip.tripStart)} />
                <Row label="Ends" value={fmtDateTime(selected.trip.tripEnd)} />
                <Row label="Status" value={selected.trip.status} />
                <Row
                  label="Days rented"
                  value={
                    selected.trip.daysRented != null
                      ? `${selected.trip.daysRented} ${selected.trip.daysRented === 1 ? "day" : "days"}`
                      : "—"
                  }
                />
                <Row
                  label="Earnings"
                  value={
                    selected.trip.earnings != null
                      ? selected.trip.earnings.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })
                      : "—"
                  }
                />
                <Row label="Miles included" value={selected.trip.milesIncluded || "—"} />
                <Row label="Pick up location" value={selected.trip.pickupLocation || "—"} />
                <Row
                  label="Drop off location"
                  value={
                    /* Turo emails often carry only one address. Fall back the
                       same way the trip pages do rather than showing a dash
                       when a delivery/pickup address is the known drop-off. */
                    selected.trip.returnLocation ||
                    selected.trip.deliveryLocation ||
                    selected.trip.pickupLocation ||
                    "—"
                  }
                />
                <Row label="Extras" value={selected.trip.extras || "None"} />
                {/* Turo Trips is an admin/co-host page — a client has no access
                    to it, so the link would only lead to a blocked route. */}
                {data?.role !== "client" && (
                  <div className="pt-3">
                    <a
                      href={`/admin/turo-trips?q=${encodeURIComponent(selected.trip.reservationId ?? "")}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open in Turo Trips →
                    </a>
                  </div>
                )}
              </dl>
            ) : (
              <dl className="space-y-2 text-sm">
                <Row label="Owner" value={selected.block.ownerName} />
                <Row
                  label="Reason"
                  value={REASON_LABEL[selected.block.reason] ?? selected.block.reason}
                />
                <Row label="Starts" value={fmtDateTime(selected.block.start)} />
                <Row
                  label="Ends"
                  value={selected.block.end ? fmtDateTime(selected.block.end) : "Ongoing"}
                />
                <Row label="Status" value={selected.block.status.replace(/_/g, " ")} />
              </dl>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-[#1f2937]" /> Booked trip
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded bg-gray-700" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded border border-amber-400 bg-amber-100" /> Owner block-off
        </span>
        <span className="ml-auto">Click any bar for details</span>
      </div>
    </div>
  );
}
