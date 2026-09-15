/**
 * Shared read-only "my submissions" table for the incident-style client forms
 * (ticket violation, towing & impound, ...): a submitted/car/type/due-date/
 * amount/status table with a detail dialog. Each caller supplies its own row
 * shape via field accessors, since the column keys (tv_*, ti_*, ...) differ
 * per feature's DB table.
 */

import { useState } from "react";
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

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  new: "New",
  charged_guest: "Charged the Guest",
  paid: "Paid",
  disputed: "Disputed",
};

export function formatIncidentDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

export function formatIncidentCurrency(v: number | string | null): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n)
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function IncidentStatusBadge({ status }: { status: string }) {
  const label = INCIDENT_STATUS_LABELS[status] || status;
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

export interface IncidentRow {
  id: number;
  carLabel: string;
  typeLabel: string | null;
  dueDate: string | null;
  amountDue: number | string | null;
  totalPayment: number | string | null;
  attachments: string[];
  status: string;
  dateSubmitted: string;
}

export function IncidentMySubmissionsTable({
  rows,
  isLoading,
  isError,
  detailTitle,
  typeColumnLabel,
  emptyMessage,
  attachmentsLabel,
}: {
  rows: IncidentRow[];
  isLoading: boolean;
  isError: boolean;
  detailTitle: string;
  typeColumnLabel: string;
  emptyMessage: string;
  attachmentsLabel: string;
}) {
  const [selectedRow, setSelectedRow] = useState<IncidentRow | null>(null);

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
        <p className="text-sm">{emptyMessage}</p>
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
              <TableHead className="w-[130px]">{typeColumnLabel}</TableHead>
              <TableHead className="w-[110px]">Due Date</TableHead>
              <TableHead className="text-right w-[110px]">Amount</TableHead>
              <TableHead className="text-center w-[140px]">Status</TableHead>
              <TableHead className="w-[60px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatIncidentDate(row.dateSubmitted)}</TableCell>
                <TableCell className="text-sm font-medium">{row.carLabel}</TableCell>
                <TableCell className="text-sm">{row.typeLabel || "—"}</TableCell>
                <TableCell className="text-sm">{formatIncidentDate(row.dueDate)}</TableCell>
                <TableCell className="text-right text-sm font-mono">
                  {formatIncidentCurrency(row.amountDue)}
                </TableCell>
                <TableCell className="text-center">
                  <IncidentStatusBadge status={row.status} />
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
            <DialogTitle className="text-primary">{detailTitle}</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatIncidentDate(selectedRow.dateSubmitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <IncidentStatusBadge status={selectedRow.status} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car</p>
                  <p className="font-medium">{selectedRow.carLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{typeColumnLabel}</p>
                  <p className="font-medium">{selectedRow.typeLabel || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due Date</p>
                  <p className="font-medium">{formatIncidentDate(selectedRow.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Amount Due</p>
                  <p className="font-medium font-mono">{formatIncidentCurrency(selectedRow.amountDue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Payment</p>
                  <p className="font-medium font-mono">{formatIncidentCurrency(selectedRow.totalPayment)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{attachmentsLabel}</p>
                  {selectedRow.attachments && selectedRow.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedRow.attachments.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          View {selectedRow.attachments.length > 1 ? `#${i + 1}` : "attachment"}
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
