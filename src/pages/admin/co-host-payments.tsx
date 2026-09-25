import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { authMeQueryFn } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useCoHost } from "@/hooks/use-co-host";
import {
  PaymentFilterBar,
  type PaymentFilterCar,
  type PaymentFilterStatus,
} from "@/components/admin/payments/PaymentFilterBar";
import { usePaymentListState } from "@/components/admin/payments/usePaymentListState";
import { PaymentsPaginationFooter } from "@/components/admin/payments/PaymentsPaginationFooter";
import { PaymentEditHistory } from "@/components/admin/payments/PaymentEditHistory";

interface Payment {
  payments_aid: number;
  payments_car_id: number;
  payments_year_month: string;
  payments_amount: number;
  payments_amount_payout: number;
  payments_amount_balance: number;
  payments_reference_number: string;
  payments_invoice_date: string | null;
  payments_remarks: string | null;
  payment_status_name: string;
  payment_status_color: string;
  car_make_name: string;
  car_make_model: string; // fallback alias
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
  client_fname: string;
  client_lname: string;
  fullname: string;
  co_host_name: string | null;
}

function formatYearMonth(ym: string): string {
  try {
    const [year, month] = ym.split("-");
    return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return ym;
  }
}

function fmt(n: number | string): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

// Shared mutation helper — sends a partial update to PUT /api/payments/:id
function usePaymentUpdate(paymentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      return api.put(`/api/payments/${paymentId}`, body, {
        fallbackMessage: "Failed to update payment",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", paymentId, "edit-history"] });
    },
  });
}

// Inline-editable cell — only rendered for GLA admins. Shows `display` with a
// hover pencil; editing opens an input and saves `toBody(value)`.
function InlineEditCell({
  paymentId,
  display,
  initialValue,
  toBody,
  title,
  inputType,
  inputClassName,
  placeholder,
  alignEnd,
  mono,
}: {
  paymentId: number;
  display: string;
  initialValue: string;
  toBody: (value: string) => Record<string, unknown>;
  title: string;
  inputType: "number" | "date" | "text";
  inputClassName: string;
  placeholder?: string;
  alignEnd?: boolean;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const { mutate, isPending } = usePaymentUpdate(paymentId);

  const save = () => { mutate(toBody(value)); setEditing(false); };
  const justify = alignEnd ? "justify-end" : "";

  if (!editing) {
    return (
      <span className={`flex items-center ${justify} gap-1 group whitespace-nowrap ${mono ? "font-mono" : ""}`}>
        <span>{display}</span>
        <button
          onClick={() => { setValue(initialValue); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title={title}
        >
          <Pencil className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className={`flex items-center ${justify} gap-1`}>
      <input
        type={inputType}
        {...(inputType === "number" ? { step: "0.01", min: "0" } : {})}
        value={value}
        autoFocus
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`text-xs px-1 py-0.5 border border-border rounded bg-background ${inputClassName}`}
      />
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button onClick={save} className="text-green-600 hover:text-green-700">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        </>
      )}
    </span>
  );
}

// Deliberately pinned to America/Denver, not the viewer's timezone: this
// round-trips through an <input type="date"> that SAVES the edited value
// back as paymentsInvoiceDate. An invoice date is a specific calendar day,
// and a Manila-based admin editing this must see and save the same day a
// Utah-based admin would, or the two would silently disagree on which day
// the invoice is dated. Convert stored UTC date to YYYY-MM-DD for the input.
function toDateInputValue(d: string | null): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(d));
  } catch {
    return d.slice(0, 10);
  }
}

function EditablePaidCell({ payment }: { payment: Payment }) {
  return (
    <InlineEditCell
      paymentId={payment.payments_aid}
      display={fmt(payment.payments_amount_payout)}
      initialValue={Number(payment.payments_amount_payout || 0).toFixed(2)}
      toBody={(v) => ({ paymentsAmountPayout: Number(v) })}
      title="Edit paid amount"
      inputType="number"
      inputClassName="w-20 text-right"
      alignEnd
    />
  );
}

function EditableDateCell({ payment }: { payment: Payment }) {
  return (
    <InlineEditCell
      paymentId={payment.payments_aid}
      display={formatInvoiceDate(payment.payments_invoice_date)}
      initialValue={toDateInputValue(payment.payments_invoice_date)}
      toBody={(v) => ({ paymentsInvoiceDate: v || null })}
      title="Edit payment date"
      inputType="date"
      inputClassName=""
    />
  );
}

function EditableRefCell({ payment }: { payment: Payment }) {
  return (
    <InlineEditCell
      paymentId={payment.payments_aid}
      display={payment.payments_reference_number || "—"}
      initialValue={payment.payments_reference_number || ""}
      toBody={(v) => ({ paymentsReferenceNumber: v })}
      title="Edit reference #"
      inputType="text"
      inputClassName="w-28 font-mono"
      placeholder="Ref #"
      mono
    />
  );
}

const TH = "h-11 px-3 font-semibold text-foreground text-[11px] uppercase tracking-wider whitespace-nowrap";

function EditableBadge() {
  return (
    <span className="text-[9px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded px-1 py-0.5">
      Editable
    </span>
  );
}

function formatInvoiceDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "—";
}

