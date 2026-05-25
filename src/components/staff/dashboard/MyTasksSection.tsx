/**
 * My Tasks — tasks assigned to the current employee.
 * Pulls from /api/staff/task-management. Employees can edit the status
 * inline via PATCH /api/staff/task-management/:id/status.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
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

interface TaskItem {
  task_timer_aid?: string | number;
  task_timer_date_start?: string;
  task_timer_date_end?: string;
  task_timer_emp_list?: string;
  task_timer_name?: string;
  task_timer_car_name?: string;
  task_timer_status?: number;
  task_timer_description?: string;
}

// Status codes match the admin Task Management page:
//   0 = New, 1 = In Progress, 2 = On Hold, 3 = Completed.
// The old mapping in this file (1→Completed, 2→In Progress) was wrong and made
// the dashboard show "Completed" for tasks that were actually just in progress.
const STATUS_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "0", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "1", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "2", label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  { value: "3", label: "Completed", className: "bg-green-100 text-green-700" },
];

function statusLabel(v: number | undefined): string {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(Number(v ?? 0)))?.label ??
    "New"
  );
}

function fmtDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/**
 * task_timer_emp_list is stored as a JSON string. Historically it was a
 * mixed bag: a CSV of IDs, a JSON array of IDs/names, OR — and this is what
 * caused the "[object Object]" rendering bug — a JSON array of {id,name}
 * objects. We pull a display name out of each entry.
 */
function parseAssignees(empList: string | undefined): string {
  if (!empList) return "—";
  let parsed: unknown = empList;
  try {
    parsed = JSON.parse(empList);
  } catch {
    // Not JSON — treat as CSV string.
    return empList.trim() || "—";
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return "—";
  const names = (parsed as unknown[])
    .map((x) => {
      if (x == null) return "";
      if (typeof x === "string" || typeof x === "number") return String(x);
      if (typeof x === "object") {
        const obj = x as Record<string, unknown>;
        return String(
          obj.name ?? obj.fullname ?? obj.label ?? obj.email ?? obj.id ?? "",
        );
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

export default function MyTasksSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success?: boolean; data?: TaskItem[] }>({
    queryKey: ["staff-task-management", "/api/staff/task-management"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/staff/task-management"), { credentials: "include" });
      if (r.status === 404 || r.status === 501) return { success: true, data: [] };
      if (!r.ok) throw new Error("Failed to load tasks");
      return r.json();
    },
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: number }) => {
      const r = await fetch(
        buildApiUrl(`/api/staff/task-management/${vars.id}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_timer_status: vars.status }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff-task-management", "/api/staff/task-management"],
      });
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

  const all = data?.data ?? [];
  const tasks = all.slice(0, 8);

  return (
    <div className="mb-8">
      <SectionHeader title="TASK MANAGEMENT" subtitle="Tasks assigned to you." />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No tasks assigned.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#FFCC00] border-collapse text-sm">
            <thead>
              <tr className="bg-black border-y border-[#FFCC00]">
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Assigned To:</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Date</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Task Description</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Due Date</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Repeat</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Assignee</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={String(t.task_timer_aid ?? i)} className="bg-white border-y border-[#FFCC00]">
                  <td className="px-3 py-2 text-center text-black">{parseAssignees(t.task_timer_emp_list)}</td>
                  <td className="px-3 py-2 text-center text-black">{fmtDate(t.task_timer_date_start)}</td>
                  <td className="px-3 py-2 text-center text-black">
                    {t.task_timer_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-black">{fmtDate(t.task_timer_date_end)}</td>
                  <td className="px-3 py-2 text-center text-black">None</td>
                  <td className="px-3 py-2 text-center text-black">—</td>
                  <td className="px-3 py-2 text-center text-black">
                    {t.task_timer_aid != null ? (
                      <Select
                        value={String(Number(t.task_timer_status ?? 0))}
                        onValueChange={(v) =>
                          updateStatus.mutate({
                            id: Number(t.task_timer_aid),
                            status: Number(v),
                          })
                        }
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger
                          className={`h-8 w-[140px] mx-auto text-xs ${
                            STATUS_OPTIONS.find(
                              (s) =>
                                s.value === String(Number(t.task_timer_status ?? 0)),
                            )?.className ?? ""
                          }`}
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
                      statusLabel(t.task_timer_status)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {all.length > tasks.length && (
            <div className="mt-3 text-center">
              <Link
                href="/staff/task-management"
                className="text-sm font-medium text-[#B8860B] hover:underline"
              >
                View all {all.length} tasks →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
