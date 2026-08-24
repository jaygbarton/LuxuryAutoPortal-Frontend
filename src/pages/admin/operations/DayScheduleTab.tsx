import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, Car, User, ArrowRight, ArrowDownToLine, ArrowUpFromLine, GripVertical, LayoutList, Rows3, Plus } from "lucide-react";
import { PhotoUpload } from "./PhotoUpload";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { CarScheduleImage } from "./CarScheduleImage";
import { operationLocationMatches, useOperationLocationFilter } from "./OperationLocationFilter";
import { mtLocalInputToUtcIso, mtTodayKey, addUtcDays, dayKeyToUtcDate, utcDateToDayKey } from "@/lib/mt-datetime";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayEventType =
  | "pickup" | "delivery" | "cleaning" | "refuel" | "custom"
  | "mechanic" | "windshield" | "license_plate" | "airport"
  | "maintenance" | "task_driver" | "maintenance_driver"
  | "inspection" | "block_off"
  | "owner_pickup" | "owner_cleaning" | "owner_dropoff"
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
  location_tag?: string | null;
  photos: string[] | null;
  car_photo: string | null;
  duration_minutes: number | null;
  driver_assignment_type?: "employee" | "uber" | "na" | null;
  driver_assigned_to?: string | null;
  driver_assigned_to_id?: number | null;
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

// ─── Status options per event type ───────────────────────────────────────────

const TASK_STATUSES = ["new", "in_progress", "completed", "delivered"];
const INSPECTION_STATUSES = ["new", "in_progress", "completed", "no_issues"];
const MAINTENANCE_STATUSES = ["new", "in_progress", "completed"];

const OPERATION_TASK_TYPES: DayEventType[] = ["cleaning", "delivery", "pickup", "refuel", "custom", "mechanic", "windshield", "license_plate", "airport"];

// Event types that carry an editable estimated_duration_minutes column on the
// backend (see setEventDuration in dayScheduleService.ts). Trip Start/End,
// Inspections, Block Offs, and Calendar Events already have real start/end
// timing and can't be assigned a duration.
const DURATION_EDITABLE_TYPES: DayEventType[] = ["cleaning", "delivery", "pickup", "refuel", "custom", "maintenance"];

// Event types assignable via the on-card employee picker / drag-and-drop.
// Matches ASSIGNABLE_TYPES in routes/operations.ts.
const ASSIGNEE_EDITABLE_TYPES: DayEventType[] = [
  "cleaning", "delivery", "pickup", "refuel", "mechanic", "windshield", "license_plate", "airport",
  "custom", "maintenance", "task_driver", "maintenance_driver",
  "inspection", "block_off", "owner_pickup", "owner_cleaning", "owner_dropoff", "trip_start", "trip_end",
];

const DRIVER_EDITABLE_TYPES: DayEventType[] = ["pickup", "delivery", "maintenance"];

function statusOptionsFor(type: DayEventType): string[] | null {
  if (OPERATION_TASK_TYPES.includes(type)) return TASK_STATUSES;
  if (type === "inspection") return INSPECTION_STATUSES;
  if (type === "maintenance") return MAINTENANCE_STATUSES;
  return null; // trip_start, trip_end, block_off — no editable status
}

function statusEndpointFor(type: DayEventType, id: number): { url: string; method: string } | null {
  if (OPERATION_TASK_TYPES.includes(type)) {
    return { url: `/api/operations/tasks/${id}/status`, method: "PATCH" };
  }
  if (type === "inspection") {
    return { url: `/api/operations/inspections/${id}/status`, method: "PATCH" };
  }
  if (type === "maintenance") {
    return { url: `/api/operations/maintenance/${id}`, method: "PUT" };
  }
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Pick Up":               { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
  "Drop Off":              { bg: "bg-rose-600",    text: "text-white", border: "border-rose-700" },
  "Cleaning":              { bg: "bg-teal-500",    text: "text-white", border: "border-teal-600" },
  "Refuel Run":            { bg: "bg-orange-500",  text: "text-white", border: "border-orange-600" },
  "Custom Entry":          { bg: "bg-stone-700",   text: "text-white", border: "border-stone-800" },
  "Driver":                { bg: "bg-amber-600",   text: "text-white", border: "border-amber-700" },
  "Mechanical Run":        { bg: "bg-red-500",     text: "text-white", border: "border-red-600" },
  "Car Inspection":        { bg: "bg-yellow-500",  text: "text-white", border: "border-yellow-600" },
  "Windshield Run":        { bg: "bg-purple-500",  text: "text-white", border: "border-purple-600" },
  "License Plate Run":     { bg: "bg-cyan-600",    text: "text-white", border: "border-cyan-700" },
};

