import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtWhen } from "@/components/admin/ReceiptEditHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

interface PaymentAuditRow {
  id: number;
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
}

function fmtValue(field: string, v: string | null): string {
  if (v === null || v === "") return "—";
  if (field === "payments_amount" || field === "payments_amount_payout") {
    return `$${Number(v).toFixed(2)}`;
  }
  if (field === "payments_invoice_date") {
    // Stored as the calendar day (YYYY-MM-DD); show it as MM/DD/YYYY.
    const [y, m, d] = v.split("-");
    return y && m && d ? `${m}/${d}/${y}` : v;
  }
  if (field === "payments_attachment") return "file(s) attached";
  return v;
}

/**
 * Edit-history viewer for one client_payments row: who changed which field,
 * from what to what, and when. Admin-only — the backend rejects real co-host
 * sessions — so render the trigger only for admins.
 */
export function PaymentEditHistory({ paymentId, label }: { paymentId: number; label: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: PaymentAuditRow[] }>({
    queryKey: ["/api/payments", paymentId, "edit-history"],
    queryFn: async () =>
      api.get(`/api/payments/${paymentId}/edit-history`, {
        fallbackMessage: "Failed to load edit history",
      }),
    enabled: open,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
        title="Edit history"
      >
        <History className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Payment Edit History</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {label} — newest first.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No edits recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-foreground">{r.fieldLabel}</span>
                      <span className="text-muted-foreground">{fmtValue(r.field, r.oldValue)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">{fmtValue(r.field, r.newValue)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by {r.actorName || r.actorEmail || "Unknown"}
                      {r.actorName && r.actorEmail && <span className="ml-1">({r.actorEmail})</span>}
                      <span className="ml-2">{fmtWhen(r.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
