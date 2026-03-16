/**
 * Admin Payroll – Commissions (v1 parity).
 * List, add, edit, delete commissions; filter by date range and paid status.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Search } from "lucide-react";

interface CommissionRow {
  commissions_aid: number;
  commissions_type: string;
  commissions_amount: string;
  commissions_is_paid: number;
  commissions_remarks: string;
  commissions_employee_id: number;
  commissions_date: string;
  commissions_account_owner_name: string;
  commissions_account_owner_id: string;
  commissions_percentage: string;
  commissions_percentage_amount: string;
  fullname?: string;
}

export default function PayrollCommissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paidFilter, setPaidFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    commissions_type: "",
    commissions_amount: "",
    commissions_employee_id: 0,
    commissions_date: "",
    commissions_remarks: "",
    commissions_account_owner_name: "",
    commissions_account_owner_id: "",
    commissions_percentage: "",
    commissions_percentage_amount: "",
  });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");

  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (paidFilter !== "all") params.set("commissions_is_paid", paidFilter);
  params.set("limit", "100");

  const { data, isLoading } = useQuery<{ success: boolean; data: CommissionRow[]; total: number }>({
    queryKey: ["/api/payroll/commissions", search, dateFrom, dateTo, paidFilter],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payroll/commissions?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: employeeSearchResult } = useQuery<{ success: boolean; data: { employee_aid: number; fullname: string }[] }>({
    queryKey: ["/api/admin/hr/search-employee", employeeSearch],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/hr/search-employee"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ searchValue: employeeSearch }),
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: employeeSearch.trim().length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch(buildApiUrl("/api/payroll/commissions"), {
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
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      setModalOpen(false);
      resetForm();
      toast({ title: "Commission added" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<typeof form> }) => {
      const res = await fetch(buildApiUrl(`/api/payroll/commissions/${id}`), {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      setModalOpen(false);
      setEditingId(null);
      resetForm();
      toast({ title: "Commission updated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/payroll/commissions/${id}`), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      toast({ title: "Commission deleted" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: number; paid: number }) => {
      const res = await fetch(buildApiUrl(`/api/payroll/commissions/${id}/paid`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commissions_is_paid: paid }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  function resetForm() {
    setForm({
      commissions_type: "",
      commissions_amount: "",
      commissions_employee_id: 0,
      commissions_date: "",
      commissions_remarks: "",
      commissions_account_owner_name: "",
      commissions_account_owner_id: "",
      commissions_percentage: "",
      commissions_percentage_amount: "",
    });
    setEmployeeSearch("");
    setSelectedEmployeeName("");
  }

  const rows = data?.data ?? [];
  const employees = employeeSearchResult?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Commissions</h1>
            <p className="text-muted-foreground text-sm">Manage employee commissions. Mark as paid when processed.</p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              resetForm();
              setModalOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Add Commission
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by type or employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" placeholder="From" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" placeholder="To" />
              <Select value={paidFilter} onValueChange={setPaidFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Paid status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="0">Unpaid</SelectItem>
                  <SelectItem value="1">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No commissions found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.commissions_aid}>
                      <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                      <TableCell>{r.commissions_type || "—"}</TableCell>
                      <TableCell>{r.commissions_date}</TableCell>
                      <TableCell className="text-right">${Number(r.commissions_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{r.commissions_is_paid ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!r.commissions_is_paid && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaidMutation.mutate({ id: r.commissions_aid, paid: 1 })}
                              disabled={markPaidMutation.isPending}
                            >
                              Mark paid
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(r.commissions_aid);
                              setForm({
                                commissions_type: r.commissions_type,
                                commissions_amount: r.commissions_amount,
                                commissions_employee_id: r.commissions_employee_id,
                                commissions_date: r.commissions_date,
                                commissions_remarks: r.commissions_remarks ?? "",
                                commissions_account_owner_name: r.commissions_account_owner_name ?? "",
                                commissions_account_owner_id: r.commissions_account_owner_id ?? "",
                                commissions_percentage: r.commissions_percentage ?? "",
                                commissions_percentage_amount: r.commissions_percentage_amount ?? "",
                              });
                              setSelectedEmployeeName(r.fullname ?? "");
                              setModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(r.commissions_aid)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {data?.total != null && data.total > rows.length && (
              <p className="text-muted-foreground text-sm mt-2">Showing {rows.length} of {data.total}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Commission" : "Add Commission"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingId && (
              <div className="space-y-2">
                <Label>Employee (search and select)</Label>
                <Input
                  placeholder="Type to search employee..."
                  value={editingId ? selectedEmployeeName : employeeSearch}
                  onChange={(e) => {
                    if (!editingId) {
                      setEmployeeSearch(e.target.value);
                      setSelectedEmployeeName("");
                    }
                  }}
                />
                {employees.length > 0 && !editingId && (
                  <ul className="border rounded-md max-h-32 overflow-auto">
                    {employees.slice(0, 10).map((emp: { employee_aid: number; fullname: string }) => (
                      <li
                        key={emp.employee_aid}
                        className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                        onClick={() => {
                          setForm((f) => ({ ...f, commissions_employee_id: emp.employee_aid }));
                          setSelectedEmployeeName(emp.fullname);
                          setEmployeeSearch("");
                        }}
                      >
                        {emp.fullname}
                      </li>
                    ))}
                  </ul>
                )}
                {editingId && <p className="text-sm text-muted-foreground">{selectedEmployeeName}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Input
                  value={form.commissions_type}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_type: e.target.value }))}
                  placeholder="e.g. Referral"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.commissions_amount}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.commissions_date}
                onChange={(e) => setForm((f) => ({ ...f, commissions_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Input
                value={form.commissions_remarks}
                onChange={(e) => setForm((f) => ({ ...f, commissions_remarks: e.target.value }))}
                placeholder="Remarks"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Account owner name (optional)</Label>
                <Input
                  value={form.commissions_account_owner_name}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_account_owner_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Account owner ID (optional)</Label>
                <Input
                  value={form.commissions_account_owner_id}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_account_owner_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Percentage (optional)</Label>
                <Input
                  value={form.commissions_percentage}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_percentage: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Percentage amount (optional)</Label>
                <Input
                  value={form.commissions_percentage_amount}
                  onChange={(e) => setForm((f) => ({ ...f, commissions_percentage_amount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              disabled={
                !form.commissions_type ||
                !form.commissions_amount ||
                !form.commissions_date ||
                (!editingId && !form.commissions_employee_id) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              onClick={() => {
                if (editingId) {
                  updateMutation.mutate({
                    id: editingId,
                    body: {
                      commissions_type: form.commissions_type,
                      commissions_amount: form.commissions_amount,
                      commissions_date: form.commissions_date,
                      commissions_remarks: form.commissions_remarks,
                      commissions_account_owner_name: form.commissions_account_owner_name,
                      commissions_account_owner_id: form.commissions_account_owner_id,
                      commissions_percentage: form.commissions_percentage,
                      commissions_percentage_amount: form.commissions_percentage_amount,
                    },
                  });
                } else {
                  createMutation.mutate(form);
                }
              }}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
