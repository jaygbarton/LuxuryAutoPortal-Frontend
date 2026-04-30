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
import { Loader2, Plus, Pencil, Trash2, Search, ChevronDown, X } from "lucide-react";
import { useRef, useEffect } from "react";

interface CommissionRow {
  commissions_aid: number;
  commissions_type: string;
  commissions_amount: string;
  commissions_is_paid: number;
  commissions_remarks: string;
  commissions_employee_id: number;
  commissions_date: string;
  commissions_billed_gla_client?: number;
  fullname?: string;
}

function isInsuranceType(type: string): boolean {
  return type.trim().toLowerCase() === "insurance";
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
    commissions_billed_gla_client: 0,
  });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");
  const [focusEmpSearch, setFocusEmpSearch] = useState(false);
  const empSearchRef = useRef<HTMLDivElement>(null);

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
    queryKey: ["/api/admin/work-sched/search-employee", employeeSearch],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/work-sched/search-employee"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ searchValue: employeeSearch }),
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: modalOpen,
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

  const billedGlaMutation = useMutation({
    mutationFn: async ({ id, billed }: { id: number; billed: number }) => {
      const res = await fetch(buildApiUrl(`/api/payroll/commissions/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commissions_billed_gla_client: billed }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      toast({ title: "Billed GLA Client updated" });
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
      commissions_billed_gla_client: 0,
    });
    setEmployeeSearch("");
    setSelectedEmployeeName("");
    setFocusEmpSearch(false);
  }

  const rows = data?.data ?? [];
  const employees = employeeSearchResult?.data ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empSearchRef.current && !empSearchRef.current.contains(e.target as Node)) {
        setFocusEmpSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
                    <TableHead>Billed GLA Client</TableHead>
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
                        {isInsuranceType(r.commissions_type) ? (
                          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!!r.commissions_billed_gla_client}
                              disabled={billedGlaMutation.isPending}
                              onChange={(e) =>
                                billedGlaMutation.mutate({
                                  id: r.commissions_aid,
                                  billed: e.target.checked ? 1 : 0,
                                })
                              }
                            />
                            <span>{r.commissions_billed_gla_client ? "Billed" : "Not billed"}</span>
                          </label>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
                                commissions_billed_gla_client: r.commissions_billed_gla_client ? 1 : 0,
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
                <div ref={empSearchRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setFocusEmpSearch((v) => !v)}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {selectedEmployeeName ? (
                      <span className="truncate">{selectedEmployeeName}</span>
                    ) : (
                      <span className="text-muted-foreground">Select employee...</span>
                    )}
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      {selectedEmployeeName && (
                        <span
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setForm((f) => ({ ...f, commissions_employee_id: 0 }));
                              setSelectedEmployeeName("");
                              setEmployeeSearch("");
                              setFocusEmpSearch(true);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm((f) => ({ ...f, commissions_employee_id: 0 }));
                            setSelectedEmployeeName("");
                            setEmployeeSearch("");
                            setFocusEmpSearch(true);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${focusEmpSearch ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {focusEmpSearch && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      <div className="flex items-center border-b px-3 py-2 gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Search employee..."
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        {employeeSearch && (
                          <button type="button" onClick={() => setEmployeeSearch("")} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <ul className="max-h-48 overflow-auto py-1">
                        {employees.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">No employees found.</li>
                        ) : (
                          employees.map((emp) => (
                            <li key={emp.employee_aid}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                                onClick={() => {
                                  setForm((f) => ({ ...f, commissions_employee_id: emp.employee_aid }));
                                  setSelectedEmployeeName(emp.fullname);
                                  setEmployeeSearch("");
                                  setFocusEmpSearch(false);
                                }}
                              >
                                {emp.fullname}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
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
            {isInsuranceType(form.commissions_type) && (
              <div className="flex items-center gap-2 rounded-md border p-3">
                <input
                  id="billed_gla_client"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!form.commissions_billed_gla_client}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      commissions_billed_gla_client: e.target.checked ? 1 : 0,
                    }))
                  }
                />
                <Label htmlFor="billed_gla_client" className="cursor-pointer">
                  Billed GLA Client
                </Label>
              </div>
            )}
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
                      commissions_billed_gla_client: form.commissions_billed_gla_client,
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
