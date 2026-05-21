/**
 * My Tasks — tasks assigned to the current employee.
 * Pulls from /api/staff/task-management.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

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

function fmtDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function statusLabel(status: number | undefined): string {
  const s = Number(status);
  if (s === 1) return "Completed";
  if (s === 2) return "In-Progress";
  return "Not Started";
}

function parseAssignees(empList: string | undefined): string {
  if (!empList) return "—";
  try {
    const parsed: unknown = JSON.parse(empList);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.join(", ");
  } catch {
    /* not JSON */
  }
  return "—";
}

export default function MyTasksSection() {
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
                  <td className="px-3 py-2 text-center text-black">{statusLabel(t.task_timer_status)}</td>
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
