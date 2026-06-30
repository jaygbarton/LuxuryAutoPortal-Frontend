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
  Sparkles,
  Wrench,
  Fuel,
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

const DONE_STATUSES = new Set([
  "completed", "delivered", "blocked_off_ended", "done",
]);

// Task types that are "children" of a trip card rather than standalone rows.
const TRIP_CHILD_TYPES = new Set<DayEventType>([
  "pickup", "delivery", "cleaning", "refuel",
]);

const SOON_MINUTES = 30;
const DATA_REFRESH_MS = 60_000;
const CLOCK_TICK_MS = 15_000;

// ─── Urgency model ────────────────────────────────────────────────────────────

type Urgency = "overdue" | "soon" | "scheduled" | "none";

interface Timed {
  sortMs: number | null;
  deadlineMs: number | null;
}

function mtDateTimeToMs(mt: string | null): number | null {
  if (!mt) return null;
  const [datePart, timePart] = mt.split(" ");
  if (!datePart || !timePart) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMin = mtOffsetMinutes(new Date(asUtc));
  return asUtc - offsetMin * 60_000;
}

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

/** "HH:MM" → "9:30 AM" */
function fmt12(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Format a full MT datetime "YYYY-MM-DD HH:MM" for display.
 * When the date part matches scheduleDate (today) we only show the time.
 * When it's a different day, prefix with "Mon Jun 30, ".
 */
function fmtMtDateTime(mt: string | null, scheduleDate: string): string {
  if (!mt) return "—";
  const [datePart, timePart] = mt.split(" ");
  if (!datePart || !timePart) return mt;
  const timeLabel = fmt12(timePart);
  if (datePart === scheduleDate) return timeLabel;
  const [y, mo, d] = datePart.split("-").map(Number);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, mo - 1, d)));
  return `${dateLabel}, ${timeLabel}`;
}

function timingFor(e: DayEvent, scheduleDate: string): Timed {
  let sortMs: number | null = null;
  if (e.start_time) {
    sortMs = mtDateTimeToMs(`${scheduleDate} ${e.start_time}`);
  }

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

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0, soon: 1, scheduled: 2, none: 3,
};

