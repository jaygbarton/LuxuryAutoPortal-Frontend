/**
 * Approved Form Submissions & Receipts
 * Displays approved expense form submissions with receipt photos in the Income and Expenses area.
 * Receipts uploaded through forms are visible here so users can view them alongside I&E data.
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, FileText, Receipt, Eye } from "lucide-react";
import InAppReceipt from "@/components/receipts/InAppReceipt";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORY_LABELS: Record<string, string> = {
  income: "Income",
  directDelivery: "Direct Delivery",
  cogs: "COGS",
  reimbursedBills: "Reimbursed Bills",
};

function formatFieldLabel(field: string) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function parseReceiptUrls(sub: Record<string, unknown>): string[] | null {
  const urls = sub.receiptUrls ?? sub.receipt_urls;
  if (urls == null) return null;
  if (Array.isArray(urls) && urls.every((x) => typeof x === "string")) return urls as string[];
  if (typeof urls === "string") {
    try {
      const parsed = JSON.parse(urls);
      return Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string") ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

interface FormSubmissionsAndReceiptsProps {
  carId: number | null;
  year: string;
  className?: string;
}

export default function FormSubmissionsAndReceipts({ carId, year, className }: FormSubmissionsAndReceiptsProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [viewReceiptsOpen, setViewReceiptsOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions", "approved-by-car", carId, year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/approved-by-car?carId=${carId}&year=${year}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!carId && !!year,
  });

  const rawList = Array.isArray(data?.data) ? data.data : [];
  const submissions = rawList.map((sub: any) => ({
    ...sub,
    receiptUrls: parseReceiptUrls(sub),
  }));

  const submissionIdForReceipt = viewReceiptsOpen && selectedSubmission?.id ? selectedSubmission.id : null;
  const receiptUrlsFromDb = selectedSubmission?.receiptUrls ?? null;

  return (
    <div className={cn("border border-border rounded-lg bg-card/50 mb-4", className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Receipt className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">
            Uploaded Receipts from Forms ({submissions.length})
          </span>
          <span className="text-xs text-muted-foreground">
            — Receipts uploaded through forms are visible here in the Income and Expenses area
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : submissions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No approved form submissions for this car/year. Receipts uploaded through forms will appear here.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {submissions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="border border-border rounded-md p-3 bg-background/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {formatFieldLabel(sub.field)} — ${Number(sub.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sub.employeeName} • {MONTHS[Number(sub.month) - 1]} • {CATEGORY_LABELS[sub.category] || sub.category}
                      </p>
                    </div>
                    {sub.receiptUrls && sub.receiptUrls.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setViewReceiptsOpen(true);
                        }}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        title="View copy of receipt"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    )}
                  </div>
                  {sub.receiptUrls && sub.receiptUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sub.receiptUrls.map((fileId: string, i: number) => {
                        const isPdf = typeof fileId === "string" && fileId.toLowerCase().endsWith(".pdf");
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedSubmission(sub);
                              setViewReceiptsOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            {isPdf ? `Receipt ${i + 1} (PDF)` : `Receipt ${i + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View copy of receipt – embedded display so uploaded receipt is visible in I&E area */}
      <Dialog open={viewReceiptsOpen} onOpenChange={setViewReceiptsOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">View copy of receipt</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.employeeName} — ${Number(selectedSubmission?.amount ?? 0).toLocaleString()}
              {selectedSubmission?.remarks && ` • Remarks: ${selectedSubmission.remarks}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {receiptUrlsFromDb?.length ? (
              receiptUrlsFromDb.map((urlOrId: string, i: number) => {
                const receiptLabel = `Receipt ${i + 1}`;
                const displayUrl =
                  urlOrId && submissionIdForReceipt
                    ? buildApiUrl(
                        `/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(urlOrId)}&submissionId=${submissionIdForReceipt}`
                      )
                    : urlOrId;
                return (
                  <div key={i} className="space-y-1">
                    <p className="text-sm text-muted-foreground">{receiptLabel}</p>
                    <div className="rounded border border-border overflow-hidden bg-muted/30">
                      <InAppReceipt
                        src={displayUrl}
                        filename={urlOrId}
                        alt={receiptLabel}
                        className="max-h-[64vh] w-full object-contain"
                        expandable
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No receipt attached.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
