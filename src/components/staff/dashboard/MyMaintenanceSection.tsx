/**
 * Maintenance — tasks assigned to me.
 * Card-based layout matching the admin dashboard MaintenanceSection,
 * scoped to the logged-in employee via /api/me/maintenance.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardRecordCard } from "@/components/admin/dashboard";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAINT_STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "delivered", label: "Delivered", className: "bg-purple-100 text-purple-700" },
];

function statusMeta(v: string | undefined | null) {
  return (
    MAINT_STATUS_OPTIONS.find((s) => s.value === String(v ?? "").toLowerCase()) ??
    MAINT_STATUS_OPTIONS[0]
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
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
}

function fmtMoney(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toMtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso)); }
  catch { return null; }
}

export default function MyMaintenanceSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; data: any[]; total?: number }>({
    queryKey: ["/api/me/maintenance"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/maintenance"), {
        credentials: "include",
      });
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: string }) => {
      const r = await fetch(buildApiUrl(`/api/operations/maintenance/${vars.id}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/maintenance"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({ title: "Could not update status", description: e?.message ?? "", variant: "destructive" });
    },
  });

  const allTasks = useMemo(() =>
    [...(data?.data ?? [])].sort((a, b) => {
      const at = (a.trip_start || a.scheduled_date) ? new Date(a.trip_start || a.scheduled_date).getTime() : 0;
      const bt = (b.trip_start || b.scheduled_date) ? new Date(b.trip_start || b.scheduled_date).getTime() : 0;
      return at - bt;
    }),
    [data]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const displayTasks = useMemo(() => {
    let f = allTasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(t => [t.car_name, t.car, t.task_description, t.car_issues, t.assigned_to, t.repair_shop, t.notes, t.remarks]
        .some(v => v && String(v).toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") f = f.filter(t => t.status === statusFilter);
    if (rangeFrom || rangeTo) {
      const inRange = (day: string | null) => day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
      f = f.filter(t => inRange(toMtDate(t.trip_start)) || inRange(toMtDate(t.trip_end)));
    }
    return f.slice(0, 20);
  }, [allTasks, search, statusFilter, rangeFrom, rangeTo]);

  const isFiltered = search || statusFilter !== "all" || rangeFrom || rangeTo;
  function clearAll() { setSearch(""); setStatusFilter("all"); setRangeFrom(""); setRangeTo(""); }

  return (
    <div className="mb-8">
      <SectionHeader title="MAINTENANCE" />

      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search car, description…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
          <option value="all">All Statuses</option>
          {MAINT_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">Trip Start/End From</span>
          <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          <span className="text-xs text-gray-400">–</span>
          <span className="text-xs text-gray-500 whitespace-nowrap">To</span>
          <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {(rangeFrom || rangeTo) && <button onClick={() => { setRangeFrom(""); setRangeTo(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        {isFiltered && <><span className="text-xs text-gray-500">{displayTasks.length} result{displayTasks.length !== 1 ? "s" : ""}</span><button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button></>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : displayTasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{isFiltered ? "No matching results." : "No maintenance tasks assigned to you."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {displayTasks.map((task, i) => {
            const sm = statusMeta(task.status);
            const carName = task.car_name || task.car || "—";
            const plate = task.plate || task.car_plate || task.trip_plate_number || "—";
            const description = task.task_description || task.car_issues || "—";
            const tripStart = task.trip_start;
            const tripEnd = task.trip_end;
            const pickup = task.pickup_location || task.trip_pickup_location || task.trip_delivery_location;
            const dropoff = task.dropoff_location || task.trip_return_location || task.trip_delivery_location;
            const earnings = task.earnings || task.trip_earnings;
            const notes = task.notes || task.remarks;
            return (
              <DashboardRecordCard
                key={task.id ?? i}
                accentBg="bg-orange-500"
                accentBorder="border-orange-300"
                typeLabel="Maintenance"
                reservationId={task.reservation_no || task.trip_reservation_id}
                carName={carName}
                plate={plate}
                assignedTo={task.assigned_to}
                tripStart={tripStart ? formatDateTime(tripStart) : "—"}
                tripEnd={tripEnd ? formatDateTime(tripEnd) : "—"}
                pickupLocation={pickup || "—"}
                dropoffLocation={dropoff || "—"}
                details={[
                  { label: "Task Description", value: description },
                  { label: "Scheduled Date", value: formatDate(task.scheduled_date) },
                  { label: "Due Date", value: formatDate(task.due_date) },
                  { label: "Repair Shop", value: task.repair_shop || "—" },
                  { label: "Extras", value: task.extras || task.trip_extras || "—" },
                  { label: "Earnings", value: fmtMoney(earnings) },
                  { label: "Trip Status", value: task.trip_status || "—" },
                ]}
                notes={notes || "—"}
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
                      {MAINT_STATUS_OPTIONS.map((s) => (
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
