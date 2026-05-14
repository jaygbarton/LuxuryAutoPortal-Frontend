import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "./PhotoUpload";
import { CarSelectCombobox } from "./CarSelectCombobox";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import type { MaintenanceRecord } from "./types";

interface MaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: MaintenanceRecord | null;
  prefill?: {
    inspection_id?: number;
    car_name?: string;
    /** Pre-fill description (e.g. from an approved Pending Car Issue title). */
    task_description?: string;
    /** Pre-fill notes (e.g. concatenated contributor notes). */
    notes?: string;
    /** Pre-fill photo URLs (e.g. attachments from contributors). */
    photos?: string[];
    /**
     * If set, approving this maintenance record also flips the matching
     * Pending Car Issue to status='approved' and links it to the new
     * maintenance row. Used by the "Approve & Schedule" flow.
     */
    pending_issue_id?: number;
  };
}

export function MaintenanceModal({ open, onOpenChange, record, prefill }: MaintenanceModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!record;

  const [formData, setFormData] = useState({
    inspection_id: record?.inspection_id || prefill?.inspection_id || null,
    car_id: record?.car_id ?? null,
    car_name: record?.car_name || prefill?.car_name || "",
    task_description: record?.task_description || prefill?.task_description || "",
    assigned_to: record?.assigned_to || "",
    assigned_to_id: record?.assigned_to_id ?? null,
    scheduled_date: record?.scheduled_date ? record.scheduled_date.slice(0, 16) : "",
    due_date: record?.due_date ? record.due_date.slice(0, 16) : "",
    notes: record?.notes || prefill?.notes || "",
    photos: record?.photos || prefill?.photos || [],
    repair_shop: record?.repair_shop || "",
  });


  useEffect(() => {
    if (record) {
      setFormData({
        inspection_id: record.inspection_id,
        car_id: record.car_id ?? null,
        car_name: record.car_name,
        task_description: record.task_description,
        assigned_to: record.assigned_to,
        assigned_to_id: record.assigned_to_id ?? null,
        scheduled_date: record.scheduled_date ? record.scheduled_date.slice(0, 16) : "",
        due_date: record.due_date ? record.due_date.slice(0, 16) : "",
        notes: record.notes || "",
        photos: record.photos || [],
        repair_shop: record.repair_shop || "",
      });
    } else if (prefill) {
      setFormData((prev) => ({
        ...prev,
        inspection_id: prefill.inspection_id ?? prev.inspection_id ?? null,
        car_name: prefill.car_name || prev.car_name,
        task_description: prefill.task_description || prev.task_description,
        notes: prefill.notes || prev.notes,
        photos: prefill.photos && prefill.photos.length > 0 ? prefill.photos : prev.photos,
      }));
    }
  }, [record, prefill]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? buildApiUrl(`/api/operations/maintenance/${record.id}`)
        : buildApiUrl("/api/operations/maintenance");
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save maintenance record");
      return response.json();
    },
    onSuccess: async (resp) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });

      // If this save was launched via "Approve & Schedule" from the Pending
      // Car Issues queue, flip that pending issue to approved and link it to
      // the maintenance row we just created.
      const pendingIssueId = prefill?.pending_issue_id;
      if (!isEdit && pendingIssueId) {
        const newMaintenanceId =
          resp?.id ??
          resp?.data?.id ??
          resp?.maintenance?.id ??
          resp?.record?.id ??
          null;
        try {
          await fetch(buildApiUrl(`/api/car-issues/${pendingIssueId}/approve`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ maintenance_id: newMaintenanceId }),
          });
          queryClient.invalidateQueries({ queryKey: ["/api/car-issues/pending"] });
        } catch (err) {
          // Non-fatal: maintenance was saved; admin can dismiss/approve manually.
          console.error("[MaintenanceModal] approve pending issue failed", err);
        }
      }

      toast({ title: "Success", description: `Maintenance ${isEdit ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.car_name ||
      !formData.task_description ||
      !formData.assigned_to ||
      !formData.scheduled_date
    ) {
      toast({
        title: "Missing required fields",
        description:
          "Car, Description, Assigned To, and Scheduled Date are all required.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Maintenance" : "Add Maintenance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Car *</label>
            <CarSelectCombobox
              value={formData.car_name}
              onChange={(v) => setFormData({ ...formData, car_name: v })}
              onSelectCar={(car) =>
                setFormData((prev) => ({
                  ...prev,
                  car_id: car?.id ?? null,
                  car_name: car?.makeModel ?? prev.car_name,
                }))
              }
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Description *</label>
            <Textarea
              value={formData.task_description}
              onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="What maintenance is needed..."
              rows={2}
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Assigned To *</label>
            <EmployeeSelectCombobox
              value={formData.assigned_to}
              onChange={(v) => setFormData({ ...formData, assigned_to: v })}
              onSelectEmployee={(emp) =>
                setFormData((prev) => ({
                  ...prev,
                  assigned_to_id: emp?.employee_aid ?? null,
                }))
              }
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Scheduled Date/Time *</label>
            <Input
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Setting a scheduled date adds this maintenance to the Google Calendar.
            </p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Due Date</label>
            <Input
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Repair Shop</label>
            <Input
              value={formData.repair_shop}
              onChange={(e) => setFormData({ ...formData, repair_shop: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Shop name / location"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Photos</label>
            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData({ ...formData, photos })}
              entityType="maintenance"
              entityId={record?.id}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-card text-foreground border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/80">
              {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
