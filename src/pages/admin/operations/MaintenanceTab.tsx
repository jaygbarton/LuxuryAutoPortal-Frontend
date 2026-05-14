import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { MaintenanceModal } from "./MaintenanceModal";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, History } from "lucide-react";
import type { MaintenanceRecord } from "./types";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

interface MaintenanceTabProps {
  /** Pre-select a status filter on mount. */
  defaultStatus?: string;
  /** When true, hide the status filter row (the tab already implies the filter). */
  lockedStatus?: boolean;
}

export function MaintenanceTab({ defaultStatus = "all", lockedStatus = false }: MaintenanceTabProps = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatus);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<MaintenanceRecord | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<MaintenanceRecord | null>(null);

  const { data, isLoading } = useQuery<{ data: MaintenanceRecord[] }>({
    queryKey: ["/api/operations/maintenance", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      const qs = params.toString();
      const response = await fetch(buildApiUrl(`/api/operations/maintenance${qs ? `?${qs}` : ""}`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch maintenance records");
      return response.json();
    },
  });

  const records = data?.data || [];

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(buildApiUrl(`/api/operations/maintenance/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
      toast({ title: "Success", description: "Maintenance status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/maintenance/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
      toast({ title: "Success", description: "Maintenance record deleted" });
      setDeleteModalOpen(false);
      setDeletingRecord(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Maintenance" variant="plain" className="mb-0" />
        <Button onClick={() => { setEditingRecord(null); setModalOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <Plus className="w-4 h-4 mr-2" />
          Add Maintenance
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            {!lockedStatus && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground text-sm">Status:</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="bg-card border-border text-foreground w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="damage_reported">Damage Reported</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="charged_customer">Charged Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {filterStatus !== "all" && (
                  <Button variant="ghost" onClick={() => setFilterStatus("all")} className="text-red-700 hover:text-red-700 hover:bg-red-900/20">
                    Clear Filters
                  </Button>
                )}
              </>
            )}
            <div className={lockedStatus ? "" : "ml-auto"} >
              <span className="text-muted-foreground text-sm">Total: {records.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Make</TableHead>
                  <TableHead className="text-foreground font-medium">Model</TableHead>
                  <TableHead className="text-foreground font-medium">Year</TableHead>
                  <TableHead className="text-foreground font-medium">Plate #</TableHead>
                  <TableHead className="text-foreground font-medium">Description</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium">Scheduled Date</TableHead>
                  <TableHead className="text-foreground font-medium">Due Date</TableHead>
                  <TableHead className="text-foreground font-medium">Status</TableHead>
                  <TableHead className="text-foreground font-medium">Repair Shop</TableHead>
                  <TableHead className="text-foreground font-medium">Notes</TableHead>
                  <TableHead className="text-foreground font-medium">Photos</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">Loading maintenance records...</TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">No maintenance records found</TableCell>
                  </TableRow>
                ) : (
                  records.map((rec) => {
                    // Prefer the joined car fields (populated for rows created via the new
                    // car-id-aware flow). For legacy rows where only car_name exists,
                    // best-effort split on whitespace so the table still shows something.
                    const fallbackParts = (rec.car_name || "").trim().split(/\s+/);
                    const make = rec.car_make || fallbackParts[0] || "--";
                    const model =
                      rec.car_model || (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ") : "--");
                    const year = rec.car_year != null ? String(rec.car_year) : "--";
                    const plate = rec.car_plate || "--";
                    return (
                    <TableRow key={rec.id} className="border-border hover:bg-card/50 transition-colors">
                      <TableCell className="text-foreground">{make}</TableCell>
                      <TableCell className="text-foreground">{model}</TableCell>
                      <TableCell className="text-foreground">{year}</TableCell>
                      <TableCell className="text-foreground font-mono text-sm">{plate}</TableCell>
                      <TableCell className="text-foreground text-sm max-w-[200px] truncate" title={rec.task_description}>{rec.task_description}</TableCell>
                      <TableCell className="text-foreground">{rec.assigned_to}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(rec.scheduled_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(rec.due_date)}</TableCell>
                      <TableCell>
                        <Select
                          value={rec.status}
                          onValueChange={(v) => statusUpdateMutation.mutate({ id: rec.id, status: v })}
                        >
                          <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                            <StatusBadge status={rec.status} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="damage_reported">Damage Reported</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="in_repair">In Repair</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="charged_customer">Charged Customer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate" title={rec.repair_shop || undefined}>{rec.repair_shop || "--"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={rec.notes || undefined}>{rec.notes || "--"}</TableCell>
                      <TableCell>
                        {rec.photos && rec.photos.length > 0 ? (
                          <PhotoUpload photos={rec.photos} onPhotosChange={() => {}} entityType="maintenance" entityId={rec.id} disabled />
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setEditingRecord(rec); setModalOpen(true); }}
                            className="text-muted-foreground hover:text-primary h-8 px-2"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setHistoryRecord(rec); setHistoryModalOpen(true); }}
                            className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                            title="View History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => { setDeletingRecord(rec); setDeleteModalOpen(true); }}
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

      <MaintenanceModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingRecord(null); }}
        record={editingRecord}
      />

      {deleteModalOpen && deletingRecord && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Maintenance Record</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this maintenance record for {deletingRecord.car_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="bg-card text-foreground border-border">Cancel</Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingRecord.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyRecord && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit History</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(historyRecord.created_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">{formatDate(historyRecord.updated_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyRecord.status} />
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">From Inspection</span>
                <span className="text-foreground">{historyRecord.inspection_id ? `#${historyRecord.inspection_id}` : "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">{historyRecord.assigned_to}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
