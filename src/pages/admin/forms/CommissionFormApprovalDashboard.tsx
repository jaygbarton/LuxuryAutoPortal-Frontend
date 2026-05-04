/**
 * Commission Form Approval Dashboard
 * Admin view: review, edit, approve, decline, and delete commission form submissions
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  XCircle,
  Pencil,
  Trash2,
  Eye,
  Search,
  Loader2,
  Filter,
  X,
  FileText,
  ExternalLink,
  DollarSign,
  ZoomIn,
} from "lucide-react";

interface CommissionFormRow {
  cf_aid: number;
  cf_employee_id: number;
  cf_date_submitted: string;
  cf_approval_date: string | null;
  cf_approved_by: string | null;
  cf_commission_date: string;
  cf_commission_type: string;
  cf_car_name: string;
  cf_total_receipt_cost: number;
  cf_remarks: string | null;
  cf_receipt_url: string | null;
  cf_status: "pending" | "approved" | "declined";
  cf_decline_reason: string | null;
  employee_name?: string;
  employee_email?: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "declined") return <Badge className="bg-red-100 text-red-800 border-red-200">Declined</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
}


export default function CommissionFormApprovalDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [viewRow, setViewRow] = useState<CommissionFormRow | null>(null);
  const [editRow, setEditRow] = useState<CommissionFormRow | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<CommissionFormRow | null>(null);
  const [declineRow, setDeclineRow] = useState<CommissionFormRow | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const [editForm, setEditForm] = useState({
    cf_commission_date: "",
    cf_commission_type: "",
    cf_total_receipt_cost: "",
    cf_remarks: "",
    cf_receipt_url: "",
  });
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);

  // Car search state for edit modal
  const [editCarSearch, setEditCarSearch] = useState("");
  const [editCarName, setEditCarName] = useState("");
  const [editCarDropdownOpen, setEditCarDropdownOpen] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/commission-forms", statusFilter, search, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/commission-forms?${params.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: optionsData } = useQuery({
    queryKey: ["/api/commission-forms/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/commission-forms/options"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
  });

  const cars: { id: number; name: string; vin: string | null; plate: string | null }[] =
    optionsData?.data?.cars ?? [];

  const filteredEditCars = cars.filter((car) => {
    const q = editCarSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      car.name.toLowerCase().includes(q) ||
      (car.vin ?? "").toLowerCase().includes(q) ||
      (car.plate ?? "").toLowerCase().includes(q)
    );
  });

  const rows: CommissionFormRow[] = data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/commission-forms"] });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/commission-forms/${id}/approve`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
    },
    onSuccess: () => { invalidate(); toast({ title: "Approved successfully" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(buildApiUrl(`/api/admin/commission-forms/${id}/decline`), {
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
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/commission-forms/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { invalidate(); setDeleteRow(null); toast({ title: "Deleted successfully" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (id: number) => {
      const fd = new FormData();
      fd.append("cf_commission_date", editForm.cf_commission_date);
      fd.append("cf_commission_type", editForm.cf_commission_type);
      fd.append("cf_car_name", editCarName || editCarSearch.trim());
      fd.append("cf_total_receipt_cost", editForm.cf_total_receipt_cost);
      fd.append("cf_remarks", editForm.cf_remarks);
      if (editReceiptFile) {
        fd.append("receipt", editReceiptFile);
      } else {
        fd.append("cf_receipt_url", editForm.cf_receipt_url || "");
      }

      const res = await fetch(buildApiUrl(`/api/admin/commission-forms/${id}`), {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      invalidate();
      setEditRow(null);
      setEditReceiptFile(null);
      toast({ title: "Updated successfully" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEdit = (row: CommissionFormRow) => {
    setEditRow(row);
    setEditForm({
      cf_commission_date: row.cf_commission_date?.slice(0, 10) ?? "",
      cf_commission_type: row.cf_commission_type ?? "",
      cf_total_receipt_cost: String(row.cf_total_receipt_cost ?? ""),
      cf_remarks: row.cf_remarks ?? "",
      cf_receipt_url: row.cf_receipt_url ?? "",
    });
    setEditCarName(row.cf_car_name ?? "");
    setEditCarSearch(row.cf_car_name ?? "");
    setEditCarDropdownOpen(false);
    setEditReceiptFile(null);
  };

  const closeEdit = () => {
    setEditRow(null);
    setEditReceiptFile(null);
    setEditCarSearch("");
    setEditCarName("");
    setEditCarDropdownOpen(false);
  };

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
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee, car, type..."
              className="pl-9"
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
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
          <DollarSign className="h-10 w-10" />
          <p className="text-sm">No commission forms found.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">Date Submitted</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="w-[110px]">Comm. Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Car</TableHead>
                <TableHead className="text-right w-[110px]">Amount</TableHead>
                <TableHead className="w-[90px] text-center">Status</TableHead>
                <TableHead className="w-[140px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.cf_aid} className="hover:bg-muted/20">
                  <TableCell className="text-xs">{formatDate(row.cf_date_submitted)}</TableCell>
                  <TableCell className="text-sm font-medium">{row.employee_name || "—"}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.cf_commission_date)}</TableCell>
                  <TableCell className="text-sm">{row.cf_commission_type}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate" title={row.cf_car_name}>
                    {row.cf_car_name}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {formatCurrency(row.cf_total_receipt_cost)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.cf_status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewRow(row)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Edit" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {row.cf_status !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700"
                          title="Approve"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(row.cf_aid)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {row.cf_status !== "declined" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          title="Decline"
                          onClick={() => { setDeclineRow(row); setDeclineReason(""); }}
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
            <DialogTitle className="text-primary">Commission Form Details</DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Employee</p>
                  <p className="font-medium">{viewRow.employee_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={viewRow.cf_status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Date Submitted</p>
                  <p className="font-medium">{formatDate(viewRow.cf_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Date</p>
                  <p className="font-medium">{formatDate(viewRow.cf_commission_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Commission Type</p>
                  <p className="font-medium">{viewRow.cf_commission_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Receipt Cost</p>
                  <p className="font-medium font-mono">{formatCurrency(viewRow.cf_total_receipt_cost)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Car Name</p>
                  <p className="font-medium">{viewRow.cf_car_name}</p>
                </div>
                {viewRow.cf_approval_date && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approval Date</p>
                    <p className="font-medium">{formatDate(viewRow.cf_approval_date)}</p>
                  </div>
                )}
                {viewRow.cf_approved_by && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Approved By</p>
                    <p className="font-medium">{viewRow.cf_approved_by}</p>
                  </div>
                )}
                {viewRow.cf_remarks && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Remarks</p>
                    <p className="font-medium">{viewRow.cf_remarks}</p>
                  </div>
                )}
                {viewRow.cf_status === "declined" && viewRow.cf_decline_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Decline Reason</p>
                    <p className="text-red-800 mt-1">{viewRow.cf_decline_reason}</p>
                  </div>
                )}
              </div>

              {viewRow.cf_receipt_url && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Receipt</p>
                  {viewRow.cf_receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <button
                      type="button"
                      className="relative group block w-fit"
                      onClick={() => setLightboxUrl(getProxiedImageUrl(viewRow.cf_receipt_url ?? ""))}
                    >
                      <img
                        src={getProxiedImageUrl(viewRow.cf_receipt_url ?? "")}
                        alt="Receipt"
                        className="max-h-48 rounded-md object-contain border border-border transition-opacity group-hover:opacity-80"
                      />
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="h-7 w-7 text-white drop-shadow-lg" />
                      </span>
                    </button>
                  ) : (
                    <a
                      href={getProxiedImageUrl(viewRow.cf_receipt_url ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      View Receipt
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setViewRow(null); openEdit(viewRow); }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                {viewRow.cf_status !== "approved" && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => { approveMutation.mutate(viewRow.cf_aid); setViewRow(null); }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Approve
                  </Button>
                )}
                {viewRow.cf_status !== "declined" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setViewRow(null); setDeclineRow(viewRow); setDeclineReason(""); }}
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
            <DialogTitle className="text-primary">Edit Commission Form</DialogTitle>
            <DialogDescription>
              {editRow?.employee_name} — submitted {formatDate(editRow?.cf_date_submitted ?? null)}
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Commission Date</Label>
                  <Input
                    type="date"
                    value={editForm.cf_commission_date}
                    onChange={(e) => setEditForm((p) => ({ ...p, cf_commission_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Commission Type</Label>
                  <Input
                    value={editForm.cf_commission_type}
                    onChange={(e) => setEditForm((p) => ({ ...p, cf_commission_type: e.target.value }))}
                  />
                </div>
              </div>

              {/* Car Name — searchable dropdown */}
              <div className="relative space-y-1.5">
                <Label>Car Name</Label>
                <p className="text-xs text-muted-foreground">Type car name, VIN, or plate number to search.</p>
                <Input
                  value={editCarDropdownOpen ? editCarSearch : editCarName || editCarSearch}
                  onChange={(e) => {
                    setEditCarSearch(e.target.value);
                    setEditCarDropdownOpen(true);
                    if (!e.target.value) setEditCarName("");
                  }}
                  onFocus={() => setEditCarDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setEditCarDropdownOpen(false), 150)}
                  placeholder="Type car name, VIN, or plate number..."
                />
                {editCarDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border border-border bg-background shadow-lg">
                    {filteredEditCars.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {cars.length === 0 ? "No cars loaded." : "No matching car. Try name, VIN, or plate."}
                      </div>
                    ) : (
                      filteredEditCars.map((car) => (
                        <button
                          key={car.id}
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditCarName(car.name);
                            setEditCarSearch(car.name);
                            setEditCarDropdownOpen(false);
                          }}
                        >
                          {car.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Total Receipt Cost</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={editForm.cf_total_receipt_cost}
                    onChange={(e) => setEditForm((p) => ({ ...p, cf_total_receipt_cost: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea
                  rows={2}
                  value={editForm.cf_remarks}
                  onChange={(e) => setEditForm((p) => ({ ...p, cf_remarks: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Replace Receipt (optional)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setEditReceiptFile(e.target.files?.[0] ?? null)}
                />
                {editForm.cf_receipt_url && !editReceiptFile && (
                  <p className="text-xs text-muted-foreground">
                    Current:{" "}
                    <a
                      href={getProxiedImageUrl(editForm.cf_receipt_url ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View existing receipt
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              disabled={editMutation.isPending}
              onClick={() => editRow && editMutation.mutate(editRow.cf_aid)}
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={!!declineRow} onOpenChange={(open) => { if (!open) { setDeclineRow(null); setDeclineReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Decline Commission Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this submission from{" "}
              <span className="font-medium">{declineRow?.employee_name}</span>?
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
            <Button variant="outline" onClick={() => { setDeclineRow(null); setDeclineReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending}
              onClick={() => declineRow && declineMutation.mutate({ id: declineRow.cf_aid, reason: declineReason })}
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
            <DialogTitle className="text-destructive">Delete Commission Form</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The commission form submitted by{" "}
              <span className="font-medium">{deleteRow?.employee_name}</span> will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow.cf_aid)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Lightbox */}
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
            alt="Receipt full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
