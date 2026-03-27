import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, SummaryCard, DashboardTable } from "@/components/admin/dashboard";

interface TaskTimer {
  task_timer_aid: number;
  task_timer_name: string;
  task_timer_emp_list: string;
  task_timer_date_start: string;
  task_timer_date_end: string;
  task_timer_status: number;
  task_timer_description: string;
  task_timer_car_name: string;
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
  try {
    const parsed: unknown = JSON.parse(empList);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.join(", ");
    }
  } catch {
    // not valid JSON
  }
  return "Unassigned";
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: number }) {
  const config: Record<number, { label: string; className: string }> = {
    0: { label: "Not Started", className: "bg-red-600 text-white" },
    1: { label: "In Progress", className: "bg-[#FFD700] text-black" },
    2: { label: "Completed", className: "bg-green-600 text-white" },
  };

  const { label, className } = config[status] ?? {
    label: "Pending",
    className: "bg-gray-400 text-white",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${className}`}
    >
      {label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 px-4 py-6">
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

  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.task_timer_status === 1).length;
  const completedCount = tasks.filter((t) => t.task_timer_status === 2).length;

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
      repeat: "None",
      assignedBy: "—",
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
          {/* Summary Cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:grid-cols-3">
            <SummaryCard
              label="Total Tasks"
              value={String(totalCount)}
              variant="gold"
            />
            <SummaryCard
              label="In Progress"
              value={String(inProgressCount)}
              variant="dark"
            />
            <SummaryCard
              label="Completed"
              value={String(completedCount)}
              variant="dark"
            />
          </div>

          {/* Task Table */}
          <div className="mt-4 px-4">
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
