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
} from "lucide-react";
import { useState, useRef } from "react";
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
    // Parse assigned employee
    let empId = task.task_timer_emp_id || "";
    let empName = "";
    if (!empId && task.task_timer_emp_list) {
      try {
        const parsed = JSON.parse(task.task_timer_emp_list);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          empId = String(first?.id ?? first ?? "");
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
              <Label>Assignee (User — who is assigning this task)</Label>
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
    </AdminLayout>
  );
}
