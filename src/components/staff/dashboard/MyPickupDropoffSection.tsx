/**
 * Pick Up & Drop Off — operation_tasks assigned to me.
 *
 * Endpoint: /api/me/pickup-dropoff (graceful fallback if not implemented).
 *
 * Each row is a delivery / pickup / cleaning task. We surface the TASK TYPE
 * column so employees can tell at a glance whether a row is a pick-up, a
 * drop-off (delivery), or a car cleaning — previously this was ambiguous.
 * Employees can also update the status inline via
 * PATCH /api/me/pickup-dropoff/:id/status.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
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

const ENDPOINT = "/api/me/pickup-dropoff";
const QUERY_KEY = "me-pickup-dropoff";

interface PickupDropoffRow {
  id?: number;
  reservation_no?: string | number;
  car?: string;
  plate?: string;
  trip_start?: string;
  trip_end?: string;
  pickup_location?: string;
  dropoff_location?: string;
  assigned_to?: string;
  status?: string;
  task_type?: string;
  // Trip columns mirrored from the admin Trip Tasks tab.
  days_rented?: number | string;
  extras?: string;
  miles_included?: number | string;
  trip_start_odometer?: number | string;
  trip_end_odometer?: number | string;
  total_miles?: number | string;
  earnings?: number | string;
  trip_status?: string;
  scheduled_date?: string;
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

function fmtScheduled(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  } catch {
    return String(v);
  }
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

// operation_tasks.task_type → friendly label + chip color.
const TASK_TYPE_META: Record<string, { label: string; className: string }> = {
  pickup: { label: "Pick Up", className: "bg-blue-100 text-blue-700" },
  delivery: { label: "Drop Off", className: "bg-purple-100 text-purple-700" },
  cleaning: { label: "Cleaning", className: "bg-amber-100 text-amber-800" },
};

function taskTypeMeta(t: string | undefined) {
  return (
    TASK_TYPE_META[String(t ?? "").toLowerCase()] ?? {
      label: t ? String(t) : "—",
      className: "bg-gray-100 text-gray-700",
    }
  );
}

// operation_tasks.status values, per operationsService.ts.
const STATUS_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "delivered", label: "Delivered", className: "bg-emerald-100 text-emerald-700" },
];

function statusMeta(v: string | undefined) {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(v ?? "").toLowerCase()) ??
    STATUS_OPTIONS[0]
  );
}

function asString(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function MyPickupDropoffSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success?: boolean; data?: PickupDropoffRow[] }>({
    queryKey: [QUERY_KEY, ENDPOINT],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(ENDPOINT), { credentials: "include" });
      if (r.status === 404 || r.status === 501) return { success: true, data: [] };
      if (!r.ok) throw new Error("Failed to load Pick Up & Drop Off");
      return r.json();
    },
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: string }) => {
      const r = await fetch(
        buildApiUrl(`${ENDPOINT}/${vars.id}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: vars.status }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, ENDPOINT] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({
        title: "Could not update status",
        description: e?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const allRows = data?.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [tripStartFrom, setTripStartFrom] = useState("");
  const [tripEndTo, setTripEndTo] = useState("");

  const assignedToOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of allRows) {
      const v = String(row.assigned_to ?? "").trim();
      if (v && v !== "—") names.add(v);
    }
    return Array.from(names).sort();
  }, [allRows]);

  const rows = useMemo(() => {
    let filtered = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((row) => String(row.status ?? "") === statusFilter);
    }
    if (assignedToFilter !== "all") {
      filtered = filtered.filter((row) => String(row.assigned_to ?? "").trim() === assignedToFilter);
    }
    // Match each date field against its own exact Mountain-Time calendar day,
    // AND-ed together: "Trip Start on 6/17 AND Trip Ends on 6/17". Compare
    // MT YYYY-MM-DD strings (not raw UTC timestamps) so the filter agrees with
    // the Trip Start / Trip Ends columns, which render in America/Denver.
    const toMtDate = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso)); }
      catch { return null; }
    };
    if (tripStartFrom) {
      filtered = filtered.filter((row) => toMtDate(row.trip_start) === tripStartFrom);
    }
    if (tripEndTo) {
      filtered = filtered.filter((row) => toMtDate(row.trip_end) === tripEndTo);
    }
    return filtered.slice(0, 10);
  }, [allRows, search, statusFilter, assignedToFilter, tripStartFrom, tripEndTo]);

  const isFiltered = search || statusFilter !== "all" || assignedToFilter !== "all" || tripStartFrom || tripEndTo;

  function clearAll() {
    setSearch(""); setStatusFilter("all"); setAssignedToFilter("all"); setTripStartFrom(""); setTripEndTo("");
  }

  return (
    <div className="mb-8">
      <SectionHeader title="PICK UP AND DROP OFF" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, car, guest…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {assignedToOptions.length > 0 && (
          <select value={assignedToFilter} onChange={(e) => setAssignedToFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
            <option value="all">All Assignees</option>
            {assignedToOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 whitespace-nowrap">Trip Start</label>
          <input type="date" value={tripStartFrom} onChange={(e) => setTripStartFrom(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {tripStartFrom && <button onClick={() => setTripStartFrom("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500 whitespace-nowrap">Trip Ends</label>
          <input type="date" value={tripEndTo} onChange={(e) => setTripEndTo(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {tripEndTo && <button onClick={() => setTripEndTo("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        {isFiltered && (
          <>
            <span className="text-xs text-gray-500">{rows.length} result{rows.length !== 1 ? "s" : ""}</span>
            <button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {isFiltered ? "No matching results." : "Nothing assigned to you."}
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-black">
                {[
                  "Reservation #",
                  "CAR Name",
                  "Plate #",
                  "Trip Start",
                  "Pick Up Location",
                  "Trip Ends",
                  "Drop Off Location",
                  "Days Rented",
                  "Extras",
                  "Miles Included",
                  "Trip Start Odometer",
                  "Trip Ends Odometer",
                  "Total Miles",
                  "Earnings",
                  "Trip Status",
                  "Task Type",
                  "Assigned To",
                  "Scheduled Date/Time",
                  "Task Status",
                ].map((label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-10 bg-black px-3 py-2 text-center font-bold uppercase text-white whitespace-nowrap border-b border-[#D3BC8D]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const type = taskTypeMeta(row.task_type);
                const sm = statusMeta(row.status);
                return (
                  <tr key={String(row.id ?? i)} className="border-b border-[#D3BC8D] even:bg-muted/30 hover:bg-muted/50">
                    <td className="px-3 py-2 text-center whitespace-nowrap font-medium text-primary">{asString(row.reservation_no)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{asString(row.car)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{asString(row.plate)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{fmtDateTime(row.trip_start)}</td>
                    <td className="px-3 py-2 text-center max-w-[160px] truncate" title={asString(row.pickup_location) !== "—" ? String(row.pickup_location) : undefined}>{asString(row.pickup_location)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{fmtDateTime(row.trip_end)}</td>
                    <td className="px-3 py-2 text-center max-w-[160px] truncate" title={asString(row.dropoff_location) !== "—" ? String(row.dropoff_location) : undefined}>{asString(row.dropoff_location)}</td>
                    <td className="px-3 py-2 text-center">{fmtDays(row.days_rented)}</td>
                    <td className="px-3 py-2 text-center max-w-[140px] truncate" title={asString(row.extras) !== "—" ? String(row.extras) : undefined}>{asString(row.extras)}</td>
                    <td className="px-3 py-2 text-center">{fmtNum(row.miles_included)}</td>
                    <td className="px-3 py-2 text-center">{fmtNum(row.trip_start_odometer)}</td>
                    <td className="px-3 py-2 text-center">{fmtNum(row.trip_end_odometer)}</td>
                    <td className="px-3 py-2 text-center">{fmtNum(row.total_miles)}</td>
                    <td className="px-3 py-2 text-center font-medium text-primary">{fmtMoney(row.earnings)}</td>
                    <td className="px-3 py-2 text-center capitalize">{asString(row.trip_status)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.className}`}>
                        {type.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{asString(row.assigned_to)}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{fmtScheduled(row.scheduled_date)}</td>
                    <td className="px-3 py-2 text-center">
                      {row.id != null ? (
                        <Select
                          value={sm.value}
                          onValueChange={(v) => updateStatus.mutate({ id: Number(row.id), status: v })}
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger className={`h-7 w-[130px] mx-auto text-xs font-semibold ${sm.className}`}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${sm.className}`}>{sm.label}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
