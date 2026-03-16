/**
 * Admin HR – Task Management (v1 parity).
 * List, create, edit, delete task timers; assign employees.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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

export default function AdminHrTaskManagement() {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    task_timer_name: "",
    task_timer_date_start: "",
    task_timer_date_end: "",
    task_timer_description: "",
    task_timer_emp_list: "[]",
  });

  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const { data, isLoading } = useQuery<{ success: boolean; data: TaskTimer[]; total: number }>({
    queryKey: ["/api/admin/hr/task-timers", fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/task-timers?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/task-timers"] });
      setModalOpen(false);
      setForm({ task_timer_name: "", task_timer_date_start: "", task_timer_date_end: "", task_timer_description: "", task_timer_emp_list: "[]" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/task-timers/${id}`), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/task-timers"] }),
  });

  const rows = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Task Management</h1>
            <p className="text-muted-foreground text-sm">Create and manage tasks assigned to employees.</p>
          </div>
          <Button onClick={() => { setEditingId(null); setForm({ task_timer_name: "", task_timer_date_start: "", task_timer_date_end: "", task_timer_description: "", task_timer_emp_list: "[]" }); setModalOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Task
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" placeholder="From" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" placeholder="To" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tasks found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    let assignCount = 0;
                    try {
                      const arr = JSON.parse(r.task_timer_emp_list || "[]");
                      assignCount = Array.isArray(arr) ? arr.length : 0;
                    } catch {}
                    return (
                      <TableRow key={r.task_timer_aid}>
                        <TableCell className="font-medium">{r.task_timer_name || "—"}</TableCell>
                        <TableCell>{r.task_timer_date_start || "—"}</TableCell>
                        <TableCell>{r.task_timer_date_end || "—"}</TableCell>
                        <TableCell>{r.task_timer_status === 0 ? "Open" : "Closed"}</TableCell>
                        <TableCell>{assignCount} employee(s)</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.task_timer_aid)} disabled={deleteMutation.isPending}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task name</Label>
              <Input value={form.task_timer_name} onChange={(e) => setForm((f) => ({ ...f, task_timer_name: e.target.value }))} placeholder="Task name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start date</Label>
                <Input type="date" value={form.task_timer_date_start} onChange={(e) => setForm((f) => ({ ...f, task_timer_date_start: e.target.value }))} />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={form.task_timer_date_end} onChange={(e) => setForm((f) => ({ ...f, task_timer_date_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.task_timer_description} onChange={(e) => setForm((f) => ({ ...f, task_timer_description: e.target.value }))} placeholder="Description" />
            </div>
            <p className="text-xs text-muted-foreground">Employee assignment: use Employees page or edit task to assign. Emp list stored as JSON array.</p>
            <Button onClick={() => createMutation.mutate({ ...form, task_timer_status: 0 })} disabled={createMutation.isPending || !form.task_timer_name || !form.task_timer_date_start || !form.task_timer_date_end}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
