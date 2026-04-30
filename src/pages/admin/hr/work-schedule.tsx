/**
 * Work Schedule page – v1 parity.
 * Month filter, calendar grid (Sun–Sat), add/edit/view/delete modals.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getArrayTotalDaysInMonthAndYear,
  getMonthYearNow,
  getWeeksCount,
  getWeekRow,
  WEEK_DAYS,
  type DayCell,
} from "@/lib/work-schedule-calendar";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const LIMIT_CELL = 3;

interface LeaveOnDay {
  employee_id: number;
  fullname: string;
}

interface WorkSchedEntry {
  work_sched_aid: number;
  work_sched_date: string;
  work_sched_code: string;
  work_sched_emp_id: number;
  work_sched_time: string;
  work_sched_start_time: string;
  work_sched_end_time: string;
  fullname: string;
  employee_aid: number;
}

function useWorkSchedByCode(code: string, limit: number) {
  return useQuery({
    queryKey: ["work-sched", "read-by-code", code, limit],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/work-sched/read-by-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ work_sched_code: code, limit }),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return (json.data ?? []) as WorkSchedEntry[];
    },
    enabled: !!code && code.length >= 8,
  });
}

/** Get next calendar day as YYYY-MM-DD and YYYYMMDD. */
function getNextDay(originalDate: string): { date: string; code: string } | null {
  if (!originalDate || originalDate.length < 10) return null;
  const d = new Date(originalDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, code: `${y}${m}${day}` };
}

