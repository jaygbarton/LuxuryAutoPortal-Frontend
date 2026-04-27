/**
 * Approval Dashboard for Expense Form Submissions
 * Admins can approve, decline, edit, and delete pending submissions
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  History,
  Filter,
  X,
} from "lucide-react";
const CATEGORY_LABELS: Record<string, string> = {
  directDelivery: "Direct Delivery",
  cogs: "COGS",
  reimbursedBills: "Reimbursed Bills",
  income: "Income & Expenses",
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
  submittedByName?: string | null;
  approvedByName?: string | null;
  historyCount?: number;
}

interface AuditEntry {
  id: number;
  submissionId: number;
  action: "create" | "update" | "approve" | "decline" | "delete" | "restore";
  actorId: number | null;
  actorName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
}

const UTAH_TZ = "America/Denver";

function formatUtahDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatUtahDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  create: "Created",
  update: "Edited",
  approve: "Approved",
  decline: "Declined",
  delete: "Deleted",
  restore: "Restored",
};

const ACTION_BADGE_CLASS: Record<AuditEntry["action"], string> = {
  create: "border-blue-500/50 text-blue-700 bg-blue-500/15",
  update: "border-amber-500/50 text-amber-700 bg-amber-500/15",
  approve: "border-green-500/50 text-green-700 bg-green-500/15",
  decline: "border-red-500/50 text-red-700 bg-red-500/15",
  delete: "border-rose-500/50 text-rose-700 bg-rose-500/15",
  restore: "border-purple-500/50 text-purple-700 bg-purple-500/15",
};

const CATEGORY_FIELDS: Record<string, { value: string; label: string }[]> = {
  directDelivery: [
    { value: "laborCarCleaning", label: "Labor Car Cleaning" },
    { value: "laborDelivery", label: "Labor Delivery" },
    { value: "parkingAirport", label: "Parking Airport" },
    { value: "parkingLot", label: "Parking Lot" },
    { value: "uberLyftLime", label: "Uber/Lyft/Lime" },
  ],
  cogs: [
    { value: "alignment", label: "Alignment" },
    { value: "autoBodyShopWreck", label: "Auto Body Shop/Wreck" },
    { value: "battery", label: "Battery" },
    { value: "brakes", label: "Brakes" },
    { value: "carInsurance", label: "Car Insurance" },
    { value: "carSeats", label: "Car Seats" },
    { value: "cleaningSuppliesTools", label: "Cleaning Supplies/Tools" },
    { value: "emissions", label: "Emissions" },
    { value: "gpsSystem", label: "GPS System" },
    { value: "keyFob", label: "Key Fob" },
    { value: "laborCleaning", label: "Labor Cleaning" },
    { value: "licenseRegistration", label: "License/Registration" },
    { value: "mechanic", label: "Mechanic" },
    { value: "oilLube", label: "Oil/Lube" },
    { value: "parts", label: "Parts" },
    { value: "skiRacks", label: "Ski Racks" },
    { value: "tickets", label: "Tickets" },
    { value: "tiredAirStation", label: "Tired/Air Station" },
    { value: "tires", label: "Tires" },
    { value: "towingImpoundFees", label: "Towing/Impound Fees" },
    { value: "uberLyftLime", label: "Uber/Lyft/Lime" },
    { value: "windshield", label: "Windshield" },
    { value: "wipers", label: "Wipers" },
  ],
  reimbursedBills: [
    { value: "electricReimbursed", label: "Electric Reimbursed" },
    { value: "electricNotReimbursed", label: "Electric Not Reimbursed" },
    { value: "gasReimbursed", label: "Gas Reimbursed" },
    { value: "gasNotReimbursed", label: "Gas Not Reimbursed" },
    { value: "gasServiceRun", label: "Gas Service Run" },
    { value: "parkingAirport", label: "Parking Airport" },
    { value: "uberLyftLimeNotReimbursed", label: "Uber/Lyft/Lime Not Reimbursed" },
    { value: "uberLyftLimeReimbursed", label: "Uber/Lyft/Lime Reimbursed" },
  ],
  income: [
    { value: "rentalIncome", label: "Rental Income" },
    { value: "deliveryIncome", label: "Delivery Income" },
    { value: "electricPrepaidIncome", label: "Electric Prepaid Income" },
    { value: "smokingFines", label: "Smoking Fines" },
    { value: "gasPrepaidIncome", label: "Gas Prepaid Income" },
    { value: "skiRacksIncome", label: "Ski Racks Income" },
    { value: "milesIncome", label: "Miles Income" },
    { value: "childSeatIncome", label: "Child Seat Income" },
    { value: "coolersIncome", label: "Coolers Income" },
    { value: "insuranceWreckIncome", label: "Insurance Wreck Income" },
    { value: "otherIncome", label: "Other Income" },
  ],
};

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

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySubmission, setHistorySubmission] = useState<Submission | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [carFilter, setCarFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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
  const employees = optionsData?.data?.employees || [];
  const cars = optionsData?.data?.cars || [];

  const fieldOptions = useMemo(() => {
    if (categoryFilter === "all") {
      const all: { value: string; label: string }[] = [];
      const seen = new Set<string>();
      Object.values(CATEGORY_FIELDS).forEach((arr) =>
        arr.forEach((f) => {
          if (!seen.has(f.value)) {
            seen.add(f.value);
            all.push(f);
          }
        })
      );
      return all.sort((a, b) => a.label.localeCompare(b.label));
    }
    return CATEGORY_FIELDS[categoryFilter] ?? [];
  }, [categoryFilter]);

  const hasActiveFilters =
    statusFilter !== "pending" ||
    !!searchQuery.trim() ||
    categoryFilter !== "all" ||
    fieldFilter !== "all" ||
    carFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setStatusFilter("pending");
    setSearchQuery("");
    setCategoryFilter("all");
    setFieldFilter("all");
    setCarFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "/api/expense-form-submissions",
      statusFilter,
      page,
      limit,
      searchQuery,
      categoryFilter,
      fieldFilter,
      carFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      if (fieldFilter && fieldFilter !== "all") params.append("field", fieldFilter);
      if (carFilter && carFilter !== "all") params.append("carId", carFilter);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions?${params}`),
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch submissions");
      return json;
    },
  });

  const historyEnabled = historyOpen && !!historySubmission?.id;
  const { data: historyData, isLoading: historyLoading } = useQuery<{ success: boolean; data: AuditEntry[] }>({
    queryKey: ["/api/expense-form-submissions/history", historySubmission?.id],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/${historySubmission!.id}/history`),
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch history");
      return json;
    },
    enabled: historyEnabled,
  });
  const historyEntries: AuditEntry[] = historyData?.data ?? [];

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
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="font-medium text-foreground">Filters</span>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 ml-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative col-span-1 sm:col-span-2 xl:col-span-2">
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
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setFieldFilter("all");
              setPage(1);
            }}
          >
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="directDelivery">Direct Delivery</SelectItem>
              <SelectItem value="cogs">COGS</SelectItem>
              <SelectItem value="reimbursedBills">Reimbursed Bills</SelectItem>
              <SelectItem value="income">Income & Expenses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={fieldFilter} onValueChange={(v) => { setFieldFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Receipt type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {fieldOptions.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={carFilter} onValueChange={(v) => { setCarFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Car" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="all">All cars</SelectItem>
              {(cars as Array<{ id: number; name: string }>).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Receipt date from</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-card border-border text-foreground"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Receipt date to</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-card border-border text-foreground"
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                const now = new Date();
                const tz = "America/Denver";
                const toIso = (d: Date) => {
                  const f = new Intl.DateTimeFormat("en-CA", {
                    timeZone: tz,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(d);
                  return f;
                };
                setDateFrom(toIso(now));
                setDateTo(toIso(now));
                setPage(1);
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                const now = new Date();
                const start = new Date(now);
                start.setDate(start.getDate() - 6);
                const tz = "America/Denver";
                const toIso = (d: Date) => new Intl.DateTimeFormat("en-CA", {
                  timeZone: tz,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(d);
                setDateFrom(toIso(start));
                setDateTo(toIso(now));
                setPage(1);
              }}
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const tz = "America/Denver";
                const toIso = (d: Date) => new Intl.DateTimeFormat("en-CA", {
                  timeZone: tz,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(d);
                setDateFrom(toIso(start));
                setDateTo(toIso(now));
                setPage(1);
              }}
            >
              This month
            </Button>
          </div>
        </div>
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
                  <TableHead className="text-foreground font-semibold w-[140px] text-xs whitespace-nowrap py-2 px-2 h-auto">Submitted</TableHead>
                  <TableHead className="text-foreground font-semibold w-[90px] text-xs whitespace-nowrap py-2 px-2 h-auto">Receipt Date</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Employee</TableHead>
                  <TableHead className="text-foreground font-semibold w-[200px] min-w-[160px] text-xs whitespace-nowrap py-2 px-2 h-auto">Car</TableHead>
                  <TableHead className="text-foreground font-semibold w-[80px] text-xs whitespace-nowrap py-2 px-2 h-auto">Year/Month</TableHead>
                  <TableHead className="text-foreground font-semibold w-[100px] text-xs whitespace-nowrap py-2 px-2 h-auto">Category</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Type</TableHead>
                  <TableHead className="text-foreground font-semibold w-[80px] text-xs whitespace-nowrap py-2 px-2 h-auto">Amount</TableHead>
                  <TableHead className="text-foreground font-semibold w-[88px] text-xs whitespace-nowrap py-2 px-2 h-auto">Status</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Remarks</TableHead>
                  <TableHead className="text-foreground font-semibold min-w-0 text-xs whitespace-nowrap py-2 px-2 h-auto">Actioned By</TableHead>
                  <TableHead className="text-foreground font-semibold w-[120px] text-xs whitespace-nowrap py-2 px-2 h-auto">Action Date</TableHead>
                  <TableHead className="text-foreground font-semibold w-[110px] min-w-[110px] text-xs whitespace-nowrap py-2 px-2 h-auto">Decline Reason</TableHead>
                  <TableHead className="text-foreground font-semibold w-[52px] min-w-[52px] text-xs whitespace-nowrap py-2 px-2 h-auto">Receipt</TableHead>
                  <TableHead className="text-foreground font-semibold w-[52px] min-w-[52px] text-xs whitespace-nowrap py-2 px-2 h-auto">History</TableHead>
                  {isAdmin && <TableHead className="text-foreground font-semibold text-right w-[140px] text-xs whitespace-nowrap py-2 px-2 h-auto">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id} className="border-border">
                    <TableCell className="text-foreground text-xs whitespace-nowrap py-2 px-2" title={formatUtahDateTime(sub.createdAt)}>
                      {formatUtahDateTime(sub.createdAt)}
                    </TableCell>
                    <TableCell className="text-foreground text-xs truncate whitespace-nowrap py-2 px-2" title={formatUtahDate(sub.submissionDate)}>
                      {formatUtahDate(sub.submissionDate)}
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
                    <TableCell className="text-foreground text-xs truncate min-w-0 whitespace-nowrap py-2 px-2" title={sub.approvedByName || undefined}>
                      {sub.status === "pending"
                        ? "—"
                        : sub.approvedByName || (sub.status === "approved" ? "Approved" : sub.status === "declined" ? "Declined" : "—")}
                    </TableCell>
                    <TableCell className="text-foreground text-xs whitespace-nowrap py-2 px-2" title={formatUtahDateTime(sub.approvedAt)}>
                      {sub.status === "pending" ? "—" : formatUtahDateTime(sub.approvedAt)}
                    </TableCell>
                    <TableCell className="text-red-700/80 text-xs truncate min-w-0 whitespace-nowrap py-2 px-2" title={sub.declineReason || undefined}>
                      {sub.status === "declined" && sub.declineReason ? sub.declineReason : "—"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap py-2 px-2">
                      {sub.receiptUrls && sub.receiptUrls.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[#D3BC8D] hover:text-[#D3BC8D] hover:bg-[#D3BC8D]/10"
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setViewReceiptsOpen(true);
                          }}
                          title="View copy of receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <span className="text-gray-400 text-xs px-1">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap py-2 px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[#D3BC8D] hover:text-[#D3BC8D] hover:bg-[#D3BC8D]/10 relative"
                        onClick={() => {
                          setHistorySubmission(sub);
                          setHistoryOpen(true);
                        }}
                        title="View edit history"
                      >
                        <History className="w-3.5 h-3.5" />
                        {sub.historyCount && sub.historyCount > 0 && (
                          <span className="absolute -top-1 -right-1 text-[9px] font-bold leading-none bg-[#D3BC8D] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
                            {sub.historyCount}
                          </span>
                        )}
                      </Button>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right text-xs whitespace-nowrap py-2 px-2">
                        <div className="flex items-center justify-end gap-0.5">
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

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (!o) setHistorySubmission(null); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#D3BC8D]">Edit history</DialogTitle>
            <DialogDescription>
              {historySubmission ? (
                <>
                  {historySubmission.employeeName || "Submission"} • {CATEGORY_LABELS[historySubmission.category] || historySubmission.category} • ${Number(historySubmission.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </>
              ) : (
                "Activity log"
              )}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No activity recorded yet.</p>
          ) : (
            <ol className="relative border-l-2 border-border pl-4 space-y-4 ml-2">
              {historyEntries.map((entry) => {
                const changedKeys = entry.before && entry.after
                  ? Array.from(new Set([
                      ...Object.keys(entry.before || {}),
                      ...Object.keys(entry.after || {}),
                    ]))
                  : [];
                return (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-[#D3BC8D] border-2 border-background" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${ACTION_BADGE_CLASS[entry.action] || ""}`}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Badge>
                      <span className="text-sm text-foreground font-medium">
                        {entry.actorName || "System"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatUtahDateTime(entry.createdAt)}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                    )}
                    {entry.action === "update" && changedKeys.length > 0 && (
                      <div className="mt-2 rounded-md border border-border bg-background/40 overflow-hidden">
                        <Table className="text-xs">
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="py-1 px-2 h-auto text-foreground font-semibold">Field</TableHead>
                              <TableHead className="py-1 px-2 h-auto text-foreground font-semibold">Before</TableHead>
                              <TableHead className="py-1 px-2 h-auto text-foreground font-semibold">After</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {changedKeys.map((k) => {
                              const before = entry.before?.[k];
                              const after = entry.after?.[k];
                              const fmt = (v: unknown) => {
                                if (v == null || v === "") return "—";
                                if (typeof v === "object") return JSON.stringify(v);
                                return String(v);
                              };
                              return (
                                <TableRow key={k} className="border-border">
                                  <TableCell className="py-1 px-2 text-foreground capitalize">
                                    {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
                                  </TableCell>
                                  <TableCell className="py-1 px-2 text-muted-foreground line-through">{fmt(before)}</TableCell>
                                  <TableCell className="py-1 px-2 text-foreground">{fmt(after)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {entry.action === "decline" && entry.after && typeof (entry.after as any).declineReason === "string" && (
                      <p className="text-xs text-red-700 mt-1">
                        Reason: {(entry.after as any).declineReason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </DialogContent>
      </Dialog>

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
