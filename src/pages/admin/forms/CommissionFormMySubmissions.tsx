/**
 * Commission Form My Submissions
 * Read-only view of the current employee's commission form submissions
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
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
import { Loader2, Eye, FileText, ExternalLink, DollarSign, ZoomIn, X } from "lucide-react";

interface CommissionFormRow {
  cf_aid: number;
  cf_employee_id: number;
  cf_date_submitted: string;
  cf_approval_date: string | null;
  cf_approved_by: string | null;
  cf_commission_date: string;
  cf_commission_type: string;
  cf_car_name: string;
  cf_total_receipt_cost: number;
  cf_remarks: string | null;
  cf_receipt_url: string | null;
  cf_status: "pending" | "approved" | "declined";
  cf_decline_reason: string | null;
  employee_name?: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined") return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}


export default function CommissionFormMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<CommissionFormRow | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/commission-forms/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/commission-forms/my"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: CommissionFormRow[] = data?.data ?? [];

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
        <DollarSign className="h-10 w-10" />
        <p className="text-sm">No commission forms submitted yet.</p>
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
              <TableHead className="w-[110px]">Commission Date</TableHead>
              <TableHead>Commission Type</TableHead>
              <TableHead>Car Name</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px] text-center">Status</TableHead>
              <TableHead className="w-[70px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cf_aid} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatDate(row.cf_date_submitted)}</TableCell>
                <TableCell className="text-sm">{formatDate(row.cf_commission_date)}</TableCell>
                <TableCell className="text-sm font-medium">{row.cf_commission_type}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate" title={row.cf_car_name}>
                  {row.cf_car_name}
                </TableCell>
                <TableCell
                  className="text-sm max-w-[240px] truncate text-muted-foreground"
                  title={row.cf_remarks ?? ""}
                >
                  {row.cf_remarks?.trim() || "—"}
                </TableCell>
                <TableCell className="text-sm text-right font-mono">
                  {formatCurrency(row.cf_total_receipt_cost)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.cf_status} />
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

      {/* Receipt Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={lightboxUrl}
            alt="Receipt full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) setSelectedRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Commission Form Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date Submitted</p>
                  <p className="font-medium">{formatDate(selectedRow.cf_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={selectedRow.cf_status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Date</p>
                  <p className="font-medium">{formatDate(selectedRow.cf_commission_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Type</p>
                  <p className="font-medium">{selectedRow.cf_commission_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car Name</p>
                  <p className="font-medium">{selectedRow.cf_car_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Receipt Cost</p>
                  <p className="font-medium font-mono">{formatCurrency(selectedRow.cf_total_receipt_cost)}</p>
                </div>
                {selectedRow.cf_approval_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approval Date</p>
                    <p className="font-medium">{formatDate(selectedRow.cf_approval_date)}</p>
                  </div>
                )}
                {selectedRow.cf_approved_by && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approved By</p>
                    <p className="font-medium">{selectedRow.cf_approved_by}</p>
                  </div>
                )}
                {selectedRow.cf_remarks && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Remarks</p>
                    <p className="font-medium">{selectedRow.cf_remarks}</p>
                  </div>
                )}
                {selectedRow.cf_status === "declined" && selectedRow.cf_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{selectedRow.cf_decline_reason}</p>
                  </div>
                )}
              </div>

              {selectedRow.cf_receipt_url && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Receipt</p>
                  {selectedRow.cf_receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <button
                      type="button"
                      className="relative group block w-fit"
                      onClick={() => setLightboxUrl(getProxiedImageUrl(selectedRow.cf_receipt_url ?? ""))}
                    >
                      <img
                        src={getProxiedImageUrl(selectedRow.cf_receipt_url ?? "")}
                        alt="Receipt"
                        className="max-h-48 rounded-md object-contain border border-border transition-opacity group-hover:opacity-80"
                      />
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="h-7 w-7 text-white drop-shadow-lg" />
                      </span>
                    </button>
                  ) : (
                    <a
                      href={getProxiedImageUrl(selectedRow.cf_receipt_url ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      View Receipt
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
