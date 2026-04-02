import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "./PhotoUpload";
import type { Inspection } from "./types";

interface InspectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: Inspection | null;
  prefill?: {
    turo_trip_id?: number;
    reservation_id?: string;
    car_name?: string;
  };
}

export function InspectionModal({ open, onOpenChange, inspection, prefill }: InspectionModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!inspection;

  const [formData, setFormData] = useState({
    turo_trip_id: inspection?.turo_trip_id || prefill?.turo_trip_id || null,
    reservation_id: inspection?.reservation_id || prefill?.reservation_id || "",
    car_name: inspection?.car_name || prefill?.car_name || "",
    assigned_to: inspection?.assigned_to || "Cathy",
    inspection_date: inspection?.inspection_date ? inspection.inspection_date.slice(0, 16) : "",
    notes: inspection?.notes || "",
    photos: inspection?.photos || [],
  });

  useEffect(() => {
    if (inspection) {
      setFormData({
        turo_trip_id: inspection.turo_trip_id,
        reservation_id: inspection.reservation_id || "",
        car_name: inspection.car_name,
        assigned_to: inspection.assigned_to,
        inspection_date: inspection.inspection_date ? inspection.inspection_date.slice(0, 16) : "",
        notes: inspection.notes || "",
        photos: inspection.photos || [],
      });
    } else if (prefill) {
      setFormData((prev) => ({
        ...prev,
        turo_trip_id: prefill.turo_trip_id || null,
        reservation_id: prefill.reservation_id || "",
        car_name: prefill.car_name || "",
      }));
    }
  }, [inspection, prefill]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? buildApiUrl(`/api/operations/inspections/${inspection.id}`)
        : buildApiUrl("/api/operations/inspections");
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save inspection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: `Inspection ${isEdit ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.car_name || !formData.assigned_to) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Inspection" : "Add Inspection"}</DialogTitle>
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
            <label className="text-sm text-muted-foreground">Inspection Date/Time</label>
            <Input
              type="datetime-local"
              value={formData.inspection_date}
              onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
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
              placeholder="Inspection notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Photos</label>
            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData({ ...formData, photos })}
              entityType="inspection"
              entityId={inspection?.id}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-card text-foreground border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/80">
              {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Create Inspection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
