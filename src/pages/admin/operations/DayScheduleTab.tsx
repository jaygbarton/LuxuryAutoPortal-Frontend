import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, User, Car } from "lucide-react";

// ─── Types (mirror backend DayScheduleService) ───────────────────────────────

type DayEventType =
  | "pickup" | "delivery" | "cleaning" | "refuel"
  | "maintenance" | "inspection" | "block_off" | "work_shift";

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
}

interface WorkShift {
  employee_id: number;
  fullname: string;
  start_time: string;
  end_time: string;
  shift_label: string;
}

interface DayScheduleResult {
  date: string;
  events: DayEvent[];
  work_shifts: WorkShift[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HOUR_START = 7;   // 7am
const HOUR_END = 20;    // 8pm (exclusive — last visible slot is 7pm)
const TOTAL_HOURS = HOUR_END - HOUR_START;

const CATEGORY_COLORS: Record<string, string> = {
  "Airport / Pickup Run": "bg-blue-500",
  "Delivery Run":         "bg-indigo-500",
  "Cleaning":             "bg-teal-500",
  "Refuel Run":           "bg-orange-500",
  "Mechanical Run":       "bg-red-500",
  "Car Inspection":       "bg-yellow-500",
  "Windshield Run":       "bg-purple-500",
  "Owner Rental":         "bg-pink-500",
};

const STATUS_BADGE: Record<string, string> = {
  pending:           "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress:       "bg-blue-100 text-blue-800 border-blue-200",
  completed:         "bg-green-100 text-green-800 border-green-200",
  new:               "bg-gray-100 text-gray-700 border-gray-200",
  block_off_started: "bg-blue-100 text-blue-800 border-blue-200",
  blocked_off_ended: "bg-green-100 text-green-800 border-green-200",
  car_not_available: "bg-red-100 text-red-800 border-red-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayMTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Parse "HH:MM" to fractional hours since midnight. Returns null if invalid. */
function parseHHMM(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}

/** Clamp to timeline range and convert to a percent of total height. */
function toTopPct(hours: number): number {
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hours));
  return ((clamped - HOUR_START) / TOTAL_HOURS) * 100;
}

function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-slate-500";
}

// ─── Swimlane layout helpers ─────────────────────────────────────────────────

interface PositionedEvent extends DayEvent {
  topPct: number;
  heightPct: number;
  column: number;
  columnCount: number;
}

function layoutEvents(events: DayEvent[]): PositionedEvent[] {
  const timed = events
    .map((e) => {
      const start = parseHHMM(e.start_time);
      if (start === null) return null;
      const endRaw = parseHHMM(e.end_time);
      // Default duration: 30 min if no end time
      const end = endRaw !== null ? endRaw : start + 0.5;
      return { ...e, _start: start, _end: end };
    })
    .filter(Boolean) as (DayEvent & { _start: number; _end: number })[];

  // Sort by start
  timed.sort((a, b) => a._start - b._start);

  // Column assignment: greedy overlap detection
  const cols: number[] = new Array(timed.length).fill(0);
  const colEnds: number[] = [];

  for (let i = 0; i < timed.length; i++) {
    let col = 0;
    while (colEnds[col] !== undefined && colEnds[col] > timed[i]._start + 0.01) {
      col++;
    }
    cols[i] = col;
    colEnds[col] = timed[i]._end;
  }

  const maxCol = Math.max(0, ...cols) + 1;

  return timed.map((e, i) => ({
    ...e,
    topPct: toTopPct(e._start),
    heightPct: Math.max(
      (Math.min(e._end, HOUR_END) - Math.max(e._start, HOUR_START)) / TOTAL_HOURS * 100,
      1.5
    ),
    column: cols[i],
    columnCount: maxCol,
  }));
}

// ─── Unassigned event card (list view) ───────────────────────────────────────

function UnassignedCard({ event }: { event: DayEvent }) {
  const dot = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <div className="flex items-start gap-2 border border-border rounded-md p-2 bg-muted/30 text-xs">
      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{event.category}</div>
        {event.car_name && (
          <div className="text-muted-foreground flex items-center gap-1 truncate">
            <Car className="w-3 h-3 flex-shrink-0" />
            {event.car_name}{event.plate ? ` (${event.plate})` : ""}
          </div>
        )}
        {event.guest_name && (
          <div className="text-muted-foreground truncate">{event.guest_name}</div>
        )}
        {event.location && (
          <div className="text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {event.location}
          </div>
        )}
        {event.detail && <div className="text-muted-foreground italic truncate">{event.detail}</div>}
      </div>
      {event.status && (
        <Badge variant="outline" className={`text-[10px] px-1 py-0 flex-shrink-0 ${badgeClass}`}>
          {event.status.replace(/_/g, " ")}
        </Badge>
      )}
    </div>
  );
}

