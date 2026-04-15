import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { InspectionModal } from "./InspectionModal";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ArrowRight, Wrench, History } from "lucide-react";
import type { Inspection, MaintenanceRecord } from "./types";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState<Inspection | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(null);

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

  const { data: maintenanceData } = useQuery<{ data: MaintenanceRecord[] }>({
    queryKey: ["/api/operations/maintenance", "all"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/maintenance?limit=500"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch maintenance");
      return response.json();
    },
  });

  const inspections = data?.data || [];
  const maintenanceRecords = maintenanceData?.data || [];

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground text-sm">Status:</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterStatus !== "all" && (
              <Button variant="ghost" onClick={() => setFilterStatus("all")} className="text-red-700 hover:text-red-700 hover:bg-red-900/20">
                Clear Filters
              </Button>
            )}
            <div className="ml-auto text-muted-foreground text-sm">Total: {inspections.length}</div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Car</TableHead>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading inspections...</TableCell>
                  </TableRow>
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No inspections found</TableCell>
                  </TableRow>
                ) : (
                  inspections.map((insp) => {
                    const movedToMaint = isMovedToMaintenance(insp.id);
                    return (
                      <TableRow key={insp.id} className="border-border hover:bg-card/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{insp.car_name}</span>
                            {movedToMaint && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-[10px] px-1.5 py-0 gap-1">
                                <Wrench className="w-2.5 h-2.5" />
                                In Maintenance
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
                            {!movedToMaint && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => moveToMaintenanceMutation.mutate(insp.id)}
                                className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                                title="Move to Maintenance"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
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