function formatCar(p: Payment): string {
  return [
    p.car_make_name || p.car_make_model,
    p.car_year,
    p.car_vin_number ? `- ${p.car_vin_number}` : null,
    p.car_plate_number ? `- #${p.car_plate_number}` : null,
  ].filter(Boolean).join(" ") || "—";
}

export default function CoHostPaymentsPage() {
  const list = usePaymentListState();
  const { sortOrder, setSortOrder, page, effectivePageSize } = list;

  const { data: meData } = useQuery<{ user?: { isAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = !!(meData?.user as any)?.isAdmin;
  // Payment writes are requireAdminNotCoHost on the backend, which rejects any
  // co-host session (a real co-host login AND an admin using "View as
  // Co-Host"), so only offer the inline editors to a plain GLA admin.
  // Edit history is readable by any admin, including one viewing as a
  // co-host, but never by a real co-host login.
  const { isCoHost, isRealCoHost } = useCoHost();
  const canEdit = isAdmin && !isCoHost;
  const canSeeHistory = isAdmin && !isRealCoHost;

  const { data: statusesData } = useQuery<{ success: boolean; data: PaymentFilterStatus[] }>({
    queryKey: ["/api/payment-status"],
    queryFn: async () => api.get("/api/payment-status", { fallbackMessage: "Failed to fetch payment statuses" }),
  });
  const statuses = statusesData?.data ?? [];

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
    queryKey: [
      "/api/payments/search",
      "co-host",
      ...list.queryKeyParts,
    ],
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
      paid: acc.paid + Number(p.payments_amount_payout || 0),
      balance: acc.balance + Number(p.payments_amount_balance || 0),
    }),
    { split: 0, paid: 0, balance: 0 }
  );

  const colCount = canSeeHistory ? 12 : 11;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-primary">Co-Host Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View payments for co-host assigned cars.
          </p>
        </div>

        <PaymentFilterBar
          statuses={statuses}
          cars={filterCars}
          {...list.filterBarProps}
        />

        {/* Table card */}
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[1200px] caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className={`${TH} text-left w-12`}>#</th>
                  <th className={`${TH} text-left`}>Status</th>
                  <th className={`${TH} text-left`}>
                    <button
                      type="button"
                      onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors uppercase"
                      title={sortOrder === "desc" ? "Sorted: newest first — click to reverse" : "Sorted: oldest first — click to reverse"}
                    >
                      Date <span className="text-primary">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    </button>
                  </th>
                  <th className={`${TH} text-left`}>Car</th>
                  <th className={`${TH} text-left`}>Client</th>
                  <th className={`${TH} text-left`}>Co-Host</th>
                  <th className={`${TH} text-right`}>Co-Host Split</th>
                  <th className={`${TH} text-right`}>
                    <span className="flex items-center justify-end gap-1.5">Paid {canEdit && <EditableBadge />}</span>
                  </th>
                  <th className={`${TH} text-right`}>Balance</th>
                  <th className={`${TH} text-left`}>
                    <span className="flex items-center gap-1.5">Payment Date {canEdit && <EditableBadge />}</span>
                  </th>
                  <th className={`${TH} text-left`}>
                    <span className="flex items-center gap-1.5">Reference # {canEdit && <EditableBadge />}</span>
                  </th>
                  {canSeeHistory && <th className={`${TH} text-center w-20`}>History</th>}
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
                    {payments.map((p, i) => (
                      <tr key={p.payments_aid} className="border-b border-border/60 hover:bg-muted/40 transition-colors text-xs">
                        <td className="px-3 py-3 text-muted-foreground">{(page - 1) * effectivePageSize + i + 1}.</td>
                        <td className="px-3 py-3">
                          <Badge
                            style={{ backgroundColor: p.payment_status_color, color: "#000" }}
                            className="text-[10px] font-medium px-2 py-0.5 rounded"
                          >
                            {p.payment_status_name}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {formatYearMonth(p.payments_year_month)}
                        </td>
                        <td className="px-3 py-3 text-foreground font-medium leading-snug">{formatCar(p)}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {p.client_fname || p.client_lname
                            ? [p.client_fname, p.client_lname].filter(Boolean).join(" ")
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{p.co_host_name || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-primary font-semibold whitespace-nowrap">
                          {fmt(p.payments_amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground whitespace-nowrap">
                          {canEdit ? <EditablePaidCell payment={p} /> : fmt(p.payments_amount_payout)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          <span className={Number(p.payments_amount_balance) < 0 ? "text-red-500" : "text-muted-foreground"}>
                            {fmt(p.payments_amount_balance)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                          {canEdit ? <EditableDateCell payment={p} /> : formatInvoiceDate(p.payments_invoice_date)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {canEdit ? (
                            <EditableRefCell payment={p} />
                          ) : (
                            <span className="font-mono">{p.payments_reference_number || "—"}</span>
                          )}
                        </td>
                        {canSeeHistory && (
                          <td className="px-3 py-3 text-center">
                            <PaymentEditHistory
                              paymentId={p.payments_aid}
                              label={`${formatYearMonth(p.payments_year_month)} · ${formatCar(p)}`}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/50 text-xs">
                      <td colSpan={6} className="px-3 py-3 text-right font-bold text-foreground uppercase tracking-wider">
                        Page Total
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{fmt(totals.split)}</td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{fmt(totals.paid)}</td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap">{fmt(totals.balance)}</td>
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
            {...list.paginationProps}
            isLoading={isLoading}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