// ─── Timeline event card ──────────────────────────────────────────────────────

function TimelineEventCard({ event }: { event: PositionedEvent }) {
  const bg = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const widthPct = 100 / event.columnCount;

  return (
    <div
      className={`absolute rounded text-white overflow-hidden shadow-sm border border-white/20 hover:z-30 transition-shadow hover:shadow-md group`}
      style={{
        top: `${event.topPct}%`,
        height: `${event.heightPct}%`,
        left: `${event.column * widthPct}%`,
        width: `calc(${widthPct}% - 2px)`,
      }}
    >
      <div className={`h-full flex flex-col p-1 text-[10px] leading-tight ${bg}`}>
        <div className="font-semibold truncate">{event.category}</div>
        {event.start_time && (
          <div className="opacity-90 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}
          </div>
        )}
        {event.car_name && (
          <div className="opacity-90 truncate flex items-center gap-0.5">
            <Car className="w-2.5 h-2.5" />
            {event.car_name}
          </div>
        )}
        {event.guest_name && (
          <div className="opacity-90 truncate">{event.guest_name}</div>
        )}
        {event.location && (
          <div className="opacity-90 truncate hidden group-hover:block">
            <MapPin className="w-2.5 h-2.5 inline" /> {event.location}
          </div>
        )}
        {event.status && (
          <span className={`mt-auto self-start text-[9px] px-1 rounded border ${badgeClass}`}>
            {event.status.replace(/_/g, " ")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Swimlane row ─────────────────────────────────────────────────────────────

interface SwimLaneProps {
  label: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  events: DayEvent[];
}

function SwimLane({ label, shiftStart, shiftEnd, events }: SwimLaneProps) {
  const positioned = layoutEvents(events);
  const hourH = 56; // px per hour
  const totalH = TOTAL_HOURS * hourH;

  // Shift highlight band
  const shiftTop = shiftStart ? toTopPct(parseHHMM(shiftStart) ?? HOUR_START) : null;
  const shiftBot = shiftEnd ? toTopPct(parseHHMM(shiftEnd) ?? HOUR_END) : null;

  return (
    <div className="flex border-b border-border last:border-0">
      {/* Employee label */}
      <div className="w-28 flex-shrink-0 flex items-start justify-end pr-2 pt-1">
        <div className="text-right">
          <div className="text-xs font-medium text-foreground leading-tight">{label}</div>
          {shiftStart && shiftEnd && (
            <div className="text-[10px] text-muted-foreground">{shiftStart}–{shiftEnd}</div>
          )}
        </div>
      </div>

      {/* Timeline column */}
      <div
        className="flex-1 relative border-l border-border"
        style={{ height: `${totalH}px` }}
      >
        {/* Hour gridlines */}
        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: `${(i / TOTAL_HOURS) * 100}%` }}
          />
        ))}

        {/* Shift availability band */}
        {shiftTop !== null && shiftBot !== null && (
          <div
            className="absolute left-0 right-0 bg-green-500/10 border-l-2 border-green-500/50"
            style={{
              top: `${shiftTop}%`,
              height: `${shiftBot - shiftTop}%`,
            }}
          />
        )}

        {/* Events */}
        {positioned.map((e) => (
          <TimelineEventCard key={`${e.type}-${e.id}`} event={e} />
        ))}
      </div>
    </div>
  );
}

// ─── Hour axis ────────────────────────────────────────────────────────────────

