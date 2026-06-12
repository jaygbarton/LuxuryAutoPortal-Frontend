import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, Car, User } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayEventType =
  | "pickup" | "delivery" | "cleaning" | "refuel"
  | "maintenance" | "inspection" | "block_off";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 20;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_H = 60; // px per hour

const CATEGORY_COLORS: Record<string, string> = {
  "Airport / Pickup Run": "bg-blue-500",
  "Delivery Run":         "bg-indigo-500",
  "Cleaning":             "bg-teal-500",
  "Refuel Run":           "bg-orange-500",
  "Mechanical Run":       "bg-red-500",
  "Car Inspection":       "bg-yellow-600",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayMTDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function parseHHMM(t: string | null): number | null {
  if (!t) return null;
  const [h, mi] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(mi)) return null;
  return h + mi / 60;
}

function toTopPct(hours: number): number {
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hours));
  return ((clamped - HOUR_START) / TOTAL_HOURS) * 100;
}

function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-slate-500";
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

// ─── Employee grouping key ────────────────────────────────────────────────────
// Use assigned_to_id when available; fall back to name-based key for events
// like block-offs that store a name but no id. Unassigned = truly no name.

function assigneeKey(e: DayEvent): string | null {
  if (e.assigned_to_id) return `id:${e.assigned_to_id}`;
  if (e.assigned_to?.trim()) return `name:${e.assigned_to.trim()}`;
  return null;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

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
      const end = endRaw !== null ? endRaw : start + 0.5;
      return { ...e, _start: start, _end: end };
    })
    .filter(Boolean) as (DayEvent & { _start: number; _end: number })[];

  timed.sort((a, b) => a._start - b._start);

  const cols: number[] = new Array(timed.length).fill(0);
  const colEnds: number[] = [];
  for (let i = 0; i < timed.length; i++) {
    let col = 0;
    while (colEnds[col] !== undefined && colEnds[col] > timed[i]._start + 0.01) col++;
    cols[i] = col;
    colEnds[col] = timed[i]._end;
  }
  const maxCol = Math.max(0, ...cols) + 1;

  return timed.map((e, i) => ({
    ...e,
    topPct: toTopPct(e._start),
    heightPct: Math.max(
      (Math.min(e._end, HOUR_END) - Math.max(e._start, HOUR_START)) / TOTAL_HOURS * 100,
      1.2,
    ),
    column: cols[i],
    columnCount: maxCol,
  }));
}

// ─── Event card (timeline) ────────────────────────────────────────────────────

