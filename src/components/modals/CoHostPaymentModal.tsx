import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface CoHostPaymentRow {
  payments_car_id: number;
  payments_year_month: string;
  /** Live Co-Host Split for the car-month. */
  payments_amount: number | string;
  co_host_payment_id: number | null;
  co_host_paid: number | string;
  co_host_reference_number: string | null;
  co_host_invoice_date: string | null;
  co_host_remarks: string | null;
  co_host_attachment: string | null;
  co_host_status_id: number | null;
  co_host_status_name: string;
}

interface Props {
  payment: CoHostPaymentRow | null;
  /** Human label for the header, e.g. "06/2026 · Kia Rio 2019 · #MBB5890". */
  label: string;
  statuses: { payment_status_aid: number; payment_status_name: string }[];
  onClose: () => void;
}

// The payment date is a DATE column — a calendar day with no time or zone.
// mysql2 (pool timezone "Z") sends it as "YYYY-MM-DDT00:00:00.000Z", so the
// day is the leading YYYY-MM-DD. Converting that midnight-UTC instant to any
// US zone lands on the PREVIOUS day (08/13 read back as 08/12), and re-saving
// would then store the wrong day.
function toDateInputValue(d: string | null): string {
  return d ? d.slice(0, 10) : "";
}

function receiptCount(attachment: string | null): number {
  if (!attachment) return 0;
  try {
    const parsed = JSON.parse(attachment);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Edit what GLA paid the co-host for one car-month. Saves to
 * PUT /api/co-host-payments (the co_host_payments ledger) — never to the car
 * owner's client_payments row, so Client Payments' Paid Amount is untouched.
 */
export function CoHostPaymentModal({ payment, label, statuses, onClose }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusId, setStatusId] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!payment) return;
    const toPay = statuses.find((s) => s.payment_status_name.toLowerCase() === "to pay");
    setStatusId(String(payment.co_host_status_id ?? toPay?.payment_status_aid ?? ""));
    setPaid(Number(payment.co_host_paid || 0).toFixed(2));
    setPaymentDate(toDateInputValue(payment.co_host_invoice_date));
    setReferenceNumber(payment.co_host_reference_number || "");
    setRemarks(payment.co_host_remarks || "");
    setFiles([]);
  }, [payment, statuses]);

  const split = Number(payment?.payments_amount || 0);
  const balance = (Number(paid) || 0) - split;

  const save = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("carId", String(payment!.payments_car_id));
      fd.append("yearMonth", payment!.payments_year_month);
      if (statusId) fd.append("statusId", statusId);
      fd.append("amountPayout", paid || "0");
      fd.append("invoiceDate", paymentDate);
      fd.append("referenceNumber", referenceNumber);
      fd.append("remarks", remarks);
      for (const f of files) fd.append("receiptFiles", f);
      return api.put("/api/co-host-payments", fd, {
        upload: true,
        fallbackMessage: "Failed to save co-host payment",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/co-host-payments"] });
      toast({ title: "Co-host payment saved" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const existingReceipts = receiptCount(payment?.co_host_attachment ?? null);

  return (
    <Dialog open={!!payment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="bg-card border-border text-foreground max-w-2xl max-h-[92vh] overflow-y-auto p-0"
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-radix-select-content]")) e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground text-xl font-semibold">Edit Co-Host Payment</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {label}. This records the payout to the co-host only — the car owner's Client Payment is not changed.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="px-6 py-5 space-y-6"
        >
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</h4>
            <Select value={statusId} onValueChange={setStatusId} disabled={save.isPending}>
              <SelectTrigger className="bg-card border-border text-foreground h-10 sm:w-1/2">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground z-[4100]">
                {statuses.map((s) => (
                  <SelectItem key={s.payment_status_aid} value={String(s.payment_status_aid)}>
                    {s.payment_status_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amounts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Co-Host Split</Label>
                <Input value={split.toFixed(2)} readOnly disabled className="bg-background border-border mt-1 h-10" />
                <p className="text-[11px] text-muted-foreground mt-1">From Income & Expense (auto)</p>
              </div>
              <div>
                <Label htmlFor="chp-paid" className="text-muted-foreground text-xs">Paid Amount</Label>
                <Input
                  id="chp-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  disabled={save.isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">Amount paid to the co-host</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Balance</Label>
                <Input
                  value={balance.toFixed(2)}
                  disabled
                  className={`bg-background border-border mt-1 h-10 font-semibold ${
                    balance < 0 ? "text-red-500" : balance > 0 ? "text-emerald-500" : "text-foreground"
                  }`}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Paid Amount − Co-Host Split</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chp-ref" className="text-muted-foreground text-xs">Reference Number</Label>
                <Input
                  id="chp-ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={save.isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  placeholder="e.g. Zelle #12345"
                />
              </div>
              <div>
                <Label htmlFor="chp-date" className="text-muted-foreground text-xs">Payment Date</Label>
                <Input
                  id="chp-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={save.isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt</h4>
            {existingReceipts > 0 && (
              <p className="text-xs text-muted-foreground">
                {existingReceipts} saved file{existingReceipts === 1 ? "" : "s"} — new uploads are added alongside.
              </p>
            )}
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).filter((f) => f.size > 0))}
              disabled={save.isPending}
              className="bg-muted border-border text-foreground"
            />
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</h4>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={save.isPending}
              className="bg-muted border-border text-foreground"
              rows={3}
            />
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
