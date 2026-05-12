/**
 * Admin Payroll – Employee payslip (gla-v3 parity).
 *
 * Mirrors `PayslipList.jsx` from gla-v3:
 *  - Header: Payroll Number, Date Range, Employee Name
 *  - Earnings table with Hours / Rate / Amount columns
 *  - Total Earnings line
 *  - Deductions list
 *  - Total Deductions / Tax / Net summary block
 *  - Print button (uses browser print with a print-friendly layout)
 */

import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

interface PayrunRow {
  payrun_aid: number;
  payrun_number: string;
  payrun_date_from: string;
  payrun_date_to: string;
  payrun_pay_date: string;
  payrun_status: number;
}

interface PayrunListRow {
  payrun_list_gross: string;
  payrun_list_deduction: string;
  payrun_list_net: string;
  fullname?: string;
  employee_name?: string;
}

interface PaysummaryRow {
  paysummary_name: string;
  paysummary_is_deduction: number;
  paysummary_is_earnings: number;
  paysummary_amount: string;
  paysummary_rate: string;
  paysummary_hrs: string;
}

interface PayslipData {
  payrun: PayrunRow;
  payrunList: PayrunListRow;
  paysummary: PaysummaryRow[];
  employee?: { fullname?: string; first_name?: string; last_name?: string };
}

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

