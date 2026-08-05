/**
 * Referral Form My Submissions
 * Read-only view of the current user's referral form submissions.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Eye, Users } from "lucide-react";

interface ReferralRow {
  rf_aid: number;
  rf_client_email: string;
  rf_client_name: string;
  rf_date: string;
  rf_referral_first_name: string;
  rf_referral_last_name: string;
  rf_referral_phone_number: string;
  rf_referral_email_address: string;
  rf_status: "pending" | "approved" | "declined";
  rf_decline_reason: string | null;
  rf_approval_date: string | null;
  rf_approved_by: string | null;
  rf_commission_amount: number | null;
  rf_commission_status: "paid" | "unpaid" | "in_review" | null;
  rf_date_submitted: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | string | null) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined") return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}

function CommissionStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "paid") return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
  if (status === "unpaid") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Unpaid</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Review</Badge>;
}

export default function ReferralFormMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<ReferralRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/referral-forms/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/referral-forms/my"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: ReferralRow[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive py-4">Failed to load your submissions.</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Users className="h-10 w-10" />
        <p className="text-sm">No referral forms submitted yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px]">Date Submitted</TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Referral Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[110px]">Commission</TableHead>
              <TableHead className="text-center w-[100px]">Pay Status</TableHead>
              <TableHead className="w-[60px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.rf_aid} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatDate(row.rf_date_submitted)}</TableCell>
                <TableCell className="text-sm">{formatDate(row.rf_date)}</TableCell>
                <TableCell className="text-sm font-medium">
                  {row.rf_referral_first_name} {row.rf_referral_last_name}
                </TableCell>
                <TableCell className="text-sm">{row.rf_referral_phone_number}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate" title={row.rf_referral_email_address}>
                  {row.rf_referral_email_address}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.rf_status} />
                </TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(row.rf_commission_amount)}
                </TableCell>
                <TableCell className="text-center">
                  <CommissionStatusBadge status={row.rf_commission_status} />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedRow(row)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) setSelectedRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Referral Form Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date Submitted</p>
                  <p className="font-medium">{formatDate(selectedRow.rf_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={selectedRow.rf_status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date</p>
                  <p className="font-medium">{formatDate(selectedRow.rf_date)}</p>
                </div>
                {selectedRow.rf_approval_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approval Date</p>
                    <p className="font-medium">{formatDate(selectedRow.rf_approval_date)}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Referral Name</p>
                  <p className="font-medium">
                    {selectedRow.rf_referral_first_name} {selectedRow.rf_referral_last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Phone</p>
                  <p className="font-medium">{selectedRow.rf_referral_phone_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Email</p>
                  <p className="font-medium">{selectedRow.rf_referral_email_address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission</p>
                  <p className="font-medium font-mono">{formatCurrency(selectedRow.rf_commission_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Status</p>
                  <CommissionStatusBadge status={selectedRow.rf_commission_status} />
                </div>
                {selectedRow.rf_status === "declined" && selectedRow.rf_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{selectedRow.rf_decline_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
