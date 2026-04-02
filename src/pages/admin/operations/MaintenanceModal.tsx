import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "./PhotoUpload";
import type { MaintenanceRecord } from "./types";

interface MaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: MaintenanceRecord | null;
  prefill?: {
    inspection_id?: number;
    car_name?: string;
  };
}

export function MaintenanceModal({ open, onOpenChange, record, prefill }: MaintenanceModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!record;

  const [formData, setFormData] = useState({
    inspection_id: record?.inspection_id || prefill?.inspection_id || null,
    car_name: record?.car_name || prefill?.car_name || "",
    task_description: record?.task_description || "",
    assigned_to: record?.assigned_to || "",
    scheduled_date: record?.scheduled_date ? record.scheduled_date.slice(0, 16) : "",
    notes: record?.notes || "",
    photos: record?.photos || [],
  });

  useEffect(() => {
    if (record) {
      setFormData({
        inspection_id: record.inspection_id,
        car_name: record.car_name,
        task_description: record.task_description,
        assigned_to: record.assigned_to,
        scheduled_date: record.scheduled_date ? record.scheduled_date.slice(0, 16) : "",
        notes: record.notes || "",
        photos: record.photos || [],
      });
    } else if (prefill) {
      setFormData((prev) => ({
        ...prev,
        inspection_id: prefill.inspection_id || null,
        car_name: prefill.car_name || "",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
      toast({ title: "Success", description: `Maintenance ${isEdit ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.car_name || !formData.task_description || !formData.assigned_to) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Maintenance" : "Add Maintenance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Car *</label>
            <Input
              value={formData.car_name}
              onChange={(e) => setFormData({ ...formData, car_name: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Vehicle name"
              required
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
            <Input
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Employee name"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Scheduled Date/Time</label>
            <Input
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
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
