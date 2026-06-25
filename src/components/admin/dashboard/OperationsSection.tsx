import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardRecordCard } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface OperationTask {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string | null;
  plate?: string | null;
  guest_name: string | null;
  task_type: "cleaning" | "delivery" | "pickup" | "refuel";
  assigned_to: string | null;
  scheduled_date: string | null;
  scheduled_location: string | null;
  due_date: string | null;
  status: "new" | "in_progress" | "completed" | "delivered";
  notes: string | null;
  trip_start?: string | null;
  trip_end?: string | null;
  days_rented?: number | string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  extras?: string | null;
  miles_included?: number | string | null;
  trip_start_odometer?: number | string | null;
  trip_end_odometer?: number | string | null;
  total_miles?: number | string | null;
  earnings?: number | string | null;
  trip_status?: string | null;
  created_at: string;
  updated_at: string;
}

interface OperationTasksResponse {
  success: boolean;
  data: OperationTask[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "delivered", label: "Delivered", className: "bg-emerald-100 text-emerald-700" },
];

const TASK_TYPE_META: Record<string, { label: string; className: string }> = {
  pickup: { label: "Pick Up", className: "bg-blue-100 text-blue-700" },
  delivery: { label: "Drop Off", className: "bg-purple-100 text-purple-700" },
  cleaning: { label: "Cleaning", className: "bg-amber-100 text-amber-800" },
};

function taskTypeMeta(t: string | undefined | null) {
  return (
    TASK_TYPE_META[String(t ?? "").toLowerCase()] ?? {
      label: t ? String(t) : "—",
      className: "bg-gray-100 text-gray-700",
    }
  );
}

function statusMeta(v: string | undefined | null) {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(v ?? "").toLowerCase()) ??
    STATUS_OPTIONS[0]
  );
}

function asStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmtMoney(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

function fmtDays(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n) || n < 0) return "—";
  return String(n);
}

function fmtDateTime(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return String(v);
  }
}

// Accent colors per task type, mirroring the Day Schedule category palette so
// the dashboard cards read the same way as the daily schedule.
const TASK_TYPE_ACCENT: Record<string, { bg: string; border: string }> = {
  pickup: { bg: "bg-blue-500", border: "border-blue-300" },
  delivery: { bg: "bg-indigo-500", border: "border-indigo-300" },
  cleaning: { bg: "bg-teal-500", border: "border-teal-300" },
};