const STATUS_BADGE: Record<string, string> = {
  pending:           "bg-yellow-100 text-yellow-800 border-yellow-300",
  in_progress:       "bg-blue-100 text-blue-800 border-blue-300",
  completed:         "bg-green-100 text-green-800 border-green-300",
  new:               "bg-gray-100 text-gray-700 border-gray-300",
  car_blocked_off:   "bg-amber-100 text-amber-800 border-amber-300",
  car_not_available: "bg-red-100 text-red-800 border-red-300",
  // Legacy statuses (pre-merge) still colored for any historical rows.
  block_off_started: "bg-amber-100 text-amber-800 border-amber-300",
  blocked_off_ended: "bg-amber-100 text-amber-800 border-amber-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayMTDate = mtTodayKey;

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "YYYY-MM-DD" -> "Aug/10/2026", for the compact date+time shown on each task card. */
function formatDateCompact(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${month}/${String(d).padStart(2, "0")}/${y}`;
}

function shiftDate(iso: string, delta: number): string {
  return utcDateToDayKey(addUtcDays(dayKeyToUtcDate(iso), delta));
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
    weekday: "short", month: "2-digit", day: "2-digit", timeZone: "UTC",
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

function EventCard({
  event,
  date,
  onStatusChange,
  onAssign,
  onUnassign,
  onDurationChange,
  onDriverChange,
  showAssignee = false,
}: {
  event: DayEvent;
  /** The Day Schedule page's selected date ("YYYY-MM-DD"), shown on the card
   *  alongside its time so the date is clear without depending on the page's
   *  date-nav header staying in view (e.g. after scrolling). */
  date: string;
  onStatusChange: (type: DayEventType, id: number, status: string) => void;
  /** Show the assigned employee's name on the card itself. Used by the flat
   *  Timeline view, which (unlike the Employee view) has no per-employee
   *  header to convey who a task belongs to. */
  showAssignee?: boolean;
  onAssign: (event: DayEvent, employeeId: number, fullname: string) => void;
  onUnassign: (event: DayEvent) => void;
  onDurationChange: (event: DayEvent, minutes: number | null) => void;
  onDriverChange: (
    event: DayEvent,
    assignmentType: "employee" | "uber" | "na" | null,
    employeeId?: number | null,
    fullname?: string | null,
  ) => void;
}) {
  const c = colorFor(event.category);
  const badgeClass = STATUS_BADGE[event.status ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-300";
  const statusOptions = statusOptionsFor(event.type);
  const canEditAssignee = ASSIGNEE_EDITABLE_TYPES.includes(event.type);
  const canEditDuration = DURATION_EDITABLE_TYPES.includes(event.type);
  const canEditDriver = DRIVER_EDITABLE_TYPES.includes(event.type);
  const [driverModeDraft, setDriverModeDraft] = useState<"employee" | "uber" | "na" | "">("");
  const [showAlreadyCleanBy, setShowAlreadyCleanBy] = useState(false);
  const driverMode = driverModeDraft || event.driver_assignment_type || "";

  return (
    <div
      draggable
      onDragStart={(e) => setDragData(e, event)}
      className={`group/event flex flex-col rounded-lg border ${c.border} shadow-sm cursor-grab active:cursor-grabbing sm:flex-row sm:items-stretch`}
    >
      {/* Color bar */}
      <div className={`h-1.5 w-full flex-shrink-0 ${c.bg} sm:h-auto sm:w-1.5`} />

      {/* Time gutter */}
      <div className="flex w-full flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-tight text-muted-foreground sm:w-20 sm:flex-col sm:items-end sm:justify-center sm:border-b-0 sm:border-r sm:px-1.5 sm:text-right sm:text-[10px]">
        <span>{formatDateCompact(date)}</span>
        {event.start_time ? (
          <span className="flex items-center gap-1.5 sm:flex-col sm:items-end sm:gap-0">
            <span className="font-medium text-foreground">{fmt12(event.start_time)}</span>
            {event.end_time && <span>{fmt12(event.end_time)}</span>}
          </span>
        ) : (
          <span className="italic">No time</span>
        )}
      </div>

      {/* Content */}
      <div className={`relative flex-1 min-w-0 space-y-1 px-2.5 py-2.5 ${event.car_photo ? "md:pr-40 lg:pr-52" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <GripVertical className="hidden h-3 w-3 flex-shrink-0 text-muted-foreground/40 group-hover/event:text-muted-foreground sm:block" />
              <span className={`text-[11px] font-semibold px-2 py-1 rounded sm:px-1.5 sm:py-0.5 sm:text-[10px] ${c.bg} ${c.text}`}>
                {event.category}
              </span>
              {statusOptions ? (
                <span onClick={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
                  <Select
                    value={event.status ?? "new"}
                    onValueChange={(val) => onStatusChange(event.type, event.id, val)}
                  >
                    <SelectTrigger className={`h-8 min-w-[7rem] cursor-pointer gap-1 rounded border px-2 py-0 text-[11px] sm:h-5 sm:min-w-0 sm:w-auto sm:px-1.5 sm:text-[10px] ${badgeClass}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              ) : event.status ? (
                <span className={`text-[11px] px-2 py-1 rounded border sm:px-1.5 sm:py-0.5 sm:text-[10px] ${badgeClass}`}>
                  {event.status.replace(/_/g, " ")}
                </span>
              ) : null}
              {event.type === "cleaning" && event.status !== "completed" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-[11px] sm:h-5 sm:text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAlreadyCleanBy((v) => !v);
                  }}
                >
                  Already clean?
                </Button>
              )}
            </div>
            <div className="space-y-0.5 sm:hidden">
              {event.car_name && (
                <div className="flex items-start gap-1.5 text-sm text-foreground">
                  <Car className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="min-w-0 font-semibold leading-snug">
                    {event.car_name}
                    {event.plate && <span className="font-normal text-muted-foreground"> · {event.plate}</span>}
                  </span>
                </div>
              )}
              {(event.reservation_id || event.guest_name) && (
                <div className="text-xs text-muted-foreground">
                  {event.reservation_id && <span><span className="font-medium text-foreground">Res:</span> {event.reservation_id}</span>}
                  {event.reservation_id && event.guest_name && <span> · </span>}
                  {event.guest_name && <span>{event.guest_name}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
        <CarScheduleImage
          carPhoto={event.car_photo}
          carName={event.car_name}
          className="h-32 w-full md:hidden"
          size={360}
          hideBelowMd={false}
          fit="contain"
        />
        {(canEditAssignee || canEditDuration || canEditDriver) && (
          <div
            className="grid grid-cols-1 gap-2 pt-1 min-[430px]:grid-cols-2 md:flex md:flex-wrap md:items-center"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          >
            {canEditAssignee && (
              <div className="w-full md:w-36">
                <EmployeeSelectCombobox
                  value={event.assigned_to ?? ""}
                  onChange={() => {}}
                  onSelectEmployee={(emp) => {
                    if (emp) onAssign(event, emp.employee_aid, [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || `Employee #${emp.employee_aid}`);
                    else onUnassign(event);
                  }}
                  placeholder="Unassigned"
                />
              </div>
            )}
            {canEditDuration && (
              <label className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground md:h-auto md:border-0 md:bg-transparent md:px-0 md:text-[10px]">
                <Clock className="w-3 h-3" />
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={event.duration_minutes ?? ""}
                  placeholder="mins"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onDurationChange(event, raw === "" ? null : Math.max(0, Number(raw)));
                  }}
                  className="h-7 w-16 rounded border border-border bg-background px-1 text-[11px] text-foreground md:h-6 md:w-14 md:text-[10px]"
                />
                <span>min</span>
              </label>
            )}
            {canEditDriver && (
              <div className="flex w-full items-center gap-1.5 min-[430px]:col-span-2 md:w-auto md:flex-wrap">
                <span className="text-[11px] text-muted-foreground md:text-[10px]">Driver</span>
                <Select
                  value={driverMode}
                  onValueChange={(val) => {
                    if (val === "employee") {
                      setDriverModeDraft("employee");
                      return;
                    }
                    setDriverModeDraft("");
                    onDriverChange(event, val === "clear" ? null : (val as "uber" | "na"));
                  }}
                >
                  <SelectTrigger className="h-9 w-28 px-2 text-[11px] md:h-6 md:w-24 md:text-[10px]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear">Clear</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="uber">Uber</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
                {driverMode === "employee" && (
                  <div className="min-w-0 flex-1 md:w-36 md:flex-none">
                    <EmployeeSelectCombobox
                      value={event.driver_assigned_to ?? ""}
                      onChange={() => {}}
                      onSelectEmployee={(emp) => {
                        if (emp) {
                          const fullname = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || `Employee #${emp.employee_aid}`;
                          onDriverChange(event, "employee", emp.employee_aid, fullname);
                        } else {
                          onDriverChange(event, null);
                        }
                      }}
                      placeholder="Driver"
                    />
                  </div>
                )}
              </div>
            )}
            {event.type === "cleaning" && event.status !== "completed" && showAlreadyCleanBy && (
              <div className="flex items-center gap-1 flex-wrap min-[430px]:col-span-2">
                <span className="text-[11px] text-muted-foreground md:text-[10px]">Completed by:</span>
                <div className="min-w-0 flex-1 md:w-36 md:flex-none">
                  <EmployeeSelectCombobox
                    value={event.assigned_to ?? ""}
                    onChange={() => {}}
                    onSelectEmployee={(emp) => {
                      if (!emp) return;
                      const fullname = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || `Employee #${emp.employee_aid}`;
                      onAssign(event, emp.employee_aid, fullname);
                      onStatusChange(event.type, event.id, "completed");
                      setShowAlreadyCleanBy(false);
                    }}
                    placeholder="Select employee"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {showAssignee && (
          <div className="flex items-center gap-1 text-xs text-foreground">
            <User className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className={event.assigned_to ? "font-medium" : "italic text-muted-foreground"}>
              {event.assigned_to ?? "Unassigned"}
            </span>
          </div>
        )}
        {event.car_name && (
          <div className="hidden min-w-0 items-start gap-1 text-xs text-foreground sm:flex">
            <Car className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words font-medium">{event.car_name}</span>
            {event.plate && <span className="shrink-0 text-muted-foreground">· {event.plate}</span>}
          </div>
        )}
        {event.reservation_id && (
          <div className="hidden text-xs text-muted-foreground sm:block">
            <span className="font-medium text-foreground">Res:</span> {event.reservation_id}
          </div>
        )}
        {event.guest_name && (
          <div className="hidden text-xs text-muted-foreground sm:block">{event.guest_name}</div>
        )}
        {event.extras && (
          <div className="animate-pulse inline-flex items-center gap-1 text-xs font-medium text-amber-900 bg-amber-300 rounded px-1.5 py-0.5 w-fit">
            <span className="font-semibold">Extras:</span> {event.extras}
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
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="break-words">{event.location}</span>
          </div>
        )}
        {event.detail && (
          <div className="text-xs text-muted-foreground italic break-words">{event.detail}</div>
        )}
        {event.notes && (
          <div className="text-xs text-muted-foreground break-words">{event.notes}</div>
        )}
        {/* Photos from the underlying inspection/maintenance record — lets the
            morning-meeting review "back-track" what was actually done that day. */}
        {event.photos && event.photos.length > 0 && (
          <div onClick={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
            <PhotoUpload
              photos={event.photos}
              onPhotosChange={() => {}}
              entityType={event.type === "maintenance" ? "maintenance" : "inspection"}
              disabled
              compact
            />
          </div>
        )}
        <CarScheduleImage
          carPhoto={event.car_photo}
          carName={event.car_name}
          className="absolute bottom-2 right-2 top-2 w-36 lg:w-48"
          fit="contain"
        />
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
  date,
  onAssign,
  onStatusChange,
  onAssignEvent,
  onUnassignEvent,
  onDurationChange,
  onDriverChange,
}: {
  empKey: string;
  emp: EmpInfo;
  events: DayEvent[];
  date: string;
  onAssign: (payload: DragPayload, employeeId: number, fullname: string) => void;
  onStatusChange: (type: DayEventType, id: number, status: string) => void;
  onAssignEvent: (event: DayEvent, employeeId: number, fullname: string) => void;
  onUnassignEvent: (event: DayEvent) => void;
  onDurationChange: (event: DayEvent, minutes: number | null) => void;
  onDriverChange: (
    event: DayEvent,
    assignmentType: "employee" | "uber" | "na" | null,
    employeeId?: number | null,
    fullname?: string | null,
  ) => void;
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
      className={`border rounded-lg overflow-hidden transition-colors ${sorted.length === 0 ? "hidden md:block" : ""} ${
        dragOver ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      {/* Employee header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border sm:gap-3">
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
        <Badge variant="outline" className="ml-auto text-xs">
          {events.length} task{events.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Event list */}
      <div className="p-2 space-y-2 bg-background sm:space-y-1.5">
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3 italic">No tasks scheduled</div>
        ) : (
          sorted.map((e) => (
            <EventCard
              key={`${e.type}-${e.id}`}
              event={e}
              date={date}
              onStatusChange={onStatusChange}
              onAssign={onAssignEvent}
              onUnassign={onUnassignEvent}
              onDurationChange={onDurationChange}
              onDriverChange={onDriverChange}
            />
          ))
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
          <div className="animate-pulse inline-flex items-center gap-1 font-medium text-amber-900 bg-amber-300 rounded px-1.5 py-0.5 w-fit">
            <span className="font-semibold">Extras:</span> {event.extras}
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
  const locationFilter = useOperationLocationFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unassignOver, setUnassignOver] = useState(false);
  // Clicking a category badge/legend entry toggles it into this set to filter
  // the task list down to just that category; click again to clear. Empty
  // set = no filter (show everything), matching today's default behavior.
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"employee" | "timeline">("employee");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryType, setEntryType] = useState<"refuel" | "custom">("refuel");
  const [entryCarName, setEntryCarName] = useState("");
  // Seed from the Mountain-Time wall clock, not the browser's. `date` (the
  // day being browsed) is still an America/Denver day key until the backend's
  // /api/operations/day-schedule query understands per-viewer day windows
  // (Phase 5) — so `entryTime` has to stay pinned to the same zone `date`
  // uses, or combining them at submit would silently reintroduce the
  // day-shift bug this form was fixed for.
  const [entryTime, setEntryTime] = useState(() =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Denver",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  const [entryNotes, setEntryNotes] = useState("");
  const [entryEmployee, setEntryEmployee] = useState<{ id: number | null; name: string }>({ id: null, name: "" });

  function toggleCategoryFilter(category: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

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
  // Same assign/unassign mutation, but driven by the on-card employee picker
  // (image 7's "users must be able to change the assigned employees") rather
  // than drag-and-drop.
  function assignEventTo(event: DayEvent, employeeId: number, fullname: string) {
    assignMutation.mutate({ type: event.type, eventId: event.id, employeeId, fullname });
  }
  function unassignEvent(event: DayEvent) {
    assignMutation.mutate({ type: event.type, eventId: event.id, employeeId: null, fullname: null });
  }

  const durationMutation = useMutation({
    mutationFn: async (body: { type: DayEventType; eventId: number; minutes: number | null }) => {
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule/duration`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update duration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update duration", description: e.message }),
  });

  function handleDurationChange(event: DayEvent, minutes: number | null) {
    durationMutation.mutate({ type: event.type, eventId: event.id, minutes });
  }

  const driverMutation = useMutation({
    mutationFn: async (body: {
      type: DayEventType;
      eventId: number;
      assignmentType: "employee" | "uber" | "na" | null;
      employeeId?: number | null;
      fullname?: string | null;
    }) => {
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule/driver`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update driver");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update driver", description: e.message }),
  });

  function handleDriverChange(
    event: DayEvent,
    assignmentType: "employee" | "uber" | "na" | null,
    employeeId: number | null = null,
    fullname: string | null = null,
  ) {
    driverMutation.mutate({ type: event.type, eventId: event.id, assignmentType, employeeId, fullname });
  }

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      // `date` is a Mountain-Time day key and `entryTime` a Mountain wall time,
      // so the pair has to be interpreted as Mountain — letting `new Date()`
      // parse it applied the *browser's* offset instead, which filed a Manila
      // user's entry under the previous day.
      const scheduledAt = mtLocalInputToUtcIso(`${date}T${entryTime || "09:00"}`);
      if (!scheduledAt) throw new Error("Pick a valid date and time");
      const res = await fetch(buildApiUrl(`/api/operations/day-schedule/entry`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entryType,
          carName: entryCarName,
          scheduledAt,
          notes: entryNotes,
          employeeId: entryEmployee.id,
          fullname: entryEmployee.name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
      setShowAddEntry(false);
      setEntryCarName("");
      setEntryNotes("");
      setEntryEmployee({ id: null, name: "" });
      toast({ title: "Entry added" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't add entry", description: e.message }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ type, id, status }: { type: DayEventType; id: number; status: string }) => {
      const endpoint = statusEndpointFor(type, id);
      if (!endpoint) throw new Error("Cannot update status for this event type");
      const res = await fetch(buildApiUrl(endpoint.url), {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Couldn't update status", description: e.message }),
  });

  function handleStatusChange(type: DayEventType, id: number, status: string) {
    statusMutation.mutate({ type, id, status });
  }

  const allEvents = (data?.events ?? []).filter((event) =>
    operationLocationMatches(locationFilter, [
      event.location_tag,
      event.pickup_location,
      event.dropoff_location,
      event.location,
      event.car_name,
      event.plate,
    ]),
  );
  // Category counts for the summary badges/legend are always computed from
  // the FULL unfiltered list, so a user can see (and toggle back on) every
  // category's total even while other categories are filtered out.
  const events = activeCategories.size === 0
    ? allEvents
    : allEvents.filter((e) => activeCategories.has(e.category));
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

  // Flat, time-sorted list for the Timeline view — every task across every
  // employee in one list, instead of grouped by employee section.
  const timelineEvents = [...events].sort((a, b) => timeKey(a.start_time).localeCompare(timeKey(b.start_time)));

  // Category totals for summary bar — always from the full unfiltered list.
  const categoryCounts = allEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Date nav */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <Button variant="outline" size="sm" className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-3" onClick={() => setDate((d) => shiftDate(d, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex items-center justify-center gap-2 sm:justify-start">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">{formatDisplayDate(date)}</span>
        </div>
        <Button variant="outline" size="sm" className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-3" onClick={() => setDate((d) => shiftDate(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="col-span-3 h-10 min-w-0 rounded border border-border bg-background px-2 py-1 text-sm text-foreground sm:col-span-1 sm:h-9"
        />
        <Button variant="outline" size="sm" className="h-10 sm:h-9" onClick={() => setDate(todayMTDate())}>
          Today
        </Button>
        <Button variant="default" size="sm" className="col-span-2 h-10 sm:col-span-1 sm:h-9" onClick={() => setShowAddEntry((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Entry
        </Button>

        {/* View toggle: group by employee (default), or a single flat list
            sorted by time across everyone. */}
        <div className="col-span-3 grid grid-cols-2 overflow-hidden rounded-md border border-border sm:col-span-1 sm:ml-auto sm:inline-flex">
          <button
            type="button"
            onClick={() => setViewMode("employee")}
            className={`inline-flex h-10 items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors sm:h-auto ${
              viewMode === "employee" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Rows3 className="w-3.5 h-3.5" /> By Employee
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`inline-flex h-10 items-center justify-center gap-1.5 border-l border-border px-2.5 py-1.5 text-xs font-medium transition-colors sm:h-auto ${
              viewMode === "timeline" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" /> Timeline
          </button>
        </div>
      </div>

      {showAddEntry && (
        <div className="border border-border rounded-lg bg-background p-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as "refuel" | "custom")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refuel">Refuel Run</SelectItem>
                  <SelectItem value="custom">Custom Entry</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Car</span>
              <input
                value={entryCarName}
                onChange={(e) => setEntryCarName(e.target.value)}
                placeholder="Car refueled or worked on"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Time</span>
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Employee</span>
              <EmployeeSelectCombobox
                value={entryEmployee.name}
                onChange={(name) => setEntryEmployee((prev) => ({ ...prev, name }))}
                onSelectEmployee={(emp) => {
                  if (!emp) {
                    setEntryEmployee({ id: null, name: "" });
                    return;
                  }
                  const fullname = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || `Employee #${emp.employee_aid}`;
                  setEntryEmployee({ id: emp.employee_aid, name: fullname });
                }}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-1 md:col-span-5">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <input
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                placeholder="Details"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </label>
            <Button
              type="button"
              disabled={!entryCarName.trim() || addEntryMutation.isPending}
              onClick={() => addEntryMutation.mutate()}
            >
              Save Entry
            </Button>
          </div>
        </div>
      )}

      {/* Summary badges — click to filter the task list down to that category;
          click again (or the same legend entry) to clear it. */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const c = colorFor(cat);
            const active = activeCategories.has(cat);
            return (
              <button
                type="button"
                key={cat}
                onClick={() => toggleCategoryFilter(cat)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium ${c.bg} ${c.text} transition-opacity cursor-pointer hover:opacity-80 sm:py-1 ${
                  activeCategories.size > 0 && !active ? "opacity-40" : ""
                } ${active ? "ring-2 ring-offset-1 ring-foreground/60" : ""}`}
                title={active ? `Click to clear the ${cat} filter` : `Click to filter by ${cat}`}
              >
                {cat} <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
              </button>
            );
          })}
          {activeCategories.size > 0 && (
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs sm:h-6" onClick={() => setActiveCategories(new Set())}>
              Clear filter
            </Button>
          )}
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading schedule…</div>}
      {error && <div className="text-sm text-destructive py-4">Failed to load schedule.</div>}

      {!isLoading && !error && (
        <div className="flex gap-4 flex-col lg:flex-row items-start">

          {/* Main content: grouped by employee, or a flat timeline */}
          <div className="flex-1 min-w-0 space-y-3">
            {viewMode === "employee" ? (
              sortedEmployees.length === 0 && unassigned.length === 0 ? (
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
                    date={date}
                    onAssign={assignTo}
                    onStatusChange={handleStatusChange}
                    onAssignEvent={assignEventTo}
                    onUnassignEvent={unassignEvent}
                    onDurationChange={handleDurationChange}
                    onDriverChange={handleDriverChange}
                  />
                ))
              )
            ) : timelineEvents.length === 0 ? (
              <div className="border border-border rounded-lg py-12 text-center text-sm text-muted-foreground bg-background">
                No scheduled events for this day.
              </div>
            ) : (
              <div className="space-y-1.5">
                {timelineEvents.map((e) => (
                  <EventCard
                    key={`${e.type}-${e.id}`}
                    event={e}
                    date={date}
                    showAssignee
                    onStatusChange={handleStatusChange}
                    onAssign={assignEventTo}
                    onUnassign={unassignEvent}
                    onDurationChange={handleDurationChange}
                    onDriverChange={handleDriverChange}
                  />
                ))}
              </div>
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
              <div className="p-2 space-y-1.5 max-h-[55vh] overflow-y-auto lg:max-h-80">
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
                {Object.entries(CATEGORY_COLORS).map(([cat, c]) => {
                  const active = activeCategories.has(cat);
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => toggleCategoryFilter(cat)}
                      className={`w-full flex items-center gap-2 text-xs text-foreground rounded px-1 py-0.5 -mx-1 hover:bg-muted transition-opacity ${
                        activeCategories.size > 0 && !active ? "opacity-40" : ""
                      } ${active ? "bg-muted font-semibold" : ""}`}
                      title={active ? `Click to clear the ${cat} filter` : `Click to filter by ${cat}`}
                    >
                      <span className={`w-3 h-3 rounded flex-shrink-0 ${c.bg}`} />
                      {cat}
                    </button>
                  );
                })}
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
