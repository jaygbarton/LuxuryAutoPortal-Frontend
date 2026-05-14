/**
 * Document Update Approval Dashboard (admin).
 *
 * Admin view: search/filter, review uploaded files, approve/reject, request
 * updated documents, edit details, add internal notes, and inspect a full
 * audit history.
 */

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CheckCircle,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  History,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";

type DocumentType = "license" | "registration" | "insurance";
type Status = "pending_review" | "approved" | "rejected" | "update_requested";

interface SubmittedFile {
  url: string;
  name: string;
  mime: string;
}

interface DocumentUpdateRow {
  du_aid: number;
  du_client_user_id: number | null;
  du_full_name: string;
  du_email: string;
  du_phone: string;
  du_plate_number: string | null;
  du_document_type: DocumentType;
  du_expiration_date: string | null;
  du_notes: string | null;
  du_files: string | null;
  du_status: Status;
  du_reject_reason: string | null;
  du_update_request_message: string | null;
  du_decided_by: string | null;
  du_decided_at: string | null;
  du_date_submitted: string;
}

interface InternalNote {
  dun_aid: number;
  dun_du_aid: number;
  dun_author_id: number | null;
  dun_author_name: string | null;
  dun_note: string;
  dun_created: string;
}

interface AuditEntry {
  dua_aid: number;
  dua_du_aid: number;
  dua_action:
    | "create"
    | "update"
    | "approve"
    | "reject"
    | "request_updates"
    | "internal_note"
    | "delete";
  dua_actor_id: number | null;
  dua_actor_name: string | null;
  dua_before: string | null;
  dua_after: string | null;
  dua_notes: string | null;
  dua_created: string;
}

const DOC_LABELS: Record<DocumentType, string> = {
  license: "License Update",
  registration: "Registration Update",
  insurance: "Insurance Update",
};

const STATUS_OPTIONS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "update_requested", label: "Update Requested" },
];

const TYPE_OPTIONS: { value: DocumentType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "license", label: "License" },
  { value: "registration", label: "Registration" },
  { value: "insurance", label: "Insurance" },
];

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

function formatDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function parseFiles(raw: string | null): SubmittedFile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SubmittedFile => f && typeof f === "object" && typeof f.url === "string"
    );
  } catch {
    return [];
  }
}

function isImageMime(mime: string, url: string): boolean {
  if (mime && mime.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "approved")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
  if (status === "update_requested")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">Update Requested</Badge>
    );
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
}

export default function DocumentUpdateApprovalDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewRow, setViewRow] = useState<DocumentUpdateRow | null>(null);
  const [editRow, setEditRow] = useState<DocumentUpdateRow | null>(null);
  const [rejectRow, setRejectRow] = useState<DocumentUpdateRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [requestUpdatesRow, setRequestUpdatesRow] = useState<DocumentUpdateRow | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [notesRow, setNotesRow] = useState<DocumentUpdateRow | null>(null);
  const [historyRow, setHistoryRow] = useState<DocumentUpdateRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<DocumentUpdateRow | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    plateNumber: "",
    documentType: "" as DocumentType | "",
    expirationDate: "",
    notes: "",
  });
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (typeFilter !== "all") params.set("documentType", typeFilter);
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading } = useQuery({
    queryKey: [
      "/api/admin/document-updates",
      statusFilter,
      typeFilter,
      search,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates?${params.toString()}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rows: DocumentUpdateRow[] = data?.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/document-updates"] });

  // ── Mutations ──────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${id}/approve`),
        { method: "PATCH", credentials: "include" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Approve failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Approved" });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (vars: { id: number; reason: string }) => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${vars.id}/reject`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: vars.reason || null }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Reject failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Rejected" });
      setRejectRow(null);
      setRejectReason("");
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const requestUpdatesMutation = useMutation({
    mutationFn: async (vars: { id: number; message: string }) => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${vars.id}/request-updates`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: vars.message || null }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Update request sent to client" });
      setRequestUpdatesRow(null);
      setRequestMessage("");
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${id}`),
        { method: "DELETE", credentials: "include" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Delete failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      setDeleteRow(null);
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (id: number) => {
      const fd = new FormData();
      fd.append("fullName", editForm.fullName);
      fd.append("email", editForm.email);
      fd.append("phone", editForm.phone);
      fd.append("plateNumber", editForm.plateNumber || "");
      if (editForm.documentType) fd.append("documentType", editForm.documentType);
      fd.append("expirationDate", editForm.expirationDate || "");
      fd.append("notes", editForm.notes || "");
      for (const f of editNewFiles) fd.append("documents", f);

      const res = await fetch(buildApiUrl(`/api/admin/document-updates/${id}`), {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      setEditRow(null);
      setEditNewFiles([]);
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────

  const openEdit = (row: DocumentUpdateRow) => {
    setEditForm({
      fullName: row.du_full_name,
      email: row.du_email,
      phone: row.du_phone,
      plateNumber: row.du_plate_number ?? "",
      documentType: row.du_document_type,
      expirationDate: row.du_expiration_date
        ? row.du_expiration_date.slice(0, 10)
        : "",
      notes: row.du_notes ?? "",
    });
    setEditNewFiles([]);
    setEditRow(row);
  };

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, plate…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((p) => !p)}>
          <Filter className="h-4 w-4 mr-1" />
          {showFilters ? "Hide dates" : "Dates"}
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 items-end p-3 rounded-md border border-border">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              <X className="h-4 w-4 mr-1" /> Clear dates
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10" />
          <p className="text-sm">No document updates found.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">Submitted</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead className="w-[100px]">Expires</TableHead>
                <TableHead className="w-[70px] text-center">Files</TableHead>
                <TableHead className="w-[140px] text-center">Status</TableHead>
                <TableHead className="w-[220px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const files = parseFiles(row.du_files);
                return (
                  <TableRow key={row.du_aid} className="hover:bg-muted/20">
                    <TableCell className="text-xs">
                      {formatDate(row.du_date_submitted)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      <div>{row.du_full_name}</div>
                      <div className="text-xs text-muted-foreground">{row.du_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {DOC_LABELS[row.du_document_type]}
                    </TableCell>
                    <TableCell className="text-sm">{row.du_plate_number || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(row.du_expiration_date)}
                    </TableCell>
                    <TableCell className="text-sm text-center">{files.length}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={row.du_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View"
                          onClick={() => setViewRow(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          title="Edit"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {row.du_status !== "approved" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700"
                            title="Approve"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(row.du_aid)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {row.du_status !== "rejected" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600"
                            title="Reject"
                            onClick={() => {
                              setRejectReason("");
                              setRejectRow(row);
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-600 hover:text-amber-700"
                          title="Request updated documents"
                          onClick={() => {
                            setRequestMessage("");
                            setRequestUpdatesRow(row);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Internal notes"
                          onClick={() => setNotesRow(row)}
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="History"
                          onClick={() => setHistoryRow(row)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete"
                          onClick={() => setDeleteRow(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewRow} onOpenChange={(o) => { if (!o) setViewRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Submission Details</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Client</p>
                  <p className="font-medium">{viewRow.du_full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Status</p>
                  <StatusBadge status={viewRow.du_status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Email</p>
                  <p className="font-medium">{viewRow.du_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Phone</p>
                  <p className="font-medium">{viewRow.du_phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Document Type</p>
                  <p className="font-medium">{DOC_LABELS[viewRow.du_document_type]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Plate</p>
                  <p className="font-medium">{viewRow.du_plate_number || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Submitted</p>
                  <p className="font-medium">{formatDate(viewRow.du_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Expires</p>
                  <p className="font-medium">{formatDate(viewRow.du_expiration_date)}</p>
                </div>
                {viewRow.du_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{viewRow.du_notes}</p>
                  </div>
                )}
                {viewRow.du_status === "rejected" && viewRow.du_reject_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase">Rejection Reason</p>
                    <p className="text-red-800 mt-1">{viewRow.du_reject_reason}</p>
                  </div>
                )}
                {viewRow.du_status === "update_requested" &&
                  viewRow.du_update_request_message && (
                    <div className="col-span-2 rounded-md bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs font-medium text-amber-700 uppercase">
                        Update Request Sent
                      </p>
                      <p className="text-amber-800 mt-1">
                        {viewRow.du_update_request_message}
                      </p>
                    </div>
                  )}
                {viewRow.du_decided_by && (
                  <div className="col-span-2 text-xs text-muted-foreground">
                    Decision by {viewRow.du_decided_by} on {formatDateTime(viewRow.du_decided_at)}
                  </div>
                )}
              </div>

              {(() => {
                const files = parseFiles(viewRow.du_files);
                if (files.length === 0)
                  return (
                    <p className="text-sm text-muted-foreground">No files attached.</p>
                  );
                return (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase mb-1.5">
                      Attached Documents
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {files.map((f, i) => {
                        const isImg = isImageMime(f.mime, f.url);
                        if (isImg) {
                          return (
                            <button
                              key={i}
                              type="button"
                              className="relative group block rounded-md border border-border overflow-hidden"
                              onClick={() => setLightboxUrl(getProxiedImageUrl(f.url))}
                            >
                              <img
                                src={getProxiedImageUrl(f.url)}
                                alt={f.name}
                                className="h-32 w-full object-cover transition-opacity group-hover:opacity-80"
                              />
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="h-7 w-7 text-white drop-shadow-lg" />
                              </span>
                            </button>
                          );
                        }
                        return (
                          <a
                            key={i}
                            href={getProxiedImageUrl(f.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm rounded-md border border-border p-3"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate">{f.name || "Document"}</span>
                            <ExternalLink className="h-3 w-3 ml-auto" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Submission</DialogTitle>
            <DialogDescription>
              Adjust details. Attaching new files replaces the existing set.
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Plate</Label>
                  <Input
                    value={editForm.plateNumber}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, plateNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Document Type</Label>
                  <Select
                    value={editForm.documentType || ""}
                    onValueChange={(v) =>
                      setEditForm((p) => ({ ...p, documentType: v as DocumentType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="license">License Update</SelectItem>
                      <SelectItem value="registration">Registration Update</SelectItem>
                      <SelectItem value="insurance">Insurance Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Expiration</Label>
                  <Input
                    type="date"
                    value={editForm.expirationDate}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, expirationDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Replace Files (optional)</Label>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/*"
                  onChange={(e) => setEditNewFiles(Array.from(e.target.files ?? []))}
                />
                {editNewFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {editNewFiles.length} file(s) will replace the current attachments on save.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editRow && editMutation.mutate(editRow.du_aid)}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectRow} onOpenChange={(o) => { if (!o) { setRejectRow(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Optional: tell the client why you're rejecting this submission.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectRow(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectRow &&
                rejectMutation.mutate({ id: rejectRow.du_aid, reason: rejectReason })
              }
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request updates dialog */}
      <Dialog
        open={!!requestUpdatesRow}
        onOpenChange={(o) => {
          if (!o) {
            setRequestUpdatesRow(null);
            setRequestMessage("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Updated Documents</DialogTitle>
            <DialogDescription>
              Email + Slack notification will be sent to the client. Status becomes
              "Update Requested".
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Tell the client what's needed (e.g. 'Please re-upload your insurance card — the image was blurry')"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRequestUpdatesRow(null);
                setRequestMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                requestUpdatesRow &&
                requestUpdatesMutation.mutate({
                  id: requestUpdatesRow.du_aid,
                  message: requestMessage,
                })
              }
              disabled={requestUpdatesMutation.isPending}
            >
              {requestUpdatesMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InternalNotesDialog row={notesRow} onClose={() => setNotesRow(null)} />
      <HistoryDialog row={historyRow} onClose={() => setHistoryRow(null)} />

      {/* Delete confirmation */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => { if (!o) setDeleteRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete submission?</DialogTitle>
            <DialogDescription>
              {deleteRow
                ? `This will permanently delete ${deleteRow.du_full_name}'s ${DOC_LABELS[deleteRow.du_document_type]} submission. The audit history will be preserved.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow.du_aid)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
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
            alt="Document full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Internal notes dialog ──────────────────────────────────────────────────

function InternalNotesDialog(props: {
  row: DocumentUpdateRow | null;
  onClose: () => void;
}) {
  const { row, onClose } = props;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; data: InternalNote[] }>({
    queryKey: ["/api/admin/document-updates", row?.du_aid, "notes"],
    enabled: !!row,
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${row!.du_aid}/notes`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load notes");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${row!.du_aid}/notes`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/document-updates", row!.du_aid, "notes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/document-updates", row!.du_aid, "history"],
      });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const notes = data?.data ?? [];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Internal Notes</DialogTitle>
          <DialogDescription>
            {row ? `${row.du_full_name} — ${DOC_LABELS[row.du_document_type]}` : ""} · visible to admins only
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[40vh] overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No internal notes yet.
            </p>
          ) : (
            notes.map((n) => (
              <div key={n.dun_aid} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    {n.dun_author_name ?? "Admin"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(n.dun_created)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{n.dun_note}</p>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs">Add a note</Label>
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Visible to admins only"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => draft.trim() && addMutation.mutate(draft.trim())}
              disabled={!draft.trim() || addMutation.isPending}
            >
              {addMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── History dialog ─────────────────────────────────────────────────────────

const AUDIT_FIELD_LABELS: Record<string, string> = {
  du_full_name: "Full Name",
  du_email: "Email",
  du_phone: "Phone",
  du_plate_number: "Plate",
  du_document_type: "Document Type",
  du_expiration_date: "Expiration",
  du_notes: "Notes",
  du_status: "Status",
  du_reject_reason: "Reject Reason",
  du_update_request_message: "Update Request",
  du_decided_by: "Decided By",
  du_files: "Files",
};

function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    if (v.length > 80) return v.slice(0, 77) + "…";
    return v;
  }
  return String(v);
}

function HistoryDialog(props: {
  row: DocumentUpdateRow | null;
  onClose: () => void;
}) {
  const { row, onClose } = props;
  const { data, isLoading } = useQuery<{ success: boolean; data: AuditEntry[] }>({
    queryKey: ["/api/admin/document-updates", row?.du_aid, "history"],
    enabled: !!row,
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/document-updates/${row!.du_aid}/history`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });
  const entries = data?.data ?? [];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit History</DialogTitle>
          <DialogDescription>
            {row ? `${row.du_full_name} — ${DOC_LABELS[row.du_document_type]}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No history recorded yet.
            </p>
          ) : (
            entries.map((h) => {
              let before: Record<string, unknown> | null = null;
              let after: Record<string, unknown> | null = null;
              try { before = h.dua_before ? JSON.parse(h.dua_before) : null; } catch { before = null; }
              try { after = h.dua_after ? JSON.parse(h.dua_after) : null; } catch { after = null; }
              const changedKeys =
                h.dua_action === "create"
                  ? after
                    ? Object.keys(AUDIT_FIELD_LABELS).filter(
                        (k) => (after as any)[k] != null && (after as any)[k] !== ""
                      )
                    : []
                  : !before || !after
                  ? []
                  : Object.keys(AUDIT_FIELD_LABELS).filter(
                      (k) =>
                        JSON.stringify((before as any)[k] ?? null) !==
                        JSON.stringify((after as any)[k] ?? null)
                    );
              const actionStyle =
                h.dua_action === "reject" || h.dua_action === "delete"
                  ? "bg-red-100 text-red-900"
                  : h.dua_action === "approve"
                  ? "bg-emerald-100 text-emerald-900"
                  : h.dua_action === "request_updates"
                  ? "bg-amber-100 text-amber-900"
                  : h.dua_action === "internal_note"
                  ? "bg-blue-100 text-blue-900"
                  : h.dua_action === "create"
                  ? "bg-violet-100 text-violet-900"
                  : "bg-slate-100 text-slate-900";
              const actionLabel = h.dua_action.replace(/_/g, " ").toUpperCase();
              return (
                <div key={h.dua_aid} className="rounded-md border p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${actionStyle}`}
                      >
                        {actionLabel}
                      </span>
                      <span className="font-medium">{h.dua_actor_name ?? "System"}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(h.dua_created)}
                    </span>
                  </div>
                  {h.dua_notes && (
                    <div className="text-muted-foreground">Notes: {h.dua_notes}</div>
                  )}
                  {changedKeys.length > 0 && (
                    <div className="grid grid-cols-[140px,1fr,1fr] gap-x-2 gap-y-1 text-xs">
                      <span className="font-medium text-muted-foreground">Field</span>
                      <span className="font-medium text-muted-foreground">Before</span>
                      <span className="font-medium text-muted-foreground">After</span>
                      {changedKeys.map((k) => (
                        <Fragment key={k}>
                          <span className="text-foreground">
                            {AUDIT_FIELD_LABELS[k] ?? k}
                          </span>
                          <span className="text-muted-foreground break-words">
                            {formatAuditValue(before ? (before as any)[k] : null)}
                          </span>
                          <span className="text-foreground break-words">
                            {formatAuditValue(after ? (after as any)[k] : null)}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
