/**
 * Admin Payroll – Payroll list for a pay run (gla-v3 parity).
 *
 * Mirrors `PayrollList.jsx` from gla-v3:
 *  - Header showing Payroll Number + Pay Period
 *  - Search by employee
 *  - Per-row status badge (To Pay / Paid / On Hold / In Review)
 *  - Per-row status actions (to-pay, review, hold, paid)
 *  - Click row to open the employee's payslip
 *
 * payrun_list_status map (matches backend + gla-v3):
 *   0 = To Pay, 1 = Paid, 2 = On Hold, 3 = In Review
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  FileText,
  Check,
  Lock,
  ClipboardCheck,
  HandCoins,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableRowSkeleton } from "@/components/ui/skeletons";

interface PayrunRow {
  payrun_aid: number;
  payrun_number: string;
  payrun_date_from: string;
  payrun_date_to: string;
  payrun_pay_date: string;
  payrun_status: number;
}

interface PayrollListItem {
  payrun_list_aid: number;
  payrun_list_id: number;
  payrun_list_emp_id: number;
  payrun_list_status?: number;
  payrun_list_gross: string;
  payrun_list_deduction: string;
  payrun_list_net: string;
  total_hours?: string | number | null;
  employee_name?: string;
  fullname?: string;
}

const PAYROLL_STATUS_MAP: Record<
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

export default function PayrollByRunPage() {
  const [, params] = useRoute<{ payrunId: string }>("/admin/payroll/:payrunId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const payrunId = params?.payrunId ? parseInt(params.payrunId, 10) : null;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data: payrunData } = useQuery<{ success: boolean; data: PayrunRow }>({
    queryKey: ["/api/payroll/payruns", payrunId],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payroll/payruns/${payrunId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Payrun not found");
      return res.json();
    },
    enabled: payrunId != null,
  });

  const { data: payrollData, isLoading } = useQuery<{
    success: boolean;
    list: PayrollListItem[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/payroll/payruns", payrunId, "payroll", page, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(
        buildApiUrl(`/api/payroll/payruns/${payrunId}/payroll?${params}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load payroll");
      return res.json();
    },
    enabled: payrunId != null,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/payroll/payruns/${payrunId}/generate`),
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate payroll");
      }
      return res.json() as Promise<{
        success: boolean;
        data: { payrun_number: string; totalAmount: number; employeeCount: number };
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/payruns", payrunId] });
      queryClient.invalidateQueries({
        queryKey: ["/api/payroll/payruns", payrunId, "payroll"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/payruns"] });
      const d = result?.data;
      const total = (d?.totalAmount ?? 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      toast({
        title: "Payroll generated from timesheet",
        description: `${d?.payrun_number ?? "Pay run"}: ${d?.employeeCount ?? 0} employee(s), total $${total}.`,
      });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (vars: { employeeId: number; status: number }) => {
      const res = await fetch(
        buildApiUrl(
          `/api/payroll/payruns/${payrunId}/payroll/${vars.employeeId}/status`,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: vars.status }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/payroll/payruns", payrunId, "payroll"],
      });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const payrun = payrunData?.data;
  const list = payrollData?.list ?? [];
  const total = payrollData?.total ?? 0;
  const totalPages = payrollData?.limit ? Math.ceil(total / payrollData.limit) : 1;

  if (payrunId == null || Number.isNaN(payrunId)) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Invalid pay run.</p>
          <Button
            variant="ghost"
            className="px-0 mt-2"
            onClick={() => setLocation("/admin/payroll")}
          >
            Back to Pay runs
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin/payroll")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Payroll</h1>
            <p className="text-muted-foreground text-sm">
              {payrun ? (
                <>
                  <span className="font-medium">{payrun.payrun_number}</span>
                  {" · "}
                  {formatDate(payrun.payrun_date_from)} – {formatDate(payrun.payrun_date_to)}
                  {" · Pay date: "}
                  {formatDate(payrun.payrun_pay_date)}
                </>
              ) : (
                "Loading…"
              )}
            </p>
          </div>
          {payrun && payrun.payrun_status !== 1 && (
            <ConfirmDialog
              trigger={
                <Button
                  variant="outline"
                  disabled={generateMutation.isPending}
                  data-testid="button-generate-payroll"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Generate from Timesheet
                </Button>
              }
              title="Generate payroll from timesheet?"
              description={
                <>
                  This replaces all existing payslips for{" "}
                  <span className="font-medium">{payrun.payrun_number}</span> with newly
                  computed amounts based on clocked hours × hourly rate plus any unpaid
                  earnings/deductions in the pay period.
                </>
              }
              confirmText="Generate"
              onConfirm={() => generateMutation.mutate()}
            />
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-0.5 text-sm">
                <p className="text-muted-foreground">
                  Payroll Number:{" "}
                  <span className="font-semibold text-foreground">
                    {payrun?.payrun_number ?? "—"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Pay Period:{" "}
                  <span className="font-semibold text-foreground">
                    {payrun
                      ? `${formatDate(payrun.payrun_date_from)} – ${formatDate(payrun.payrun_date_to)}`
                      : "—"}
                  </span>
                </p>
              </div>
              <div className="relative flex-1 sm:max-w-sm sm:ml-auto">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by employee name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                  data-testid="input-search-employee"
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
                    <TableHead>Employee Name</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Total Pay</TableHead>
                    <TableHead className="w-[220px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton colSpan={6} rows={5} />
                  ) : list.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No employees in this pay run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((row, idx) => {
                      const statusKey = Number(row.payrun_list_status ?? 0);
                      const status =
                        PAYROLL_STATUS_MAP[statusKey] ?? {
                          label: `Status ${statusKey}`,
                          variant: "outline" as const,
                          dot: "bg-gray-400",
                        };
                      const empName =
                        row.fullname ??
                        row.employee_name ??
                        `Employee #${row.payrun_list_emp_id}`;
                      const go = () =>
                        setLocation(
                          `/admin/payroll/${payrunId}/payslip/${row.payrun_list_emp_id}`,
                        );
                      return (
                        <TableRow
                          key={row.payrun_list_aid}
                          className="group cursor-pointer"
                          data-testid={`row-payroll-${row.payrun_list_emp_id}`}
                        >
                          <TableCell className="text-muted-foreground" onClick={go}>
                            {(page - 1) * 50 + idx + 1}.
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
                            {empName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums" onClick={go}>
                            {Number(row.total_hours ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium" onClick={go}>
                            ${formatCurrency(row.payrun_list_net)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div
                              className="flex items-center justify-end gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {statusKey !== 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark: To Pay"
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      employeeId: row.payrun_list_emp_id,
                                      status: 0,
                                    })
                                  }
                                  data-testid={`button-status-topay-${row.payrun_list_emp_id}`}
                                >
                                  <HandCoins className="h-4 w-4" />
                                </Button>
                              )}
                              {statusKey !== 3 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark: In Review"
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      employeeId: row.payrun_list_emp_id,
                                      status: 3,
                                    })
                                  }
                                  data-testid={`button-status-review-${row.payrun_list_emp_id}`}
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </Button>
                              )}
                              {statusKey !== 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark: On Hold"
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      employeeId: row.payrun_list_emp_id,
                                      status: 2,
                                    })
                                  }
                                  data-testid={`button-status-hold-${row.payrun_list_emp_id}`}
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )}
                              {statusKey !== 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark: Paid"
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      employeeId: row.payrun_list_emp_id,
                                      status: 1,
                                    })
                                  }
                                  data-testid={`button-status-paid-${row.payrun_list_emp_id}`}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View payslip"
                                onClick={go}
                                data-testid={`button-payslip-${row.payrun_list_emp_id}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
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
                  Page {payrollData?.page ?? 1} of {totalPages} ({total} employees)
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
    </AdminLayout>
  );
}
