/**
 * Admin Payroll – Pay runs list (gla-v3 parity).
 *
 * Mirrors `portal/admin/payrun` from gla-v3:
 *  - Status filter (All / To Pay / On hold / In review / Paid)
 *  - Create pay run (Pay Date / Period Start / Period End / Remarks)
 *  - Edit pay run status + remarks
 *  - Delete pay run
 *  - Click row to open the payroll for that run
 *
 * Payrun status map (matches backend + gla-v3):
 *   0 = To Pay, 1 = Paid, 2 = On Hold, 3 = In Review
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { TableRowSkeleton } from "@/components/ui/skeletons";

interface PayrunRow {
  payrun_aid: number;
  payrun_status: number;
  payrun_number: string;
  payrun_date_from: string;
  payrun_date_to: string;
  payrun_pay_date: string;
  payrun_total_amount: string;
  payrun_total_employee: string;
  payrun_remarks: string | null;
}

/** Status map – keep in sync with gla-v3 `Payrun.jsx` filter options. */
const PAYRUN_STATUS_MAP: Record<
  number,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; dot: string }
> = {
  0: { label: "To Pay", variant: "secondary", dot: "bg-gray-500" },
  1: { label: "Paid", variant: "default", dot: "bg-green-600" },
  2: { label: "On Hold", variant: "destructive", dot: "bg-red-600" },
  3: { label: "In Review", variant: "outline", dot: "bg-yellow-500" },
};

