import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X, Sparkles, Truck, Package, Clock } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
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

// A "trip group" — one card per unique turo_trip_id (or per standalone task)
interface TripGroup {
  tripId: number | null;
  key: string;
  reservation_id: string | null;
  car_name: string | null;
  plate: string | null;
  guest_name: string | null;
  trip_start: string | null;
  trip_end: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  days_rented: unknown;
  extras: unknown;
  miles_included: unknown;
  trip_start_odometer: unknown;
  trip_end_odometer: unknown;
  total_miles: unknown;
  earnings: unknown;
  trip_status: string | null;
  cleaning: OperationTask | null;
  delivery: OperationTask | null;
  pickup: OperationTask | null;
  allTasks: OperationTask[];
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "delivered", label: "Delivered", className: "bg-emerald-100 text-emerald-700" },
];

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

function asStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
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

function statusMeta(v: string | undefined | null) {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(v ?? "").toLowerCase()) ??
    STATUS_OPTIONS[0]
  );
}

// Assignment chip for cleaning / delivery / pickup
function AssignmentChip({
  icon: Icon,
  label,
  task,
  iconColor,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  task: OperationTask | null;
  iconColor: string;
  bgColor: string;
}) {
  if (!task) {
    return (
      <div className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 border border-dashed border-gray-200 bg-gray-50 opacity-50`}>
        <Icon className={`w-3.5 h-3.5 shrink-0 text-gray-400`} />
        <span className="text-[11px] text-gray-400">{label}: —</span>
      </div>
    );
  }

  const sm = statusMeta(task.status);
  const hasSched = !!task.scheduled_date;

  return (
    <div className={`flex flex-col gap-0.5 rounded-md px-2 py-1.5 border border-border ${bgColor}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
        <span className={`text-[11px] font-semibold ${iconColor}`}>{label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sm.className}`}>{sm.label}</span>
      </div>
      <span className="text-xs text-foreground font-medium pl-5">
        {task.assigned_to || <span className="text-muted-foreground italic">Unassigned</span>}
      </span>
      {hasSched && (
        <div className="flex items-center gap-1 pl-5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{fmtDateTime(task.scheduled_date)}</span>
        </div>
      )}
    </div>
  );
}

export default function OperationsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const todayMt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
  const fromDate = (() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d);
  })();
  const toDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 60);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d);
  })();

  const { data, isLoading } = useQuery<OperationTasksResponse>({
    queryKey: ["/api/operations/tasks", todayMt],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "500",
        tripRangeFrom: fromDate,
        tripRangeTo: toDate,
      });
      const res = await fetch(buildApiUrl(`/api/operations/tasks?${params}`), {
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

  // Group tasks by turo_trip_id so each trip shows one card with all 3 assignments
  const allGroups = useMemo<TripGroup[]>(() => {
    const rawTasks = (data?.data ?? []).filter(t => t.task_type !== "refuel");
    const map = new Map<string, TripGroup>();

    for (const t of rawTasks) {
      const key = t.turo_trip_id != null ? `trip_${t.turo_trip_id}` : `task_${t.id}`;
      if (!map.has(key)) {
        map.set(key, {
          tripId: t.turo_trip_id,
          key,
          reservation_id: t.reservation_id,
          car_name: t.car_name,
          plate: t.plate ?? null,
          guest_name: t.guest_name,
          trip_start: t.trip_start ?? null,
          trip_end: t.trip_end ?? null,
          pickup_location: t.pickup_location ?? t.scheduled_location ?? null,
          dropoff_location: t.dropoff_location ?? null,
          days_rented: t.days_rented,
          extras: t.extras,
          miles_included: t.miles_included,
          trip_start_odometer: t.trip_start_odometer,
          trip_end_odometer: t.trip_end_odometer,
          total_miles: t.total_miles,
          earnings: t.earnings,
          trip_status: t.trip_status ?? null,
          cleaning: null,
          delivery: null,
          pickup: null,
          allTasks: [],
        });
      }
      const g = map.get(key)!;
      g.allTasks.push(t);
      if (t.task_type === "cleaning") g.cleaning = t;
      else if (t.task_type === "delivery") g.delivery = t;
      else if (t.task_type === "pickup") g.pickup = t;
    }

    return [...map.values()].sort((a, b) => {
      const aTime = a.trip_start ? new Date(a.trip_start).getTime() : 0;
      const bTime = b.trip_start ? new Date(b.trip_start).getTime() : 0;
      return aTime - bTime;
    });
  }, [data]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const assignedToOptions = useMemo(() => {
    const names = new Set<string>();
    for (const g of allGroups) {
      for (const t of g.allTasks) {
        const v = (t.assigned_to ?? "").trim();
        if (v) names.add(v);
      }
    }
    return Array.from(names).sort();
  }, [allGroups]);

  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso)); }
    catch { return null; }
  };

  const groups = useMemo(() => {
    let f = allGroups;
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(g =>
        [g.reservation_id, g.car_name, g.plate, g.guest_name,
          g.cleaning?.assigned_to, g.delivery?.assigned_to, g.pickup?.assigned_to,
        ].some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      f = f.filter(g => g.allTasks.some(t => t.status === statusFilter));
    }
    if (assignedToFilter !== "all") {
      f = f.filter(g => g.allTasks.some(t => (t.assigned_to ?? "").trim() === assignedToFilter));
    }
    if (rangeFrom || rangeTo) {
      f = f.filter(g => {
        const sd = toMtDate(g.trip_start);
        const ed = toMtDate(g.trip_end);
        const inRange = (day: string | null) => day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
        return inRange(sd) || inRange(ed);
      });
    }
    return f.slice(0, 20);
  }, [allGroups, search, statusFilter, assignedToFilter, rangeFrom, rangeTo]);

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
        {isFiltered && <><span className="text-xs text-gray-500">{groups.length} result{groups.length !== 1 ? "s" : ""}</span><button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button></>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{isFiltered ? "No matching results." : "No tasks found."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div
              key={g.key}
              className="flex items-stretch rounded-lg overflow-hidden border border-blue-200 bg-white shadow-sm"
            >
              {/* Accent bar */}
              <div className="w-1.5 flex-shrink-0 bg-blue-500" />

              <div className="flex-1 min-w-0 px-3 py-2.5 space-y-2">
                {/* Header: reservation + trip dates */}
                <div className="flex items-start gap-2 flex-wrap">
                  {g.reservation_id && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      #{g.reservation_id}
                    </span>
                  )}
                  {g.trip_status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium capitalize">
                      {g.trip_status}
                    </span>
                  )}
                </div>

                {/* Car + plate */}
                {g.car_name && (
                  <div className="flex items-center gap-1.5 text-sm text-foreground">
                    <span className="font-semibold">{g.car_name}</span>
                    {g.plate && <span className="text-muted-foreground text-xs">· {g.plate}</span>}
                  </div>
                )}

                {/* Guest */}
                {g.guest_name && (
                  <div className="text-xs text-muted-foreground">{g.guest_name}</div>
                )}

                {/* Trip window */}
                {(g.trip_start || g.trip_end) && (
                  <div className="flex items-center gap-1.5 text-xs flex-wrap">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{fmtDateTime(g.trip_start)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">{fmtDateTime(g.trip_end)}</span>
                  </div>
                )}

                {/* Pickup / drop off locations */}
                {g.pickup_location && g.pickup_location !== "—" && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Pick Up:</span> {g.pickup_location}
                  </div>
                )}
                {g.dropoff_location && g.dropoff_location !== "—" && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Drop Off:</span> {g.dropoff_location}
                  </div>
                )}

                {/* ── Assignment chips: Cleaning · Delivery · Pickup ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <AssignmentChip
                    icon={Sparkles}
                    label="Cleaning"
                    task={g.cleaning}
                    iconColor="text-yellow-600"
                    bgColor="bg-yellow-50"
                  />
                  <AssignmentChip
                    icon={Truck}
                    label="Delivery"
                    task={g.delivery}
                    iconColor="text-blue-600"
                    bgColor="bg-blue-50"
                  />
                  <AssignmentChip
                    icon={Package}
                    label="Pick Up"
                    task={g.pickup}
                    iconColor="text-green-600"
                    bgColor="bg-green-50"
                  />
                </div>

                {/* Trip details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 pt-1 border-t border-border/40">
                  {[
                    { label: "Days Rented", value: fmtDays(g.days_rented) },
                    { label: "Miles Included", value: fmtNum(g.miles_included) },
                    { label: "Total Miles", value: fmtNum(g.total_miles) },
                    { label: "Earnings", value: fmtMoney(g.earnings) },
                    { label: "Trip Start ODO", value: fmtNum(g.trip_start_odometer) },
                    { label: "Trip End ODO", value: fmtNum(g.trip_end_odometer) },
                    { label: "Extras", value: asStr(g.extras) },
                  ].filter(d => d.value !== "—").map(d => (
                    <div key={d.label} className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 leading-tight">{d.label}</div>
                      <div className="text-xs text-foreground">{d.value}</div>
                    </div>
                  ))}
                </div>

                {/* Per-task status controls */}
                {g.allTasks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                    {g.allTasks.map(t => {
                      const sm = statusMeta(t.status);
                      return (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground capitalize">{t.task_type}:</span>
                          <Select
                            value={sm.value}
                            onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}
                            disabled={updateStatus.isPending}
                          >
                            <SelectTrigger className={`h-7 w-[120px] text-xs ${sm.className}`}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