function DayCellContent({
  cell,
  month,
  onAdd,
  onViewMore,
  onEdit,
  onDelete,
  onCopyToNextDay,
  leavesOnDay,
}: {
  cell: DayCell;
  month: string;
  onAdd: (cell: DayCell) => void;
  onViewMore: (cell: DayCell) => void;
  onEdit: (cell: DayCell, entry: WorkSchedEntry) => void;
  onDelete: (entry: WorkSchedEntry) => void;
  onCopyToNextDay: (cell: DayCell) => void;
  leavesOnDay: LeaveOnDay[];
}) {
  const code = cell.originalDateCode;
  const { data: list = [], isLoading } = useWorkSchedByCode(code, LIMIT_CELL);
  const isToday = code && new Date().toISOString().slice(0, 10).replace(/-/g, "") === code;
  const hasEntries = list.length > 0;

  if (cell.day === 0) {
    return (
      <td className="w-[14.2857%] border-b border-r border-border bg-muted/30 p-0 align-top last:border-r-0">
        <div className="h-32" />
      </td>
    );
  }

  return (
    <td className="w-[14.2857%] border-b border-r border-border p-2 align-top last:border-r-0 overflow-hidden">
      <div className="min-h-32">
        {/* Day number + actions */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isToday
                ? "bg-primary text-primary-foreground"
                : "text-foreground"
            }`}
          >
            {cell.day}
          </span>
          <button
            type="button"
            className="flex items-center gap-0.5 text-xs text-primary hover:underline"
            onClick={() => onAdd(cell)}
          >
            <Plus className="h-3 w-3" /> Add
          </button>
          {hasEntries && (
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => onCopyToNextDay(cell)}
              title="Copy schedule to next day"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          )}
        </div>

        {/* Day-off chips */}
        {leavesOnDay.length > 0 && (
          <div className="space-y-0.5 mb-1">
            {leavesOnDay.map((l) => (
              <div
                key={l.employee_id}
                className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 dark:border-rose-800 dark:bg-rose-950/40"
              >
                <span className="truncate text-[10px] font-medium text-rose-700 dark:text-rose-400" title={l.fullname}>
                  {l.fullname}
                </span>
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-500">
                  · Day Off
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Entries */}
        {isLoading ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((entry) => (
              <div
                key={entry.work_sched_aid}
                className="group rounded-md border border-primary/20 bg-primary/8 px-1.5 py-1"
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="truncate text-xs font-medium leading-tight" title={entry.fullname}>
                    {entry.fullname}
                  </span>
                  <span className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-black/10"
                      title="Edit"
                      onClick={() => onEdit(cell, entry)}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-destructive/20 text-destructive"
                      title="Delete"
                      onClick={() => onDelete(entry)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </div>
                {entry.work_sched_time && (
                  <div className="truncate text-[10px] text-muted-foreground uppercase mt-0.5">
                    {entry.work_sched_time}
                  </div>
                )}
              </div>
            ))}
            {list.length >= LIMIT_CELL && (
              <button
                type="button"
                className="w-full text-center text-xs text-primary hover:underline"
                onClick={() => onViewMore(cell)}
              >
                View more…
              </button>
            )}
          </div>
        )}
      </div>
    </td>
  );
}

function AddEditModal({
  open,
  onClose,
  cell,
  editEntry,
  onSuccess,
  leavesOnDay,
}: {
  open: boolean;
  onClose: () => void;
  cell: DayCell | null;
  editEntry: WorkSchedEntry | null;
  onSuccess: () => void;
  leavesOnDay: LeaveOnDay[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [employeeSearch, setEmployeeSearch] = useState("");
  type EmployeeOption = {
    employee_aid: number;
    fullname: string;
    employee_job_pay_salary_rate?: string | null;
    employee_job_pay_department_name?: string | null;
    employee_job_pay_job_title_name?: string | null;
    employee_job_pay_work_email?: string | null;
  };
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(
    editEntry ? { employee_aid: editEntry.employee_aid, fullname: editEntry.fullname } : null
  );
  const [startTime, setStartTime] = useState(editEntry?.work_sched_start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(editEntry?.work_sched_end_time?.slice(0, 5) ?? "17:00");
  const [focusSearch, setFocusSearch] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isEdit = !!editEntry;

  const { data: searchResults = [] } = useQuery({
    queryKey: ["work-sched", "search-employee", employeeSearch],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/work-sched/search-employee"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ searchValue: employeeSearch }),
      });
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      return (json.data ?? []) as EmployeeOption[];
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(buildApiUrl("/api/admin/work-sched"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-sched"] });
      onSuccess();
      onClose();
      toast({ title: "Success", description: "Schedule added." });
    },
    onError: (e) => toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(buildApiUrl(`/api/admin/work-sched/${editEntry!.work_sched_aid}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-sched"] });
      onSuccess();
      onClose();
      toast({ title: "Success", description: "Schedule updated." });
    },
    onError: (e) => toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }),
  });

  useEffect(() => {
    if (!open) return;
    setSelectedEmployee(editEntry ? { employee_aid: editEntry.employee_aid, fullname: editEntry.fullname } : null);
    setStartTime(editEntry?.work_sched_start_time?.slice(0, 5) ?? "09:00");
    setEndTime(editEntry?.work_sched_end_time?.slice(0, 5) ?? "17:00");
    setEmployeeSearch(editEntry?.fullname ?? "");
  }, [open, editEntry]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocusSearch(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cell || !selectedEmployee) {
      toast({ title: "Validation", description: "Please select an employee.", variant: "destructive" });
      return;
    }
    if (isEdit) {
      updateMutation.mutate({
        work_sched_emp_id: selectedEmployee.employee_aid,
        work_sched_start_time: startTime,
        work_sched_end_time: endTime,
      });
    } else {
      createMutation.mutate({
        work_sched_date: cell.originalDate,
        work_sched_code: cell.originalDateCode,
        work_sched_emp_id: selectedEmployee.employee_aid,
        work_sched_start_time: startTime,
        work_sched_end_time: endTime,
      });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;
  const dateLabel = cell ? new Date(cell.originalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const isSelectedOnLeave = !!(
    selectedEmployee &&
    leavesOnDay.some((l) => l.employee_id === selectedEmployee.employee_aid)
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add"} Work Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="font-medium">
            Date: <span className="text-muted-foreground">{dateLabel}</span>
          </p>
          <div ref={ref} className="relative">
            <Label>Employee</Label>
            <Input
              type="search"
              value={selectedEmployee ? selectedEmployee.fullname : employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                if (!e.target.value) setSelectedEmployee(null);
              }}
              onFocus={() => setFocusSearch(true)}
              placeholder="Search employee..."
              className="mt-1"
            />
            {focusSearch && !selectedEmployee && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
                {searchResults.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
                ) : (
                  searchResults.map((emp) => {
                    const dept = emp.employee_job_pay_department_name?.trim() ?? "";
                    const title = emp.employee_job_pay_job_title_name?.trim() ?? "";
                    const email = emp.employee_job_pay_work_email?.trim() ?? "";
                    const subtitle = [dept, title].filter(Boolean).join(" · ") || email || null;
                    return (
                      <li key={emp.employee_aid}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setEmployeeSearch(emp.fullname);
                            setFocusSearch(false);
                          }}
                        >
                          <div className="font-medium text-sm">{emp.fullname}</div>
                          {subtitle && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {subtitle}
                            </div>
                          )}
                          {!emp.employee_job_pay_salary_rate && (
                            <div className="text-xs text-destructive mt-0.5">NO SALARY RATE</div>
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
            {selectedEmployee && (selectedEmployee.employee_job_pay_department_name || selectedEmployee.employee_job_pay_job_title_name || selectedEmployee.employee_job_pay_work_email) && (
              <div className="mt-1.5 text-xs text-muted-foreground">
                {[selectedEmployee.employee_job_pay_department_name, selectedEmployee.employee_job_pay_job_title_name]
                  .filter(Boolean)
                  .join(" · ") || selectedEmployee.employee_job_pay_work_email}
              </div>
            )}
          </div>
          {isSelectedOnLeave && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              <strong>{selectedEmployee?.fullname}</strong> has an approved day off on this date. A work schedule cannot be added.
            </div>
          )}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
            <div>
              <Label>Start</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" required />
            </div>
            <span className="pb-2">to</span>
            <div>
              <Label>End</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || isSelectedOnLeave}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewMoreModal({
  open,
  onClose,
  cell,
  onAdd,
  onEdit,
  onDelete,
  onCopyToNextDay,
}: {
  open: boolean;
  onClose: () => void;
  cell: DayCell | null;
  onAdd: (cell: DayCell) => void;
  onEdit: (cell: DayCell, entry: WorkSchedEntry) => void;
  onDelete: (entry: WorkSchedEntry) => void;
  onCopyToNextDay: (cell: DayCell) => void;
}) {
  const code = cell?.originalDateCode ?? "";
  const { data: list = [], isLoading } = useWorkSchedByCode(code, 0);
  const dateLabel = cell ? new Date(cell.originalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>View Work Schedule</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Date: {dateLabel}</p>
          {cell && (
            <div className="flex items-center gap-2">
              {list.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onCopyToNextDay(cell);
                    onClose();
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copy to next day
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { onAdd(cell); onClose(); }}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </div>
        <div className="max-h-[60vh] overflow-auto rounded border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 p-2 text-left">#</th>
                  <th className="p-2 text-left">Employee</th>
                  <th className="p-2 text-left">Work Schedule</th>
                  <th className="w-20 p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((entry, i) => (
                  <tr key={entry.work_sched_aid} className="border-b">
                    <td className="p-2">{i + 1}.</td>
                    <td className="p-2">{entry.fullname}</td>
                    <td className="p-2 uppercase">{entry.work_sched_time}</td>
                    <td className="p-2">
                      <div className="flex justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => cell && onEdit(cell, entry)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(entry)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmModal({
  open,
  onClose,
  entry,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  entry: WorkSchedEntry | null;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!entry) return;
    setDeleting(true);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/work-sched/${entry.work_sched_aid}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      queryClient.invalidateQueries({ queryKey: ["work-sched"] });
      onConfirm();
      onClose();
      toast({ title: "Deleted", description: "Schedule deleted successfully." });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          Are you sure you want to delete this record? {entry && <strong>{entry.fullname}</strong>}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkSchedulePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(getMonthYearNow());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(null);
  const [editEntry, setEditEntry] = useState<WorkSchedEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<WorkSchedEntry | null>(null);

  // Fetch all approved leaves for the visible month so we can show day-off
  // indicators and block scheduling an employee who is on leave.
  const [monthYear, monthNum] = month.split("-");
  const leaveFrom = `${month}-01`;
  const leaveTo = `${month}-${new Date(Number(monthYear), Number(monthNum), 0).getDate().toString().padStart(2, "0")}`;
  const { data: leavesData } = useQuery<{ data?: Array<{ leave_employee_id: number; leave_date: string; fullname: string; leave_is_status: number }> }>({
    queryKey: ["work-sched", "approved-leaves", month],
    queryFn: async () => {
      const params = new URLSearchParams({ fromDate: leaveFrom, toDate: leaveTo, status: "approved", limit: "500" });
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave?${params}`), { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  // Build a map from YYYY-MM-DD → employees on approved leave that day.
  const leavesByDate = useCallback((): Record<string, LeaveOnDay[]> => {
    const map: Record<string, LeaveOnDay[]> = {};
    for (const row of leavesData?.data ?? []) {
      if (row.leave_is_status !== 1) continue;
      const date = row.leave_date?.slice(0, 10);
      if (!date) continue;
      if (!map[date]) map[date] = [];
      map[date].push({ employee_id: row.leave_employee_id, fullname: row.fullname });
    }
    return map;
  }, [leavesData])();


  const copyMutation = useMutation({
    mutationFn: async ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
      const res = await fetch(buildApiUrl("/api/admin/work-sched/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fromDate, toDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Copy failed");
      return json as { data: { copied: number }; message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["work-sched"] });
      const n = data?.data?.copied ?? 0;
      toast({
        title: "Schedule copied",
        description: n === 0 ? "No entries to copy." : `Copied ${n} schedule(s) to the next day.`,
      });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Copy failed", variant: "destructive" });
    },
  });

  const handleCopyToNextDay = useCallback(
    (cell: DayCell) => {
      const next = getNextDay(cell.originalDate);
      if (!next) {
        toast({ title: "Error", description: "Invalid date.", variant: "destructive" });
        return;
      }
      copyMutation.mutate({ fromDate: cell.originalDate, toDate: next.date });
    },
    [copyMutation, toast]
  );

  const dayCells = getArrayTotalDaysInMonthAndYear(month);
  const weeksCount = getWeeksCount(dayCells);
  const weeks = Array.from({ length: weeksCount }, (_, i) => i + 1);

  const handleAdd = useCallback((cell: DayCell) => {
    setEditEntry(null);
    setSelectedCell(cell);
    setAddModalOpen(true);
  }, []);

  const handleViewMore = useCallback((cell: DayCell) => {
    setSelectedCell(cell);
    setViewModalOpen(true);
  }, []);

  const handleEdit = useCallback((cell: DayCell, entry: WorkSchedEntry) => {
    setSelectedCell(cell);
    setEditEntry(entry);
    setAddModalOpen(true);
    setViewModalOpen(false);
  }, []);

  const handleDelete = useCallback((entry: WorkSchedEntry) => {
    setDeleteEntry(entry);
    setDeleteModalOpen(true);
    setViewModalOpen(false);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Work Schedule</h1>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">Manage employee work schedule by month and day.</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Mountain Time (MT) · UTC−7
              </span>
            </div>
          </div>
          {/* Inline month filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="month" className="text-sm font-medium shrink-0">Month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {/* Calendar */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-200px)]">
            <table className="w-full border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr>
                  {WEEK_DAYS.map((d) => (
                    <th
                      key={d}
                      className="w-[14.2857%] border-b border-border bg-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((weekNum) => {
                  const weekRow = getWeekRow(dayCells, weekNum);
                  return (
                    <tr key={weekNum}>
                      {weekRow.map((cell, idx) => (
                        <DayCellContent
                          key={cell.originalDateCode || `w${weekNum}-${idx}`}
                          cell={cell}
                          month={month}
                          onAdd={handleAdd}
                          onViewMore={handleViewMore}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onCopyToNextDay={handleCopyToNextDay}
                          leavesOnDay={leavesByDate[cell.originalDate] ?? []}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddEditModal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setSelectedCell(null); setEditEntry(null); }}
        cell={selectedCell}
        editEntry={editEntry}
        onSuccess={() => {}}
        leavesOnDay={selectedCell ? (leavesByDate[selectedCell.originalDate] ?? []) : []}
      />
      <ViewMoreModal
        open={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setSelectedCell(null); }}
        cell={selectedCell}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopyToNextDay={handleCopyToNextDay}
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteEntry(null); }}
        entry={deleteEntry}
        onConfirm={() => {}}
      />
    </AdminLayout>
  );
}