export default function OperationsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<OperationTasksResponse>({
    queryKey: ["/api/operations/tasks"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/tasks?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: string }) => {
      const r = await fetch(buildApiUrl(`/api/operations/tasks/${vars.id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) throw new Error(body?.error || `HTTP ${r.status}`);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({ title: "Could not update status", description: e?.message ?? "", variant: "destructive" });
    },
  });

  const allTasks = useMemo(() =>
    [...(data?.data ?? [])].sort((a, b) => {
      // Sort by trip_start DESC so today's trips appear at the top.
      // Fall back to scheduled_date then created_at for tasks without a trip.
      const aTime = a.trip_start
        ? new Date(a.trip_start).getTime()
        : a.scheduled_date
          ? new Date(a.scheduled_date).getTime()
          : new Date(a.created_at).getTime();
      const bTime = b.trip_start
        ? new Date(b.trip_start).getTime()
        : b.scheduled_date
          ? new Date(b.scheduled_date).getTime()
          : new Date(b.created_at).getTime();
      return bTime - aTime;
    }),
    [data]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const assignedToOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of allTasks) { const v = (t.assigned_to ?? "").trim(); if (v) names.add(v); }
    return Array.from(names).sort();
  }, [allTasks]);

  const tasks = useMemo(() => {
    // This section is "Pick Up and Drop Off" — refuel tasks are standalone
    // Bouncie-triggered reminders, not related to guest pickups/deliveries.
    let f = allTasks.filter(t => t.task_type !== "refuel");
    if (search.trim()) { const q = search.toLowerCase(); f = f.filter(t => Object.values(t).some(v => v != null && String(v).toLowerCase().includes(q))); }
    if (statusFilter !== "all") f = f.filter(t => t.status === statusFilter);
    if (assignedToFilter !== "all") f = f.filter(t => (t.assigned_to ?? "").trim() === assignedToFilter);
    // Single date RANGE [From, To]: keep trips whose trip_start OR trip_end
    // falls within the range (single day = From==To). Compare MT YYYY-MM-DD
    // strings (not raw UTC timestamps) so the filter agrees with the Trip Start
    // / Trip Ends columns, which render in America/Denver.
    const toMtDate = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso)); }
      catch { return null; }
    };
    if (rangeFrom || rangeTo) {
      f = f.filter(t => {
        const sd = toMtDate(t.trip_start);
        const ed = toMtDate(t.trip_end);
        const inRange = (day: string | null) => day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
        return inRange(sd) || inRange(ed);
      });
    }
    return f.slice(0, 20);
  }, [allTasks, search, statusFilter, assignedToFilter, rangeFrom, rangeTo]);

  const isFiltered = search || statusFilter !== "all" || assignedToFilter !== "all" || rangeFrom || rangeTo;
  function clearAll() { setSearch(""); setStatusFilter("all"); setAssignedToFilter("all"); setRangeFrom(""); setRangeTo(""); }

  return (
    <div className="mb-8">
      <SectionHeader title="OPERATIONS" subtitle="PICK UP AND DROP OFF" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reservation, car, guest…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {assignedToOptions.length > 0 && (
          <select value={assignedToFilter} onChange={e => setAssignedToFilter(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
            <option value="all">All Assignees</option>
            {assignedToOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 whitespace-nowrap">Trip Start/End From</label>
          <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          <span className="text-xs text-gray-400">–</span>
          <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
          <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {(rangeFrom || rangeTo) && <button onClick={() => { setRangeFrom(""); setRangeTo(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        {isFiltered && <><span className="text-xs text-gray-500">{tasks.length} result{tasks.length !== 1 ? "s" : ""}</span><button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button></>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{isFiltered ? "No matching results." : "No tasks found."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task, i) => {
            const type = taskTypeMeta(task.task_type);
            const sm = statusMeta(task.status);
            return (
              <DashboardRecordCard
                key={task.id ?? i}
                accentBg={TASK_TYPE_ACCENT[String(task.task_type ?? "").toLowerCase()]?.bg ?? "bg-slate-500"}
                accentBorder={TASK_TYPE_ACCENT[String(task.task_type ?? "").toLowerCase()]?.border ?? "border-slate-300"}
                typeLabel={type.label}
                reservationId={task.reservation_id}
                carName={task.car_name}
                plate={task.plate}
                guestName={task.guest_name}
                assignedTo={task.assigned_to}
                tripStart={fmtDateTime(task.trip_start)}
                tripEnd={fmtDateTime(task.trip_end)}
                pickupLocation={asStr(task.pickup_location ?? task.scheduled_location)}
                dropoffLocation={asStr(task.dropoff_location)}
                details={[
                  { label: "Days Rented", value: fmtDays(task.days_rented) },
                  { label: "Extras", value: asStr(task.extras) },
                  { label: "Miles Included", value: fmtNum(task.miles_included) },
                  { label: "Trip Start Odometer", value: fmtNum(task.trip_start_odometer) },
                  { label: "Trip Ends Odometer", value: fmtNum(task.trip_end_odometer) },
                  { label: "Total Miles", value: fmtNum(task.total_miles) },
                  { label: "Earnings", value: fmtMoney(task.earnings) },
                  { label: "Trip Status", value: asStr(task.trip_status) },
                  { label: "Scheduled Date/Time", value: fmtDateTime(task.scheduled_date) },
                ]}
                statusControl={
                  <Select
                    value={sm.value}
                    onValueChange={(v) => updateStatus.mutate({ id: task.id, status: v })}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className={`h-7 w-[130px] text-xs ${sm.className}`}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
