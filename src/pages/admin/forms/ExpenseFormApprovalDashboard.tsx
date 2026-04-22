/**
 * Approval Dashboard for Expense Form Submissions
 * Admins can approve, decline, edit, and delete pending submissions
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Eye,
  ExternalLink,
} from "lucide-react";
const CATEGORY_LABELS: Record<string, string> = {
  directDelivery: "Direct Delivery",
  cogs: "COGS",
  reimbursedBills: "Reimbursed Bills",
  income: "Income",
};

/** Extract Google Drive file ID from share/view URLs. */
function getGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const dMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  const ucMatch = trimmed.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return ucMatch[1];
  return null;
} 

/** True if the string looks like a Google Drive file/view URL. */
function isGoogleDriveUrl(url: string): boolean {
  return getGoogleDriveFileId(url) != null;
}

/**
 * For Google Drive PDF: fetch via uc?export=view and return blob URL (frontend-only).
 * For images we use thumbnail URL in img directly to avoid CORS.
 */
function useGoogleDrivePdfBlobUrl(googleDriveUrl: string | null): { blobUrl: string | null; loading: boolean; error: string | null } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!googleDriveUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fileId = googleDriveUrl ? getGoogleDriveFileId(googleDriveUrl) : null;
    if (!fileId) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    const directUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
    fetch(directUrl, { mode: "cors", credentials: "omit" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "File not found" : `Failed to load (${res.status})`);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) throw new Error("Drive returned a page instead of file (link may need to be shared)");
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!revoked) {
          setError(err instanceof Error ? err.message : "Failed to load from Drive");
          setLoading(false);
        }
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [googleDriveUrl]);

  return { blobUrl, loading, error };
}

/** Direct thumbnail URL for a Google Drive file (use in img src; no CORS for display). */
function getGoogleDriveThumbnailUrl(url: string): string | null {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
}

