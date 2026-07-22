/**
 * Car Repaired My Submissions
 * Read-only view of the current user's car-repaired submissions.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
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
import { Loader2, Eye, Wrench } from "lucide-react";

interface CarRepairedRow {
  cr_aid: number;
  cr_car_label: string;
  cr_repair_completion_date: string | null;
  cr_repair_type: string | null;
  cr_repair_notes: string | null;
  cr_photos: string[];
  cr_receipts: string[];
  cr_date_submitted: string;
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

export default function CarRepairedMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<CarRepairedRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/car-repaired/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-repaired/my"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: CarRepairedRow[] = data?.data ?? [];

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
        <Wrench className="h-10 w-10" />
        <p className="text-sm">No car repaired logs submitted yet.</p>
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
              <TableHead className="w-[160px]">Repair Type</TableHead>
              <TableHead className="w-[130px]">Completion Date</TableHead>
              <TableHead className="w-[60px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.cr_aid} className="hover:bg-muted/20">
                <TableCell className="text-sm">{formatDate(row.cr_date_submitted)}</TableCell>
                <TableCell className="text-sm font-medium">{row.cr_car_label}</TableCell>
                <TableCell className="text-sm">{row.cr_repair_type || "—"}</TableCell>
                <TableCell className="text-sm">{formatDate(row.cr_repair_completion_date)}</TableCell>
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
            <DialogTitle className="text-primary">Car Repaired Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatDate(selectedRow.cr_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Completion Date</p>
                  <p className="font-medium">{formatDate(selectedRow.cr_repair_completion_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car</p>
                  <p className="font-medium">{selectedRow.cr_car_label}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Repair Type</p>
                  <p className="font-medium">{selectedRow.cr_repair_type || "—"}</p>
                </div>
                {selectedRow.cr_repair_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Notes</p>
                    <p className="font-medium">{selectedRow.cr_repair_notes}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Photos</p>
                  {selectedRow.cr_photos && selectedRow.cr_photos.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedRow.cr_photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          Photo #{i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No photos</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Receipts</p>
                  {selectedRow.cr_receipts && selectedRow.cr_receipts.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedRow.cr_receipts.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline font-medium"
                        >
                          Receipt #{i + 1}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No receipts</p>
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
