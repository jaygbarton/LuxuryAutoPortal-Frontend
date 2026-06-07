import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

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
  car_make_model: string;
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
  client_fname: string;
  client_lname: string;
  fullname: string;
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

export default function CoHostPaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);

  const { data: paymentsData, isLoading } = useQuery<{
    success: boolean;
    data: Payment[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["/api/payments/search", "co-host", page, pageSize],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/payments/search"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carActiveStatus: "active",
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
            Payments for your assigned cars.
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
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5">Car Owner Split</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Paid</th>
                      <th className="text-right font-medium text-muted-foreground uppercase tracking-wider px-3 py-2.5 hidden md:table-cell">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p, i) => (
                      <tr key={p.payments_aid} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              backgroundColor: `${p.payment_status_color}22`,
                              color: p.payment_status_color,
                              borderColor: `${p.payment_status_color}44`,
                            }}
                          >
                            {p.payment_status_name}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatYearMonth(p.payments_year_month)}
                        </td>
                        <td className="px-3 py-2 text-foreground max-w-[180px]">
                          <div className="truncate">
                            {[p.car_year, p.car_make_model].filter(Boolean).join(" ")}
                          </div>
                          {p.car_plate_number && (
                            <div className="text-muted-foreground text-[10px] truncate">#{p.car_plate_number}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                          {p.fullname || [p.client_fname, p.client_lname].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-primary font-medium">
                          {fmt(p.payments_amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground hidden md:table-cell">
                          {fmt(p.payments_amount_payout)}
                        </td>
                        <td className="px-3 py-2 text-right hidden md:table-cell">
                          <span className={Number(p.payments_amount_balance) < 0 ? "text-red-500" : "text-muted-foreground"}>
                            {fmt(p.payments_amount_balance)}
                          </span>
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