interface TimelineRow {
  event: DayEvent;
  timing: Timed;
  urgency: Urgency;
  isDone: boolean;
  // Operation tasks linked to this trip (for trip_start / trip_end cards)
  childTasks: DayEvent[];
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

// ─── Child task chip (cleaning / pickup / delivery / refuel) ──────────────────

const TASK_ICON: Record<string, React.ReactNode> = {
  cleaning: <Sparkles className="w-3.5 h-3.5" />,
  pickup: <Car className="w-3.5 h-3.5" />,
  delivery: <MapPin className="w-3.5 h-3.5" />,
  refuel: <Fuel className="w-3.5 h-3.5" />,
  maintenance: <Wrench className="w-3.5 h-3.5" />,
};

const TASK_BG: Record<string, string> = {
  cleaning: "bg-teal-900/40 border-teal-700/50",
  pickup: "bg-blue-900/40 border-blue-700/50",
  delivery: "bg-indigo-900/40 border-indigo-700/50",
  refuel: "bg-orange-900/40 border-orange-700/50",
  maintenance: "bg-red-900/40 border-red-700/50",
};

function ChildTaskChip({ task, scheduleDate }: { task: DayEvent; scheduleDate: string }) {
  const isDone = DONE_STATUSES.has((task.status ?? "").toLowerCase());
  const bg = TASK_BG[task.type] ?? "bg-muted border-border";
  return (
    <div
      className={`flex items-start gap-2 rounded border px-2 py-1.5 text-sm ${bg} ${
        isDone ? "opacity-50" : ""
      }`}
    >
      <span className="flex-shrink-0 mt-0.5 text-foreground/70">
        {TASK_ICON[task.type] ?? <Clock className="w-3.5 h-3.5" />}
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground capitalize">{task.category}</span>
          {task.start_time && (
            <span className="text-muted-foreground text-xs">
              {fmtMtDateTime(`${scheduleDate} ${task.start_time}`, scheduleDate)}
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Done
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3" />
            {task.assigned_to ? (
              <span className="text-foreground font-medium">{task.assigned_to}</span>
            ) : (
              <span className="italic text-amber-500">Unassigned</span>
            )}
          </span>
          {task.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{task.location}</span>
            </span>
          )}
          {task.notes && (
            <span className="italic truncate max-w-[200px]">{task.notes}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Timeline card ─────────────────────────────────────────────────────────────

function TimelineCard({
  row,
  nowMs,
  scheduleDate,
}: {
  row: TimelineRow;
  nowMs: number;
  scheduleDate: string;
}) {
  const { event: e, urgency, isDone, timing, childTasks } = row;
  const accent = CATEGORY_COLORS[e.category] ?? "bg-slate-500";
  const u = URGENCY_STYLE[urgency];

  // Date label for the time column — show day name when event is cross-day
  const eventDateLabel = (() => {
    const mt = e.type === "trip_start" ? e.trip_start_mt : e.trip_end_mt;
    if (!mt) return null;
    const [datePart] = mt.split(" ");
    if (!datePart || datePart === scheduleDate) return null;
    const [y, mo, d] = datePart.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(y, mo - 1, d)));
  })();

  return (
    <div
      className={`flex items-stretch rounded-lg overflow-hidden border shadow-sm ${
        isDone ? "border-border bg-muted/40 opacity-60" : u.row
      }`}
    >
      {/* Color bar */}
      <div className={`w-2 flex-shrink-0 ${accent}`} />

      {/* Time column */}
      <div className="w-32 flex-shrink-0 flex flex-col items-center justify-center px-2 py-3 bg-muted/30 border-r border-border text-center gap-0.5">
        {eventDateLabel && (
          <span className="text-[10px] font-medium text-muted-foreground leading-none">
            {eventDateLabel}
          </span>
        )}
        {e.start_time ? (
          <span className="text-2xl font-bold text-foreground leading-none">
            {fmt12(e.start_time)}
          </span>
        ) : (
          <span className="text-sm italic text-muted-foreground">No time</span>
        )}
        {timing.deadlineMs != null && !isDone && (
          <span
            className={`text-xs font-semibold leading-tight ${
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
      <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1.5">
        {/* Badge row */}
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

        {/* Car */}
        {e.car_name && (
          <div className="flex items-center gap-1.5 text-lg text-foreground">
            <Car className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span className="font-semibold">{e.car_name}</span>
            {e.plate && <span className="text-muted-foreground text-base">· {e.plate}</span>}
          </div>
        )}

        {/* Res / guest / assigned */}
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

        {/* Trip window (shows full date+time when cross-day) */}
        {(e.trip_start_mt || e.trip_end_mt) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">
              {fmtMtDateTime(e.trip_start_mt, scheduleDate)}
            </span>
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">
              {fmtMtDateTime(e.trip_end_mt, scheduleDate)}
            </span>
          </div>
        )}

        {/* Locations */}
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
        {e.location && !e.pickup_location && !e.dropoff_location && (
          <div className="flex items-center gap-1.5 text-base text-muted-foreground">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{e.location}</span>
          </div>
        )}
        {/* Extras */}
        {e.extras && (
          <div className="flex items-center gap-1.5 text-base text-muted-foreground">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>{e.extras}</span>
          </div>
        )}
        {e.detail && (
          <div className="text-base text-muted-foreground italic">{e.detail}</div>
        )}

        {/* Linked tasks (cleaning, pickup, delivery, refuel) */}
        {childTasks.length > 0 && (
          <div className="pt-1 space-y-1 border-t border-border/50">
            {childTasks.map((t) => (
              <ChildTaskChip key={`${t.type}-${t.id}`} task={t} scheduleDate={scheduleDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TvTimelineTab() {
  const [date, setDate] = useState(todayMTDate);
  const [showCompleted, setShowCompleted] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

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

    // Build a lookup: reservation_id → list of operation task events for that trip.
    // These are the "child" tasks (cleaning, pickup, delivery, refuel) that belong
    // to a trip and should appear nested under the trip_start / trip_end card.
    const tasksByRes = new Map<string, DayEvent[]>();
    for (const ev of events) {
      if (!TRIP_CHILD_TYPES.has(ev.type)) continue;
      if (!ev.reservation_id) continue;
      const list = tasksByRes.get(ev.reservation_id) ?? [];
      list.push(ev);
      tasksByRes.set(ev.reservation_id, list);
    }

    // Build rows for events that should appear as top-level cards.
    // Operation tasks that match a trip card are shown as children of that card,
    // not as their own row. Standalone tasks (no reservation_id, or no matching
    // trip event) still get their own row.
    const tripResIds = new Set<string>();
    for (const ev of events) {
      if ((ev.type === "trip_start" || ev.type === "trip_end") && ev.reservation_id) {
        tripResIds.add(ev.reservation_id);
      }
    }

    const topLevel = events.filter((ev) => {
      if (!TRIP_CHILD_TYPES.has(ev.type)) return true;
      // Keep as standalone if there's no parent trip card to attach to.
      return !ev.reservation_id || !tripResIds.has(ev.reservation_id);
    });

    const built = topLevel.map((event): TimelineRow => {
      const timing = timingFor(event, date);
      const isDone = DONE_STATUSES.has((event.status ?? "").toLowerCase());
      // Attach child tasks for trip start/end cards.
      const childTasks =
        (event.type === "trip_start" || event.type === "trip_end") && event.reservation_id
          ? (tasksByRes.get(event.reservation_id) ?? [])
          : [];
      return {
        event,
        timing,
        urgency: urgencyFor(timing, isDone, nowMs),
        isDone,
        childTasks,
      };
    });

    built.sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      const ur = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      if (ur !== 0) return ur;
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
      {/* Header bar */}
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
              <TimelineCard
                key={`${row.event.type}-${row.event.id}`}
                row={row}
                nowMs={nowMs}
                scheduleDate={date}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
