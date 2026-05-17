import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { StatusBadge } from "./StatusBadge";
import { InspectionModal } from "./InspectionModal";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, ArrowRight, Wrench, History, CheckCircle2 } from "lucide-react";
import type { Inspection, MaintenanceRecord, TuroTrip } from "./types";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export function CarInspectionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState<Inspection | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.carIssues",
  );
  const carNameWithYear = useCarNameWithYear();

  const { data, isLoading } = useQuery<{ data: Inspection[] }>({
    queryKey: ["/api/operations/inspections", "all_sources", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      const qs = params.toString();
      const response = await fetch(buildApiUrl(`/api/operations/inspections${qs ? `?${qs}` : ""}`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const { data: maintenanceData, isLoading: isMaintLoading } = useQuery<{ data: MaintenanceRecord[] }>({
    queryKey: ["/api/operations/maintenance", "all"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/maintenance?limit=500"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch maintenance");
      return response.json();
    },
  });

  // Trips lookup so we can show plate # from the linked Turo trip.
  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 500 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=500"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawInspections = data?.data || [];
  const maintenanceRecords = maintenanceData?.data || [];

  const inspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;
    return rawInspections.filter((insp) => {
      if (q) {
        const hay = [
          insp.car_name,
          insp.reservation_id,
          insp.assigned_to,
          insp.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterSource !== "all" && insp.source !== filterSource) return false;
      if (from != null || to != null) {
        const d = insp.inspection_date
          ? new Date(insp.inspection_date).getTime()
          : null;
        if (d == null) return false;
        if (from != null && d < from) return false;
        if (to != null && d > to) return false;
      }
      return true;
    });
  }, [rawInspections, search, filterSource, dateFrom, dateTo]);

  const hasActiveFilters =
    filterStatus !== "all" ||
    filterSource !== "all" ||
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSource, search, dateFrom, dateTo, pageSize]);

  const pagedInspections = useMemo(
    () => inspections.slice((page - 1) * pageSize, page * pageSize),
    [inspections, page, pageSize],
  );

  const isMovedToMaintenance = (inspectionId: number): boolean => {
    return maintenanceRecords.some(m => m.inspection_id === inspectionId);
  };

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const moveToMaintenanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}/move-to-maintenance`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to move to maintenance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
      toast({ title: "Success", description: "Moved to maintenance" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection deleted" });
      setDeleteModalOpen(false);
      setDeletingInspection(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Car Inspections" variant="plain" className="mb-0" />
        <Button onClick={() => { setEditingInspection(null); setModalOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <Plus className="w-4 h-4 mr-2" />
          Add Manual Inspection
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, reservation, assignee..."
                className="bg-card border-border text-foreground h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_issues">No Car Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Source</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="bg-card border-border text-foreground w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="turo_return">Turo Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Inspection From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Inspection To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus("all");
                  setFilterSource("all");
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {inspections.length}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Car</TableHead>
                  <TableHead className="text-foreground font-medium">Plate #</TableHead>
                  <TableHead className="text-foreground font-medium">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium">Source</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium">Status</TableHead>
                  <TableHead className="text-foreground font-medium">Scheduled Date</TableHead>
                  <TableHead className="text-foreground font-medium">Due Date</TableHead>
                  <TableHead className="text-foreground font-medium">Notes</TableHead>
                  <TableHead className="text-foreground font-medium">Photos</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isMaintLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Loading inspections...</TableCell>
                  </TableRow>
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No inspections found</TableCell>
                  </TableRow>
                ) : (
                  pagedInspections.map((insp) => {
                    const movedToMaint = isMovedToMaintenance(insp.id);
                    const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
                    return (
                      <TableRow key={insp.id} className="border-border hover:bg-card/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">
                              {carNameWithYear(insp.car_name, trip?.plateNumber)}
                            </span>
                            {movedToMaint && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-[10px] px-1.5 py-0 gap-1">
                                <Wrench className="w-2.5 h-2.5" />
                                In Maintenance
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">{trip?.plateNumber || "--"}</TableCell>
                        <TableCell className="text-foreground font-mono text-sm">{insp.reservation_id || "--"}</TableCell>
                        <TableCell className="text-muted-foreground capitalize text-sm">{insp.source?.replace(/_/g, " ") || "--"}</TableCell>
                        <TableCell className="text-foreground">{insp.assigned_to}</TableCell>
                        <TableCell>
                          <Select
                            value={insp.status}
                            onValueChange={(v) => statusUpdateMutation.mutate({ id: insp.id, status: v })}
                          >
                            <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                              <StatusBadge status={insp.status} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="no_issues">No Car Issues</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(insp.inspection_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(insp.due_date)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={insp.notes || undefined}>{insp.notes || "--"}</TableCell>
                        <TableCell>
                          {insp.photos && insp.photos.length > 0 ? (
                            <PhotoUpload photos={insp.photos} onPhotosChange={() => {}} entityType="inspection" entityId={insp.id} disabled />
                          ) : (
                            <span className="text-muted-foreground text-sm">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setEditingInspection(insp); setModalOpen(true); }}
                              className="text-muted-foreground hover:text-primary h-8 px-2"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setHistoryInspection(insp); setHistoryModalOpen(true); }}
                              className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                              title="View History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            {!movedToMaint && insp.status !== "no_issues" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => moveToMaintenanceMutation.mutate(insp.id)}
                                className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                                title="Move to Maintenance"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!movedToMaint && insp.status !== "no_issues" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => statusUpdateMutation.mutate({ id: insp.id, status: "no_issues" })}
                                className="text-muted-foreground hover:text-emerald-400 h-8 px-2"
                                title="Mark No Car Issues"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setDeletingInspection(insp); setDeleteModalOpen(true); }}
                              className="text-muted-foreground hover:text-red-700 h-8 px-2"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <TablePagination
          totalItems={inspections.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading || isMaintLoading}
        />
      </div>

      <InspectionModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingInspection(null); }}
        inspection={editingInspection}
      />

      {deleteModalOpen && deletingInspection && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Inspection</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this inspection for {deletingInspection.car_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="bg-card text-foreground border-border">Cancel</Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingInspection.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyInspection && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit History</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(historyInspection.created_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">{formatDate(historyInspection.updated_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyInspection.status} />
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground capitalize">{historyInspection.source?.replace(/_/g, " ") || "Manual"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moved to Maintenance</span>
                <span className="text-foreground">{isMovedToMaintenance(historyInspection.id) ? "Yes" : "No"}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