function formatCurrency(s: string | number) {
  const n = typeof s === "number" ? s : parseFloat(String(s));
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PayslipPage() {
  const [, params] = useRoute<{ payrunId: string; employeeId: string }>(
    "/admin/payroll/:payrunId/payslip/:employeeId",
  );
  const [, setLocation] = useLocation();
  const payrunId = params?.payrunId ? parseInt(params.payrunId, 10) : null;
  const employeeId = params?.employeeId ? parseInt(params.employeeId, 10) : null;

  const { data: res, isLoading, error } = useQuery<{
    success: boolean;
    data: PayslipData;
  }>({
    queryKey: ["/api/payroll/payruns", payrunId, "payslip", employeeId],
    queryFn: async () => {
      const r = await fetch(
        buildApiUrl(`/api/payroll/payruns/${payrunId}/payslip/${employeeId}`),
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Payslip not found");
      return r.json();
    },
    enabled: payrunId != null && employeeId != null,
  });

  const payrunData = res?.data;

  const { data: commissionsRes, isLoading: commissionsLoading } = useQuery<{
    success: boolean;
    data: CommissionRow[];
    total: number;
  }>({
    queryKey: [
      "/api/payroll/commissions",
      payrunData?.payrun.payrun_date_from,
      payrunData?.payrun.payrun_date_to,
      employeeId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (payrunData?.payrun.payrun_date_from) params.set("dateFrom", payrunData.payrun.payrun_date_from);
      if (payrunData?.payrun.payrun_date_to) params.set("dateTo", payrunData.payrun.payrun_date_to);
      params.set("limit", "500");
      const r = await fetch(
        buildApiUrl(`/api/payroll/commissions?${params}`),
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Failed to fetch commissions");
      return r.json();
    },
    enabled:
      payrunData != null &&
      !!payrunData.payrun.payrun_date_from &&
      !!payrunData.payrun.payrun_date_to &&
      employeeId != null,
  });

  const employeeCommissions =
    commissionsRes?.data?.filter(
      (c) => c.commissions_employee_id === employeeId,
    ) ?? [];
  const commissionsTotal = employeeCommissions.reduce(
    (sum, c) => sum + Number(c.commissions_amount || 0),
    0,
  );

  if (payrunId == null || employeeId == null || Number.isNaN(payrunId) || Number.isNaN(employeeId)) {
    return (
      <AdminLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Invalid payslip.</p>
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

  const data = payrunData;
  const earnings = data?.paysummary?.filter((l) => Number(l.paysummary_is_deduction) === 0) ?? [];
  const deductions = data?.paysummary?.filter((l) => Number(l.paysummary_is_deduction) === 1) ?? [];
  const employeeName =
    data?.payrunList.fullname ??
    data?.payrunList.employee_name ??
    data?.employee?.fullname ??
    (data?.employee?.first_name
      ? `${data.employee.first_name} ${data.employee.last_name ?? ""}`.trim()
      : `Employee #${employeeId}`);

  const handlePrint = () => {
    if (!data) return;
    const originalTitle = document.title;
    document.title = `${employeeName} (${formatDate(data.payrun.payrun_date_from)} – ${formatDate(data.payrun.payrun_date_to)})`;
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 50);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
        <div className="flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/admin/payroll/${payrunId}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold">Payslip</h1>
          </div>
          <Button
            onClick={handlePrint}
            disabled={!data || isLoading}
            data-testid="button-print"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="text-destructive">Failed to load payslip.</p>}

        {data && (
          <Card className="print:shadow-none print:border-0">
            <CardContent className="pt-6 print:pt-2">
              <div className="mb-5 space-y-0.5 text-sm">
                <p className="text-muted-foreground">
                  Payroll Number:{" "}
                  <span className="font-semibold text-foreground">
                    {data.payrun.payrun_number}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Date Range:{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(data.payrun.payrun_date_from)} – {formatDate(data.payrun.payrun_date_to)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Pay Date:{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(data.payrun.payrun_pay_date)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Employee Name:{" "}
                  <span className="font-semibold text-foreground">{employeeName}</span>
                </p>
              </div>

              {/* Earnings */}
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[1fr_6rem_6rem_8rem] bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                  <div>Earnings</div>
                  <div className="text-center">Hours</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Amount</div>
                </div>
                {earnings.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No earnings recorded.
                  </div>
                ) : (
                  earnings.map((line, i) => {
                    const hasRate = line.paysummary_rate && line.paysummary_rate !== "";
                    const hasHrs = line.paysummary_hrs && line.paysummary_hrs !== "";
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_6rem_6rem_8rem] items-center border-t px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <div>{line.paysummary_name || "Earning"}</div>
                        <div className="text-center">{hasHrs ? line.paysummary_hrs : ""}</div>
                        <div className="text-right">
                          {hasRate ? `$${formatCurrency(line.paysummary_rate)}` : ""}
                        </div>
                        <div className="text-right font-medium">
                          ${formatCurrency(line.paysummary_amount)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="grid grid-cols-[1fr_8rem] border-t bg-muted/60 px-3 py-2 text-sm font-semibold">
                  <div className="uppercase tracking-wide">Total Earnings</div>
                  <div className="text-right">
                    ${formatCurrency(data.payrunList.payrun_list_gross)}
                  </div>
                </div>
              </div>

              {/* Deductions */}
              {deductions.length > 0 && (
                <div className="mt-6 rounded-md border overflow-hidden">
                  <div className="grid grid-cols-[1fr_8rem] bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                    <div>Deductions</div>
                    <div className="text-right">Amount</div>
                  </div>
                  {deductions.map((line, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_8rem] border-t px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <div>{line.paysummary_name || "Deduction"}</div>
                      <div className="text-right font-medium">
                        ${formatCurrency(line.paysummary_amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Commissions */}
              <div className="mt-6 rounded-md border overflow-hidden">
                <div className="grid grid-cols-[8rem_1fr_8rem] bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                  <div>Date</div>
                  <div>Description</div>
                  <div className="text-right">Amount</div>
                </div>
                {commissionsLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading commissions…
                  </div>
                ) : employeeCommissions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No commissions for this period.
                  </div>
                ) : (
                  employeeCommissions.map((c) => (
                    <div
                      key={c.commissions_aid}
                      className="grid grid-cols-[8rem_1fr_8rem] items-center border-t px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <div>{formatDate(c.commissions_date)}</div>
                      <div>
                        {c.commissions_type || "Commission"}
                        {c.commissions_remarks ? (
                          <span className="ml-1 text-muted-foreground">
                            — {c.commissions_remarks}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right font-medium">
                        ${formatCurrency(c.commissions_amount)}
                      </div>
                    </div>
                  ))
                )}
                <div className="grid grid-cols-[1fr_8rem] border-t bg-muted/60 px-3 py-2 text-sm font-semibold">
                  <div className="uppercase tracking-wide">Total Commissions</div>
                  <div className="text-right">
                    ${formatCurrency(commissionsTotal)}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 rounded-md border overflow-hidden">
                <div className="grid grid-cols-[1fr_8rem] border-t bg-muted/40 px-3 py-2 text-sm">
                  <div className="uppercase tracking-wide text-muted-foreground">
                    Total Deduction
                  </div>
                  <div className="text-right">
                    -${formatCurrency(data.payrunList.payrun_list_deduction)}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_8rem] border-t bg-muted/40 px-3 py-2 text-sm">
                  <div className="uppercase tracking-wide text-muted-foreground">Tax</div>
                  <div className="text-right">${formatCurrency(0)}</div>
                </div>
                <div className="grid grid-cols-[1fr_8rem] border-t-2 border-foreground bg-primary px-3 py-3 text-base font-bold text-primary-foreground">
                  <div className="uppercase tracking-wide">Net Pay</div>
                  <div className="text-right">
                    ${formatCurrency(data.payrunList.payrun_list_net)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
