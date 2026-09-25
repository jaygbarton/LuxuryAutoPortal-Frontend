import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, FileText } from "lucide-react";
import { authMeQueryFn } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { formatMonthDayYear } from "@/lib/date-format";
import { useCoHost } from "@/hooks/use-co-host";
import {
  PaymentFilterBar,
  type PaymentFilterCar,
} from "@/components/admin/payments/PaymentFilterBar";
import { PaymentsPaginationFooter } from "@/components/admin/payments/PaymentsPaginationFooter";
import { PaymentEditHistory } from "@/components/admin/payments/PaymentEditHistory";
import { usePaymentListState } from "@/components/admin/payments/usePaymentListState";
import { CoHostPaymentModal, type CoHostPaymentRow } from "@/components/modals/CoHostPaymentModal";
import { PaymentReceiptModal } from "@/components/modals/PaymentReceiptModal";

/**
 * One co-hosted car-month. The car/month/Co-Host Split come from the
 * client_payments row; everything paid to the co-host (co_host_*) comes from
 * the separate co_host_payments ledger, so this page never reads or writes the
 * car owner's Paid Amount.
 */
interface Payment extends CoHostPaymentRow {
  payments_aid: number;
  car_make_name: string;
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
  fullname: string;
  co_host_name: string | null;
  co_host_status_color: string | null;
  co_host_balance: number;
}

interface PaymentStatus {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
}

const formatCurrency = (value: number): string => {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `($ ${formatted})` : `$ ${formatted}`;
};

const formatYearMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split("-");
  return year && month ? `${month.padStart(2, "0")}/${year}` : yearMonth;
};

const formatVehicleInfo = (p: Payment) => {
  const name = `${p.car_make_name || ""} ${p.car_year || ""}`.trim();
  const plate = p.car_plate_number ? `#${p.car_plate_number.trim()}` : "";
  const vin = p.car_vin_number ? p.car_vin_number.trim() : "";
  return [name, plate, vin].filter(Boolean).join(" – ");
};

const TH = "h-11 px-3 font-semibold text-foreground text-[11px] uppercase tracking-wider";

