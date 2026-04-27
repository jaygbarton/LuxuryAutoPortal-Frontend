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

function statusBadge(status: number | undefined) {
  const s = Number(status);
  if (s === 1) {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Completed
      </span>
    );
  }
  if (s === 2) {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        In-Progress
      </span>
    );
  }
  return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
      Not Started
    </span>
  );
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
      <SectionHeader title="MY TASKS" subtitle="Tasks assigned to you." />

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No tasks assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Task Description</th>
                  <th className="px-3 py-2 text-left font-semibold">Due Date</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, i) => (
                  <tr
                    key={String(t.task_timer_aid ?? i)}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 text-gray-700">{fmtDate(t.task_timer_date_start)}</td>
                    <td className="px-3 py-2 text-gray-900">
                      <div className="font-medium">{t.task_timer_name ?? "Untitled task"}</div>
                      {t.task_timer_car_name && (
                        <div className="text-xs text-gray-500">{t.task_timer_car_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{fmtDate(t.task_timer_date_end)}</td>
                    <td className="px-3 py-2 text-center">{statusBadge(t.task_timer_status)}</td>
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
    </div>
  );
}
