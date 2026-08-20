import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarCar {
  carId: number;
  carName: string;
  plateNumber: string | null;
  carStatus: string | null;
}
interface CalendarTrip {
  id: number;
  reservationId: string | null;
  carId: number;
  guestName: string | null;
  tripStart: string;
  tripEnd: string;
  status: string;
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
  sync: { lastSyncAt: string | null; hoursSinceSync: number | null; stale: boolean };
}

const DAY_MS = 86_400_000;
const COL_W = 44;   // px per day column
const ROW_H = 44;   // px per vehicle row
const LABEL_W = 190;

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
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
    const list = data?.cars ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.carName.toLowerCase().includes(q) ||
        (c.plateNumber ?? "").toLowerCase().includes(q),
    );
  }, [data?.cars, search]);

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

  const todayKey = ymd(startOfDay(new Date()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {title ?? "Trip Calendar"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search vehicle or plate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
          />
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
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, -days))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, days))}>
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
        <div className="overflow-x-auto rounded-md border border-border">
          <div style={{ minWidth: LABEL_W + days * COL_W }}>
            {/* Header: day columns */}
            <div className="flex border-b border-border bg-muted/50">
              <div
                className="flex-shrink-0 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground"
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
                    className="flex flex-shrink-0 flex-col justify-center overflow-hidden px-3"
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
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex">
                      {dayList.map((d) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const isToday = ymd(d) === todayKey;
                        return (
                          <div
                            key={ymd(d)}
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
                          className="absolute flex items-center overflow-hidden rounded border border-amber-400/70 bg-amber-100/80 px-2"
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
                          className={cn(
                            "absolute flex items-center overflow-hidden rounded px-2 shadow-sm",
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
      </div>
    </div>
  );
}
