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

interface OperationTask {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string | null;
  plate?: string | null;
  guest_name: string | null;
  task_type: "cleaning" | "delivery" | "pickup";
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
  "Task Type",
  "Assigned To",
  "Scheduled Date/Time",
  "Task Status",
];

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

  const tasks = [...(data?.data ?? [])]
    .sort((a, b) => {
      const aTime = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const bTime = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  return (
    <div className="mb-8">
      <SectionHeader title="OPERATIONS" subtitle="PICK UP AND DROP OFF" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No tasks found.</p>
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
              {tasks.map((task, i) => {
                const type = taskTypeMeta(task.task_type);
                const sm = statusMeta(task.status);
                return (
                  <tr key={task.id ?? i} className="bg-white border-y border-[#D3BC8D]">
                    <td className="px-3 py-2 text-center text-black">{asStr(task.reservation_id)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.car_name)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.plate)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDateTime(task.trip_start)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.pickup_location ?? task.scheduled_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDateTime(task.trip_end)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDays(task.days_rented)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.dropoff_location)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.extras)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(task.miles_included)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(task.trip_start_odometer)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(task.trip_end_odometer)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtNum(task.total_miles)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtMoney(task.earnings)}</td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.trip_status)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.className}`}>
                        {type.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-black">{asStr(task.assigned_to)}</td>
                    <td className="px-3 py-2 text-center text-black">{fmtDateTime(task.scheduled_date)}</td>
                    <td className="px-3 py-2 text-center text-black">
                      <Select
                        value={sm.value}
                        onValueChange={(v) => updateStatus.mutate({ id: task.id, status: v })}
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
