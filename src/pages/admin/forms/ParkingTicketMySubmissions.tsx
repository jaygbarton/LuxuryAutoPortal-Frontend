/**
 * Parking Ticket My Submissions
 * Read-only view of the current user's parking ticket submissions.
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
import { Loader2, Eye, ParkingCircle } from "lucide-react";

interface ParkingTicketRow {
  pt_aid: number;
  pt_client_email: string;
  pt_client_name: string;
  pt_car_label: string;
  pt_receipt_date: string;
  pt_amount: number | string;
  pt_receipt_url: string | null;
  pt_status: "new" | "approved" | "declined";
  pt_decline_reason: string | null;
  pt_decision_date: string | null;
  pt_decided_by: string | null;
  pt_date_submitted: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | string | null) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n)
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined")
    return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">New</Badge>;
}

export default function ParkingTicketMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<ParkingTicketRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/parking-tickets/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/parking-tickets/my"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: ParkingTicketRow[] = data?.data ?? [];

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
        <ParkingCircle className="h-10 w-10" />
        <p className="text-sm">No parking tickets submitted yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px]">Submitted</TableHead>
              <TableHead>Car</TableHead>
              <TableHead className="w-[120px]">Date of Receipt</TableHead>
              <TableHead className="text-right w-[110px]">Amount</TableHead>
              <TableHead className="text-center w-[100px]">Status</TableHead>
              <TableHead className="w-[60px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.pt_aid} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatDate(row.pt_date_submitted)}</TableCell>
                <TableCell className="text-sm font-medium">{row.pt_car_label}</TableCell>
                <TableCell className="text-sm">{formatDate(row.pt_receipt_date)}</TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(row.pt_amount)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.pt_status} />
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

      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Parking Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatDate(selectedRow.pt_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={selectedRow.pt_status} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car</p>
                  <p className="font-medium">{selectedRow.pt_car_label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date of Receipt</p>
                  <p className="font-medium">{formatDate(selectedRow.pt_receipt_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Amount</p>
                  <p className="font-medium font-mono">{formatCurrency(selectedRow.pt_amount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receipt</p>
                  {selectedRow.pt_receipt_url ? (
                    <a
                      href={selectedRow.pt_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline font-medium"
                    >
                      View receipt
                    </a>
                  ) : (
                    <p className="text-muted-foreground">No receipt attached</p>
                  )}
                </div>
                {selectedRow.pt_decision_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Decision Date</p>
                    <p className="font-medium">{formatDate(selectedRow.pt_decision_date)}</p>
                  </div>
                )}
                {selectedRow.pt_status === "declined" && selectedRow.pt_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{selectedRow.pt_decline_reason}</p>
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
