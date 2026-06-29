import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, Car, User, ArrowRight, ArrowDownToLine, ArrowUpFromLine, GripVertical } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Trip Start":           { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
  "Trip End":             { bg: "bg-rose-600",    text: "text-white", border: "border-rose-700" },
  "Airport / Pickup Run": { bg: "bg-blue-500",    text: "text-white", border: "border-blue-600" },
  "Delivery Run":         { bg: "bg-indigo-500",  text: "text-white", border: "border-indigo-600" },
  "Cleaning":             { bg: "bg-teal-500",    text: "text-white", border: "border-teal-600" },
  "Refuel Run":           { bg: "bg-orange-500",  text: "text-white", border: "border-orange-600" },
  "Mechanical Run":       { bg: "bg-red-500",     text: "text-white", border: "border-red-600" },
  "Car Inspection":       { bg: "bg-yellow-500",  text: "text-white", border: "border-yellow-600" },
  "Windshield Run":       { bg: "bg-purple-500",  text: "text-white", border: "border-purple-600" },
  "Owner Rental":         { bg: "bg-pink-500",    text: "text-white", border: "border-pink-600" },
};

const STATUS_BADGE: Record<string, string> = {
  pending:           "bg-yellow-100 text-yellow-800 border-yellow-300",
  in_progress:       "bg-blue-100 text-blue-800 border-blue-300",
  completed:         "bg-green-100 text-green-800 border-green-300",
  new:               "bg-gray-100 text-gray-700 border-gray-300",
  block_off_started: "bg-blue-100 text-blue-800 border-blue-300",
  blocked_off_ended: "bg-green-100 text-green-800 border-green-300",
  car_not_available: "bg-red-100 text-red-800 border-red-300",
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

function colorFor(category: string) {
  return CATEGORY_COLORS[category] ?? { bg: "bg-slate-500", text: "text-white", border: "border-slate-600" };
}

/** Format "HH:MM" → "9:30 AM" */
function fmt12(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Sort key: "HH:MM" strings; events with no time go to end */
function timeKey(t: string | null): string {
  return t ?? "99:99";
}

/**
 * Format a full MT datetime "YYYY-MM-DD HH:MM" for display.
 * Shows "Mon Jun 30, 10:00 AM" — used when the trip spans across days so
 * the date context is clear.
 */
function fmtTripDateTime(dt: string | null): string {
  if (!dt) return "—";
  const [datePart, timePart] = dt.split(" ");
  if (!datePart || !timePart) return dt;
  const [y, mo, d] = datePart.split("-").map(Number);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(y, mo - 1, d)));
  return `${dateLabel}, ${fmt12(timePart)}`;
}

/** Grouping key: prefer id, fall back to name, null = truly unassigned */
function assigneeKey(e: DayEvent): string | null {
  if (e.assigned_to_id) return `id:${e.assigned_to_id}`;
  if (e.assigned_to?.trim()) return `name:${e.assigned_to.trim()}`;
  return null;
}

// ─── Drag-and-drop ──────────────────────────────────────────────────────────
// Events with their assignee on a row we can update are draggable: drag onto an
// employee to assign, or onto "Needs Assignment" to unassign. Trip Start / End
// are assignable only when their pickup/delivery task already exists — the
// backend rejects otherwise with a helpful message.
const DRAG_MIME = "application/x-gla-day-event";

interface DragPayload {
  type: DayEventType;
  id: number;
  category: string;
}

function setDragData(e: React.DragEvent, event: DayEvent) {
  const payload: DragPayload = { type: event.type, id: event.id, category: event.category };
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

function readDragData(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try { return JSON.parse(raw) as DragPayload; } catch { return null; }
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: DayEvent }) {
  const c = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <div
      draggable
      onDragStart={(e) => setDragData(e, event)}
      className={`group/event flex items-stretch rounded-lg overflow-hidden border ${c.border} shadow-sm cursor-grab active:cursor-grabbing`}
    >
      {/* Color bar */}
      <div className={`w-1.5 flex-shrink-0 ${c.bg}`} />

      {/* Time gutter */}
      <div className="w-16 flex-shrink-0 flex flex-col items-end justify-center px-1.5 py-2 bg-muted/30 border-r border-border text-[10px] text-muted-foreground leading-tight text-right">
        {event.start_time ? (
          <>
            <span className="font-medium text-foreground">{fmt12(event.start_time)}</span>
            {event.end_time && <span>{fmt12(event.end_time)}</span>}
          </>
        ) : (
          <span className="italic">No time</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 px-2 py-2 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <GripVertical className="w-3 h-3 flex-shrink-0 text-muted-foreground/40 group-hover/event:text-muted-foreground" />
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
            {event.category}
          </span>
          {event.status && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}>
              {event.status.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {event.car_name && (
          <div className="flex items-center gap-1 text-xs text-foreground">
            <Car className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium">{event.car_name}</span>
            {event.plate && <span className="text-muted-foreground">· {event.plate}</span>}
          </div>
        )}
        {event.reservation_id && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Res:</span> {event.reservation_id}
          </div>
        )}
        {event.guest_name && (
          <div className="text-xs text-muted-foreground">{event.guest_name}</div>
        )}
        {event.extras && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Extras:</span> {event.extras}
          </div>
        )}

        {/* Trip window: trip start → trip end (with date when it spans days) */}
        {(event.trip_start_mt || event.trip_end_mt) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="text-foreground font-medium">{fmtTripDateTime(event.trip_start_mt)}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <span className="text-foreground font-medium">{fmtTripDateTime(event.trip_end_mt)}</span>
          </div>
        )}

        {/* Pick up & drop off locations */}
        {event.pickup_location && (
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <ArrowUpFromLine className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span className="break-words"><span className="font-medium text-foreground">Pick Up:</span> {event.pickup_location}</span>
          </div>
        )}
        {event.dropoff_location && (
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <ArrowDownToLine className="w-3 h-3 flex-shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words"><span className="font-medium text-foreground">Drop Off:</span> {event.dropoff_location}</span>
          </div>
        )}

        {/* Generic location (non-trip events: e.g. cleaning's own scheduled location, repair shop) — only when no trip endpoints shown */}
        {event.location && !event.pickup_location && !event.dropoff_location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {event.detail && (
          <div className="text-xs text-muted-foreground italic">{event.detail}</div>
        )}
        {event.notes && (
          <div className="text-xs text-muted-foreground truncate">{event.notes}</div>
        )}
      </div>
    </div>
  );
}

