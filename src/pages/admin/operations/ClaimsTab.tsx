import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { ClaimModal } from "./ClaimModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { Claim } from "./types";

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return dateStr;
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export function ClaimsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingClaim, setDeletingClaim] = useState<Claim | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("operations.claims");

  const { data: meData } = useQuery<{ user?: { firstName?: string; lastName?: string } }>({
    queryKey: ["/api/auth/me"],
  });
  const currentUserName = meData?.user
    ? `${meData.user.firstName || ""} ${meData.user.lastName || ""}`.trim()
    : undefined;

  const { data, isLoading } = useQuery<{ data: Claim[]; total: number }>({
    queryKey: ["/api/operations/claims", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      params.append("limit", "5000");
      const response = await fetch(
        buildApiUrl(`/api/operations/claims?${params.toString()}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch claims");
      return response.json();
    },
  });

  const rawClaims = data?.data || [];

  const claims = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawClaims;
    return rawClaims.filter((c) => {
      const hay = [
        c.reservationId,
        c.claimId,
        c.damageReport,
        c.damageReportLink,
        c.incidentReportLink,
        c.shopName,
        c.description,
        c.assignedTo,
        c.status,
        c.carName,
        c.vin,
        c.plate,
        c.guestName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rawClaims, search]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, search, pageSize]);

  const pagedClaims = useMemo(
    () => claims.slice((page - 1) * pageSize, page * pageSize),
    [claims, page, pageSize],
  );

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(buildApiUrl(`/api/operations/claims/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/claims"] });
      toast({ title: "Success", description: "Claim status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const assigneeUpdateMutation = useMutation({
    mutationFn: async ({
      id,
      assignedTo,
      assignedToId,
    }: {
      id: number;
      assignedTo: string | null;
      assignedToId: number | null;
    }) => {
      const response = await fetch(buildApiUrl(`/api/operations/claims/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedTo, assignedToId }),
      });
      if (!response.ok) throw new Error("Failed to update assignee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/claims"] });
      toast({ title: "Assigned employee updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/claims/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/claims"] });
      toast({ title: "Success", description: "Claim deleted" });
      setDeleteModalOpen(false);
      setDeletingClaim(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const requestedCount = rawClaims.filter((c) => c.status === "estimate_requested").length;
  const sentCount = rawClaims.filter((c) => c.status === "estimate_sent_to_turo").length;
  const resolvedCount = rawClaims.filter((c) => c.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Claims" variant="plain" className="mb-0" />
        <Button
          onClick={() => { setEditingClaim(null); setModalOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Manual Claim
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Estimate Requested" value={String(requestedCount)} variant="gold" />
        <SummaryCard label="Sent to Turo" value={String(sentCount)} variant="dark" />
        <SummaryCard label="Resolved" value={String(resolvedCount)} variant="white" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reservation #, claim ID, car, guest, assignee..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="estimate_requested">Estimate Requested</SelectItem>
                  <SelectItem value="estimate_sent_to_turo">Estimate Sent to Turo</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="not_resolved">Not Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {claims.length}
          </div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading claims...</p>
            ) : claims.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No claims found</p>
            ) : (
              pagedClaims.map((claim) => {
                const statusAccent =
                  claim.status === "resolved"
                    ? { bg: "bg-green-600", border: "border-green-300" }
                    : claim.status === "not_resolved"
                    ? { bg: "bg-red-600", border: "border-red-300" }
                    : claim.status === "estimate_sent_to_turo"
                    ? { bg: "bg-blue-500", border: "border-blue-300" }
                    : claim.status === "new"
                    ? { bg: "bg-slate-500", border: "border-slate-300" }
                    : { bg: "bg-amber-500", border: "border-amber-300" };

                const statusControl = (
                  <Select
                    value={claim.status}
                    onValueChange={(v) => statusUpdateMutation.mutate({ id: claim.id, status: v })}
                  >
                    <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                      <StatusBadge status={claim.status} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="estimate_requested">Estimate Requested</SelectItem>
                      <SelectItem value="estimate_sent_to_turo">Estimate Sent to Turo</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="not_resolved">Not Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                );

                const actionsEl = (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingClaim(claim); setModalOpen(true); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDeletingClaim(claim); setDeleteModalOpen(true); }} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );

                const linkEl = (url: string | null) =>
                  url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all hover:text-primary/80"
                    >
                      Open
                    </a>
                  ) : (
                    "--"
                  );

                const estimateCostEl =
                  claim.estimateCost != null
                    ? `$${Number(claim.estimateCost).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "--";

                const receiptEl =
                  claim.receiptPhotos && claim.receiptPhotos.length > 0 ? (
                    <PhotoUpload
                      photos={claim.receiptPhotos}
                      onPhotosChange={() => {}}
                      entityType="claim"
                      entityId={claim.id}
                      disabled
                      compact
                    />
                  ) : (
                    "--"
                  );

                const assigneeEl = (
                  <EmployeeSelectCombobox
                    value={claim.assignedTo || ""}
                    onChange={(v) => { if (!v) assigneeUpdateMutation.mutate({ id: claim.id, assignedTo: null, assignedToId: null }); }}
                    onSelectEmployee={(emp) => {
                      if (emp) {
                        const fullName = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || emp.employee_email || `Employee #${emp.employee_aid}`;
                        assigneeUpdateMutation.mutate({ id: claim.id, assignedTo: fullName, assignedToId: emp.employee_aid });
                      }
                    }}
                    placeholder="Assign..."
                  />
                );

                return (
                  <DashboardRecordCard
                    key={claim.id}
                    accentBg={statusAccent.bg}
                    accentBorder={statusAccent.border}
                    typeLabel="Claim"
                    reservationId={claim.reservationId}
                    carName={claim.carName || "--"}
                    plate={claim.plate}
                    guestName={claim.guestName}
                    assignedTo={claim.assignedTo || null}
                    tripStart={formatDateTime(claim.tripStart)}
                    tripEnd={formatDateTime(claim.tripEnd)}
                    statusControl={statusControl}
                    notes={claim.description}
                    details={[
                      { label: "Claim ID", value: claim.claimId || "--" },
                      { label: "VIN", value: claim.vin || "--" },
                      { label: "Damage Report", value: claim.damageReport || "--" },
                      { label: "Damage Report Link", value: linkEl(claim.damageReportLink) },
                      { label: "Incident Report Link", value: linkEl(claim.incidentReportLink) },
                      { label: "Shop Name", value: claim.shopName || "--" },
                      { label: "Estimate Cost", value: estimateCostEl },
                      { label: "Receipt", value: receiptEl },
                      { label: "Deadline", value: formatDate(claim.deadline) },
                      { label: "Assigned To", value: assigneeEl },
                      { label: "Source", value: claim.source === "email" ? "Turo Email" : "Manual" },
                      { label: "Actions", value: actionsEl },
                    ]}
                  />
                );
              })
            )}
          </div>
        </div>
        <TablePagination
          totalItems={claims.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      <ClaimModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingClaim(null);
        }}
        claim={editingClaim}
        defaultAssignedTo={!editingClaim ? currentUserName : undefined}
      />

      {deleteModalOpen && deletingClaim && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Claim</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete the claim for{" "}
                {deletingClaim.reservationId
                  ? `reservation #${deletingClaim.reservationId}`
                  : deletingClaim.claimId
                  ? `claim #${deletingClaim.claimId}`
                  : "this record"}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
                className="bg-card text-foreground border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingClaim.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
