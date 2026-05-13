/**
 * Admin HR – Time Sheet Review.
 *
 *  • Admin can view all time logs (with filters).
 *  • Admin can add time logs manually.
 *  • Admin can edit, delete, and update time logs.
 *  • Every change is logged to an audit trail (who / when / before / after).
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

interface TimeRow {
  time_aid: number;
  time_is_active: number;
  time_date: string;
  time_employee_id: number;
  time_working_hours: string | null;
  time_hours_per_day: string | null;
  time_in: string | null;
  time_lunch_out: string | null;
  time_lunch_in: string | null;
  time_out: string | null;
  time_total_hours: string | null;
  time_form_details: string | null;
  time_created: string;
  time_updated: string;
  fullname: string | null;
  employee_first_name: string | null;
  employee_last_name: string | null;
  employee_job_pay_salary_rate: string | null;
}

interface EmployeeOption {
  employee_aid: number;
  employee_first_name: string;
  employee_last_name: string;
  employee_status?: string;
  employee_job_pay_salary_rate?: string | null;
}

interface AuditRow {
  time_audit_aid: number;
  time_audit_time_aid: number;
  time_audit_action: "create" | "update" | "delete";
  time_audit_actor_id: number | null;
  time_audit_actor_name: string | null;
  time_audit_before: string | null;
  time_audit_after: string | null;
  time_audit_notes: string | null;
  time_audit_created: string;
}

interface TimeFormState {
  employeeId: string;
  date: string;
  workingHours: string;
  hoursPerDay: string;
  timeIn: string;
  lunchOut: string;
  lunchIn: string;
  timeOut: string;
  notes: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// All time-sheet values are anchored to Utah / America/Denver (Mountain) — the
// company's reference timezone. The DB stores `time_in`/`time_out` as UTC
// DATETIME (no offset) and `time_date` as a Utah calendar date. We normalize
// both for display so admin and employee views always agree.
const UTAH_TZ = "America/Denver";

/** Parse a DB value treating bare DATETIME as UTC (matches backend writers). */
function parseDb(d: string | null | undefined): Date | null {
  if (!d) return null;
  const s = String(d).trim();
  // Pure date — interpret as Utah calendar day (parsed at noon UTC to dodge DST edges).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const x = new Date(s + "T12:00:00Z");
    return isNaN(x.getTime()) ? null : x;
  }
  const dt = s.replace(" ", "T");
  const utc = dt.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dt) ? dt : dt + "Z";
  const x = new Date(utc);
  return isNaN(x.getTime()) ? null : x;
}

function formatDate(d: string | null | undefined): string {
  // For pure YYYY-MM-DD strings, render directly so they never shift across TZs.
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  }
  const x = parseDb(d);
  if (!x) return "—";
  return x.toLocaleDateString("en-US", { timeZone: UTAH_TZ });
}

