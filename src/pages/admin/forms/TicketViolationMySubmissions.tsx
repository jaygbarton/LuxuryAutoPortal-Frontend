/**
 * Ticket Violation My Submissions
 * Read-only view of the current user's ticket violation submissions + status.
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
import { Loader2, Eye, FileWarning } from "lucide-react";

interface TicketViolationRow {
  tv_aid: number;
  tv_client_email: string;
  tv_client_name: string;
  tv_car_label: string;
  tv_violation_type: string | null;
  tv_violation_date: string | null;
  tv_due_date: string | null;
  tv_amount_due: number | string | null;
  tv_total_payment: number | string | null;
  tv_photos: string[];
  tv_status: string;
  tv_date_submitted: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  charged_guest: "Charged the Guest",
  paid: "Paid",
  disputed: "Disputed",
};

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
  const label = STATUS_LABELS[status] || status;
  const cls =
    status === "paid"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "disputed"
      ? "bg-red-100 text-red-800 border-red-200"
      : status === "charged_guest"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-blue-100 text-blue-800 border-blue-200";
  return <Badge className={cls}>{label}</Badge>;
}

export default function TicketViolationMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<TicketViolationRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/ticket-violations/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/ticket-violations/my"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: TicketViolationRow[] = data?.data ?? [];

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
        <FileWarning className="h-10 w-10" />
        <p className="text-sm">No ticket violations submitted yet.</p>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-sm font-medium text-foreground mb-3">My Submissions</h3>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px]">Submitted</TableHead>
              <TableHead>Car</TableHead>
              <TableHead className="w-[130px]">Violation</TableHead>
              <TableHead className="w-[110px]">Due Date</TableHead>
              <TableHead className="text-right w-[110px]">Amount</TableHead>
              <TableHead className="text-center w-[140px]">Status</TableHead>
              <TableHead className="w-[60px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tv_aid} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatDate(row.tv_date_submitted)}</TableCell>
                <TableCell className="text-sm font-medium">{row.tv_car_label}</TableCell>
                <TableCell className="text-sm">{row.tv_violation_type || "—"}</TableCell>
                <TableCell className="text-sm">{formatDate(row.tv_due_date)}</TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatCurrency(row.tv_amount_due)}
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={row.tv_status} />
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
            <DialogTitle className="text-primary">Ticket Violation Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatDate(selectedRow.tv_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={selectedRow.tv_status} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car</p>
                  <p className="font-medium">{selectedRow.tv_car_label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Violation Type</p>
                  <p className="font-medium">{selectedRow.tv_violation_type || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due Date</p>
                  <p className="font-medium">{formatDate(selectedRow.tv_due_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Amount Due</p>
                  <p className="font-medium font-mono">{formatCurrency(selectedRow.tv_amount_due)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Payment</p>
                  <p className="font-medium font-mono">{formatCurrency(selectedRow.tv_total_payment)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket / Photos</p>
                  {selectedRow.tv_photos && selectedRow.tv_photos.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedRow.tv_photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          View {selectedRow.tv_photos.length > 1 ? `#${i + 1}` : "attachment"}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No attachment</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
