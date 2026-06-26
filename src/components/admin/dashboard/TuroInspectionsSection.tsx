import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardRecordCard, CarPhotoCell } from "@/components/admin/dashboard";
import { FuelReturnedCell } from "@/pages/admin/operations/FuelReturnedCell";
import { CarIssueTypesCell } from "@/pages/admin/operations/CarIssueTypesCell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Inspection {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string | null;
  plate?: string | null;
  source: "turo_return" | "manual";
  assigned_to: string | null;
  status: "new" | "in_progress" | "completed" | "no_issues";
  inspection_date: string | null;
  due_date: string | null;
  notes: string | null;
  photos: string[] | null;
  tt_trip_start?: string | null;
  tt_trip_end?: string | null;
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
  gas_level_trip_start?: string | null;
  gas_level_trip_end?: string | null;
  fuel_returned?: string | null;
  car_issue_types?: unknown;
  car_photo?: string | null;
  created_at: string;
  updated_at: string;
}

interface InspectionsResponse {
  success: boolean;
  data: Inspection[];
  total: number;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "no_issues", label: "No Issues", className: "bg-emerald-100 text-emerald-700" },
];

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

const GAS_LABELS: Record<string, string> = {
  empty: "Empty",
  quarter: "1/4",
  half: "1/2",
  three_quarters: "3/4",
  full: "Full",
};
function fmtGasLevel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return GAS_LABELS[String(v)] ?? String(v);
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


function parseIssueTypes(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function TuroInspectionsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<InspectionsResponse>({
    queryKey: ["/api/operations/inspections", "turo"],
    queryFn: async () => {
      // Fetch turo_return stubs server-side so this section is scoped to Turo
      // returns (the Car Issues section handles manual inspections).
      const res = await fetch(buildApiUrl("/api/operations/inspections?source=turo_return&limit=200"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch inspections");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: string }) => {
      const r = await fetch(buildApiUrl(`/api/operations/inspections/${vars.id}/status`), {
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
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections", "turo"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({ title: "Could not update status", description: e?.message ?? "", variant: "destructive" });
    },
  });

  const allInspections = useMemo(() =>
    // Sort by Trip Start ASC (soonest upcoming first), matching the Day
    // Schedule's chronological order; fall back to created_at when no trip.
    [...(data?.data ?? [])].sort((a, b) => {
      const at = a.tt_trip_start ? new Date(a.tt_trip_start).getTime() : new Date(a.created_at).getTime();
      const bt = b.tt_trip_start ? new Date(b.tt_trip_start).getTime() : new Date(b.created_at).getTime();
      return at - bt;
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
    for (const t of allInspections) { const v = (t.assigned_to ?? "").trim(); if (v) names.add(v); }
    return Array.from(names).sort();
  }, [allInspections]);

  const inspections = useMemo(() => {
    let f = allInspections;
    // Turo Messages / Inspections = auto-created turo_return stubs only.
    // Manually-logged inspections belong to the Car Issues section. This mirrors
    // the Operations tabs (Turo Messages = turo_return, Car Issues = manual) so
    // the two dashboard sections don't show the same rows twice.
    f = f.filter(t => t.source === "turo_return");
    if (search.trim()) { const q = search.toLowerCase(); f = f.filter(t => Object.values(t).some(v => v != null && String(v).toLowerCase().includes(q))); }
    if (statusFilter !== "all") f = f.filter(t => t.status === statusFilter);
    if (assignedToFilter !== "all") f = f.filter(t => (t.assigned_to ?? "").trim() === assignedToFilter);
    // Single date RANGE [From, To]: keep inspections whose trip START OR trip
    // END falls within the range (single day = From==To). Compare MT
    // YYYY-MM-DD strings so the filter agrees with the columns rendered in
    // America/Denver.
    const toMtDate = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso)); }
      catch { return null; }
    };
    if (rangeFrom || rangeTo) {
      f = f.filter(t => {
        const sd = toMtDate(t.tt_trip_start);
        const ed = toMtDate(t.tt_trip_end);
        const inRange = (day: string | null) => day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
        return inRange(sd) || inRange(ed);
      });
    }
    return f.slice(0, 30);
  }, [allInspections, search, statusFilter, assignedToFilter, rangeFrom, rangeTo]);

  const isFiltered = search || statusFilter !== "all" || assignedToFilter !== "all" || rangeFrom || rangeTo;
  function clearAll() { setSearch(""); setStatusFilter("all"); setAssignedToFilter("all"); setRangeFrom(""); setRangeTo(""); }

  return (
    <div className="mb-8">
      <SectionHeader title="TURO MESSAGES / INSPECTIONS" />

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
        {isFiltered && <><span className="text-xs text-gray-500">{inspections.length} result{inspections.length !== 1 ? "s" : ""}</span><button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button></>}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : inspections.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{isFiltered ? "No matching results." : "No inspections found."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {inspections.map((insp, i) => {
            const sm = statusMeta(insp.status);
            const photoCount = insp.photos?.length ?? 0;
            return (
              <DashboardRecordCard
                key={insp.id ?? i}
                accentBg="bg-yellow-500"
                accentBorder="border-yellow-300"
                typeLabel="Turo / Inspection"
                reservationId={insp.reservation_id}
                carName={insp.car_name}
                plate={insp.plate}
                assignedTo={insp.assigned_to}
                tripStart={fmtDateTime(insp.tt_trip_start)}
                tripEnd={fmtDateTime(insp.tt_trip_end)}
                pickupLocation={asStr(insp.pickup_location)}
                dropoffLocation={asStr(insp.dropoff_location)}
                media={<CarPhotoCell carPhoto={insp.car_photo} carName={insp.car_name} />}
                details={[
                  { label: "Days Rented", value: fmtDays(insp.days_rented) },
                  { label: "Extras", value: asStr(insp.extras) },
                  { label: "Miles Included", value: fmtNum(insp.miles_included) },
                  { label: "Trip Start Odometer", value: fmtNum(insp.trip_start_odometer) },
                  { label: "Trip Ends Odometer", value: fmtNum(insp.trip_end_odometer) },
                  { label: "Total Miles", value: fmtNum(insp.total_miles) },
                  { label: "Earnings", value: fmtMoney(insp.earnings) },
                  { label: "Trip Status", value: asStr(insp.trip_status) },
                  { label: "Gas Level Trip Start", value: fmtGasLevel(insp.gas_level_trip_start) },
                  { label: "Gas Level Trip End", value: fmtGasLevel(insp.gas_level_trip_end) },
                  { label: "Fuel Returned", value: <FuelReturnedCell level={(insp.fuel_returned as any) ?? null} /> },
                  { label: "Car Issues Type", value: <CarIssueTypesCell types={parseIssueTypes(insp.car_issue_types)} /> },
                  { label: "Photos", value: photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? "s" : ""}` : "—" },
                ]}
                notes={asStr(insp.notes)}
                statusControl={
                  <Select
                    value={sm.value}
                    onValueChange={(v) => updateStatus.mutate({ id: insp.id, status: v })}
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