// ─── Employee section ─────────────────────────────────────────────────────────

interface EmpInfo {
  fullname: string;
  // An employee can have more than one shift on the same day.
  shifts: { start: string; end: string }[];
}

function EmployeeSection({
  empKey,
  emp,
  events,
  onAssign,
}: {
  empKey: string;
  emp: EmpInfo;
  events: DayEvent[];
  onAssign: (payload: DragPayload, employeeId: number, fullname: string) => void;
}) {
  const sorted = [...events].sort((a, b) => timeKey(a.start_time).localeCompare(timeKey(b.start_time)));
  const [dragOver, setDragOver] = useState(false);

  // Only employees identified by a real employee_id can receive assignments.
  const employeeId = empKey.startsWith("id:") ? Number(empKey.slice(3)) : null;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (employeeId == null) return;
    const payload = readDragData(e);
    if (payload) onAssign(payload, employeeId, emp.fullname);
  }

  return (
    <div
      onDragOver={(e) => {
        if (employeeId == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border rounded-lg overflow-hidden transition-colors ${
        dragOver ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      {/* Employee header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-muted border-b border-border">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{emp.fullname}</div>
          {emp.shifts.length > 0 ? (
            <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5">
              <Clock className="w-3 h-3" />
              <span>Shift{emp.shifts.length > 1 ? "s" : ""}:</span>
              {emp.shifts.map((sh, i) => (
                <span key={`${sh.start}-${sh.end}-${i}`}>
                  {fmt12(sh.start)} – {fmt12(sh.end)}{i < emp.shifts.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground italic">No shift on record</div>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {events.length} task{events.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Event list */}
      <div className="p-2 space-y-1.5 bg-background">
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3 italic">No tasks scheduled</div>
        ) : (
          sorted.map((e) => <EventCard key={`${e.type}-${e.id}`} event={e} />)
        )}
      </div>
    </div>
  );
}

// ─── Unassigned card (sidebar) ────────────────────────────────────────────────

function UnassignedCard({ event }: { event: DayEvent }) {
  const c = colorFor(event.category);
  return (
    <div
      draggable
      onDragStart={(e) => setDragData(e, event)}
      className={`flex items-stretch rounded overflow-hidden border ${c.border} text-xs cursor-grab active:cursor-grabbing`}
    >
      <div className={`w-1 flex-shrink-0 ${c.bg}`} />
      <div className="flex-1 min-w-0 px-2 py-1.5 space-y-0.5">
        <div className={`font-semibold`}>{event.category}</div>
        {event.start_time && (
          <div className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />{fmt12(event.start_time)}
          </div>
        )}
        {event.car_name && (
          <div className="text-muted-foreground flex items-start gap-1">
            <Car className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="break-words">{event.car_name}{event.plate ? ` (${event.plate})` : ""}</span>
          </div>
        )}
        {event.reservation_id && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Res:</span> {event.reservation_id}
          </div>
        )}
        {event.extras && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Extras:</span> {event.extras}
          </div>
        )}
        {(event.trip_start_mt || event.trip_end_mt) && (
          <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
            <span className="font-medium text-foreground">{fmtTripDateTime(event.trip_start_mt)}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium text-foreground">{fmtTripDateTime(event.trip_end_mt)}</span>
          </div>
        )}
        {event.pickup_location && (
          <div className="text-muted-foreground flex items-start gap-1">
            <ArrowUpFromLine className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span className="break-words">{event.pickup_location}</span>
          </div>
        )}
        {event.dropoff_location && (
          <div className="text-muted-foreground flex items-start gap-1">
            <ArrowDownToLine className="w-3 h-3 flex-shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words">{event.dropoff_location}</span>
          </div>
        )}
        {event.detail && <div className="text-muted-foreground italic break-words">{event.detail}</div>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DayScheduleTab() {
  const [date, setDate] = useState(todayMTDate);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unassignOver, setUnassignOver] = useState(false);

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

  // Drag-and-drop assign / unassign. employeeId === null means unassign.
  const assignMutation = useMutation({
    mutationFn: async (body: {
      type: DayEventType;
      eventId: number;
      employeeId: number | null;
      fullname: string | null;
    }) => {
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule/assign`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update assignment");
      }
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
      toast({ title: vars.employeeId == null ? "Moved to Needs Assignment" : `Assigned to ${vars.fullname}` });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't reassign", description: e.message }),
  });

  function assignTo(payload: DragPayload, employeeId: number, fullname: string) {
    assignMutation.mutate({ type: payload.type, eventId: payload.id, employeeId, fullname });
  }
  function unassign(payload: DragPayload) {
    assignMutation.mutate({ type: payload.type, eventId: payload.id, employeeId: null, fullname: null });
  }

  const events = data?.events ?? [];
  const shifts = data?.work_shifts ?? [];

  // Build employee map from work_sched. An employee can have multiple shifts
  // in a day, so accumulate them rather than overwriting on employee_id.
  const empById = new Map<string, EmpInfo>();
  for (const s of shifts) {
    const key = `id:${s.employee_id}`;
    const existing = empById.get(key);
    const shift = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
    if (existing) {
      existing.shifts.push(shift);
    } else {
      empById.set(key, { fullname: s.fullname, shifts: [shift] });
    }
  }

  // Group events by assignee key
  const assignedMap = new Map<string, DayEvent[]>();
  const unassigned: DayEvent[] = [];

  for (const e of events) {
    const key = assigneeKey(e);
    if (!key) { unassigned.push(e); continue; }
    if (!assignedMap.has(key)) assignedMap.set(key, []);
    assignedMap.get(key)!.push(e);
    if (!empById.has(key)) {
      empById.set(key, { fullname: e.assigned_to ?? key, shifts: [] });
    }
  }

  // Employees with a shift but no events still appear
  for (const s of shifts) {
    const key = `id:${s.employee_id}`;
    if (!assignedMap.has(key)) assignedMap.set(key, []);
  }

  // Sort: shift employees first, then alphabetically
  const sortedEmployees = [...empById.entries()].sort(([, a], [, b]) => {
    const aHas = a.shifts.length > 0, bHas = b.shifts.length > 0;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.fullname.localeCompare(b.fullname);
  });

  // Category totals for summary bar
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
          <span className="font-semibold text-sm">{formatDisplayDate(date)}</span>
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

      {/* Summary badges */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const c = colorFor(cat);
            return (
              <span key={cat} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${c.bg} ${c.text} font-medium`}>
                {cat} <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading schedule…</div>}
      {error && <div className="text-sm text-destructive py-4">Failed to load schedule.</div>}

      {!isLoading && !error && (
        <div className="flex gap-4 flex-col lg:flex-row items-start">

          {/* Employee sections */}
          <div className="flex-1 min-w-0 space-y-3">
            {sortedEmployees.length === 0 && unassigned.length === 0 ? (
              <div className="border border-border rounded-lg py-12 text-center text-sm text-muted-foreground bg-background">
                No scheduled events for this day.
              </div>
            ) : (
              sortedEmployees.map(([key, emp]) => (
                <EmployeeSection
                  key={key}
                  empKey={key}
                  emp={emp}
                  events={assignedMap.get(key) ?? []}
                  onAssign={assignTo}
                />
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 space-y-4 flex-shrink-0">

            {/* Needs assignment — drop here to unassign */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setUnassignOver(true);
              }}
              onDragLeave={() => setUnassignOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUnassignOver(false);
                const payload = readDragData(e);
                if (payload) unassign(payload);
              }}
              className={`border rounded-lg overflow-hidden bg-background transition-colors ${
                unassignOver ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"
              }`}
            >
              <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                <span>Needs Assignment</span>
                {unassigned.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{unassigned.length}</Badge>
                )}
              </div>
              <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto">
                {unassigned.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {unassignOver ? "Drop to unassign" : "All events assigned ✓ — drag a task here to unassign"}
                  </p>
                ) : (
                  unassigned.map((e) => <UnassignedCard key={`${e.type}-${e.id}`} event={e} />)
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Legend
              </div>
              <div className="p-2 space-y-1">
                {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
                  <div key={cat} className="flex items-center gap-2 text-xs text-foreground">
                    <span className={`w-3 h-3 rounded flex-shrink-0 ${c.bg}`} />
                    {cat}
                  </div>
                ))}
              </div>
            </div>

            {/* Shift roster */}
            {shifts.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <div className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <User className="w-3 h-3 inline mr-1" />Shift Roster
                </div>
                <div className="p-2 space-y-1">
                  {shifts.map((s, i) => (
                    <div key={`${s.employee_id}-${s.start_time}-${i}`} className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium truncate">{s.fullname}</span>
                      <span className="text-muted-foreground flex-shrink-0 ml-1">
                        {fmt12(s.start_time.slice(0, 5))}–{fmt12(s.end_time.slice(0, 5))}
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
