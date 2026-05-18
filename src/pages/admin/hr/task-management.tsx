/**
 * Admin HR – Task Management (improved).
 * Full CRUD with status, employee assignment, photo upload, and edit history.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildApiUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Image as ImageIcon,
  X,
  History as HistoryIcon,
} from "lucide-react";
import { Fragment, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  {
    value: "0",
    label: "New",
    color: "bg-gray-500/20 text-gray-700 border-gray-500/50",
  },
  {
    value: "1",
    label: "In Progress",
    color: "bg-blue-500/20 text-blue-700 border-blue-500/50",
  },
  {
    value: "2",
    label: "On Hold",
    color: "bg-yellow-500/20 text-yellow-800 border-yellow-500/50",
  },
  {
    value: "3",
    label: "Completed",
    color: "bg-green-500/20 text-green-700 border-green-500/50",
  },
];
function statusLabel(v: number) {
  return STATUS_OPTIONS.find((s) => s.value === String(v))?.label ?? "New";
}
function statusColor(v: number) {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(v))?.color ??
    "bg-gray-500/20 text-gray-700 border-gray-500/50"
  );
}

// ─── Employee picker ──────────────────────────────────────────────────────────

function EmployeePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const { data } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/employees", "task-picker"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const employees = (data?.data ?? []).filter(
    (e: any) => (e.employee_is_active ?? 1) === 1,
  );

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => {
        if (v === "__none__") {
          onChange("", "");
          return;
        }
        const emp = employees.find((e: any) => String(e.employee_aid) === v);
        const name = emp
          ? `${emp.employee_first_name || ""} ${emp.employee_last_name || ""}`.trim()
          : v;
        onChange(v, name);
      }}
    >
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Select employee…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Unassigned —</SelectItem>
        {employees.map((e: any) => {
          const name =
            `${e.employee_first_name || ""} ${e.employee_last_name || ""}`.trim() ||
            e.employee_email ||
            `Employee #${e.employee_aid}`;
          return (
            <SelectItem key={e.employee_aid} value={String(e.employee_aid)}>
              {name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ─── Photo row ───────────────────────────────────────────────────────────────

function PhotoRow({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (f: File) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        id="task-photos"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(onAdd);
          e.target.value = "";
        }}
      />
      <label
        htmlFor="task-photos"
        className="flex items-center justify-center gap-2 h-20 rounded-md border-2 border-dashed border-border text-muted-foreground text-sm cursor-pointer hover:border-primary/50 transition-colors"
      >
        <ImageIcon className="w-4 h-4" />
        Click to upload photos
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="w-16 h-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  task_timer_name: "",
  task_timer_date_end: "", // due date
  task_timer_description: "",
  task_timer_status: "0", // "new"
  task_timer_emp_id: "", // assigned employee ID
  assignedToName: "", // display name (not sent to backend)
  assigneeName: "", // user who created / assigned (free text)
};

export default function AdminHrTaskManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [historyTask, setHistoryTask] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photos, setPhotos] = useState<File[]>([]);

  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: any[];
    total: number;
  }>({
    queryKey: ["/api/admin/hr/task-timers", fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/hr/task-timers?${params}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Upload photos for a task after create/update
  const uploadPhotos = async (taskId: number, files: File[]) => {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("photos", f));
    try {
      await fetch(buildApiUrl(`/api/admin/hr/task-timers/${taskId}/photos`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
    } catch {
      /* non-fatal */
    }
  };

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch(buildApiUrl("/api/admin/hr/task-timers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: async (resp) => {
      const taskId = resp?.insertId ?? resp?.data?.task_timer_aid;
      if (taskId) await uploadPhotos(taskId, photos);
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/hr/task-timers"],
      });
      toast({ title: "Task created" });
      closeModal();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/task-timers/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: async () => {
      if (editingTask && photos.length > 0) {
        await uploadPhotos(editingTask.task_timer_aid, photos);
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/hr/task-timers"],
      });
      toast({ title: "Task updated" });
      closeModal();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/task-timers/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/hr/task-timers"],
      });
      toast({ title: "Task deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rows = data?.data ?? [];

  function openAdd() {
    setEditingTask(null);
    setForm({ ...EMPTY_FORM });
    setPhotos([]);
    setModalOpen(true);
  }

  function openEdit(task: any) {
    setEditingTask(task);
    setPhotos([]);
    // Parse assigned employee id AND name from task_timer_emp_list
    let empId = task.task_timer_emp_id || "";
    let empName = "";
    if (task.task_timer_emp_list) {
      try {
        const parsed = JSON.parse(task.task_timer_emp_list);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (!empId) empId = String(first?.id ?? first ?? "");
          empName = String(first?.name ?? "").trim();
        }
      } catch {}
    }
    setForm({
      task_timer_name: task.task_timer_name || "",
      task_timer_date_end: task.task_timer_date_end || "",
      task_timer_description: task.task_timer_description || "",
      task_timer_status: String(task.task_timer_status ?? 0),
      task_timer_emp_id: empId,
      assignedToName: empName,
      assigneeName: task.task_timer_goal || "", // reuse goal field for assignee name
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingTask(null);
    setForm({ ...EMPTY_FORM });
    setPhotos([]);
  }

  function handleSubmit() {
    if (!form.task_timer_name.trim()) {
      toast({ title: "Task name is required", variant: "destructive" });
      return;
    }
    const payload = {
      task_timer_name: form.task_timer_name.trim(),
      task_timer_date_end: form.task_timer_date_end,
      task_timer_date_start: form.task_timer_date_end, // same for compat
      task_timer_description: form.task_timer_description.trim(),
      task_timer_status: parseInt(form.task_timer_status, 10),
      task_timer_emp_id: form.task_timer_emp_id,
      task_timer_emp_list: form.task_timer_emp_id
        ? JSON.stringify([
            { id: form.task_timer_emp_id, name: form.assignedToName },
          ])
        : "[]",
      task_timer_goal: form.assigneeName, // assignee (who created the task)
    };
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.task_timer_aid, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // Parse assigned employee name for display
  function getAssignedName(task: any): string {
    if (task.task_timer_emp_list) {
      try {
        const parsed = JSON.parse(task.task_timer_emp_list);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .map((x: any) => x?.name ?? x)
            .filter(Boolean)
            .join(", ");
        }
      } catch {}
    }
    return task.task_timer_emp_id || "—";
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              Task Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Create and manage tasks assigned to employees.
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">From:</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40 h-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">To:</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40 h-8"
                />
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="text-red-700 hover:text-red-700"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tasks found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-medium">Task Name</TableHead>
                      <TableHead className="font-medium">Assigned By</TableHead>
                      <TableHead className="font-medium">Assigned To</TableHead>
                      <TableHead className="font-medium">Due Date</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Description</TableHead>
                      <TableHead className="text-center font-medium w-24">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.task_timer_aid}
                        className="border-border"
                      >
                        <TableCell className="font-medium">
                          {r.task_timer_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {r.task_timer_goal || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getAssignedName(r)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.task_timer_date_end || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColor(r.task_timer_status ?? 0)}`}
                          >
                            {statusLabel(r.task_timer_status ?? 0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {r.task_timer_description || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => openEdit(r)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => setHistoryTask(r)}
                              title="Edit history"
                            >
                              <HistoryIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(`Delete task "${r.task_timer_name}"?`)
                                )
                                  deleteMutation.mutate(r.task_timer_aid);
                              }}
                              disabled={deleteMutation.isPending}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Task Name */}
            <div>
              <Label>
                Task Name <span className="text-destructive">*</span>
              </Label>
              <Input
                className="mt-1"
                value={form.task_timer_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, task_timer_name: e.target.value }))
                }
                placeholder="Task name"
              />
            </div>

            {/* Assignee (User) */}
            <div>
              <Label>Assignee</Label>
              <Input
                className="mt-1"
                value={form.assigneeName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assigneeName: e.target.value }))
                }
                placeholder="e.g. Cathy (Admin)"
              />
            </div>

            {/* Assigned To (Employee) */}
            <div>
              <Label>Assigned To (Employee)</Label>
              <EmployeePicker
                value={form.task_timer_emp_id}
                onChange={(id, name) =>
                  setForm((f) => ({
                    ...f,
                    task_timer_emp_id: id,
                    assignedToName: name,
                  }))
                }
              />
            </div>

            {/* Due Date */}
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={form.task_timer_date_end}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    task_timer_date_end: e.target.value,
                  }))
                }
              />
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select
                value={form.task_timer_status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, task_timer_status: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1 min-h-[80px] resize-none"
                value={form.task_timer_description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    task_timer_description: e.target.value,
                  }))
                }
                placeholder="Task details…"
              />
            </div>

            {/* Photos */}
            <div>
              <Label>Photos (optional)</Label>
              <div className="mt-1">
                <PhotoRow
                  files={photos}
                  onAdd={(f) => setPhotos((prev) => [...prev, f])}
                  onRemove={(i) =>
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isBusy || !form.task_timer_name.trim()}
              >
                {isBusy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {editingTask ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit history dialog */}
      <TaskHistoryDialog
        task={historyTask}
        onClose={() => setHistoryTask(null)}
      />
    </AdminLayout>
  );
}

// ─── Edit history dialog ───────────────────────────────────────────────────

interface TaskTimerAuditRow {
  task_timer_audit_aid: number;
  task_timer_audit_task_aid: number;
  task_timer_audit_action: "create" | "update" | "delete";
  task_timer_audit_actor_id: number | null;
  task_timer_audit_actor_name: string | null;
  task_timer_audit_before: string | null;
  task_timer_audit_after: string | null;
  task_timer_audit_notes: string | null;
  task_timer_audit_created: string;
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(String(s).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function safeParse(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function TaskHistoryDialog(props: {
  task: { task_timer_aid: number; task_timer_name?: string } | null;
  onClose: () => void;
}) {
  const { task, onClose } = props;

  // Fetch history entries
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: TaskTimerAuditRow[];
  }>({
    queryKey: ["/api/admin/hr/task-timers", task?.task_timer_aid, "history"],
    enabled: !!task,
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(
          `/api/admin/hr/task-timers/${task!.task_timer_aid}/history`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  // Fetch employee list so we can resolve IDs → names when the stored
  // name field is blank (happens when tasks were saved before the fix).
  const { data: empData } = useQuery<{ data: any[] }>({
    queryKey: ["/api/employees", "history-name-lookup"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
  // Build id → display-name map
  const empById = new Map<string, string>(
    (empData?.data ?? []).map((e: any) => {
      const name =
        e.fullname ||
        `${e.employee_first_name ?? ""} ${e.employee_last_name ?? ""}`.trim() ||
        `Employee ${e.employee_aid ?? e.id}`;
      return [String(e.employee_aid ?? e.id), name];
    }),
  );

  const entries = data?.data ?? [];

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
          <DialogDescription>
            {task?.task_timer_name || "Task"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No history recorded yet.
            </p>
          ) : (
            entries.map((h) => (
              <div
                key={h.task_timer_audit_aid}
                className="rounded-md border p-3 text-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs font-medium " +
                        (h.task_timer_audit_action === "delete"
                          ? "bg-destructive/10 text-destructive"
                          : h.task_timer_audit_action === "update"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900")
                      }
                    >
                      {h.task_timer_audit_action.toUpperCase()}
                    </span>
                    <span className="font-medium">
                      {h.task_timer_audit_actor_name ?? "System"}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(h.task_timer_audit_created)}
                  </span>
                </div>
                {h.task_timer_audit_notes && (
                  <div className="text-muted-foreground">
                    Notes: {h.task_timer_audit_notes}
                  </div>
                )}
                <TaskHistoryDiff
                  action={h.task_timer_audit_action}
                  before={h.task_timer_audit_before}
                  after={h.task_timer_audit_after}
                  empById={empById}
                />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskHistoryDiff(props: {
  action: "create" | "update" | "delete";
  before: string | null;
  after: string | null;
  empById?: Map<string, string>;
}) {
  const { empById = new Map() } = props;
  const beforeObj = safeParse(props.before);
  const afterObj = safeParse(props.after);

  // Fields to show and their labels. task_timer_emp_id is intentionally
  // omitted — we already show the employee name via task_timer_emp_list.
  const FIELDS: { key: string; label: string }[] = [
    { key: "task_timer_name", label: "Task name" },
    { key: "task_timer_goal", label: "Assignee" },
    { key: "task_timer_emp_list", label: "Assigned to" },
    { key: "task_timer_date_end", label: "Due date" },
    { key: "task_timer_date_start", label: "Start date" },
    { key: "task_timer_status", label: "Status" },
    { key: "task_timer_description", label: "Description" },
    { key: "task_timer_car_name", label: "Car" },
  ];

  /**
   * Convert `task_timer_emp_list` JSON → human-readable names.
   * Priority: stored name → employee API lookup by id → nothing shown.
   * Handles: `[{"id":"27","name":"Cathy"}]` and legacy CSV strings.
   */
  function fmtEmpList(raw: unknown): string {
    if (raw == null || raw === "" || raw === "[]") return "—";
    const str = String(raw).trim();
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        const names = parsed
          .map((entry: unknown) => {
            if (typeof entry === "object" && entry !== null) {
              const e = entry as Record<string, unknown>;
              // 1. Use stored name if present
              const stored = String(e.name ?? "").trim();
              if (stored) return stored;
              // 2. Look up from employees API by id
              const id = String(e.id ?? "").trim();
              if (id && empById.has(id)) return empById.get(id)!;
              // 3. Nothing meaningful to show
              return null;
            }
            // Plain string / number entry — try as an id lookup
            const id = String(entry).trim();
            return empById.get(id) ?? null;
          })
          .filter(Boolean);
        return names.length ? (names as string[]).join(", ") : "—";
      }
    } catch {
      // not JSON — fall through to plain string
    }
    return str || "—";
  }

  /** Map numeric status codes to the same labels shown in the table. */
  function fmtStatus(raw: unknown): string {
    const code = Number(raw);
    const found = STATUS_OPTIONS.find((s) => Number(s.value) === code);
    return found ? found.label : String(raw ?? "—");
  }

  /** Generic formatter — falls back to plain string. */
  function fmt(key: string, v: unknown): string {
    if (v == null || v === "") return "—";
    if (key === "task_timer_emp_list") return fmtEmpList(v);
    if (key === "task_timer_status") return fmtStatus(v);
    return String(v);
  }

  // CREATE / DELETE: show the full snapshot in a single column.
  if (props.action === "create" || props.action === "delete") {
    const snapshot = props.action === "create" ? afterObj : beforeObj;
    if (!snapshot) return null;
    const rows = FIELDS.filter((f) => {
      const v = snapshot[f.key];
      return v != null && v !== "" && v !== "[]";
    });
    if (rows.length === 0) {
      return (
        <div className="text-xs text-muted-foreground">No field details.</div>
      );
    }
    return (
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        {rows.map((f) => (
          <Fragment key={f.key}>
            <div className="text-muted-foreground">{f.label}:</div>
            <div className="whitespace-pre-wrap break-words">
              {fmt(f.key, snapshot[f.key])}
            </div>
          </Fragment>
        ))}
      </div>
    );
  }

  // UPDATE: side-by-side before → after, only for fields that changed.
  // Compare the *formatted* strings so that JSON whitespace differences
  // don’t produce spurious diff rows.
  const diffs = FIELDS.filter((f) => {
    const b = fmt(f.key, beforeObj?.[f.key]);
    const a = fmt(f.key, afterObj?.[f.key]);
    return b !== a;
  });

  if (!beforeObj && !afterObj) return null;
  if (diffs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">No field changes.</div>
    );
  }

  return (
    <div className="mt-1 grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-1 text-xs">
      {diffs.map((f) => (
        <Fragment key={f.key}>
          <div className="text-muted-foreground font-medium">{f.label}:</div>
          <div className="line-through text-destructive/80 whitespace-pre-wrap break-words">
            {fmt(f.key, beforeObj?.[f.key])}
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="text-emerald-700 whitespace-pre-wrap break-words">
            {fmt(f.key, afterObj?.[f.key])}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
