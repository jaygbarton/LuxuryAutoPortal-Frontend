/**
 * Read-only view of current user's expense form submissions
 * Shown to employees (and admins) to track their own submissions
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText, Eye, ExternalLink } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  directDelivery: "Direct Delivery",
  cogs: "COGS",
  reimbursedBills: "Reimbursed Bills",
  income: "Income & Expenses",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Submission {
  id: number;
  submissionDate: string;
  employeeId: number;
  carId: number;
  year: number;
  month: number;
  category: string;
  field: string;
  amount: number;
  receiptUrls: string[] | null;
  remarks: string | null;
  status: "pending" | "approved" | "declined";
  employeeName?: string;
  carDisplayName?: string;
  declineReason?: string | null;
  createdAt: string;
}

function fallbackFormatFieldLabel(field: string) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function ExpenseFormMySubmissions() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewReceiptsOpen, setViewReceiptsOpen] = useState(false);
  const limit = 10;

  // Server-driven subcategory labels so `db_<id>` values resolve correctly.
  const { data: optionsData } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
  });
  const labelByValue = useMemo(() => {
    const map = new Map<string, string>();
    const fields = optionsData?.data?.categoryFields || {};
    Object.values(fields).forEach((arr: any) =>
      arr.forEach((f: { value: string; label: string }) => map.set(f.value, f.label))
    );
    return map;
  }, [optionsData?.data?.categoryFields]);
  const formatFieldLabel = (field: string) => labelByValue.get(field) || fallbackFormatFieldLabel(field);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/expense-form-submissions/mine", statusFilter, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/mine?${params}`),
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch submissions");
      return json;
    },
  });

  const submissions: Submission[] = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 };

  function statusBadge(status: string) {
    if (status === "pending") return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-800 border-yellow-500/50 font-semibold">Pending</Badge>;
    if (status === "approved") return <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500/50 font-semibold">Approved</Badge>;
    return <Badge variant="outline" className="bg-red-500/20 text-red-700 border-red-500/50 font-semibold">Declined</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          My Expense Submissions
        </h3>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-card border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <p className="text-red-700 text-sm py-6 text-center">
          {error instanceof Error ? error.message : "Failed to load submissions."}
        </p>
      ) : submissions.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">No submissions yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground font-semibold">Date</TableHead>
                <TableHead className="text-foreground font-semibold">Car</TableHead>
                <TableHead className="text-foreground font-semibold">Category / Type</TableHead>
                <TableHead className="text-foreground font-semibold">Amount</TableHead>
                <TableHead className="text-foreground font-semibold">Status</TableHead>
                <TableHead className="text-foreground font-semibold">Remarks</TableHead>
                <TableHead className="text-foreground font-semibold">Decline Reason</TableHead>
                <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="text-muted-foreground text-sm">
                    {s.submissionDate} ({MONTHS[s.month - 1]} {s.year})
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.carDisplayName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {CATEGORY_LABELS[s.category] || s.category} / {formatFieldLabel(s.field)}
                  </TableCell>
                  <TableCell className="text-green-700 font-semibold">
                    ${Number(s.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate" title={s.remarks || undefined}>
                    {s.remarks || "—"}
                  </TableCell>
                  <TableCell className="text-red-700/80 text-sm max-w-[150px] truncate" title={s.declineReason || undefined}>
                    {s.status === "declined" && s.declineReason ? s.declineReason : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.receiptUrls && s.receiptUrls.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setSelectedSubmission(s);
                          setViewReceiptsOpen(true);
                        }}
                        title="View receipts"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 rounded border border-border hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 rounded border border-border hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View Receipts Dialog */}
      <Dialog open={viewReceiptsOpen} onOpenChange={setViewReceiptsOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary">Receipts</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.employeeName} - ${selectedSubmission?.amount?.toLocaleString()}
              {selectedSubmission?.remarks && ` • ${selectedSubmission.remarks}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-4">
            {selectedSubmission?.receiptUrls?.map((urlOrId, i) => {
              const isDriveFileId = urlOrId && !urlOrId.startsWith("http");
              const displayUrl = isDriveFileId
                ? buildApiUrl(`/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(urlOrId)}`)
                : urlOrId;
              const isPdf = urlOrId?.match(/\.pdf$/i);
              return (
                <a
                  key={i}
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isPdf ? (
                    <span className="flex items-center gap-2 text-blue-700 hover:underline">
                      <ExternalLink className="w-4 h-4" /> Receipt {i + 1} (PDF)
                    </span>
                  ) : isDriveFileId ? (
                    <span className="flex items-center gap-2 text-blue-700 hover:underline">
                      <ExternalLink className="w-4 h-4" /> View Receipt {i + 1}
                    </span>
                  ) : (
                    <img
                      src={displayUrl}
                      alt={`Receipt ${i + 1}`}
                      className="max-h-48 rounded border border-border object-contain"
                    />
                  )}
                </a>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
