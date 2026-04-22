import React, { useState } from "react";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PaymentReceiptModal } from "@/components/modals/PaymentReceiptModal";
import { fmt, getMonthLabel } from "./utils";
import type { Payment } from "./types";

interface PaymentHistoryCardProps {
  payments: Payment[];
  isLoading: boolean;
}

export function PaymentHistoryCard({ payments, isLoading }: PaymentHistoryCardProps) {
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase text-foreground tracking-wide">
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d]" />
          </div>
        ) : payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#1a1a1a" }}>
                <TableHead className="text-white font-semibold text-xs py-3">Month</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3 text-right">Car Owner Split</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3 text-right">Amount Paid</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3 text-right">Balance</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3">Payment Date</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3 text-center">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.payments_aid} className="border-border hover:bg-muted/30">
                  <TableCell className="text-sm py-2 font-medium">{getMonthLabel(p.payments_year_month)}</TableCell>
                  <TableCell className="text-sm py-2 text-right text-[#d3bc8d]">{fmt(p.payments_amount_payout)}</TableCell>
                  <TableCell className="text-sm py-2 text-right">{fmt(p.payments_amount)}</TableCell>
                  <TableCell className="text-sm py-2 text-right">
                    <span className={p.payments_amount_balance >= 0 ? "text-green-400" : "text-red-400"}>
                      {fmt(p.payments_amount_balance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{p.payments_invoice_date ?? "—"}</TableCell>
                  <TableCell className="text-center py-2">
                    {p.payments_attachment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReceiptPayment(p)}
                        className="text-[#d3bc8d] hover:text-[#c2a671] h-7 w-7 p-0"
                        title="View Receipt"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
            <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-sm">No payment records found</p>
          </div>
        )}
      </CardContent>

      {receiptPayment && (
        <PaymentReceiptModal
          isOpen={true}
          onClose={() => setReceiptPayment(null)}
          payment={receiptPayment}
        />
      )}
    </Card>
  );
}
