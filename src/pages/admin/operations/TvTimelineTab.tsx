import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock,
  MapPin,
  Car,
  User,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";

// ─── Types (mirror /api/operations/day-schedule) ──────────────────────────────

type DayEventType =
  | "pickup" | "delivery" | "cleaning" | "refuel"
  | "maintenance" | "inspection" | "block_off"
  | "trip_start" | "trip_end";

interface DayEvent {
  id: number;
  type: DayEventType;
  category: string;
  car_name: string | null;
  plate: string | null;
  guest_name: string | null;
  assigned_to: string | null;
  assigned_to_id: number | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string | null;
  notes: string | null;
  detail: string | null;
  reservation_id: string | null;
  extras: string | null;
  trip_start: string | null;
  trip_end: string | null;
  trip_start_mt: string | null;
  trip_end_mt: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
}

interface DayScheduleResult {
  date: string;
  events: DayEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Same palette as the Day Schedule tab so the two views stay visually consistent.
const CATEGORY_COLORS: Record<string, string> = {
  "Trip Start": "bg-emerald-600",
  "Trip End": "bg-rose-600",
  "Airport / Pickup Run": "bg-blue-500",
  "Delivery Run": "bg-indigo-500",
  "Cleaning": "bg-teal-500",
  "Refuel Run": "bg-orange-500",
  "Mechanical Run": "bg-red-500",
  "Car Inspection": "bg-yellow-500",
  "Windshield Run": "bg-purple-500",
  "Owner Rental": "bg-pink-500",
};

// A task is "done" once it reaches one of these statuses.
const DONE_STATUSES = new Set([
  "completed", "delivered", "blocked_off_ended", "done",
]);

// Yellow once the deadline is within this many minutes.
const SOON_MINUTES = 30;

// Auto-refresh cadence (ms): pull fresh data, and separately tick "now" so the
// urgency colors recompute even between fetches.
const DATA_REFRESH_MS = 60_000;
const CLOCK_TICK_MS = 15_000;

// ─── Urgency model ────────────────────────────────────────────────────────────
//
// Only TIME-SENSITIVE events get an urgency color. Per the shop's rules, the one
// hard deadline is a car going OUT on a trip — it must be at the delivery
// location by the trip's start time. Everything else (airport pickups,
// cleanings, inspections, refuels, trip returns) is sorted by time but never
// flagged overdue.
//
//   "complete by" = the trip_start datetime for a `trip_start` event.
//
type Urgency = "overdue" | "soon" | "scheduled" | "none";

interface Timed {
  /** Epoch ms used for chronological sorting (always set when a time exists). */
  sortMs: number | null;
  /** Epoch ms of the hard deadline — only for time-sensitive events. */
  deadlineMs: number | null;
}

/** Parse an MT "YYYY-MM-DD HH:MM" string into epoch ms (interpreting it as MT). */
function mtDateTimeToMs(mt: string | null): number | null {
  if (!mt) return null;
  const [datePart, timePart] = mt.split(" ");
  if (!datePart || !timePart) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  // Build a UTC instant for the wall-clock time, then correct by MT's offset.
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // MT offset (minutes) at that instant: compare the wall time we want against
  // what that UTC instant renders as in America/Denver.
  const offsetMin = mtOffsetMinutes(new Date(asUtc));
  return asUtc - offsetMin * 60_000;
}

/** Offset of America/Denver from UTC in minutes (negative; handles DST). */
function mtOffsetMinutes(d: Date): number {
  const tz = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(tz.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(
    get("year"), get("month") - 1, get("day"), get("hour"), get("minute"),
  );
  return Math.round((asIfUtc - d.getTime()) / 60_000);
}

/** Today's date (YYYY-MM-DD) in Mountain Time. */
function todayMTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "HH:MM" → "9:30 AM". */
function fmt12(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Compute the sort + deadline timestamps for an event. */
function timingFor(e: DayEvent, scheduleDate: string): Timed {
  // Chronological sort key: prefer the event's own start_time on the schedule
  // day; fall back to far-future so timeless tasks sink to the bottom.
  let sortMs: number | null = null;
  if (e.start_time) {
    sortMs = mtDateTimeToMs(`${scheduleDate} ${e.start_time}`);
  }

  // Deadline only for cars going OUT (trip_start). The car must be at the
  // delivery location by trip_start_mt.
  let deadlineMs: number | null = null;
  if (e.type === "trip_start") {
    deadlineMs = mtDateTimeToMs(e.trip_start_mt) ?? sortMs;
    if (deadlineMs != null && sortMs == null) sortMs = deadlineMs;
  }

  return { sortMs, deadlineMs };
}

function urgencyFor(t: Timed, isDone: boolean, nowMs: number): Urgency {
  if (isDone) return "none";
  if (t.deadlineMs == null) return "none";
  const minsLeft = (t.deadlineMs - nowMs) / 60_000;
  if (minsLeft < 0) return "overdue";
  if (minsLeft <= SOON_MINUTES) return "soon";
  return "scheduled";
}

// Urgency → row styling. Overdue/soon are loud; scheduled is a subtle accent.
const URGENCY_STYLE: Record<Urgency, { row: string; chip: string; label: string }> = {
  overdue: {
    row: "border-red-500 bg-red-500/10 ring-1 ring-red-500/40",
    chip: "bg-red-600 text-white",
    label: "OVERDUE",
  },
  soon: {
    row: "border-yellow-400 bg-yellow-400/10 ring-1 ring-yellow-400/40",
    chip: "bg-yellow-400 text-black",
    label: "DUE SOON",
  },
  scheduled: {
    row: "border-emerald-600/50 bg-emerald-600/5",
    chip: "bg-emerald-600 text-white",
    label: "ON TRACK",
  },
  none: { row: "border-border bg-card", chip: "", label: "" },
};

// Sort rank: overdue first, then soon, then everything else by time.
const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0, soon: 1, scheduled: 2, none: 3,
};

interface TimelineRow {
  event: DayEvent;
  timing: Timed;
  urgency: Urgency;
  isDone: boolean;
}

function relativeDeadline(deadlineMs: number, nowMs: number): string {
  const mins = Math.round((deadlineMs - nowMs) / 60_000);
  if (mins === 0) return "now";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return mins < 0 ? `${span} overdue` : `in ${span}`;
}

// ─── Timeline card ─────────────────────────────────────────────────────────────

function TimelineCard({ row, nowMs }: { row: TimelineRow; nowMs: number }) {
  const { event: e, urgency, isDone, timing } = row;
  const accent = CATEGORY_COLORS[e.category] ?? "bg-slate-500";
  const u = URGENCY_STYLE[urgency];

  return (
    <div
      className={`flex items-stretch rounded-lg overflow-hidden border shadow-sm ${
        isDone ? "border-border bg-muted/40 opacity-60" : u.row
      }`}
    >
      {/* Color bar */}
      <div className={`w-2 flex-shrink-0 ${accent}`} />

      {/* Time column */}
      <div className="w-28 flex-shrink-0 flex flex-col items-center justify-center px-2 py-3 bg-muted/30 border-r border-border text-center">
        {e.start_time ? (
          <span className="text-2xl font-bold text-foreground leading-none">
            {fmt12(e.start_time)}
          </span>
        ) : (
          <span className="text-sm italic text-muted-foreground">No time</span>
        )}
        {timing.deadlineMs != null && !isDone && (
          <span
            className={`mt-1 text-xs font-semibold ${
              urgency === "overdue"
                ? "text-red-500"
                : urgency === "soon"
                ? "text-yellow-500"
                : "text-muted-foreground"
            }`}
          >
            {relativeDeadline(timing.deadlineMs, nowMs)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold px-2 py-0.5 rounded text-white ${accent}`}>
            {e.category}
          </span>
          {isDone ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded bg-green-600 text-white">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </span>
          ) : u.label ? (
            <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded ${u.chip}`}>
              {(urgency === "overdue" || urgency === "soon") && (
                <AlertTriangle className="w-4 h-4" />
              )}
              {u.label}
            </span>
          ) : null}
        </div>

        {e.car_name && (
          <div className="flex items-center gap-1.5 text-lg text-foreground">
            <Car className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span className="font-semibold">{e.car_name}</span>
            {e.plate && <span className="text-muted-foreground text-base">· {e.plate}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-base text-muted-foreground">
          {e.reservation_id && (
            <span>
              <span className="font-medium text-foreground">Res:</span> {e.reservation_id}
            </span>
          )}
          {e.guest_name && <span>{e.guest_name}</span>}
          <span className="inline-flex items-center gap-1">
            <User className="w-4 h-4 flex-shrink-0" />
            {e.assigned_to ? (
              <span className="text-foreground font-medium">{e.assigned_to}</span>
            ) : (
              <span className="italic text-amber-500">Unassigned</span>
            )}
          </span>
        </div>

        {/* Pick up → drop off, for trip-derived events */}
        {(e.pickup_location || e.dropoff_location) && (
          <div className="flex items-center gap-2 text-base text-muted-foreground flex-wrap">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            {e.pickup_location && <span className="break-words">{e.pickup_location}</span>}
            {e.pickup_location && e.dropoff_location && (
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            )}
            {e.dropoff_location && <span className="break-words">{e.dropoff_location}</span>}
          </div>
        )}

        {/* Generic location for non-trip events */}
        {e.location && !e.pickup_location && !e.dropoff_location && (
          <div className="flex items-center gap-1.5 text-base text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{e.location}</span>
          </div>
        )}

        {e.detail && (
          <div className="text-base text-muted-foreground italic">{e.detail}</div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TvTimelineTab() {
  // Today-only board for an unattended shop monitor.
  const [date, setDate] = useState(todayMTDate);
  const [showCompleted, setShowCompleted] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick "now" so urgency colors recompute live between data fetches, and roll
  // over to the new day at midnight MT.
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
      setDate((d) => {
        const today = todayMTDate();
        return d === today ? d : today;
      });
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, error } = useQuery<DayScheduleResult>({
    queryKey: ["/api/operations/day-schedule", date],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule?date=${date}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: DATA_REFRESH_MS,
  });

  const rows = useMemo<TimelineRow[]>(() => {
    const events = data?.events ?? [];
    const built = events.map((event): TimelineRow => {
      const timing = timingFor(event, date);
      const isDone = DONE_STATUSES.has((event.status ?? "").toLowerCase());
      return { event, timing, urgency: urgencyFor(timing, isDone, nowMs), isDone };
    });

    built.sort((a, b) => {
      // Active tasks always above completed ones.
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      // Then by urgency (overdue → soon → scheduled → none).
      const ur = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (ur !== 0) return ur;
      // Then chronologically; timeless tasks sink to the bottom.
      const am = a.timing.sortMs ?? Number.POSITIVE_INFINITY;
      const bm = b.timing.sortMs ?? Number.POSITIVE_INFINITY;
      return am - bm;
    });

    return built;
  }, [data, date, nowMs]);

  const visibleRows = showCompleted ? rows : rows.filter((r) => !r.isDone);

  const counts = useMemo(() => {
    let overdue = 0, soon = 0, done = 0, active = 0;
    for (const r of rows) {
      if (r.isDone) { done++; continue; }
      active++;
      if (r.urgency === "overdue") overdue++;
      else if (r.urgency === "soon") soon++;
    }
    return { overdue, soon, done, active };
  }, [rows]);

  const nowLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(nowMs));

  return (
    <div className="space-y-4">
      {/* Header bar — large, TV-readable */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-card border border-border rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-primary" />
          <div>
            <div className="text-xl font-bold text-foreground">{formatDisplayDate(date)}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Now {nowLabel} MT · auto-refreshing
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {counts.overdue > 0 && (
            <Badge className="bg-red-600 text-white text-sm px-3 py-1">
              {counts.overdue} overdue
            </Badge>
          )}
          {counts.soon > 0 && (
            <Badge className="bg-yellow-400 text-black text-sm px-3 py-1">
              {counts.soon} due soon
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {counts.active} active
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {counts.done} done
          </Badge>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none ml-2">
            <Checkbox
              checked={showCompleted}
              onCheckedChange={(v) => setShowCompleted(v === true)}
            />
            Show completed
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-12">Loading timeline…</div>
      )}
      {error && (
        <div className="text-center text-destructive py-12">Failed to load timeline.</div>
      )}

      {!isLoading && !error && (
        visibleRows.length === 0 ? (
          <div className="border border-border rounded-lg py-16 text-center text-lg text-muted-foreground bg-background">
            {rows.length === 0
              ? "No scheduled tasks for today."
              : "No active tasks — everything's done ✓"}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRows.map((row) => (
              <TimelineCard key={`${row.event.type}-${row.event.id}`} row={row} nowMs={nowMs} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