function formatTime(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "—";
  return x.toLocaleTimeString("en-US", {
    timeZone: UTAH_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "—";
  return `${x.toLocaleDateString("en-US", { timeZone: UTAH_TZ })} ${x.toLocaleTimeString("en-US", {
    timeZone: UTAH_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Extract Utah (Y, M, D, h, m) parts from a Date. */
function utahParts(d: Date): { y: string; mo: string; da: string; hh: string; mm: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "00";
  return {
    y: get("year"),
    mo: get("month"),
    da: get("day"),
    hh: get("hour") === "24" ? "00" : get("hour"),
    mm: get("minute"),
  };
}

/** Datetime-local input value ("YYYY-MM-DDTHH:mm") in Utah time. */
function toLocalInput(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "";
  const p = utahParts(x);
  return `${p.y}-${p.mo}-${p.da}T${p.hh}:${p.mm}`;
}

/** Utah offset (minutes from UTC, e.g. -360 for MDT) at the given instant. */
function utahOffsetMin(at: Date): number {
  // Read the wall-clock components Utah sees at `at`. The difference between
  // those (interpreted as UTC) and `at` itself is the zone's UTC offset —
  // works in every browser without relying on `timeZoneName: "shortOffset"`,
  // which falls back to non-numeric abbreviations like "MDT" on older runtimes.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(fmt.find((p) => p.type === t)?.value ?? "0");
  const wallUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((wallUTC - at.getTime()) / 60_000);
}

/** Convert a Utah-time `datetime-local` value back to UTC MySQL DATETIME. */
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  // Treat the value as Utah local; compute the matching UTC instant.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const [, y, mo, da, hh, mm] = m;
  // First-pass guess at the instant (treating the input as if it were UTC),
  // then look up Utah's true offset at that instant to handle DST correctly.
  const naiveUTC = Date.UTC(+y, +mo - 1, +da, +hh, +mm, 0);
  const offsetMin = utahOffsetMin(new Date(naiveUTC));
  const utcMs = naiveUTC - offsetMin * 60 * 1000;
  const utc = new Date(utcMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:00`;
}

function toDateInput(d: string | null | undefined): string {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const x = parseDb(d);
  if (!x) return "";
  const p = utahParts(x);
  return `${p.y}-${p.mo}-${p.da}`;
}

function emptyForm(): TimeFormState {
  const today = utahParts(new Date()).y + "-" + utahParts(new Date()).mo + "-" + utahParts(new Date()).da;
  return {
    employeeId: "",
    date: today,
    workingHours: "",
    hoursPerDay: "",
    timeIn: "",
    lunchOut: "",
    lunchIn: "",
    timeOut: "",
    notes: "",
  };
}

function rowToForm(r: TimeRow): TimeFormState {
  return {
    employeeId: String(r.time_employee_id),
    date: toDateInput(r.time_date) || toDateInput(new Date().toISOString()),
    workingHours: r.time_working_hours ?? "",
    hoursPerDay: r.time_hours_per_day != null ? String(r.time_hours_per_day) : "",
    timeIn: toLocalInput(r.time_in),
    lunchOut: toLocalInput(r.time_lunch_out),
    lunchIn: toLocalInput(r.time_lunch_in),
    timeOut: toLocalInput(r.time_out),
    notes: "",
  };
}

function formToPayload(f: TimeFormState) {
  return {
    employeeId: f.employeeId ? Number(f.employeeId) : undefined,
    date: f.date,
    workingHours: f.workingHours,
    hoursPerDay: f.hoursPerDay ? Number(f.hoursPerDay) : null,
    timeIn: fromLocalInput(f.timeIn),
    lunchOut: fromLocalInput(f.lunchOut),
    lunchIn: fromLocalInput(f.lunchIn),
    timeOut: fromLocalInput(f.timeOut),
    notes: f.notes || undefined,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AdminHrTime() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<TimeRow | null>(null);
  const [historyRow, setHistoryRow] = useState<TimeRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<TimeRow | null>(null);

  const [addForm, setAddForm] = useState<TimeFormState>(emptyForm());
  const [editForm, setEditForm] = useState<TimeFormState>(emptyForm());
  const [deleteNotes, setDeleteNotes] = useState("");

  // ── Employees (for dropdown) ──
  const { data: empData } = useQuery<{ success: boolean; data: EmployeeOption[] }>({
    queryKey: ["/api/employees", "time-sheet-review"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees?limit=1000"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });
  const employees = empData?.data ?? [];

  // ── Time records ──
  const listKey = useMemo(
    () => ["/api/admin/hr/time", fromDate, toDate, employeeFilter, search] as const,
    [fromDate, toDate, employeeFilter, search]
  );
  const { data, isLoading } = useQuery<{ success: boolean; data: TimeRow[]; total: number }>({
    queryKey: listKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (employeeFilter && employeeFilter !== "all") params.set("employeeId", employeeFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(buildApiUrl(`/api/admin/hr/time?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time records");
      return res.json();
    },
    // Pick up employee clock-ins/outs without a manual reload.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const rows = data?.data ?? [];

  const totalHrs = rows.reduce(
    (sum, r) => sum + (r.time_total_hours != null ? Number(r.time_total_hours) : 0),
    0
  );
  const totalAmount = rows.reduce((sum, r) => {
    const hrs = r.time_total_hours != null ? Number(r.time_total_hours) : 0;
    const rate = r.employee_job_pay_salary_rate != null ? Number(r.employee_job_pay_salary_rate) : 0;
    return sum + hrs * rate;
  }, 0);

  // ── Mutations ──
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/time"] });

  const createMut = useMutation({
    mutationFn: async (payload: ReturnType<typeof formToPayload>) => {
      const res = await fetch(buildApiUrl("/api/admin/hr/time"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Create failed");
      return json.data as TimeRow;
    },
    onSuccess: () => {
      toast({ title: "Time log added", description: "Manual entry saved." });
      setAddOpen(false);
      setAddForm(emptyForm());
      invalidate();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (vars: { id: number; payload: ReturnType<typeof formToPayload> }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/time/${vars.id}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
      return json.data as TimeRow;
    },
    onSuccess: () => {
      toast({ title: "Time log updated" });
      setEditRow(null);
      invalidate();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (vars: { id: number; notes?: string }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/time/${vars.id}`), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: vars.notes || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Delete failed");
      return true;
    },
    onSuccess: () => {
      toast({ title: "Time log deleted" });
      setDeleteRow(null);
      setDeleteNotes("");
      invalidate();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Handlers ──
  const openAdd = () => {
    setAddForm(emptyForm());
    setAddOpen(true);
  };
  const openEdit = (r: TimeRow) => {
    setEditForm(rowToForm(r));
    setEditRow(r);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.employeeId) {
      toast({ title: "Select an employee", variant: "destructive" });
      return;
    }
    createMut.mutate(formToPayload(addForm));
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    updateMut.mutate({ id: editRow.time_aid, payload: formToPayload(editForm) });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Time Sheet Review</h1>
            <p className="text-muted-foreground text-sm">
              View, add, edit, and delete employee time logs. Every change is logged.
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add time log
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.employee_aid} value={String(e.employee_aid)}>
                      {`${e.employee_first_name ?? ""} ${e.employee_last_name ?? ""}`.trim() ||
                        `Employee ${e.employee_aid}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee name"
                className="w-56"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No time records found.</p>
            ) : (
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 bg-black text-white hover:bg-black border-b border-black">
                      <TableHead className="text-white">Employee</TableHead>
                      <TableHead className="text-white">Date</TableHead>
                      <TableHead className="text-white">Time in</TableHead>
                      <TableHead className="text-white">Time out</TableHead>
                      <TableHead className="text-right text-white">Total hrs</TableHead>
                      <TableHead className="text-right text-white">Rate</TableHead>
                      <TableHead className="text-right text-white">Amount</TableHead>
                      <TableHead className="w-32 text-right text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const hrs = r.time_total_hours != null ? Number(r.time_total_hours) : null;
                      const rate = r.employee_job_pay_salary_rate != null ? Number(r.employee_job_pay_salary_rate) : null;
                      const amount = hrs != null && rate != null ? hrs * rate : null;
                      return (
                        <TableRow key={r.time_aid}>
                          <TableCell className="font-medium">{r.fullname || "—"}</TableCell>
                          <TableCell>{formatDate(r.time_date)}</TableCell>
                          <TableCell>{formatTime(r.time_in)}</TableCell>
                          <TableCell>{formatTime(r.time_out)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {hrs != null ? hrs.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {rate != null ? formatUsd(rate) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {amount != null ? formatUsd(amount) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEdit(r)}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setHistoryRow(r)}
                                title="Edit history"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setDeleteNotes("");
                                  setDeleteRow(r);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {totalHrs.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {totalAmount > 0 ? formatUsd(totalAmount) : "—"}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </table>
              </div>
            )}
            {data?.total != null && data.total > rows.length && (
              <p className="text-muted-foreground text-sm mt-2">
                Showing {rows.length} of {data.total} records.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Add time log</DialogTitle>
            <DialogDescription>Create a manual time entry for an employee.</DialogDescription>
          </DialogHeader>
          <TimeEntryForm
            form={addForm}
            onChange={setAddForm}
            employees={employees}
            onSubmit={submitAdd}
            submitting={createMut.isPending}
            onCancel={() => setAddOpen(false)}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit time log</DialogTitle>
            <DialogDescription>
              Changes are logged to the audit history.
            </DialogDescription>
          </DialogHeader>
          <TimeEntryForm
            form={editForm}
            onChange={setEditForm}
            employees={employees}
            onSubmit={submitEdit}
            submitting={updateMut.isPending}
            onCancel={() => setEditRow(null)}
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Delete time log?</DialogTitle>
            <DialogDescription>
              This will remove the entry. The deletion is recorded in the audit history.
            </DialogDescription>
          </DialogHeader>
          {deleteRow && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Employee:</span>{" "}
                <span className="font-medium">{deleteRow.fullname}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium">{formatDate(deleteRow.time_date)}</span>
              </div>
              <div className="space-y-1">
                <Label>Reason / notes (optional)</Label>
                <Textarea
                  value={deleteNotes}
                  onChange={(e) => setDeleteNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() =>
                deleteRow &&
                deleteMut.mutate({ id: deleteRow.time_aid, notes: deleteNotes })
              }
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <HistoryDialog row={historyRow} onClose={() => setHistoryRow(null)} />
    </AdminLayout>
  );
}

// ── Reusable form ────────────────────────────────────────────────────────

function TimeEntryForm(props: {
  form: TimeFormState;
  onChange: (f: TimeFormState) => void;
  employees: EmployeeOption[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const { form, onChange, employees, onSubmit, onCancel, submitting, submitLabel } = props;
  const set = (k: keyof TimeFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Employee *</Label>
          <Select
            value={form.employeeId}
            onValueChange={(v) => onChange({ ...form, employeeId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.employee_aid} value={String(e.employee_aid)}>
                  {`${e.employee_first_name ?? ""} ${e.employee_last_name ?? ""}`.trim() ||
                    `Employee ${e.employee_aid}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Date *</Label>
          <Input type="date" value={form.date} onChange={set("date")} required />
        </div>
        <div className="space-y-1">
          <Label>Schedule label</Label>
          <Input
            value={form.workingHours}
            onChange={set("workingHours")}
            placeholder="e.g. 09:00 to 17:00"
          />
        </div>
        <div className="space-y-1">
          <Label>Hours per day</Label>
          <Input
            type="number"
            step="0.01"
            value={form.hoursPerDay}
            onChange={set("hoursPerDay")}
            placeholder="8"
          />
        </div>
        <div className="space-y-1">
          <Label>Time in</Label>
          <Input type="datetime-local" value={form.timeIn} onChange={set("timeIn")} />
        </div>
        <div className="space-y-1">
          <Label>Lunch out</Label>
          <Input type="datetime-local" value={form.lunchOut} onChange={set("lunchOut")} />
        </div>
        <div className="space-y-1">
          <Label>Lunch in</Label>
          <Input type="datetime-local" value={form.lunchIn} onChange={set("lunchIn")} />
        </div>
        <div className="space-y-1">
          <Label>Time out</Label>
          <Input type="datetime-local" value={form.timeOut} onChange={set("timeOut")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notes (saved to audit trail)</Label>
        <Textarea rows={2} value={form.notes} onChange={set("notes")} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── History dialog ───────────────────────────────────────────────────────

function HistoryDialog(props: { row: TimeRow | null; onClose: () => void }) {
  const { row, onClose } = props;
  const { data, isLoading } = useQuery<{ success: boolean; data: AuditRow[] }>({
    queryKey: ["/api/admin/hr/time", row?.time_aid, "history"],
    enabled: !!row,
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/hr/time/${row!.time_aid}/history`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });
  const entries = data?.data ?? [];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
          <DialogDescription>
            {row ? `${row.fullname ?? "—"} — ${formatDate(row.time_date)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto space-y-3">
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
                key={h.time_audit_aid}
                className="rounded-md border p-3 text-sm space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs font-medium " +
                        (h.time_audit_action === "delete"
                          ? "bg-destructive/10 text-destructive"
                          : h.time_audit_action === "update"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900")
                      }
                    >
                      {h.time_audit_action.toUpperCase()}
                    </span>
                    <span className="font-medium">
                      {h.time_audit_actor_name ?? "System"}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(h.time_audit_created)}
                  </span>
                </div>
                {h.time_audit_notes && (
                  <div className="text-muted-foreground">Notes: {h.time_audit_notes}</div>
                )}
                <HistoryDiff before={h.time_audit_before} after={h.time_audit_after} />
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

function HistoryDiff(props: { before: string | null; after: string | null }) {
  const beforeObj = safeParse(props.before);
  const afterObj = safeParse(props.after);

  // Keys we want to show in the diff
  const FIELDS: { key: string; label: string; isTime?: boolean; isDate?: boolean }[] = [
    { key: "time_date", label: "Date", isDate: true },
    { key: "time_employee_id", label: "Employee id" },
    { key: "time_working_hours", label: "Schedule" },
    { key: "time_in", label: "Time in", isTime: true },
    { key: "time_lunch_out", label: "Lunch out", isTime: true },
    { key: "time_lunch_in", label: "Lunch in", isTime: true },
    { key: "time_out", label: "Time out", isTime: true },
    { key: "time_total_hours", label: "Total hrs" },
    { key: "time_is_active", label: "Active" },
  ];

  const fmt = (v: unknown, isTime?: boolean, isDate?: boolean) => {
    if (v == null || v === "") return "—";
    if (isTime) return formatDateTime(String(v));
    if (isDate) return formatDate(String(v));
    return String(v);
  };

  const diffs = FIELDS.filter((f) => {
    const b = beforeObj?.[f.key];
    const a = afterObj?.[f.key];
    return String(b ?? "") !== String(a ?? "");
  });

  if (!beforeObj && !afterObj) return null;
  if (diffs.length === 0) {
    return <div className="text-xs text-muted-foreground">No field changes.</div>;
  }

  return (
    <div className="mt-1 grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-1 text-xs">
      {diffs.map((f) => (
        <Fragment key={f.key}>
          <div className="text-muted-foreground">{f.label}:</div>
          <div className="font-mono line-through text-destructive/80">
            {fmt(beforeObj?.[f.key], f.isTime, f.isDate)}
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="font-mono text-emerald-700">
            {fmt(afterObj?.[f.key], f.isTime, f.isDate)}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function safeParse(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
