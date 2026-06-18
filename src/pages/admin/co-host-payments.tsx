import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import { buildApiUrl, authMeQueryFn } from "@/lib/queryClient";

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
      month: "long",
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
function usePaymentUpdate(paymentId: number, queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(buildApiUrl(`/api/payments/${paymentId}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update payment");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKey as string[] }),
  });
}

// Inline-editable Paid cell — only rendered for admins.
function EditablePaidCell({
  payment,
  queryKey,
}: {
  payment: Payment;
  queryKey: readonly unknown[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(payment.payments_amount_payout || 0).toFixed(2)));
  const { mutate, isPending } = usePaymentUpdate(payment.payments_aid, queryKey);

  const save = () => mutate({ paymentsAmountPayout: Number(value) });

  if (!editing) {
    return (
      <span className="flex items-center justify-end gap-1 group">
        <span>{fmt(payment.payments_amount_payout)}</span>
        <button
          onClick={() => {
            setValue(String(Number(payment.payments_amount_payout || 0).toFixed(2)));
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="Edit paid amount"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { save(); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 text-xs px-1 py-0.5 border border-border rounded bg-background text-right"
      />
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button onClick={() => { save(); setEditing(false); }} className="text-green-600 hover:text-green-700">
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

// Inline-editable Payment Date cell.
function EditableDateCell({
  payment,
  queryKey,
}: {
  payment: Payment;
  queryKey: readonly unknown[];
}) {
  const [editing, setEditing] = useState(false);
  // Convert stored UTC date to YYYY-MM-DD for the date input
  const toInputValue = (d: string | null): string => {
    if (!d) return "";
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(d));
    } catch {
      return d.slice(0, 10);
    }
  };
  const [value, setValue] = useState(toInputValue(payment.payments_invoice_date));
  const { mutate, isPending } = usePaymentUpdate(payment.payments_aid, queryKey);

  const save = () => mutate({ paymentsInvoiceDate: value || null });

  const displayDate = payment.payments_invoice_date
    ? new Date(payment.payments_invoice_date).toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  if (!editing) {
    return (
      <span className="flex items-center gap-1 group whitespace-nowrap">
        <span>{displayDate}</span>
        <button
          onClick={() => { setValue(toInputValue(payment.payments_invoice_date)); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="Edit payment date"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="date"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { save(); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="text-xs px-1 py-0.5 border border-border rounded bg-background"
      />
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button onClick={() => { save(); setEditing(false); }} className="text-green-600 hover:text-green-700">
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

// Inline-editable Reference # cell.
function EditableRefCell({
  payment,
  queryKey,
}: {
  payment: Payment;
  queryKey: readonly unknown[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(payment.payments_reference_number || "");
  const { mutate, isPending } = usePaymentUpdate(payment.payments_aid, queryKey);

  const save = () => mutate({ paymentsReferenceNumber: value });

  if (!editing) {
    return (
      <span className="flex items-center gap-1 group font-mono">
        <span>{payment.payments_reference_number || "—"}</span>
        <button
          onClick={() => { setValue(payment.payments_reference_number || ""); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title="Edit reference #"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        autoFocus
        placeholder="Ref #"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { save(); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-28 text-xs px-1 py-0.5 border border-border rounded bg-background font-mono"
      />
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      ) : (
        <>
          <button onClick={() => { save(); setEditing(false); }} className="text-green-600 hover:text-green-700">
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

export default function CoHostPaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);

  const { data: meData } = useQuery<{ user?: { isAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = !!(meData?.user as any)?.isAdmin;

  const paymentsQueryKey = ["/api/payments/search", "co-host", page, pageSize] as const;

  const { data: paymentsData, isLoading } = useQuery<{
    success: boolean;
    data: Payment[];
    total: number;
    totalPages: number;
  }>({
    queryKey: paymentsQueryKey,
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/payments/search"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carActiveStatus: "active",
          coHost: true,
          page,
          limit: pageSize,
          sortOrder: "desc",
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const payments = paymentsData?.data ?? [];
  const total = paymentsData?.total ?? 0;
  const totalPages = paymentsData?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Co-Host Payments</h1>
          <p className="text-muted-foreground text-sm">
            View payments for co-host assigned cars.
          </p>
        </div>

        <Card className="bg-card border-border overflow-hidden">
          {isLoading ? (
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : payments.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <p className="text-sm">No payments found for your cars.</p>
            </CardContent>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">#</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Status</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Date</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Car</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 hidden sm:table-cell">Client</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Co-Host</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Co-Host Split</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">
                        <span className="flex items-center justify-end gap-1.5">
                          Paid
                          {isAdmin && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded px-1 py-0.5">
                              Editable
                            </span>
                          )}
                        </span>
                      </th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Balance</th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          Payment Date
                          {isAdmin && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded px-1 py-0.5">
                              Editable
                            </span>
                          )}
                        </span>
                      </th>
                      <th className="text-left font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          Reference #
                          {isAdmin && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded px-1 py-0.5">
                              Editable
                            </span>
                          )}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p, i) => (
                      <tr key={p.payments_aid} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className="text-xs font-semibold text-foreground border-border bg-muted/40"
                          >
                            {p.payment_status_name}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatYearMonth(p.payments_year_month)}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="font-medium leading-tight whitespace-nowrap">
                            {[
                              p.car_make_name || p.car_make_model,
                              p.car_year,
                              p.car_vin_number ? `- ${p.car_vin_number}` : null,
                              p.car_plate_number ? `- #${p.car_plate_number}` : null,
                            ].filter(Boolean).join(" ") || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                          {p.client_fname || p.client_lname
                            ? [p.client_fname, p.client_lname].filter(Boolean).join(" ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.co_host_name || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-primary font-medium">
                          {fmt(p.payments_amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground hidden md:table-cell">
                          {isAdmin ? (
                            <EditablePaidCell payment={p} queryKey={paymentsQueryKey} />
                          ) : (
                            fmt(p.payments_amount_payout)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right hidden md:table-cell">
                          <span className={Number(p.payments_amount_balance) < 0 ? "text-red-500" : "text-muted-foreground"}>
                            {fmt(p.payments_amount_balance)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {isAdmin ? (
                            <EditableDateCell payment={p} queryKey={paymentsQueryKey} />
                          ) : (
                            p.payments_invoice_date
                              ? new Date(p.payments_invoice_date).toLocaleDateString("en-US", {
                                  timeZone: "America/Denver",
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {isAdmin ? (
                            <EditableRefCell payment={p} queryKey={paymentsQueryKey} />
                          ) : (
                            <span className="font-mono">{p.payments_reference_number || "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="border-border text-muted-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="border-border text-muted-foreground"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
