/**
 * Admin HR – Time Off (Leave). List, approve / decline, add / edit / delete employee leave requests.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TreePalm,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

interface LeaveRow {
  leave_aid: number;
  leave_employee_id: number;
  leave_is_status: number;
  leave_date: string;
  leave_type: string;
  leave_amount: string;
  leave_hour: string | number;
  leave_minute: string | number;
  leave_remarks: string;
  fullname: string;
}

interface EmployeeOption {
  employee_aid: number;
  fullname: string;
  employee_job_pay_department_name?: string | null;
  employee_job_pay_job_title_name?: string | null;
  employee_job_pay_work_email?: string | null;
}

const LEAVE_TYPE_OPTIONS = [
  { value: "paid time off", label: "Paid Time Off" },
  { value: "sick time off", label: "Sick Time Off" },
  { value: "day off", label: "Day Off" },
];

const STATUS_OPTIONS = [
  { value: "0", label: "Pending" },
  { value: "1", label: "Approved" },
  { value: "2", label: "Declined" },
];

function LeaveStatusBadge({ status }: { status: number }) {
  if (status === 1)
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
        Approved
      </Badge>
    );
  if (status === 2)
    return <Badge variant="destructive">Declined</Badge>;
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400">
      Pending
    </Badge>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function toIsoDate(d: string): string {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function toTitleCase(s: string) {
  if (!s) return "—";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminHrTimeOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDecline, setConfirmDecline] = useState<LeaveRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeaveRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRow | null>(null);

  const offset = (page - 1) * pageSize;
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: LeaveRow[];
    total: number;
  }>({
    queryKey: ["/api/admin/hr/leave", search, fromDate, toDate, statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave/${id}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leave_is_status: status }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/leave"] });
      setConfirmDecline(null);
      toast({
        title: status === 1 ? "Request approved" : "Request declined",
        description:
          status === 1
            ? "Work schedule updated with a Day Off entry."
            : "The leave request has been declined.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/leave"] });
      setConfirmDelete(null);
      toast({
        title: "Deleted",
        description: "The time off record has been removed.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    },
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : offset + 1;
  const rangeTo = Math.min(offset + pageSize, total);
  const pendingCount = rows.filter((r) => r.leave_is_status === 0).length;
  const hasActiveFilters =
    search.trim() || fromDate || toDate || statusFilter !== "all";

  function resetFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setStatusFilter("all");
    setPage(1);
  }

  function openAdd() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(row: LeaveRow) {
    setEditing(row);
    setEditorOpen(true);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <TreePalm className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-primary">Time Off</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Review and manage employee leave requests.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && !isLoading && (
              <Badge className="bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 text-sm dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                {pendingCount} pending on this page
              </Badge>
            )}
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Add time off
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Search employee
                </Label>
                <Input
                  placeholder="Name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  From
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  To
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0">Pending</SelectItem>
                    <SelectItem value="1">Approved</SelectItem>
                    <SelectItem value="2">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                <TreePalm className="w-10 h-10 opacity-25" />
                <p className="text-sm">No leave records found.</p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="text-primary underline-offset-4 hover:underline">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.leave_aid}>
                        <TableCell className="font-medium">
                          {r.fullname ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.leave_date ? formatDate(r.leave_date) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {toTitleCase(r.leave_type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.leave_hour || r.leave_minute
                            ? `${r.leave_hour}h ${r.leave_minute}m`
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {r.leave_remarks || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={r.leave_is_status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            {r.leave_is_status === 0 && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: r.leave_aid,
                                      status: 1,
                                    })
                                  }
                                  disabled={updateStatusMutation.isPending}
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setConfirmDecline(r)}
                                  disabled={updateStatusMutation.isPending}
                                  title="Decline"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(r)}
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(r)}
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

                {/* Pagination footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {total > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {rangeFrom}–{rangeTo} of {total} records
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Decline confirmation dialog */}
      {confirmDecline && (
        <Dialog open onOpenChange={() => setConfirmDecline(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Decline this request?</DialogTitle>
              <DialogDescription>
                <strong>{confirmDecline.fullname}</strong>'s leave request on{" "}
                <strong>{formatDate(confirmDecline.leave_date)}</strong> will be
                marked as Declined.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDecline(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: confirmDecline.leave_aid,
                    status: 2,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete this time off?</DialogTitle>
              <DialogDescription>
                <strong>{confirmDelete.fullname}</strong>'s {toTitleCase(confirmDelete.leave_type)} on{" "}
                <strong>{formatDate(confirmDelete.leave_date)}</strong> will be
                permanently removed.
                {confirmDelete.leave_is_status === 1 && (
                  <span className="block mt-2 text-amber-700 dark:text-amber-400">
                    The corresponding Day Off entry in the work schedule will also be removed.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(confirmDelete.leave_aid)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit dialog */}
      <TimeOffEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editing={editing}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/leave"] });
        }}
      />
    </AdminLayout>
  );
}

function TimeOffEditor({
  open,
  onClose,
  editing,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  editing: LeaveRow | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!editing;

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [date, setDate] = useState("");
  const [type, setType] = useState("paid time off");
  const [hour, setHour] = useState("8");
  const [minute, setMinute] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [status, setStatus] = useState("0");
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setSelectedEmployee({
        employee_aid: editing.leave_employee_id,
        fullname: editing.fullname,
      });
      setEmployeeSearch(editing.fullname ?? "");
      setDate(toIsoDate(editing.leave_date));
      setType(editing.leave_type || "paid time off");
      setHour(String(editing.leave_hour ?? "0"));
      setMinute(String(editing.leave_minute ?? "0"));
      setRemarks(editing.leave_remarks ?? "");
      setStatus(String(editing.leave_is_status ?? 0));
    } else {
      setSelectedEmployee(null);
      setEmployeeSearch("");
      setDate(new Date().toISOString().slice(0, 10));
      setType("paid time off");
      setHour("8");
      setMinute("0");
      setRemarks("");
      setStatus("0");
    }
    setPickerOpen(false);
  }, [open, editing]);

  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [pickerOpen]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-hr-leave", "search-employee", employeeSearch, open],
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) {
        throw new Error("Please select an employee.");
      }
      if (!date) {
        throw new Error("Please choose a date.");
      }
      const payload = {
        leave_employee_id: selectedEmployee.employee_aid,
        leave_date: date,
        leave_type: type,
        leave_hour: parseInt(hour || "0", 10) || 0,
        leave_minute: parseInt(minute || "0", 10) || 0,
        leave_remarks: remarks,
        leave_is_status: parseInt(status || "0", 10) || 0,
      };
      const url = isEdit
        ? buildApiUrl(`/api/admin/hr/leave/${editing!.leave_aid}`)
        : buildApiUrl("/api/admin/hr/leave");
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save");
      }
    },
    onSuccess: () => {
      toast({
        title: isEdit ? "Time off updated" : "Time off added",
        description: isEdit
          ? "The leave record has been updated."
          : "A new leave record has been created.",
      });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreePalm className="w-5 h-5 text-primary" />
            {isEdit ? "Edit time off" : "Add time off"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div ref={pickerRef} className="relative">
            <Label>Employee</Label>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedEmployee ? (
                <span className="truncate">{selectedEmployee.fullname}</span>
              ) : (
                <span className="text-muted-foreground">Select employee…</span>
              )}
              <div className="flex items-center gap-1 ml-2 shrink-0">
                {selectedEmployee && (
                  <span
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedEmployee(null);
                        setEmployeeSearch("");
                        setPickerOpen(true);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmployee(null);
                      setEmployeeSearch("");
                      setPickerOpen(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${pickerOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {selectedEmployee &&
              (selectedEmployee.employee_job_pay_department_name ||
                selectedEmployee.employee_job_pay_job_title_name ||
                selectedEmployee.employee_job_pay_work_email) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {[
                    selectedEmployee.employee_job_pay_department_name,
                    selectedEmployee.employee_job_pay_job_title_name,
                  ]
                    .filter(Boolean)
                    .join(" · ") || selectedEmployee.employee_job_pay_work_email}
                </div>
              )}
            {pickerOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                <div className="flex items-center border-b px-3 py-2 gap-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {employeeSearch && (
                    <button
                      type="button"
                      onClick={() => setEmployeeSearch("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <ul className="max-h-56 overflow-auto py-1">
                  {searchResults.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
                  ) : (
                    searchResults.map((emp) => {
                      const dept = emp.employee_job_pay_department_name?.trim() ?? "";
                      const title = emp.employee_job_pay_job_title_name?.trim() ?? "";
                      const email = emp.employee_job_pay_work_email?.trim() ?? "";
                      const subtitle =
                        [dept, title].filter(Boolean).join(" · ") || email || null;
                      return (
                        <li key={emp.employee_aid}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-accent"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setEmployeeSearch(emp.fullname);
                              setPickerOpen(false);
                            }}
                          >
                            <div className="font-medium text-sm">{emp.fullname}</div>
                            {subtitle && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {subtitle}
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                min={0}
                max={24}
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 min-h-[80px] resize-none"
              placeholder="Optional – reason for time off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              {isEdit ? "Save changes" : "Add time off"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