/** Renders a receipt that may be a Google Drive share URL; displays on frontend only (no backend). */
function ReceiptImageOrDrive({
  urlOrId,
  alt,
  className,
  isPdf,
}: {
  urlOrId: string;
  alt: string;
  className?: string;
  isPdf: boolean;
}) {
  const isDrive = isGoogleDriveUrl(urlOrId);
  const { blobUrl, loading, error } = useGoogleDrivePdfBlobUrl(isDrive && isPdf ? urlOrId : null);
  const driveOpenUrl = urlOrId;

  if (isDrive) {
    if (isPdf) {
      if (loading) {
        return (
          <div className={`flex items-center justify-center rounded border border-[#2a2a2a] bg-[#0d0d0d] min-h-[120px] ${className ?? ""}`}>
            <Loader2 className="w-6 h-6 animate-spin text-[#D3BC8D]" />
          </div>
        );
      }
      if (error) {
        return (
          <div className={`space-y-2 rounded border border-[#2a2a2a] bg-[#0d0d0d] p-3 ${className ?? ""}`}>
            <p className="text-sm text-red-300">{error}</p>
            <a href={driveOpenUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#D3BC8D] hover:underline">
              <ExternalLink className="w-3 h-3" /> Open in Google Drive
            </a>
          </div>
        );
      }
      if (blobUrl) {
        return (
          <object
            data={blobUrl}
            type="application/pdf"
            className={className}
            title={alt}
          >
            <a href={driveOpenUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#D3BC8D] hover:underline">
              <ExternalLink className="w-4 h-4" /> Open PDF in new tab
            </a>
          </object>
        );
      }
      return (
        <a href={driveOpenUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#D3BC8D] hover:underline">
          <ExternalLink className="w-4 h-4" /> Open PDF in Google Drive
        </a>
      );
    }

    // Image: use thumbnail URL directly in img (no CORS for display)
    const thumbUrl = getGoogleDriveThumbnailUrl(urlOrId);
    if (thumbUrl) {
      return (
        <GoogleDriveThumbnailImg
          thumbUrl={thumbUrl}
          fallbackUrl={driveOpenUrl}
          alt={alt}
          className={className}
        />
      );
    }
    return (
      <a href={driveOpenUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#D3BC8D] hover:underline">
        <ExternalLink className="w-4 h-4" /> Open in Google Drive
      </a>
    );
  }

  const isDriveFileId = urlOrId && !urlOrId.startsWith("http");
  const displayUrl = isDriveFileId
    ? buildApiUrl(`/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(urlOrId)}`)
    : urlOrId;
  return (
    <ReceiptImage
      url={displayUrl}
      alt={alt}
      className={className}
    />
  );
}

/** Renders an img using Drive thumbnail URL; on error shows link to open in Drive. */
function GoogleDriveThumbnailImg({
  thumbUrl,
  fallbackUrl,
  alt,
  className,
}: {
  thumbUrl: string;
  fallbackUrl: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`space-y-2 rounded border border-[#2a2a2a] bg-[#0d0d0d] p-3 ${className ?? ""}`}>
        <p className="text-sm text-gray-400">Image could not be loaded.</p>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#D3BC8D] hover:underline">
          <ExternalLink className="w-3 h-3" /> Open in Google Drive
        </a>
      </div>
    );
  }
  return (
    <img
      src={thumbUrl}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/** Loads receipt from API with credentials and displays as image (fixes broken image when API is cross-origin). */
function ReceiptImage({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    const isOurReceiptApi = url.includes("/api/expense-form-submissions/receipt/file");
    fetch(url, { credentials: isOurReceiptApi ? "include" : "omit" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "File not found" : `Failed to load (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!revoked) {
          setError(err instanceof Error ? err.message : "Failed to load receipt");
          setLoading(false);
        }
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center rounded border border-[#2a2a2a] bg-[#0d0d0d] min-h-[120px] ${className ?? ""}`}>
        <Loader2 className="w-6 h-6 animate-spin text-[#D3BC8D]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className={`rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 ${className ?? ""}`}>
        {error}
      </div>
    );
  }
  if (blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={alt}
        className={className}
      />
    );
  }
  return null;
}

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
  carOwnerName?: string | null;
  declineReason?: string | null;
  createdAt: string;
  approvedAt?: string | null;
}

interface ExpenseFormApprovalDashboardProps {
  isAdmin?: boolean;
}

export default function ExpenseFormApprovalDashboard({ isAdmin = true }: ExpenseFormApprovalDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewReceiptsOpen, setViewReceiptsOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submissionToDecline, setSubmissionToDecline] = useState<Submission | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Submission> & { employeeId?: number; carId?: number }>({});

  const { data: optionsData } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
    enabled: editModalOpen,
  });
  const employees = optionsData?.data?.employees || [];
  const cars = optionsData?.data?.cars || [];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "/api/expense-form-submissions",
      statusFilter,
      page,
      limit,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions?${params}`),
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch submissions");
      return json;
    },
  });

  // When View Receipt dialog is open, fetch submission by ID so receipt_urls come from DB
  const submissionIdForReceipt = viewReceiptsOpen && selectedSubmission?.id ? selectedSubmission.id : null;
  const { data: submissionForReceiptData, isLoading: submissionForReceiptLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions", submissionIdForReceipt, "embedReceipts"],
    queryFn: async () => {
      if (!submissionIdForReceipt) return null;
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/${submissionIdForReceipt}?embedReceipts=1`),
        { credentials: "include" }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || "Failed to fetch submission");
      }
      return res.json();
    },
    enabled: !!submissionIdForReceipt,
  });
  const submissionForReceipt = submissionForReceiptData?.data as Record<string, unknown> | undefined;
  const receiptUrlsFromDb = submissionForReceipt
    ? parseReceiptUrlsFromSub(submissionForReceipt)
    : selectedSubmission?.receiptUrls ?? null;
  const receiptDataUrls = (submissionForReceipt?.receiptDataUrls as Record<string, string> | undefined) ?? null;

  // Normalize list from API: ensure receiptUrls is set (API may send receipt_urls or receiptUrls, string or array)
  function parseReceiptUrlsFromSub(sub: Record<string, unknown>): string[] | null {
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
  const rawList = Array.isArray(data?.data) ? data.data : [];
  const submissions: Submission[] = rawList.map((sub: Record<string, unknown>) => ({
    ...sub,
    receiptUrls: parseReceiptUrlsFromSub(sub),
  })) as Submission[];
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 0 };

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/expense-form-submissions/${id}/approve`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Expense submission approved and synced to Income & Expenses." });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ id, declineReason }: { id: number; declineReason: string }) => {
      const res = await fetch(buildApiUrl(`/api/expense-form-submissions/${id}/decline`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ declineReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to decline");
      }
    },
    onSuccess: () => {
      toast({ title: "Declined", description: "Expense submission declined." });
      setDeclineModalOpen(false);
      setSubmissionToDecline(null);
      setDeclineReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/expense-form-submissions/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Expense submission deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await fetch(buildApiUrl(`/api/expense-form-submissions/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Expense submission updated." });
      setEditModalOpen(false);
      setSelectedSubmission(null);
      setEditForm({});
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDecline = (sub: Submission) => {
    setSubmissionToDecline(sub);
    setDeclineReason("");
    setDeclineModalOpen(true);
  };

  const confirmDecline = () => {
    if (!submissionToDecline || !declineReason.trim()) {
      toast({ title: "Required", description: "Please enter a decline reason.", variant: "destructive" });
      return;
    }
    declineMutation.mutate({ id: submissionToDecline.id, declineReason: declineReason.trim() });
  };

  const handleEdit = (sub: Submission) => {
    setSelectedSubmission(sub);
    setEditForm({
      submissionDate: sub.submissionDate,
      amount: sub.amount,
      remarks: sub.remarks ?? "",
      employeeId: sub.employeeId,
      carId: sub.carId,
    });
    setEditModalOpen(true);
  };

  const confirmEdit = () => {
    if (!selectedSubmission) return;
    updateMutation.mutate({
      id: selectedSubmission.id,
      body: {
        submissionDate: editForm.submissionDate,
        amount: editForm.amount,
        remarks: editForm.remarks,
        employeeId: editForm.employeeId,
        carId: editForm.carId,
      },
    });
  };

  const formatFieldLabel = (field: string) => {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employee, car, VIN..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-card border-border text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-8 text-red-700">
          {error instanceof Error ? error.message : "Failed to load submissions."}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No expense submissions found.
        </div>
      ) : (
        <div className="min-w-0 w-full max-w-full rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full min-w-0 text-xs">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-semibold w-[90px] text-xs whitespace-nowrap py-2 px-2 h-auto">Date</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Employee</TableHead>
                  <TableHead className="text-foreground font-semibold w-[200px] min-w-[160px] text-xs whitespace-nowrap py-2 px-2 h-auto">Car</TableHead>
                  <TableHead className="text-foreground font-semibold w-[80px] text-xs whitespace-nowrap py-2 px-2 h-auto">Year/Month</TableHead>
                  <TableHead className="text-foreground font-semibold w-[100px] text-xs whitespace-nowrap py-2 px-2 h-auto">Category</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Type</TableHead>
                  <TableHead className="text-foreground font-semibold w-[80px] text-xs whitespace-nowrap py-2 px-2 h-auto">Amount</TableHead>
                  <TableHead className="text-foreground font-semibold w-[88px] text-xs whitespace-nowrap py-2 px-2 h-auto">Status</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Remarks</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Decline Reason</TableHead>
                  <TableHead className="text-foreground font-semibold w-[72px] text-xs whitespace-nowrap py-2 px-2 h-auto">Receipt</TableHead>
                  {isAdmin && <TableHead className="text-foreground font-semibold text-right w-[140px] text-xs whitespace-nowrap py-2 px-2 h-auto">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id} className="border-border">
                    <TableCell className="text-foreground text-xs truncate whitespace-nowrap py-2 px-2" title={new Date(sub.submissionDate).toLocaleDateString()}>
                      {new Date(sub.submissionDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-foreground text-xs truncate min-w-0 whitespace-nowrap py-2 px-2" title={sub.employeeName || undefined}>
                      {sub.employeeName || "-"}
                    </TableCell>
                    <TableCell className="text-foreground text-xs py-2 px-2 align-top w-[200px] min-w-[160px] whitespace-normal break-words" title={sub.carDisplayName || undefined}>
                      {sub.carDisplayName || "-"}
                    </TableCell>
                    <TableCell className="text-foreground text-xs whitespace-nowrap py-2 px-2">
                      {sub.year} / {MONTHS[sub.month - 1]}
                    </TableCell>
                    <TableCell className="text-foreground text-xs truncate whitespace-nowrap py-2 px-2">
                      {CATEGORY_LABELS[sub.category] || sub.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate min-w-0 whitespace-nowrap py-2 px-2">
                      {formatFieldLabel(sub.field)}
                    </TableCell>
                    <TableCell className="text-green-700 font-semibold text-xs whitespace-nowrap py-2 px-2">
                      ${Number(sub.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-2 px-2">
                      <Badge
                        variant="outline"
                        className={
                          "text-xs whitespace-nowrap " +
                          (sub.status === "approved"
                            ? "border-green-500/50 text-green-700 bg-green-500/20 font-semibold"
                            : sub.status === "declined"
                            ? "border-red-500/50 text-red-700 bg-red-500/20 font-semibold"
                            : "border-yellow-500/50 text-yellow-800 bg-yellow-500/20 font-semibold")
                        }
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate min-w-0 whitespace-nowrap py-2 px-2" title={sub.remarks || undefined}>
                      {sub.remarks || "—"}
                    </TableCell>
                    <TableCell className="text-red-700/80 text-xs truncate min-w-0 whitespace-nowrap py-2 px-2" title={sub.declineReason || undefined}>
                      {sub.status === "declined" && sub.declineReason ? sub.declineReason : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap py-2 px-2">
                      {sub.receiptUrls && sub.receiptUrls.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[#D3BC8D] hover:text-[#D3BC8D] hover:bg-[#D3BC8D]/10"
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setViewReceiptsOpen(true);
                          }}
                          title="View copy of receipt"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 inline" />
                          View
                        </Button>
                      ) : (
                        <span className="text-gray-500 text-xs">No receipt</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center text-xs whitespace-nowrap py-2 px-2">
                        <div className="flex items-center justify-center gap-0.5">
                          {sub.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-500 hover:text-green-700"
                                onClick={() => approveMutation.mutate(sub.id)}
                                disabled={approveMutation.isPending}
                                title="Approve"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => handleDecline(sub)}
                                title="Decline"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleEdit(sub)}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm("Delete this submission?")) {
                                deleteMutation.mutate(sub.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-border text-primary"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-primary"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* View Receipts Dialog */}
      <Dialog open={viewReceiptsOpen} onOpenChange={setViewReceiptsOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#D3BC8D]">View copy of receipt</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.employeeName} - ${selectedSubmission?.amount?.toLocaleString()}
              {selectedSubmission?.remarks && ` • Remarks: ${selectedSubmission.remarks}`}
            </DialogDescription>
          </DialogHeader>
          {selectedSubmission?.status === "declined" && selectedSubmission?.declineReason && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
              <strong>Decline reason:</strong> {selectedSubmission.declineReason}
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            {submissionIdForReceipt && submissionForReceiptLoading ? (
              <div className="flex items-center justify-center rounded border border-[#2a2a2a] bg-[#0d0d0d] min-h-[120px] w-full">
                <Loader2 className="w-6 h-6 animate-spin text-[#D3BC8D]" />
              </div>
            ) : receiptUrlsFromDb?.length ? (
              receiptUrlsFromDb.map((urlOrId, i) => {
                const isPdf = urlOrId?.match(/\.pdf$/i);
                const receiptLabel = `Receipt ${i + 1}`;
                const embeddedDataUrl = receiptDataUrls?.[urlOrId];
                const isBackendFileId = urlOrId && !urlOrId.startsWith("http");
                const isDriveUrl = isGoogleDriveUrl(urlOrId);
                const displayUrl =
                  isBackendFileId || isDriveUrl
                    ? buildApiUrl(`/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(urlOrId)}`)
                    : urlOrId;
                if (!displayUrl && !embeddedDataUrl) return null;
                if (isPdf) {
                  return (
                    <div key={i} className="space-y-1">
                      <p className="text-sm text-gray-400">{receiptLabel} (PDF)</p>
                      {embeddedDataUrl ? (
                        <object
                          data={embeddedDataUrl}
                          type="application/pdf"
                          className="w-full min-h-[300px] max-h-[64vh] rounded border border-[#2a2a2a] bg-[#0d0d0d]"
                          title={receiptLabel}
                        >
                          <a
                            href={embeddedDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[#D3BC8D] hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" /> Open PDF in new tab
                          </a>
                        </object>
                      ) : (
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#D3BC8D] hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" /> {receiptLabel} (PDF) — Open in new tab
                        </a>
                      )}
                      <a
                        href={embeddedDataUrl ?? (isDriveUrl ? urlOrId : displayUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#D3BC8D] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Open in new tab
                      </a>
                    </div>
                  );
                }
                return (
                  <div key={i} className="space-y-1">
                    <p className="text-sm text-gray-400">{receiptLabel}</p>
                    {embeddedDataUrl ? (
                      <img
                        src={embeddedDataUrl}
                        alt={receiptLabel}
                        className="max-h-64 w-auto rounded border border-[#2a2a2a] object-contain bg-[#0d0d0d]"
                      />
                    ) : (
                      <ReceiptImage
                        url={displayUrl!}
                        alt={receiptLabel}
                        className="max-h-64 w-auto rounded border border-[#2a2a2a] object-contain bg-[#0d0d0d]"
                      />
                    )}
                    <a
                      href={embeddedDataUrl ?? (isDriveUrl ? urlOrId : displayUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#D3BC8D] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Open in new tab
                    </a>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No receipt attached.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={declineModalOpen} onOpenChange={setDeclineModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-primary">Decline Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining. This will be stored with the submission.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Decline reason (required)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="bg-card border-border text-foreground"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineModalOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              className="bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30"
              onClick={confirmDecline}
              disabled={!declineReason.trim() || declineMutation.isPending}
            >
              {declineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-primary">Edit Submission</DialogTitle>
            <DialogDescription>
              Edit receipt date, employee, car, total receipt cost, or remarks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Receipt Date</label>
              <Input
                type="date"
                value={editForm.submissionDate || ""}
                onChange={(e) => setEditForm((p) => ({ ...p, submissionDate: e.target.value }))}
                className="bg-card border-border text-foreground mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Employee</label>
              <Select
                value={editForm.employeeId != null ? String(editForm.employeeId) : ""}
                onValueChange={(v) => setEditForm((p) => ({ ...p, employeeId: v ? Number(v) : undefined }))}
              >
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: { id: number; name: string }) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Car</label>
              <Select
                value={editForm.carId != null ? String(editForm.carId) : ""}
                onValueChange={(v) => setEditForm((p) => ({ ...p, carId: v ? Number(v) : undefined }))}
              >
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue placeholder="Select car" />
                </SelectTrigger>
                <SelectContent>
                  {cars.map((car: { id: number; name?: string; displayName?: string }) => (
                    <SelectItem key={car.id} value={String(car.id)}>
                      {car.displayName || car.name || `Car #${car.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Total Receipt Cost ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.amount ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                className="bg-card border-border text-foreground mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Remarks</label>
              <Input
                value={editForm.remarks ?? ""}
                onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
                className="bg-card border-border text-foreground mt-1"
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              onClick={confirmEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