function TimelineEventCard({ event }: { event: PositionedEvent }) {
  const bg = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const widthPct = 100 / event.columnCount;

  return (
    <div
      className="absolute rounded text-white overflow-hidden shadow-sm border border-white/20 hover:z-30 transition-shadow hover:shadow-md group cursor-default"
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
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}
          </div>
        )}
        {event.car_name && (
          <div className="opacity-90 truncate flex items-center gap-0.5">
            <Car className="w-2.5 h-2.5 flex-shrink-0" />
            {event.car_name}{event.plate ? ` · ${event.plate}` : ""}
          </div>
        )}
        {event.guest_name && (
          <div className="opacity-90 truncate">{event.guest_name}</div>
        )}
        {event.location && (
          <div className="opacity-80 truncate hidden group-hover:flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{event.location}
          </div>
        )}
        {event.detail && (
          <div className="opacity-80 italic truncate hidden group-hover:block">{event.detail}</div>
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

// ─── Unassigned card (sidebar) ────────────────────────────────────────────────

function UnassignedCard({ event }: { event: DayEvent }) {
  const dot = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <div className="flex items-start gap-2 border border-border rounded-md p-2 bg-muted/30 text-xs">
      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{event.category}</div>
        {event.start_time && (
          <div className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />{event.start_time}
          </div>
        )}
        {event.car_name && (
          <div className="text-muted-foreground flex items-center gap-1 truncate">
            <Car className="w-3 h-3 flex-shrink-0" />
            {event.car_name}{event.plate ? ` (${event.plate})` : ""}
          </div>
        )}
        {event.guest_name && <div className="text-muted-foreground truncate">{event.guest_name}</div>}
        {event.location && (
          <div className="text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />{event.location}
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

// ─── Swimlane ─────────────────────────────────────────────────────────────────

interface SwimLaneProps {
  label: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  events: DayEvent[];
  showHourLabels: boolean;
}

function SwimLane({ label, shiftStart, shiftEnd, events, showHourLabels }: SwimLaneProps) {
  const positioned = layoutEvents(events);
  const totalH = TOTAL_HOURS * HOUR_H;

  const shiftTop = shiftStart ? toTopPct(parseHHMM(shiftStart) ?? HOUR_START) : null;
  const shiftBot = shiftEnd   ? toTopPct(parseHHMM(shiftEnd)   ?? HOUR_END)   : null;

  return (
    <div className="flex border-b border-border last:border-0">
      {/* Name label */}
      <div className="w-24 flex-shrink-0 flex items-start justify-end pr-2 pt-1 border-r border-border bg-muted/20">
        <div className="text-right">
          <div className="text-xs font-medium text-foreground leading-tight">{label}</div>
          {shiftStart && shiftEnd && (
            <div className="text-[10px] text-muted-foreground">{shiftStart}–{shiftEnd}</div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 relative" style={{ height: `${totalH}px` }}>
        {/* Hour gridlines + optional labels */}
        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: `${(i / TOTAL_HOURS) * 100}%` }}
          >
            {showHourLabels && i < TOTAL_HOURS && (
              <span className="absolute left-1 top-0.5 text-[9px] text-muted-foreground select-none leading-none">
                {hourLabel(HOUR_START + i)}
              </span>
            )}
          </div>
        ))}

        {/* Shift band */}
        {shiftTop !== null && shiftBot !== null && (
          <div
            className="absolute left-0 right-0 bg-green-500/10 border-l-2 border-green-400/60"
            style={{ top: `${shiftTop}%`, height: `${shiftBot - shiftTop}%` }}
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

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  // Build employee info from work_sched first
  type EmpInfo = { fullname: string; shiftStart: string; shiftEnd: string };
  const empById = new Map<string, EmpInfo>(); // key = "id:N" or "name:Foo"

  for (const s of shifts) {
    empById.set(`id:${s.employee_id}`, {
      fullname: s.fullname,
      shiftStart: s.start_time.slice(0, 5),
      shiftEnd:   s.end_time.slice(0, 5),
    });
  }

  // Group events: use assigneeKey to bucket by id OR name
  const assignedMap = new Map<string, DayEvent[]>();
  const unassigned: DayEvent[] = [];

  for (const e of events) {
    const key = assigneeKey(e);
    if (!key) {
      unassigned.push(e);
      continue;
    }
    if (!assignedMap.has(key)) assignedMap.set(key, []);
    assignedMap.get(key)!.push(e);

    // Register in empById if not already there (no shift on record)
    if (!empById.has(key)) {
      empById.set(key, {
        fullname: e.assigned_to ?? key,
        shiftStart: "",
        shiftEnd: "",
      });
    }
  }

  // Employees with a shift but zero events still get a lane
  for (const s of shifts) {
    const key = `id:${s.employee_id}`;
    if (!assignedMap.has(key)) assignedMap.set(key, []);
  }

  // Sort: shift employees first (alphabetically), then no-shift employees
  const sortedEmployees = [...empById.entries()].sort(([, a], [, b]) => {
    const aHas = !!a.shiftStart;
    const bHas = !!b.shiftStart;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.fullname.localeCompare(b.fullname);
  });

  const categoryCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Date nav */}
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

      {/* Category summary */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <span key={cat} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white ${colorFor(cat)}`}>
              {cat} <span className="font-bold">{count}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading schedule…</div>}
      {error && <div className="text-sm text-destructive py-4">Failed to load schedule.</div>}

      {!isLoading && !error && (
        <div className="flex gap-4 flex-col lg:flex-row">

          {/* Timeline */}
          <div className="flex-1 min-w-0 border border-border rounded-lg overflow-hidden bg-background">
            <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Daily Schedule — {hourLabel(HOUR_START)} to {hourLabel(HOUR_END - 1)}
            </div>

            {sortedEmployees.length === 0 && events.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No scheduled events for this day.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  {sortedEmployees.map(([key, emp], idx) => (
                    <SwimLane
                      key={key}
                      label={emp.fullname}
                      shiftStart={emp.shiftStart || null}
                      shiftEnd={emp.shiftEnd || null}
                      events={assignedMap.get(key) ?? []}
                      showHourLabels={idx === 0}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-60 space-y-4 flex-shrink-0">

            {/* Unassigned */}
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Needs Assignment</span>
                {unassigned.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {unassigned.length}
                  </Badge>
                )}
              </div>
              <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto">
                {unassigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">All events assigned ✓</p>
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
                  <span className="w-3 h-3 rounded flex-shrink-0 bg-green-400/20 border-l-2 border-green-400" />
                  Scheduled shift
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
