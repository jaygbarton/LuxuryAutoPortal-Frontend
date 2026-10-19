import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { toMtLocalInput, mtLocalInputToUtcDbString } from "@/lib/mt-datetime";
import { getActiveTimezone } from "@/hooks/use-timezone";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "./PhotoUpload";
import { CarSelectCombobox } from "./CarSelectCombobox";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import type { MaintenanceRecord, MaintenanceServiceType } from "./types";
import { MaintenanceIssueReports } from './MaintenanceIssueReports';
import { MAINTENANCE_SERVICE_TYPE_LABELS } from "./types";

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
     * maintenance row. Used by the maintenance approval flow.
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
    service_type: (record?.service_type ?? null) as MaintenanceServiceType | null,
    task_description: record?.task_description || prefill?.task_description || "",
    assigned_to: record?.assigned_to || "",
    assigned_to_id: record?.assigned_to_id ?? null,
    scheduled_date: toMtLocalInput(record?.scheduled_date, getActiveTimezone()),
    due_date: toMtLocalInput(record?.due_date, getActiveTimezone()),
    notes: record?.notes || prefill?.notes || "",
    photos: record?.photos || prefill?.photos || [],
    repair_shop: record?.repair_shop || "",
    repair_shop_license: record?.repair_shop_license || "",
  });


  useEffect(() => {
    if (record) {
      setFormData({
        inspection_id: record.inspection_id,
        car_id: record.car_id ?? null,
        car_name: record.car_name,
        service_type: record.service_type ?? null,
        task_description: record.task_description,
        assigned_to: record.assigned_to,
        assigned_to_id: record.assigned_to_id ?? null,
        scheduled_date: toMtLocalInput(record.scheduled_date, getActiveTimezone()),
        due_date: toMtLocalInput(record.due_date, getActiveTimezone()),
        notes: record.notes || "",
        photos: record.photos || [],
        repair_shop: record.repair_shop || "",
        repair_shop_license: record.repair_shop_license || "",
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
        body: JSON.stringify({
          ...data,
          scheduled_date: mtLocalInputToUtcDbString(data.scheduled_date, getActiveTimezone()),
          due_date: mtLocalInputToUtcDbString(data.due_date, getActiveTimezone()),
        }),
      });
      if (!response.ok) throw new Error("Failed to save maintenance record");
      return response.json();
    },
    onSuccess: async (resp) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });

      // If this save was launched via maintenance approval from the Pending
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
      !formData.assigned_to
    ) {
      toast({
        title: "Missing required fields",
        description:
          "Car, Description, and Assigned To are all required.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-y-auto border-border bg-card p-4 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Maintenance" : "Report Maintenance Needed"}</DialogTitle>
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
                  car_name: car
                    ? [car.makeModel, car.year].filter(Boolean).join(" ")
                    : prev.car_name,
                }))
              }
            />
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Record what maintenance is needed here. Scheduling a confirmed appointment is a separate step.</p>
            </div>
          </div>

          <div>
            <label htmlFor="maintenance-service-type" className="text-sm text-muted-foreground">Service Type</label>
            <Select
              value={formData.service_type ?? "__none__"}
              onValueChange={(v) =>
                setFormData({ ...formData, service_type: v === "__none__" ? null : (v as MaintenanceServiceType) })
              }
            >
              <SelectTrigger id="maintenance-service-type" className="mt-1 min-w-0 border-border bg-card text-foreground">
                <SelectValue placeholder="Select a service type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">--</SelectItem>
                {Object.entries(MAINTENANCE_SERVICE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Used to track last Oil Change / Tires per car on the Service Due report.
            </p>
          </div>

          <div>
            <label htmlFor="maintenance-description" className="text-sm text-muted-foreground">Description *</label>
            <Textarea
              id="maintenance-description"
              value={formData.task_description}
              onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
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
            <label htmlFor="maintenance-scheduled" className="text-sm text-muted-foreground">Suggested service date (not an appointment)</label>
            <Input
              type="datetime-local"
              id="maintenance-scheduled"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is a suggested date only. After saving the need, use Appointment to check availability and confirm a start and return time.
            </p>
          </div>

          <div>
            <label htmlFor="maintenance-due" className="text-sm text-muted-foreground">Due Date</label>
            <Input
              type="datetime-local"
              id="maintenance-due"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
            />
          </div>

          <div>
            <label htmlFor="maintenance-shop" className="text-sm text-muted-foreground">Repair Shop</label>
            <Input
              id="maintenance-shop"
              value={formData.repair_shop}
              onChange={(e) => setFormData({ ...formData, repair_shop: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
              placeholder="Shop name / location"
            />
          </div>

          <div>
            <label htmlFor="maintenance-shop-license" className="text-sm text-muted-foreground">Repair Shop License #</label>
            <Input
              id="maintenance-shop-license"
              value={formData.repair_shop_license}
              onChange={(e) => setFormData({ ...formData, repair_shop_license: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
              placeholder="Shop/mechanic license or certification number"
            />
          </div>

          <div>
            <label htmlFor="maintenance-notes" className="text-sm text-muted-foreground">Notes</label>
            <Textarea
              id="maintenance-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1 min-w-0 border-border bg-card text-foreground"
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

          {record && <MaintenanceIssueReports maintenanceId={record.id} />}
          <div className="sticky -bottom-4 grid grid-cols-2 gap-2 border-t border-border bg-card py-3 sm:-bottom-6 sm:flex sm:justify-end">
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
