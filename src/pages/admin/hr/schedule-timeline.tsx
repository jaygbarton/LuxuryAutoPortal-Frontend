/**
 * Schedule Overview — one place to scroll through employees and see shifts,
 * assigned tasks, and days off for a week at a time. Aggregates three
 * existing HR data sources (Work Schedule shifts, Task Management tasks,
 * Time Off/leave) via a single backend endpoint
 * (GET /api/admin/hr/schedule-timeline) rather than three separate fetches.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

interface TimelineShift {
  work_sched_aid: number;
  work_sched_emp_id: number;
  work_sched_time: string;
  work_sched_start_time: string;
  work_sched_end_time: string;
}

interface TimelineTask {
  task_timer_aid: number;
  task_timer_name: string;
  task_timer_description: string;
  task_timer_status: number;
  task_timer_date_end: string;
  task_timer_estimated_hours: number | string | null;
  task_timer_car_name: string;
}

interface TimelineDay {
  date: string;
  shiftsByEmp: Record<string, TimelineShift[]>;
  tasksByEmp: Record<string, TimelineTask[]>;
  dayOffEmpIds: number[];
}

interface TimelineEmployee {
  employee_aid: number;
  fullname: string;
}

interface TimelineResponse {
  success: boolean;
  data: {
    employees: TimelineEmployee[];
    days: TimelineDay[];
  };
}

const STATUS_LABELS: Record<number, string> = {
  0: "New",
  1: "In Progress",
  2: "Completed",
  3: "Delivered",
};

/** Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back to previous Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayHeader(iso: string): { weekday: string; monthDay: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function isToday(iso: string): boolean {
  return iso === toISODate(new Date());
}

export default function ScheduleTimelinePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);

  const fromDate = toISODate(weekStart);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const toDate = toISODate(weekEnd);

  const { data, isLoading, isFetching } = useQuery<TimelineResponse>({
    queryKey: ["/api/admin/hr/schedule-timeline", fromDate, toDate, taskSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate, toDate });
      if (taskSearch.trim()) params.set("search", taskSearch.trim());
      const res = await fetch(
        buildApiUrl(`/api/admin/hr/schedule-timeline?${params.toString()}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
    staleTime: 1000 * 60,
  });

  const employees = data?.data?.employees ?? [];
  const days = data?.data?.days ?? [];

  const visibleEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.fullname.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  function goToToday() {
    setWeekStart(startOfWeek(new Date()));
  }
  function goPrevWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }
  function goNextWeek() {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  return (
    <AdminLayout>
      <div className="flex flex-col w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-primary">Schedule Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shifts, tasks, and days off for every employee in one place.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goPrevWeek} title="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goNextWeek} title="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-medium text-muted-foreground whitespace-nowrap">
              {formatDayHeader(fromDate).monthDay} – {formatDayHeader(toDate).monthDay}
            </span>
          </div>

          <div className="min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Search employee</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Employee name…"
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="min-w-[220px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Search task</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Task name or description…"
                className="pl-8 h-9"
              />
            </div>
          </div>

          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Roster grid */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="border-collapse w-full text-sm" style={{ minWidth: "900px" }}>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="sticky left-0 z-10 bg-muted/40 text-left px-3 py-2 font-medium text-muted-foreground w-48 border-r border-border">
                    Employee
                  </th>
                  {days.map((day) => {
                    const { weekday, monthDay } = formatDayHeader(day.date);
                    return (
                      <th
                        key={day.date}
                        className={`text-left px-2 py-2 font-medium text-muted-foreground min-w-[140px] ${
                          isToday(day.date) ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="whitespace-nowrap">{weekday}</div>
                        <div className="text-xs font-normal">{monthDay}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-12 text-center text-muted-foreground text-sm">
                      Loading…
                    </td>
                  </tr>
                ) : visibleEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="py-12 text-center text-muted-foreground text-sm">
                      No employees match.
                    </td>
                  </tr>
                ) : (
                  visibleEmployees.map((emp) => {
                    const empKey = String(emp.employee_aid);
                    return (
                      <tr key={emp.employee_aid} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground border-r border-border whitespace-nowrap">
                          {emp.fullname}
                        </td>
                        {days.map((day) => {
                          const shifts = day.shiftsByEmp[empKey] ?? [];
                          const tasks = day.tasksByEmp[empKey] ?? [];
                          const isOff = day.dayOffEmpIds.includes(emp.employee_aid);
                          return (
                            <td
                              key={day.date}
                              className={`align-top px-2 py-2 ${
                                isOff
                                  ? "bg-rose-50 dark:bg-rose-950/40"
                                  : isToday(day.date)
                                    ? "bg-primary/5"
                                    : ""
                              }`}
                            >
                              {isOff && (
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-500 mb-1">
                                  Day Off
                                </div>
                              )}
                              <div className="flex flex-col gap-1">
                                {shifts.map((s) => (
                                  <div
                                    key={s.work_sched_aid}
                                    className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] text-foreground whitespace-nowrap"
                                    title="Shift"
                                  >
                                    {s.work_sched_time}
                                  </div>
                                ))}
                                {tasks.map((t) => (
                                  <button
                                    key={t.task_timer_aid}
                                    type="button"
                                    onClick={() => setSelectedTask(t)}
                                    className="text-left rounded border border-border bg-muted/40 hover:bg-muted/70 px-1.5 py-0.5 text-[11px] text-foreground truncate transition-colors"
                                    title={t.task_timer_name}
                                  >
                                    {t.task_timer_name}
                                  </button>
                                ))}
                                {shifts.length === 0 && tasks.length === 0 && !isOff && (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Task detail */}
      <Dialog open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.task_timer_name || "Task"}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Due date:</span>{" "}
                {selectedTask.task_timer_date_end || "—"}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {STATUS_LABELS[selectedTask.task_timer_status] ?? selectedTask.task_timer_status}
              </p>
              {selectedTask.task_timer_estimated_hours != null && (
                <p>
                  <span className="font-medium">Estimated hours:</span>{" "}
                  {selectedTask.task_timer_estimated_hours}h
                </p>
              )}
              {selectedTask.task_timer_car_name && (
                <p>
                  <span className="font-medium">Car:</span> {selectedTask.task_timer_car_name}
                </p>
              )}
              <p>
                <span className="font-medium">Description:</span>{" "}
                {selectedTask.task_timer_description || "—"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
