import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { OperationTask, TaskType } from "./types";

interface TaskAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: OperationTask | null;
  prefill?: {
    turo_trip_id?: number;
    reservation_id?: string;
    car_name?: string;
    guest_name?: string;
    task_type?: TaskType;
  };
}

export function TaskAssignmentModal({ open, onOpenChange, task, prefill }: TaskAssignmentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!task;

  const [formData, setFormData] = useState({
    turo_trip_id: task?.turo_trip_id || prefill?.turo_trip_id || null,
    reservation_id: task?.reservation_id || prefill?.reservation_id || "",
    car_name: task?.car_name || prefill?.car_name || "",
    guest_name: task?.guest_name || prefill?.guest_name || "",
    task_type: task?.task_type || prefill?.task_type || ("cleaning" as TaskType),
    assigned_to: task?.assigned_to || "",
    scheduled_date: task?.scheduled_date ? task.scheduled_date.slice(0, 16) : "",
    scheduled_location: task?.scheduled_location || "",
    notes: task?.notes || "",
  });

  useEffect(() => {
    if (task) {
      setFormData({
        turo_trip_id: task.turo_trip_id,
        reservation_id: task.reservation_id || "",
        car_name: task.car_name,
        guest_name: task.guest_name || "",
        task_type: task.task_type,
        assigned_to: task.assigned_to,
        scheduled_date: task.scheduled_date ? task.scheduled_date.slice(0, 16) : "",
        scheduled_location: task.scheduled_location || "",
        notes: task.notes || "",
      });
    } else if (prefill) {
      setFormData((prev) => ({
        ...prev,
        turo_trip_id: prefill.turo_trip_id || null,
        reservation_id: prefill.reservation_id || "",
        car_name: prefill.car_name || "",
        guest_name: prefill.guest_name || "",
        task_type: prefill.task_type || "cleaning",
      }));
    }
  }, [task, prefill]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? buildApiUrl(`/api/operations/tasks/${task.id}`)
        : buildApiUrl("/api/operations/tasks");
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({ title: "Success", description: `Task ${isEdit ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.car_name || !formData.task_type || !formData.assigned_to) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{isEdit ? "Edit Task" : "Assign Task"}</DialogTitle>
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
            <label className="text-sm text-muted-foreground">Task Type *</label>
            <Select value={formData.task_type} onValueChange={(v) => setFormData({ ...formData, task_type: v as TaskType })}>
              <SelectTrigger className="bg-card border-border text-foreground mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Assign To *</label>
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
            <label className="text-sm text-muted-foreground">Location</label>
            <Input
              value={formData.scheduled_location}
              onChange={(e) => setFormData({ ...formData, scheduled_location: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Pickup/delivery location"
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-card text-foreground border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/80">
              {mutation.isPending ? "Saving..." : isEdit ? "Update" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