function HourAxis() {
  const hourH = 56;
  const totalH = TOTAL_HOURS * hourH;

  return (
    <div className="flex border-b border-border">
      <div className="w-28 flex-shrink-0" />
      <div
        className="flex-1 relative border-l border-border"
        style={{ height: `${totalH}px` }}
      >
        {Array.from({ length: TOTAL_HOURS }, (_, i) => {
          const hour = HOUR_START + i;
          const label =
            hour === 0
              ? "12 AM"
              : hour < 12
              ? `${hour} AM`
              : hour === 12
              ? "12 PM"
              : `${hour - 12} PM`;
          return (
            <div
              key={i}
              className="absolute left-1 text-[10px] text-muted-foreground select-none"
              style={{ top: `${(i / TOTAL_HOURS) * 100}%` }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DayScheduleTab() {
  const [date, setDate] = useState(todayMTDate);

  const { data, isLoading, error } = useQuery<DayScheduleResult>({
    queryKey: ["/api/operations/day-schedule", date],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule?date=${date}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const events = data?.events ?? [];
  const shifts = data?.work_shifts ?? [];

  // Build employee map: id → { fullname, shiftStart, shiftEnd }
  const employeeMap = new Map<number, { fullname: string; shiftStart: string; shiftEnd: string }>();
  for (const s of shifts) {
    if (!employeeMap.has(s.employee_id)) {
      employeeMap.set(s.employee_id, {
        fullname: s.fullname,
        shiftStart: s.start_time.slice(0, 5),
        shiftEnd: s.end_time.slice(0, 5),
      });
    }
  }

  // Group events by assigned employee; collect unassigned separately
  const assignedMap = new Map<number, DayEvent[]>();
  const unassigned: DayEvent[] = [];

  for (const e of events) {
    if (e.assigned_to_id) {
      if (!assignedMap.has(e.assigned_to_id)) assignedMap.set(e.assigned_to_id, []);
      assignedMap.get(e.assigned_to_id)!.push(e);
      // Ensure the employee shows up even if not in work_sched
      if (!employeeMap.has(e.assigned_to_id)) {
        employeeMap.set(e.assigned_to_id, {
          fullname: e.assigned_to ?? `Employee #${e.assigned_to_id}`,
          shiftStart: "",
          shiftEnd: "",
        });
      }
    } else {
      unassigned.push(e);
    }
  }

  // Employees with a shift but no events still get a lane
  for (const s of shifts) {
    if (!assignedMap.has(s.employee_id)) {
      assignedMap.set(s.employee_id, []);
    }
  }

  // Sort employees: those with shifts first, then alphabetically
  const sortedEmployees = [...employeeMap.entries()].sort(([, a], [, b]) => {
    const aHasShift = !!a.shiftStart;
    const bHasShift = !!b.shiftStart;
    if (aHasShift && !bHasShift) return -1;
    if (!aHasShift && bHasShift) return 1;
    return a.fullname.localeCompare(b.fullname);
  });

  // Category summary counts
  const categoryCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setDate((d) => shiftDate(d, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{formatDisplayDate(date)}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate((d) => shiftDate(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground"
        />
        <Button variant="outline" size="sm" onClick={() => setDate(todayMTDate())}>
          Today
        </Button>
      </div>

      {/* Category summary badges */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <span
              key={cat}
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white ${colorFor(cat)}`}
            >
              {cat} <span className="font-bold">{count}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading schedule…</div>
      )}

      {error && (
        <div className="text-sm text-destructive py-4">
          Failed to load schedule.
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Timeline */}
          <div className="flex-1 min-w-0 border border-border rounded-lg overflow-hidden bg-background">
            <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Schedule — {HOUR_START > 12 ? `${HOUR_START - 12}PM` : `${HOUR_START}AM`} to {HOUR_END > 12 ? `${HOUR_END - 12}PM` : `${HOUR_END}AM`}
            </div>

            {sortedEmployees.length === 0 && events.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No scheduled events for this day.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  <HourAxis />
                  {sortedEmployees.map(([empId, emp]) => (
                    <SwimLane
                      key={empId}
                      label={emp.fullname}
                      shiftStart={emp.shiftStart || null}
                      shiftEnd={emp.shiftEnd || null}
                      events={assignedMap.get(empId) ?? []}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: unassigned + legend */}
          <div className="w-full lg:w-64 space-y-4 flex-shrink-0">
            {/* Unassigned */}
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Unassigned</span>
                {unassigned.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {unassigned.length}
                  </Badge>
                )}
              </div>
              <div className="p-2 space-y-1.5 max-h-96 overflow-y-auto">
                {unassigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">All events assigned</p>
                ) : (
                  unassigned.map((e) => (
                    <UnassignedCard key={`${e.type}-${e.id}`} event={e} />
                  ))
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Legend
              </div>
              <div className="p-2 space-y-1">
                {Object.entries(CATEGORY_COLORS).map(([cat, bg]) => (
                  <div key={cat} className="flex items-center gap-2 text-xs text-foreground">
                    <span className={`w-3 h-3 rounded flex-shrink-0 ${bg}`} />
                    {cat}
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-foreground mt-1 pt-1 border-t border-border">
                  <span className="w-3 h-3 rounded flex-shrink-0 bg-green-500/20 border-l-2 border-green-500" />
                  Scheduled shift window
                </div>
              </div>
            </div>

            {/* Shift roster */}
            {shifts.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <User className="w-3 h-3 inline mr-1" />Shift Roster
                </div>
                <div className="p-2 space-y-1">
                  {shifts.map((s) => (
                    <div key={s.employee_id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium truncate">{s.fullname}</span>
                      <span className="text-muted-foreground flex-shrink-0 ml-1">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
