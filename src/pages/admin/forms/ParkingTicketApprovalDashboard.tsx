/**
 * Parking Ticket Approval Dashboard
 * Admin view: review, edit (car / date / amount), approve, decline, and delete
 * parking ticket submissions. Status: New / Approved / Declined.
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
  ParkingCircle,
} from "lucide-react";

interface ParkingTicketRow {
  pt_aid: number;
  pt_client_user_id: number | null;
  pt_client_email: string;
  pt_client_name: string;
  pt_car_id: number | null;
  pt_car_label: string;
  pt_receipt_date: string;
  pt_amount: number | string;
  pt_status: "new" | "approved" | "declined";
  pt_decline_reason: string | null;
  pt_decision_date: string | null;
  pt_decided_by: string | null;
  pt_date_submitted: string;
}

interface CarOption {
  id: number;
  label: string;
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

function formatCurrency(v: number | string | null) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n)
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined")
    return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">New</Badge>;
}

export default function ParkingTicketApprovalDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewRow, setViewRow] = useState<ParkingTicketRow | null>(null);
  const [editRow, setEditRow] = useState<ParkingTicketRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ParkingTicketRow | null>(null);
  const [declineRow, setDeclineRow] = useState<ParkingTicketRow | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [editForm, setEditForm] = useState({
    pt_car_id: "",
    pt_receipt_date: "",
    pt_amount: "",
  });

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/parking-tickets", statusFilter, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/parking-tickets?${params.toString()}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Full fleet, for the edit dialog's car selector.
  const { data: carsData } = useQuery({
    queryKey: ["/api/parking-tickets/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/parking-tickets/cars"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
    enabled: !!editRow,
  });
  const cars: CarOption[] = carsData?.data ?? [];

  const rows: ParkingTicketRow[] = data?.data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/parking-tickets"] });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/parking-tickets/${id}/approve`), {
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
      const res = await fetch(buildApiUrl(`/api/admin/parking-tickets/${id}/decline`), {
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
      const res = await fetch(buildApiUrl(`/api/admin/parking-tickets/${id}`), {
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
        pt_car_id: editForm.pt_car_id === "" ? undefined : Number(editForm.pt_car_id),
        pt_receipt_date: editForm.pt_receipt_date,
        pt_amount: editForm.pt_amount === "" ? null : editForm.pt_amount,
      };
      const res = await fetch(buildApiUrl(`/api/admin/parking-tickets/${id}`), {
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

  const openEdit = (row: ParkingTicketRow) => {
    setEditRow(row);
    setEditForm({
      pt_car_id: row.pt_car_id == null ? "" : String(row.pt_car_id),
      pt_receipt_date: row.pt_receipt_date?.slice(0, 10) ?? "",
      pt_amount: row.pt_amount == null ? "" : String(row.pt_amount),
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
              placeholder="Search owner or car..."
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
            <SelectItem value="new">New</SelectItem>
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
          <ParkingCircle className="h-10 w-10" />
          <p className="text-sm">No parking tickets found.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">Submitted</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Car</TableHead>
                <TableHead className="w-[120px]">Date of Receipt</TableHead>
                <TableHead className="text-right w-[110px]">Amount</TableHead>
                <TableHead className="text-center w-[90px]">Status</TableHead>
                <TableHead className="w-[170px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.pt_aid} className="hover:bg-muted/20">
                  <TableCell className="text-xs">{formatDate(row.pt_date_submitted)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {row.pt_client_name || row.pt_client_email}
                  </TableCell>
                  <TableCell className="text-sm">{row.pt_car_label}</TableCell>
                  <TableCell className="text-sm">{formatDate(row.pt_receipt_date)}</TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {formatCurrency(row.pt_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.pt_status} />
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
                      {row.pt_status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700"
                          title="Approve"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(row.pt_aid)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {row.pt_status !== "declined" && (
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
            <DialogTitle className="text-primary">Parking Ticket Details</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Owner</p>
                  <p className="font-medium">{viewRow.pt_client_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{viewRow.pt_client_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={viewRow.pt_status} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car</p>
                  <p className="font-medium">{viewRow.pt_car_label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date of Receipt</p>
                  <p className="font-medium">{formatDate(viewRow.pt_receipt_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Amount</p>
                  <p className="font-medium font-mono">{formatCurrency(viewRow.pt_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Submitted</p>
                  <p className="font-medium">{formatDate(viewRow.pt_date_submitted)}</p>
                </div>
                {viewRow.pt_decision_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Decision Date</p>
                    <p className="font-medium">{formatDate(viewRow.pt_decision_date)}</p>
                  </div>
                )}
                {viewRow.pt_decided_by && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Decided By</p>
                    <p className="font-medium">{viewRow.pt_decided_by}</p>
                  </div>
                )}
                {viewRow.pt_status === "declined" && viewRow.pt_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{viewRow.pt_decline_reason}</p>
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
                {viewRow.pt_status !== "approved" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => {
                      approveMutation.mutate(viewRow.pt_aid);
                      setViewRow(null);
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                  </Button>
                )}
                {viewRow.pt_status !== "declined" && (
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
            <DialogTitle className="text-primary">Edit Parking Ticket</DialogTitle>
            <DialogDescription>
              {editRow?.pt_client_name || editRow?.pt_client_email} — submitted{" "}
              {formatDate(editRow?.pt_date_submitted ?? null)}
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Car</Label>
                <Select
                  value={editForm.pt_car_id}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, pt_car_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={editRow.pt_car_label || "Select a car"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cars.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date of Receipt</Label>
                  <Input
                    type="date"
                    value={editForm.pt_receipt_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, pt_receipt_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount</Label>
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
                      value={editForm.pt_amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, pt_amount: e.target.value }))}
                    />
                  </div>
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
              onClick={() => editRow && editMutation.mutate(editRow.pt_aid)}
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
            <DialogTitle className="text-destructive">Decline Parking Ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this submission from{" "}
              <span className="font-medium">
                {declineRow?.pt_client_name || declineRow?.pt_client_email}
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
                declineMutation.mutate({ id: declineRow.pt_aid, reason: declineReason })
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
            <DialogTitle className="text-destructive">Delete Parking Ticket</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The parking ticket submitted by{" "}
              <span className="font-medium">
                {deleteRow?.pt_client_name || deleteRow?.pt_client_email}
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
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow.pt_aid)}
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
