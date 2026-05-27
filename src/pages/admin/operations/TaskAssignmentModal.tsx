import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { CarSelectCombobox } from "./CarSelectCombobox";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
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
    trip_start?: string;
    trip_end?: string;
    return_location?: string;
    delivery_location?: string;
  };
}

function computeDefaults(
  taskType: TaskType,
  tripStart?: string,
  tripEnd?: string,
): { scheduledDate: string; dueDate: string } {
  if (taskType === "delivery") {
    // Delivery: both default to trip start
    const d = toMtLocalInput(tripStart);
    return { scheduledDate: d, dueDate: d };
  }
  if (taskType === "pickup") {
    // Pick Up: both default to trip end
    const d = toMtLocalInput(tripEnd);
    return { scheduledDate: d, dueDate: d };
  }
  // Cleaning: scheduled = trip start, due = trip end
  return {
    scheduledDate: toMtLocalInput(tripStart),
    dueDate: toMtLocalInput(tripEnd),
  };
}

export function TaskAssignmentModal({
  open,
  onOpenChange,
  task,
  prefill,
}: TaskAssignmentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!task;

  const [formData, setFormData] = useState({
    turo_trip_id: task?.turo_trip_id || prefill?.turo_trip_id || null,
    reservation_id: task?.reservation_id || prefill?.reservation_id || "",
    car_name: task?.car_name || prefill?.car_name || "",
    guest_name: task?.guest_name || prefill?.guest_name || "",
    task_type:
      task?.task_type || prefill?.task_type || ("cleaning" as TaskType),
    assigned_to: task?.assigned_to || "",
    scheduled_date: toMtLocalInput(task?.scheduled_date),
    scheduled_location: task?.scheduled_location || "",
    due_date: toMtLocalInput(task?.due_date),
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
        scheduled_date: toMtLocalInput(task.scheduled_date),
        scheduled_location: task.scheduled_location || "",
        due_date: toMtLocalInput(task.due_date),
        notes: task.notes || "",
      });
    } else if (prefill) {
      const taskType = prefill.task_type || "cleaning";
      const { scheduledDate, dueDate } = computeDefaults(
        taskType,
        prefill.trip_start,
        prefill.trip_end,
      );

      let defaultLocation = "";
      if (taskType === "pickup" && prefill.return_location) {
        defaultLocation = prefill.return_location;
      } else if (taskType === "delivery") {
        defaultLocation = prefill.delivery_location || prefill.return_location || "";
      }

      setFormData((prev) => ({
        ...prev,
        turo_trip_id: prefill.turo_trip_id || null,
        reservation_id: prefill.reservation_id || "",
        car_name: prefill.car_name || "",
        guest_name: prefill.guest_name || "",
        task_type: taskType,
        scheduled_date: scheduledDate,
        scheduled_location: defaultLocation,
        due_date: dueDate,
      }));
    }
  }, [task, prefill]);

  // Re-apply defaults when the user changes the task type dropdown.
  useEffect(() => {
    if (!task && prefill) {
      const { scheduledDate, dueDate } = computeDefaults(
        formData.task_type,
        prefill.trip_start,
        prefill.trip_end,
      );
      let defaultLocation = formData.scheduled_location;
      if (formData.task_type === "pickup") {
        defaultLocation = prefill.return_location || "";
      } else if (formData.task_type === "delivery") {
        defaultLocation = prefill.delivery_location || prefill.return_location || "";
      }
      setFormData((prev) => ({
        ...prev,
        scheduled_date: scheduledDate,
        scheduled_location: defaultLocation,
        due_date: dueDate,
      }));
    }
  }, [formData.task_type]);

  // Fetch all existing tasks once the modal opens so we can block duplicates
  // (same trip + same task type) before sending the create request.
  const { data: existingTasksResp } = useQuery<{ data: OperationTask[] }>({
    queryKey: ["/api/operations/tasks", "duplicate-check"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/tasks?limit=1000"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    enabled: open,
    staleTime: 30_000,
  });
  const existingTasks = existingTasksResp?.data ?? [];

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? buildApiUrl(`/api/operations/tasks/${task.id}`)
        : buildApiUrl("/api/operations/tasks");
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          reservation_id: data.reservation_id || "N/A",
          scheduled_date: mtLocalInputToUtcDbString(data.scheduled_date),
          due_date: mtLocalInputToUtcDbString(data.due_date),
        }),
      });
      if (!response.ok) throw new Error("Failed to save task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({
        title: "Success",
        description: `Task ${isEdit ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.car_name || !formData.task_type || !formData.assigned_to) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }
    // Block creating a second task of the same type on the same trip.
    // One trip should have exactly one cleaning, one delivery, and one pickup
    // task — duplicates cause confusion (e.g. "Cathy / Cathy" in the Assigned
    // column) and double-bill operations.
    if (!isEdit && formData.turo_trip_id) {
      const existsForSameTrip = existingTasks.some(
        (t) =>
          t.turo_trip_id === formData.turo_trip_id &&
          t.task_type === formData.task_type,
      );
      if (existsForSameTrip) {
        toast({
          title: "Duplicate task",
          description: `A ${formData.task_type} task already exists for this trip. Edit the existing one instead.`,
          variant: "destructive",
        });
        return;
      }
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Edit Task" : "Assign Task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Car *</label>
            {prefill?.car_name ? (
              <Input
                value={formData.car_name}
                readOnly
                className="bg-card border-border text-foreground mt-1 opacity-70"
              />
            ) : (
              <CarSelectCombobox
                value={formData.car_name}
                onChange={(v) => setFormData({ ...formData, car_name: v })}
              />
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Task Type *</label>
            <Select
              value={formData.task_type}
              onValueChange={(v) =>
                setFormData({ ...formData, task_type: v as TaskType })
              }
            >
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
            <label className="text-sm text-muted-foreground">
              Reservation ID
            </label>
            <Input
              value={formData.reservation_id}
              onChange={(e) =>
                setFormData({ ...formData, reservation_id: e.target.value })
              }
              className="bg-card border-border text-foreground mt-1"
              placeholder="Reservation ID (or N/A)"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Assign To *</label>
            <EmployeeSelectCombobox
              value={formData.assigned_to}
              onChange={(v) => setFormData({ ...formData, assigned_to: v })}
              placeholder="Select an employee..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">
              Scheduled Date/Time
            </label>
            <Input
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) =>
                setFormData({ ...formData, scheduled_date: e.target.value })
              }
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Setting a scheduled date adds this task to the Google Calendar
              (e.g. “Mercedes-Benz C-Class 2023 - ABC9999 - Pick Up - Cathy”).
            </p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Due Date</label>
            <Input
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="bg-card border-border text-foreground mt-1"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-card text-foreground border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/80"
            >
              {mutation.isPending
                ? "Saving..."
                : isEdit
                  ? "Update"
                  : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
