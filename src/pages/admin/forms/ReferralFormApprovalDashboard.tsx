/**
 * Referral Form Approval Dashboard
 * Admin view: review, edit (incl. commission amount + status),
 * approve, decline, and delete referral form submissions.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
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
  XCircle,
  Pencil,
  Trash2,
  Eye,
  Search,
  Loader2,
  Filter,
  X,
  Users,
} from "lucide-react";

interface ReferralRow {
  rf_aid: number;
  rf_client_user_id: number | null;
  rf_client_email: string;
  rf_client_name: string;
  rf_date: string;
  rf_referral_first_name: string;
  rf_referral_last_name: string;
  rf_referral_phone_number: string;
  rf_referral_email_address: string;
  rf_status: "pending" | "approved" | "declined";
  rf_decline_reason: string | null;
  rf_approval_date: string | null;
  rf_approved_by: string | null;
  rf_commission_amount: number | null;
  rf_commission_status: "paid" | "unpaid" | "in_review" | null;
  rf_date_submitted: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | string | null) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined") return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}

function CommissionStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  if (status === "paid") return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
  if (status === "unpaid") return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Unpaid</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Review</Badge>;
}

export default function ReferralFormApprovalDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewRow, setViewRow] = useState<ReferralRow | null>(null);
  const [editRow, setEditRow] = useState<ReferralRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ReferralRow | null>(null);
  const [declineRow, setDeclineRow] = useState<ReferralRow | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [editForm, setEditForm] = useState({
    rf_date: "",
    rf_referral_first_name: "",
    rf_referral_last_name: "",
    rf_referral_phone_number: "",
    rf_referral_email_address: "",
    rf_commission_amount: "",
    rf_commission_status: "" as "" | "paid" | "unpaid" | "in_review",
  });

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/referral-forms", statusFilter, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/referral-forms?${params.toString()}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rows: ReferralRow[] = data?.data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-forms"] });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/referral-forms/${id}/approve`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Approved successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(buildApiUrl(`/api/admin/referral-forms/${id}/decline`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to decline");
    },
    onSuccess: () => {
      invalidate();
      setDeclineRow(null);
      setDeclineReason("");
      toast({ title: "Declined successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/referral-forms/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      invalidate();
      setDeleteRow(null);
      toast({ title: "Deleted successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (id: number) => {
      const payload: Record<string, unknown> = {
        rf_date: editForm.rf_date,
        rf_referral_first_name: editForm.rf_referral_first_name,
        rf_referral_last_name: editForm.rf_referral_last_name,
        rf_referral_phone_number: editForm.rf_referral_phone_number,
        rf_referral_email_address: editForm.rf_referral_email_address,
        rf_commission_amount:
          editForm.rf_commission_amount === "" ? null : editForm.rf_commission_amount,
        rf_commission_status:
          editForm.rf_commission_status === "" ? null : editForm.rf_commission_status,
      };
      const res = await fetch(buildApiUrl(`/api/admin/referral-forms/${id}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: () => {
      invalidate();
      setEditRow(null);
      toast({ title: "Updated successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (row: ReferralRow) => {
    setEditRow(row);
    setEditForm({
      rf_date: row.rf_date?.slice(0, 10) ?? "",
      rf_referral_first_name: row.rf_referral_first_name ?? "",
      rf_referral_last_name: row.rf_referral_last_name ?? "",
      rf_referral_phone_number: row.rf_referral_phone_number ?? "",
      rf_referral_email_address: row.rf_referral_email_address ?? "",
      rf_commission_amount:
        row.rf_commission_amount == null ? "" : String(row.rf_commission_amount),
      rf_commission_status: (row.rf_commission_status ?? "") as
        | ""
        | "paid"
        | "unpaid"
        | "in_review",
    });
  };

  const closeEdit = () => setEditRow(null);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = search || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Header + Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 flex-1 w-full">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search referrer or referral name/email..."
              className="pl-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters((p) => !p)}
            className={showFilters || hasActiveFilters ? "border-primary text-primary" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <div className="space-y-1">
            <Label className="text-xs">Date From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Users className="h-10 w-10" />
          <p className="text-sm">No referral forms found.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">Submitted</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center w-[90px]">Status</TableHead>
                <TableHead className="text-right w-[110px]">Commission</TableHead>
                <TableHead className="text-center w-[100px]">Pay Status</TableHead>
                <TableHead className="w-[170px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.rf_aid} className="hover:bg-muted/20">
                  <TableCell className="text-xs">{formatDate(row.rf_date_submitted)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {row.rf_client_name || row.rf_client_email}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.rf_referral_first_name} {row.rf_referral_last_name}
                  </TableCell>
                  <TableCell className="text-sm">{row.rf_referral_phone_number}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={row.rf_referral_email_address}>
                    {row.rf_referral_email_address}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.rf_status} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {formatCurrency(row.rf_commission_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <CommissionStatusBadge status={row.rf_commission_status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewRow(row)}>
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
                      {row.rf_status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700"
                          title="Approve"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(row.rf_aid)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {row.rf_status !== "declined" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          title="Decline"
                          onClick={() => {
                            setDeclineRow(row);
                            setDeclineReason("");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Detail Dialog */}
      <Dialog open={!!viewRow} onOpenChange={(open) => { if (!open) setViewRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Referral Form Details</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Referrer</p>
                  <p className="font-medium">{viewRow.rf_client_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{viewRow.rf_client_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={viewRow.rf_status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatDate(viewRow.rf_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date</p>
                  <p className="font-medium">{formatDate(viewRow.rf_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Referral</p>
                  <p className="font-medium">
                    {viewRow.rf_referral_first_name} {viewRow.rf_referral_last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Phone</p>
                  <p className="font-medium">{viewRow.rf_referral_phone_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Email</p>
                  <p className="font-medium">{viewRow.rf_referral_email_address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission</p>
                  <p className="font-medium font-mono">{formatCurrency(viewRow.rf_commission_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Status</p>
                  <CommissionStatusBadge status={viewRow.rf_commission_status} />
                </div>
                {viewRow.rf_approval_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approval Date</p>
                    <p className="font-medium">{formatDate(viewRow.rf_approval_date)}</p>
                  </div>
                )}
                {viewRow.rf_approved_by && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approved By</p>
                    <p className="font-medium">{viewRow.rf_approved_by}</p>
                  </div>
                )}
                {viewRow.rf_status === "declined" && viewRow.rf_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{viewRow.rf_decline_reason}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewRow(null);
                    openEdit(viewRow);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                {viewRow.rf_status !== "approved" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => {
                      approveMutation.mutate(viewRow.rf_aid);
                      setViewRow(null);
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                  </Button>
                )}
                {viewRow.rf_status !== "declined" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setViewRow(null);
                      setDeclineRow(viewRow);
                      setDeclineReason("");
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Decline
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Edit Referral Form</DialogTitle>
            <DialogDescription>
              {editRow?.rf_client_name || editRow?.rf_client_email} — submitted{" "}
              {formatDate(editRow?.rf_date_submitted ?? null)}
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={editForm.rf_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, rf_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Referral First Name</Label>
                  <Input
                    value={editForm.rf_referral_first_name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, rf_referral_first_name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Referral Last Name</Label>
                  <Input
                    value={editForm.rf_referral_last_name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, rf_referral_last_name: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Referral Phone Number</Label>
                <Input
                  value={editForm.rf_referral_phone_number}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, rf_referral_phone_number: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Referral Email Address</Label>
                <Input
                  type="email"
                  value={editForm.rf_referral_email_address}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, rf_referral_email_address: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label>Commission Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={editForm.rf_commission_amount}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, rf_commission_amount: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Commission Status</Label>
                  <Select
                    value={editForm.rf_commission_status || "none"}
                    onValueChange={(v) =>
                      setEditForm((p) => ({
                        ...p,
                        rf_commission_status:
                          v === "none" ? "" : (v as "paid" | "unpaid" | "in_review"),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              disabled={editMutation.isPending}
              onClick={() => editRow && editMutation.mutate(editRow.rf_aid)}
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog
        open={!!declineRow}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineRow(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Decline Referral Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this submission from{" "}
              <span className="font-medium">
                {declineRow?.rf_client_name || declineRow?.rf_client_email}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea
              rows={3}
              placeholder="Provide a reason for declining..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeclineRow(null);
                setDeclineReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending}
              onClick={() =>
                declineRow &&
                declineMutation.mutate({ id: declineRow.rf_aid, reason: declineReason })
              }
            >
              {declineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(open) => { if (!open) setDeleteRow(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Referral Form</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The referral submitted by{" "}
              <span className="font-medium">
                {deleteRow?.rf_client_name || deleteRow?.rf_client_email}
              </span>{" "}
              will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow.rf_aid)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
