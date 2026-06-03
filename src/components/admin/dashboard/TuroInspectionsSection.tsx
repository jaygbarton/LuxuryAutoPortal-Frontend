import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
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
  fuel_returned?: string | null;
  car_issue_types?: unknown;
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

const HEADERS = [
  "Reservation #",
  "CAR Name",
  "Plate #",
  "Trip Start",
  "Pick Up Location",
  "Trip Ends",
  "Days Rented",
  "Drop Off Location",
  "Extras",
  "Miles Included",
  "Trip Start Odometer",
  "Trip Ends Odometer",
  "Total Miles",
  "Earnings",
  "Trip Status",
  "Assigned To",
  "Fuel Returned",
  "Car Issues Type",
  "Photos",
  "Remarks",
  "Inspection Status",
];

export default function TuroInspectionsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<InspectionsResponse>({
    queryKey: ["/api/operations/inspections", "turo"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/inspections?limit=50"), {
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

  const inspections = [...(data?.data ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);

  return (
    <div className="mb-8">
      <SectionHeader title="TURO MESSAGES / INSPECTIONS" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : inspections.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No inspections found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs">
            <thead>
              <tr className="bg-black border-y border-[#D3BC8D]">
                {HEADERS.map((h) => (
                  <th key={h} className="px-3 py-2 text-center font-bold uppercase text-white whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inspections.map((insp, i) => {
                const sm = statusMeta(insp.status);
                const photoCount = insp.photos?.length ?? 0;
                return (
                  <tr key={insp.id ?? i} className="bg-white border-y border-[#D3BC8D]">
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.reservation_id)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.car_name)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.plate)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDateTime(insp.tt_trip_start)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.pickup_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDateTime(insp.tt_trip_end)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDays(insp.days_rented)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.dropoff_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.extras)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(insp.miles_included)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(insp.trip_start_odometer)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(insp.trip_end_odometer)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(insp.total_miles)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtMoney(insp.earnings)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.trip_status)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.assigned_to)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      <FuelReturnedCell level={(insp.fuel_returned as any) ?? null} />
                    </td>
                    <td className="px-3 py-2 text-center text-black">
                      <CarIssueTypesCell types={parseIssueTypes(insp.car_issue_types)} />
                    </td>
                    <td className="px-3 py-2 text-center text-black">
                      {photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? "s" : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-black">{asStr(insp.notes)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      <Select
                        value={sm.value}
                        onValueChange={(v) => updateStatus.mutate({ id: insp.id, status: v })}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className={`h-8 w-[140px] mx-auto text-xs ${sm.className}`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
