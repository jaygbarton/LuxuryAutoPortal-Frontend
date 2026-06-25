/**
 * Admin Payroll – Commission Pay Run detail.
 *
 * Shows one commission pay run: header (number / period / pay date / status),
 * a per-employee summary (count + total), and the underlying commission rows.
 * Mark the run Paid (or change status) from here — Paid cascades to the run's
 * commissions. Mirrors the employee payroll-by-run page.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, HandCoins, RefreshCw, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CommissionPayrunRow {
  cpayrun_aid: number;
  cpayrun_status: number;
  cpayrun_number: string;
  cpayrun_date_from: string;
  cpayrun_date_to: string;
  cpayrun_pay_date: string;
  cpayrun_total_amount: string;
  cpayrun_total_employee: string;
  cpayrun_remarks: string | null;
}

interface EmployeeLine {
  cpayrun_list_aid: number;
  cpayrun_list_emp_id: number;
  cpayrun_list_count: number;
  cpayrun_list_total: string;
  employee_name?: string;
}

interface CommissionItem {
  commissions_aid: number;
  commissions_type: string;
  commissions_amount: string;
  commissions_date: string;
  commissions_is_paid: number;
  commissions_remarks: string | null;
  commissions_employee_id: number;
  fullname?: string;
}

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
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CommissionPayrunByRunPage() {
  const [, params] = useRoute("/admin/payroll/commission-payruns/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cpayrunId = params?.id ? parseInt(params.id, 10) : 0;

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: { payrun: CommissionPayrunRow | null; employees: EmployeeLine[]; commissions: CommissionItem[] };
  }>({
    queryKey: ["/api/payroll/commission-payruns", cpayrunId, "detail"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payroll/commission-payruns/${cpayrunId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load commission pay run");
      return res.json();
    },
    enabled: cpayrunId > 0,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: number) => {
      const res = await fetch(buildApiUrl(`/api/payroll/commission-payruns/${cpayrunId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commission-payruns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commissions"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payroll/commission-payruns/${cpayrunId}/regenerate`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to regenerate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/commission-payruns"] });
      toast({ title: "Pay run regenerated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const payrun = data?.data?.payrun ?? null;
  const employees = data?.data?.employees ?? [];
  const commissions = data?.data?.commissions ?? [];
  const isPaid = Number(payrun?.cpayrun_status) === 1;

  // Group commissions under each employee for the breakdown.
  const byEmployee = new Map<number, CommissionItem[]>();
  for (const c of commissions) {
    const arr = byEmployee.get(c.commissions_employee_id) ?? [];
    arr.push(c);
    byEmployee.set(c.commissions_employee_id, arr);
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!payrun) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => setLocation("/admin/payroll/commission-payruns")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <p className="mt-6 text-center text-muted-foreground">Commission pay run not found.</p>
        </div>
      </AdminLayout>
    );
  }

  const status = PAYRUN_STATUS_MAP[payrun.cpayrun_status] ?? PAYRUN_STATUS_MAP[0];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/payroll/commission-payruns")} className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to commission pay runs
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight flex items-center gap-2">
                {payrun.cpayrun_number}
                <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                <Badge variant={status.variant}>{status.label}</Badge>
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Period {formatDate(payrun.cpayrun_date_from)} – {formatDate(payrun.cpayrun_date_to)} · Pay date{" "}
                {formatDate(payrun.cpayrun_pay_date)}
              </p>
              {payrun.cpayrun_remarks && (
                <p className="text-muted-foreground text-sm mt-1 italic">{payrun.cpayrun_remarks}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isPaid && (
                <>
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" disabled={regenerateMutation.isPending}>
                        {regenerateMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate
                      </Button>
                    }
                    title="Regenerate this pay run?"
                    description="Re-gathers the unpaid commissions in this run's period and rebuilds the per-employee totals. Use after adding or editing commissions."
                    confirmText="Regenerate"
                    onConfirm={() => regenerateMutation.mutate()}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" disabled={statusMutation.isPending}>
                        <HandCoins className="mr-2 h-4 w-4" /> Mark Paid
                      </Button>
                    }
                    title="Mark this pay run as Paid?"
                    description="All commissions in this run will be marked paid. You can revert by setting the status back to To Pay."
                    confirmText="Mark Paid"
                    onConfirm={() => statusMutation.mutate(1)}
                  />
                </>
              )}
              <Select
                value={String(payrun.cpayrun_status)}
                onValueChange={(v) => statusMutation.mutate(Number(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYRUN_STATUS_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Per-employee summary */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">By employee</h2>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-center">Commissions</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No commissions in this run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((e) => (
                      <TableRow key={e.cpayrun_list_aid}>
                        <TableCell className="font-medium">{e.employee_name?.trim() || "—"}</TableCell>
                        <TableCell className="text-center">{e.cpayrun_list_count}</TableCell>
                        <TableCell className="text-right font-mono">{money(e.cpayrun_list_total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {employees.length > 0 && (
                    <TableRow className="border-t-2 bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-center">
                        {employees.reduce((s, e) => s + Number(e.cpayrun_list_count || 0), 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money(employees.reduce((s, e) => s + Number(e.cpayrun_list_total || 0), 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Commission line items */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Commissions in this run</h2>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No commission line items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions.map((c) => (
                      <TableRow key={c.commissions_aid}>
                        <TableCell className="font-medium">{c.fullname?.trim() || "—"}</TableCell>
                        <TableCell>{c.commissions_type || "—"}</TableCell>
                        <TableCell>{c.commissions_date}</TableCell>
                        <TableCell className="text-right font-mono">{money(c.commissions_amount)}</TableCell>
                        <TableCell>{c.commissions_is_paid ? "Yes" : "No"}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground" title={c.commissions_remarks ?? ""}>
                          {c.commissions_remarks?.trim() || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
