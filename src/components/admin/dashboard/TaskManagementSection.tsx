import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

interface TaskTimer {
  task_timer_aid: number;
  task_timer_name: string;
  task_timer_emp_id: string;
  task_timer_emp_list: string;
  task_timer_date_start: string;
  task_timer_date_end: string;
  task_timer_status: number;
  task_timer_description: string;
  task_timer_goal: string;
  task_timer_car_name: string;
  task_timer_recurrence: string | null;
  task_timer_series_id: number | null;
  task_timer_created: string;
}

interface TaskTimerResponse {
  success: boolean;
  data: TaskTimer[];
  total: number;
}

const TABLE_COLUMNS = [
  { key: "assignedTo", label: "Assigned To", align: "left" as const },
  { key: "date", label: "Date", align: "left" as const },
  { key: "taskDescription", label: "Task Description", align: "left" as const },
  { key: "dueDate", label: "Due Date", align: "left" as const },
  { key: "repeat", label: "Repeat", align: "left" as const },
  { key: "assignedBy", label: "Assigned By", align: "left" as const },
  { key: "status", label: "Status", align: "left" as const },
];

const STATUS_SORT_ORDER: Record<number, number> = { 1: 0, 0: 1, 2: 2 };

function parseAssignees(empList: string): string {
  if (!empList) return "Unassigned";
  try {
    const parsed: unknown = JSON.parse(empList);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const names = (parsed as unknown[]).map((x) => {
        if (x == null) return "";
        if (typeof x === "string" || typeof x === "number") return String(x);
        if (typeof x === "object") {
          const o = x as Record<string, unknown>;
          return String(o.name ?? o.fullname ?? o.label ?? o.email ?? o.id ?? "");
        }
        return "";
      }).map((s) => s.trim()).filter(Boolean);
      return names.length > 0 ? names.join(", ") : "Unassigned";
    }
  } catch {
    // not valid JSON — treat as plain string
    return empList.trim() || "Unassigned";
  }
  return "Unassigned";
}

function formatRecurrence(raw: string | null | undefined): string {
  if (!raw) return "None";
  try {
    const r = JSON.parse(raw) as { type?: string; days?: string[]; dayOfMonth?: number };
    if (!r?.type || r.type === "none") return "None";
    if (r.type === "daily") return "Daily";
    if (r.type === "weekly") {
      return r.days && r.days.length > 0 ? `Weekly (${r.days.join(", ")})` : "Weekly";
    }
    if (r.type === "monthly") {
      return r.dayOfMonth ? `Monthly (day ${r.dayOfMonth})` : "Monthly";
    }
    return r.type;
  } catch {
    return raw;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: number }) {
  const labels: Record<number, string> = {
    0: "Not Started",
    1: "In Progress",
    2: "Completed",
  };
  return <span className="text-sm text-gray-900">{labels[status] ?? "Pending"}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded bg-white/10"
        />
      ))}
    </div>
  );
}

export default function TaskManagementSection() {
  const { data, isLoading } = useQuery<TaskTimerResponse>({
    queryKey: ["/api/admin/hr/task-timers"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/hr/task-timers"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const tasks = data?.data ?? [];

  // Build a map of aid → recurrence so child tasks (which have null recurrence
  // but a task_timer_series_id pointing to the parent) can inherit the label.
  const recurrenceByAid = new Map<number, string | null>();
  for (const t of tasks) {
    if (t.task_timer_recurrence) recurrenceByAid.set(t.task_timer_aid, t.task_timer_recurrence);
  }

  const sortedTasks = [...tasks]
    .sort(
      (a, b) =>
        (STATUS_SORT_ORDER[a.task_timer_status] ?? 3) -
        (STATUS_SORT_ORDER[b.task_timer_status] ?? 3),
    )
    .slice(0, 25);

  const rows = sortedTasks.map((task) => {
    const name = task.task_timer_name || "";
    const desc = task.task_timer_description || "";
    const combined = name && desc ? `${name} — ${truncate(desc, 60)}` : name || truncate(desc, 60) || "—";

    return {
      assignedTo: parseAssignees(task.task_timer_emp_list),
      date: formatDate(task.task_timer_date_start),
      taskDescription: combined,
      dueDate: formatDate(task.task_timer_date_end),
      repeat: formatRecurrence(
        task.task_timer_recurrence ??
        (task.task_timer_series_id ? recurrenceByAid.get(task.task_timer_series_id) ?? null : null)
      ),
      assignedBy: task.task_timer_goal || "—",
      status: <StatusBadge status={task.task_timer_status} />,
    };
  });

  return (
    <div className="mb-8">
      <SectionHeader title="TASK MANAGEMENT" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Task Table */}
          <div className="mt-4">
            {rows.length === 0 ? (
              <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
                <p className="text-sm text-white/60">No tasks found</p>
              </div>
            ) : (
              <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