function formatDate(s: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

function formatCurrency(s: string) {
  const n = parseFloat(s);
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PayrollPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    dateFrom: todayIso(),
    dateTo: todayIso(),
    payDate: todayIso(),
    remarks: "",
  });

  const [editItem, setEditItem] = useState<PayrunRow | null>(null);
  const [editForm, setEditForm] = useState({ status: 0, remarks: "" });

  const { data, isLoading } = useQuery<{
    success: boolean;
    list: PayrunRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/payroll/payruns", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(buildApiUrl(`/api/payroll/payruns?${params}`), {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load payruns");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      dateFrom: string;
      dateTo: string;
      payDate: string;
      remarks?: string | null;
    }) => {
      const res = await fetch(buildApiUrl("/api/payroll/payruns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create payrun");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/payruns"] });
      toast({
        title: "Pay run created",
        description: `Pay run ${result?.data?.payrun_number ?? ""} created.`,
      });
      setIsCreateOpen(false);
      setCreateForm({
        dateFrom: todayIso(),
        dateTo: todayIso(),
        payDate: todayIso(),
        remarks: "",
      });
      if (result?.data?.payrun_aid) {
        setLocation(`/admin/payroll/${result.data.payrun_aid}`);
      }
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      payrunId: number;
      status: number;
      remarks: string | null;
    }) => {
      const res = await fetch(
        buildApiUrl(`/api/payroll/payruns/${vars.payrunId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: vars.status, remarks: vars.remarks }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update pay run");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/payruns"] });
      toast({ title: "Pay run updated" });
      setEditItem(null);
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payrunId: number) => {
      const res = await fetch(buildApiUrl(`/api/payroll/payruns/${payrunId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete pay run");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/payruns"] });
      toast({ title: "Pay run deleted" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const openEdit = (row: PayrunRow) => {
    setEditItem(row);
    setEditForm({ status: row.payrun_status ?? 0, remarks: row.payrun_remarks ?? "" });
  };

  const list = data?.list ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.limit ? Math.ceil(total / data.limit) : 1;

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Pay runs</h1>
            <p className="text-muted-foreground text-sm">
              Create and manage pay runs. Click a row to view payroll and payslips.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-payrun">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="payrun-filter" className="text-sm">
                  Filter
                </Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger id="payrun-filter" className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {Object.entries(PAYRUN_STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-2 text-sm text-muted-foreground">
                  {total} record{total === 1 ? "" : "s"}
                </span>
              </div>
              <div className="relative flex-1 sm:max-w-sm sm:ml-auto">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by number or remarks..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payroll Number</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Pay Period</TableHead>
                    <TableHead className="text-center">Total Employee(s)</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton colSpan={8} rows={5} />
                  ) : list.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        No pay runs found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((row, idx) => {
                      const status =
                        PAYRUN_STATUS_MAP[row.payrun_status] ?? {
                          label: `Status ${row.payrun_status}`,
                          variant: "outline" as const,
                          dot: "bg-gray-400",
                        };
                      const rowNum = ((data?.page ?? 1) - 1) * (data?.limit ?? 20) + idx + 1;
                      const go = () => setLocation(`/admin/payroll/${row.payrun_aid}`);
                      return (
                        <TableRow
                          key={row.payrun_aid}
                          className="group cursor-pointer"
                          data-testid={`row-payrun-${row.payrun_aid}`}
                        >
                          <TableCell className="text-muted-foreground" onClick={go}>
                            {rowNum}.
                          </TableCell>
                          <TableCell onClick={go}>
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                              <Badge variant={status.variant} className="hidden sm:inline-flex">
                                {status.label}
                              </Badge>
                            </span>
                          </TableCell>
                          <TableCell className="font-medium" onClick={go}>
                            {row.payrun_number}
                          </TableCell>
                          <TableCell onClick={go}>{formatDate(row.payrun_pay_date)}</TableCell>
                          <TableCell onClick={go}>
                            {formatDate(row.payrun_date_from)} – {formatDate(row.payrun_date_to)}
                          </TableCell>
                          <TableCell className="text-center" onClick={go}>
                            {row.payrun_total_employee ?? 0}
                          </TableCell>
                          <TableCell className="text-right" onClick={go}>
                            ${formatCurrency(row.payrun_total_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                onClick={() => openEdit(row)}
                                data-testid={`button-edit-${row.payrun_aid}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmDialog
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Delete"
                                    data-testid={`button-delete-${row.payrun_aid}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                }
                                title="Delete pay run?"
                                description={
                                  <>
                                    This will permanently remove pay run{" "}
                                    <span className="font-medium">{row.payrun_number}</span>{" "}
                                    and all associated payroll and payslip data. This action
                                    cannot be undone.
                                  </>
                                }
                                confirmText="Delete"
                                variant="destructive"
                                onConfirm={() => deleteMutation.mutate(row.payrun_aid)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {data?.page ?? 1} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create pay run dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payrun</DialogTitle>
            <DialogDescription>
              Set the period and pay date. Eligible employees and their unpaid
              earnings/deductions in this period will be included.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pay-date">Pay Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={createForm.payDate}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, payDate: e.target.value }))
                }
                data-testid="input-pay-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={createForm.dateFrom}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, dateFrom: e.target.value }))
                  }
                  data-testid="input-period-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={createForm.dateTo}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, dateTo: e.target.value }))
                  }
                  data-testid="input-period-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Input
                id="remarks"
                placeholder="Remarks"
                value={createForm.remarks}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, remarks: e.target.value }))
                }
                data-testid="input-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !createForm.dateFrom ||
                !createForm.dateTo ||
                !createForm.payDate ||
                createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  dateFrom: createForm.dateFrom,
                  dateTo: createForm.dateTo,
                  payDate: createForm.payDate,
                  remarks: createForm.remarks || null,
                })
              }
              data-testid="button-create-submit"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status + remarks dialog */}
      <Dialog open={editItem != null} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Update {editItem?.payrun_number ?? "Pay run"}
            </DialogTitle>
            <DialogDescription>
              Change the pay run status and update remarks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={String(editForm.status)}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, status: Number(v) }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYRUN_STATUS_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-remarks">Remarks</Label>
              <Textarea
                id="edit-remarks"
                rows={4}
                value={editForm.remarks}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, remarks: e.target.value }))
                }
                data-testid="input-edit-remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              disabled={updateMutation.isPending || !editItem}
              onClick={() =>
                editItem &&
                updateMutation.mutate({
                  payrunId: editItem.payrun_aid,
                  status: editForm.status,
                  remarks: editForm.remarks || null,
                })
              }
              data-testid="button-edit-submit"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
