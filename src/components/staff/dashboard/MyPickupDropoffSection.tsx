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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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

  const rows = (data?.data ?? []).slice(0, 10);

  return (
    <div className="mb-8">
      <SectionHeader title="PICK UP AND DROP OFF" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nothing assigned to you.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs">
            <thead>
              <tr className="bg-black border-y border-[#D3BC8D]">
                {[
                  "Reservation #",
                  "Task Type",
                  "Car",
                  "Plate #",
                  "Trip Start",
                  "Pick Up Location",
                  "Trip Ends",
                  "Drop Off Location",
                  "Assigned to",
                  "Status",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-3 py-2 text-center font-bold uppercase text-white whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const type = taskTypeMeta(row.task_type);
                return (
                  <tr key={String(row.id ?? i)} className="bg-white border-y border-[#D3BC8D]">
                    <td className="px-3 py-2 text-center text-black">{asString(row.reservation_no)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.className}`}
                      >
                        {type.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.car)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.plate)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.trip_start)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.pickup_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.trip_end)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.dropoff_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{asString(row.assigned_to)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      {row.id != null ? (
                        <Select
                          value={statusMeta(row.status).value}
                          onValueChange={(v) =>
                            updateStatus.mutate({ id: Number(row.id), status: v })
                          }
                          disabled={updateStatus.isPending}
                        >
                          <SelectTrigger
                            className={`h-8 w-[140px] mx-auto text-xs ${statusMeta(row.status).className}`}
                          >
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        statusMeta(row.status).label
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
