import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { format } from "date-fns";
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

const STATUS_SORT_ORDER: Record<number, number> = { 1: 0, 0: 1, 2: 2, 3: 3 };

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
    2: "On Hold",
    3: "Completed",
  };
  return <span className="text-sm text-gray-900">{labels[status] ?? "Not Started"}</span>;
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

  // Recurrence JSON is consumed on generation and not stored on any row.
  // Infer the pattern from the gap between due dates within the same series.
  const seriesDates = new Map<number, number[]>(); // seriesId → sorted timestamps
  for (const t of tasks) {
    if (!t.task_timer_series_id || !t.task_timer_date_end) continue;
    const ts = new Date(t.task_timer_date_end).getTime();
    if (!isNaN(ts)) {
      const arr = seriesDates.get(t.task_timer_series_id) ?? [];
      arr.push(ts);
      seriesDates.set(t.task_timer_series_id, arr);
    }
  }

  function inferSeriesRecurrence(seriesId: number | null): string {
    if (!seriesId) return "None";
    const dates = (seriesDates.get(seriesId) ?? []).sort((a, b) => a - b);
    if (dates.length < 2) return "None";
    const gapMs = dates[1] - dates[0];
    const gapDays = Math.round(gapMs / (1000 * 60 * 60 * 24));
    if (gapDays === 1) return "Daily";
    if (gapDays === 7) return "Weekly";
    if (gapDays >= 28 && gapDays <= 31) return "Monthly";
    return `Every ${gapDays} days`;
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const sortedTasks = useMemo(() => {
    let f = [...tasks].sort(
      (a, b) => (STATUS_SORT_ORDER[a.task_timer_status] ?? 4) - (STATUS_SORT_ORDER[b.task_timer_status] ?? 4),
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(t => [t.task_timer_name, t.task_timer_description, t.task_timer_goal, t.task_timer_car_name]
        .some(v => v && v.toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      f = f.filter(t => String(t.task_timer_status ?? 0) === statusFilter);
    }
    return f.slice(0, 25);
  }, [tasks, search, statusFilter]);

  const isFiltered = search || statusFilter !== "all";

  const rows = sortedTasks.map((task) => {
    const name = task.task_timer_name || "";
    const desc = task.task_timer_description || "";
    const combined = name && desc ? `${name} — ${truncate(desc, 60)}` : name || truncate(desc, 60) || "—";

    return {
      assignedTo: parseAssignees(task.task_timer_emp_list),
      date: formatDate(task.task_timer_date_start),
      taskDescription: combined,
      dueDate: formatDate(task.task_timer_date_end),
      repeat: task.task_timer_recurrence
        ? formatRecurrence(task.task_timer_recurrence)
        : inferSeriesRecurrence(task.task_timer_series_id),
      assignedBy: task.task_timer_goal || "—",
      status: <StatusBadge status={task.task_timer_status} />,
    };
  });

  const STATUS_FILTER_OPTIONS = [
    { value: "0", label: "Not Started" },
    { value: "1", label: "In Progress" },
    { value: "2", label: "On Hold" },
    { value: "3", label: "Completed" },
  ];

  return (
    <div className="mb-8">
      <SectionHeader title="TASK MANAGEMENT" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search task name, description…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
          <option value="all">All Statuses</option>
          {STATUS_FILTER_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isFiltered && (
          <>
            <span className="text-xs text-gray-500">{rows.length} result{rows.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-[#B8860B] hover:underline">Clear all</button>
          </>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="mt-4">
            {rows.length === 0 ? (
              <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
                <p className="text-sm text-white/60">{isFiltered ? "No matching results." : "No tasks found"}</p>
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
