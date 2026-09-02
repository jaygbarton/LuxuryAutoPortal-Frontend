/**
 * Shows "Receipt from form submission" in I&E edit modals when the cell has an approved form submission.
 * Used so receipts uploaded through Forms are visible in the Income and Expenses area.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Receipt, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import InAppReceipt from "@/components/receipts/InAppReceipt";

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

interface EditingCellLike {
  month: number;
  category: string;
  field: string;
}

interface FormReceiptInModalProps {
  carId: number;
  year: string;
  editingCell: EditingCellLike | null;
  isOpen: boolean;
}

export default function FormReceiptInModal({ carId, year, editingCell, isOpen }: FormReceiptInModalProps) {
  const { data: approvedData, isLoading: formReceiptLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions", "approved-by-car", carId, year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/approved-by-car?carId=${carId}&year=${year}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isOpen && !!carId && !!year,
  });

  const approvedList = Array.isArray(approvedData?.data) ? approvedData.data : [];
  const matchingSubmission = editingCell
    ? approvedList.find(
        (s: any) =>
          Number(s.month) === editingCell.month &&
          s.category === editingCell.category &&
          s.field === editingCell.field
      )
    : null;
  const matchingSubmissionId = matchingSubmission?.id;
  const formReceiptUrls = matchingSubmission ? parseReceiptUrls(matchingSubmission) : null;

  if (!matchingSubmissionId && !formReceiptLoading) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <Label className="text-muted-foreground text-xs mb-2 flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" />
        Receipt from form submission
      </Label>
      {formReceiptLoading ? (
        <div className="flex items-center justify-center min-h-[80px] text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : formReceiptUrls?.length ? (
        <div className="flex flex-col gap-3">
          {formReceiptUrls.map((urlOrId: string, i: number) => {
            const label = `Receipt ${i + 1}`;
            // Always proxy through the authenticated file endpoint so Drive IDs,
            // GCS URLs, and local filenames all render inside the modal.
            const displayUrl =
              urlOrId && matchingSubmissionId
                ? buildApiUrl(
                    `/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(urlOrId)}&submissionId=${matchingSubmissionId}`
                  )
                : urlOrId;
            return (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <div className="rounded border border-border overflow-hidden bg-background max-h-64">
                  <InAppReceipt
                    src={displayUrl}
                    filename={urlOrId}
                    alt={label}
                    className="max-h-64 w-full object-contain"
                    compact
                    expandable
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No receipt attached to this form submission.</p>
      )}
    </div>
  );
}