export default function CoHostPaymentsPage() {
  const list = usePaymentListState();
  const { sortOrder, setSortOrder, page, effectivePageSize } = list;
  const [editing, setEditing] = useState<Payment | null>(null);
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);

  const { data: meData } = useQuery<{ user?: { isAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = !!(meData?.user as any)?.isAdmin;
  // Writes are requireAdminNotCoHost on the backend, which rejects any co-host
  // session (a real co-host login AND an admin using "View as Co-Host"), so
  // only offer Edit to a plain GLA admin. Edit history is readable by any
  // admin, including one viewing as a co-host, but never by a real co-host.
  const { isCoHost, isRealCoHost } = useCoHost();
  const canEdit = isAdmin && !isCoHost;
  const canSeeHistory = isAdmin && !isRealCoHost;

  const { data: statusesData } = useQuery<{ success: boolean; data: PaymentStatus[] }>({
    queryKey: ["/api/payment-status"],
    queryFn: async () => api.get("/api/payment-status", { fallbackMessage: "Failed to fetch payment statuses" }),
  });
  const statuses = statusesData?.data ?? [];
  const statusColor = (p: Payment) =>
    p.co_host_status_color ??
    statuses.find((s) => s.payment_status_name === p.co_host_status_name)?.payment_status_color ??
    "#e5e7eb";

  // /api/cars is already scoped to the co-host's own cars in a co-host
  // session. A GLA admin gets every car, so narrow the picker to the cars that
  // actually have a co-host — the only ones this page can list.
  const { data: carsData } = useQuery<{ success: boolean; data: PaymentFilterCar[] }>({
    queryKey: ["/api/cars", "payments-filter"],
    queryFn: async () =>
      api.get("/api/cars", { query: { limit: 1000, status: "all" }, fallbackMessage: "Failed to fetch cars" }),
  });
  const { data: coHostCarsData } = useQuery<{ success: boolean; groups: { cars: { id: number }[] }[] }>({
    queryKey: ["/api/admin/all-co-host-cars"],
    queryFn: async () =>
      api.get("/api/admin/all-co-host-cars", { fallbackMessage: "Failed to fetch co-host cars" }),
    enabled: isAdmin && !isCoHost,
  });
  const coHostedIds = new Set((coHostCarsData?.groups ?? []).flatMap((g) => g.cars.map((c) => c.id)));
  const filterCars = (carsData?.data ?? []).filter((c) => isCoHost || coHostedIds.has(c.id));

  const { data: paymentsData, isLoading } = useQuery<{
    success: boolean;
    data: Payment[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["/api/payments/search", "co-host", ...list.queryKeyParts],
    queryFn: async () =>
      api.post("/api/payments/search", { ...list.searchBody, coHost: true }, {
        fallbackMessage: "Failed to fetch payments",
      }),
  });

  const payments = paymentsData?.data ?? [];
  const total = paymentsData?.total ?? 0;
  const totalPages = paymentsData?.totalPages ?? 1;

  const totals = payments.reduce(
    (acc, p) => ({
      split: acc.split + Number(p.payments_amount || 0),
      paid: acc.paid + Number(p.co_host_paid || 0),
      balance: acc.balance + Number(p.co_host_balance || 0),
    }),
    { split: 0, paid: 0, balance: 0 }
  );

  const rowLabel = (p: Payment) => `${formatYearMonth(p.payments_year_month)} · ${formatVehicleInfo(p)}`;
  const showActions = canEdit || canSeeHistory;
  const colCount = showActions ? 14 : 13;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-primary">Co-Host Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Payouts to co-hosts for their assigned cars. Separate from Client Payments.
          </p>
        </div>

        <PaymentFilterBar statuses={statuses} cars={filterCars} {...list.filterBarProps} />

        {/* Table card */}
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="table-fixed w-full min-w-[1300px] caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className={`${TH} text-left w-12`}>#</th>
                  <th className={`${TH} text-left w-24`}>Status</th>
                  <th className={`${TH} text-left w-32`}>Client</th>
                  <th className={`${TH} text-left w-28`}>Co-Host</th>
                  <th className={`${TH} text-left w-24 whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors uppercase"
                      title={sortOrder === "desc" ? "Sorted: newest first — click to reverse" : "Sorted: oldest first — click to reverse"}
                    >
                      Date <span className="text-primary">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    </button>
                  </th>
                  <th className={`${TH} text-left min-w-[180px]`}>Car</th>
                  <th className={`${TH} text-right w-32 whitespace-nowrap`}>Co-Host Split</th>
                  <th className={`${TH} text-right w-32 whitespace-nowrap`}>Paid Amount</th>
                  <th className={`${TH} text-right w-28`}>Balance</th>
                  <th className={`${TH} text-left w-24`}>Ref #</th>
                  <th className={`${TH} text-left w-28 whitespace-nowrap`}>Pmt Date</th>
                  <th className={`${TH} text-center w-16`}>Receipt</th>
                  <th className={`${TH} text-left min-w-[120px]`}>Remarks</th>
                  {showActions && <th className={`${TH} text-center w-24`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={colCount} className="text-center py-16 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="text-center py-16 text-muted-foreground">
                      No payment records found
                    </td>
                  </tr>
                ) : (
                  <>
                    {payments.map((p, i) => {
                      const balance = Number(p.co_host_balance || 0);
                      const balanceClass =
                        balance < 0 ? "text-red-600" : balance > 0 ? "text-emerald-600" : "text-muted-foreground";
                      return (
                        <tr key={p.payments_aid} className="border-b border-border/60 hover:bg-muted/40 transition-colors text-xs">
                          <td className="px-3 py-3 text-muted-foreground align-middle">{(page - 1) * effectivePageSize + i + 1}.</td>
                          <td className="px-3 py-3 align-middle">
                            <Badge
                              style={{ backgroundColor: statusColor(p), color: "#000" }}
                              className="text-[10px] font-medium px-2 py-0.5 rounded"
                            >
                              {p.co_host_status_name}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-foreground align-middle">{p.fullname}</td>
                          <td className="px-3 py-3 text-foreground align-middle">{p.co_host_name || "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground whitespace-nowrap align-middle">
                            {formatYearMonth(p.payments_year_month)}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground align-middle leading-snug">{formatVehicleInfo(p)}</td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap align-middle text-primary font-semibold">
                            {formatCurrency(Number(p.payments_amount || 0))}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap align-middle text-foreground">
                            {formatCurrency(Number(p.co_host_paid || 0))}
                          </td>
                          <td className={`px-3 py-3 text-right tabular-nums whitespace-nowrap font-medium align-middle ${balanceClass}`}>
                            {formatCurrency(balance)}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground align-middle truncate">{p.co_host_reference_number || "--"}</td>
                          <td className="px-3 py-3 text-muted-foreground whitespace-nowrap align-middle">
                            {formatMonthDayYear(p.co_host_invoice_date, "--")}
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReceiptFor(p)}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
                              title="View receipt"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </td>
                          <td className="px-3 py-3 max-w-[160px] truncate text-muted-foreground align-middle">
                            {p.co_host_remarks || "--"}
                          </td>
                          {showActions && (
                            <td className="px-3 py-3 text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {canSeeHistory && (
                                  <PaymentEditHistory
                                    paymentId={p.co_host_payment_id}
                                    basePath="/api/co-host-payments"
                                    label={rowLabel(p)}
                                  />
                                )}
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditing(p)}
                                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
                                    title="Edit co-host payment"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-muted/50 text-xs">
                      <td colSpan={6} className="px-3 py-3 text-right font-bold text-foreground uppercase tracking-wider">
                        Page Total
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{formatCurrency(totals.split)}</td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{formatCurrency(totals.paid)}</td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{formatCurrency(totals.balance)}</td>
                      <td colSpan={colCount - 9}></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <PaymentsPaginationFooter
            total={total}
            totalPages={totalPages}
            isLoading={isLoading}
            {...list.paginationProps}
          />
        </div>

        <CoHostPaymentModal
          payment={editing}
          label={editing ? rowLabel(editing) : ""}
          statuses={statuses}
          onClose={() => setEditing(null)}
        />

        {/* Co-host receipts only: no car id, so the modal does not pull the
            owner's Income & Expense receipts into the co-host payout. */}
        <PaymentReceiptModal
          isOpen={!!receiptFor}
          onClose={() => setReceiptFor(null)}
          payment={
            receiptFor
              ? {
                  payments_aid: receiptFor.co_host_payment_id ?? 0,
                  payments_year_month: receiptFor.payments_year_month,
                  payments_attachment: receiptFor.co_host_attachment,
                }
              : null
          }
        />
      </div>
    </AdminLayout>
  );
}
