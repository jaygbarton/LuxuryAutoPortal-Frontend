/**
 * Shows the Form Amount / Manual Amount / Total Amount breakdown for a single
 * I&E cell inside every category edit modal (Income, Direct Delivery, COGS,
 * Reimbursed Bills).
 *
 * Behavior matches the product spec:
 *   - Form Amount is read-only and sourced from approved expense form
 *     submissions (auto-added on approval, auto-removed on decline/delete).
 *   - Manual Amount is the editable I&E value stored in the income_expense
 *     table. Deleting it (setting to 0) leaves the Form Amount intact.
 *   - Total Amount = Form Amount + Manual Amount (live).
 */

import React from "react";
import { Label } from "@/components/ui/label";
import { Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface AmountBreakdownProps {
  formAmount: number;
  manualAmount: number;
  className?: string;
}

export default function AmountBreakdown({ formAmount, manualAmount, className }: AmountBreakdownProps) {
  const total = formAmount + manualAmount;
  const hasForm = formAmount > 0;

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-3 space-y-2", className)}>
      <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" />
        Amount Breakdown
      </Label>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className={cn("text-muted-foreground", hasForm && "text-primary")}>
            Form Amount
            {hasForm && (
              <span className="ml-1 text-[10px] uppercase tracking-wide">
                (from approved submissions)
              </span>
            )}
          </span>
          <span className={cn("tabular-nums", hasForm ? "text-primary font-medium" : "text-muted-foreground")}>
            ${formAmount.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Manual Amount</span>
          <span className="tabular-nums text-foreground">${manualAmount.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-border">
          <span className="text-foreground font-semibold">Total Amount</span>
          <span className="tabular-nums text-foreground font-semibold">${total.toFixed(2)}</span>
        </div>
      </div>

      {hasForm && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The Form Amount is auto-managed from approved expense form submissions. Deleting it
          here is not possible — decline or remove the submission in <em>Forms</em> and it will
          be removed automatically. Deleting the Manual Amount leaves the Form Amount in place.
        </p>
      )}
    </div>
  );
}
