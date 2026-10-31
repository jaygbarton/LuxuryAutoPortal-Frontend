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
    pickup_location?: string;
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
    // Drop Off: both default to trip start
    const d = toMtLocalInput(tripStart);
    return { scheduledDate: d, dueDate: d };
  }
  if (taskType === "pickup" || taskType === "cleaning") {
    // Retrieve and clean the vehicle when it returns, ready for its next trip.
    const d = toMtLocalInput(tripEnd);
    return { scheduledDate: d, dueDate: d };
  }
  // Preserve the existing defaults for other manually assigned task types.
  return {
    scheduledDate: toMtLocalInput(tripStart),
    dueDate: toMtLocalInput(tripStart),
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
    assigned_to_id: task?.assigned_to_id ?? null,
    scheduled_date: toMtLocalInput(task?.scheduled_date),
    scheduled_location: task?.scheduled_location || "",
    due_date: toMtLocalInput(task?.due_date),
    notes: task?.notes || "",
  });

  // Seed the form from the task being edited / the prefill. Keyed on `open` so
  // it runs once per opening: `prefill` is a fresh object on every parent
  // render, so depending on it re-ran this on each render and wiped whatever
  // the user had just typed or selected, leaving every field looking dead.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setFormData({
        turo_trip_id: task.turo_trip_id,
        reservation_id: task.reservation_id || "",
        car_name: task.car_name,
        guest_name: task.guest_name || "",
        task_type: task.task_type,
        assigned_to: task.assigned_to,
        assigned_to_id: task.assigned_to_id ?? null,
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
      if (taskType === "pickup" || taskType === "cleaning") {
        defaultLocation = prefill.return_location || prefill.delivery_location || prefill.pickup_location || "";
      } else if (taskType === "delivery") {
        defaultLocation = prefill.pickup_location || prefill.delivery_location || "";
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
    } else {
      // Opened fresh with no task and no prefill ("Add Task") — start clean so
      // the previous opening's values don't linger.
      setFormData({
        turo_trip_id: null,
        reservation_id: "",
        car_name: "",
        guest_name: "",
        task_type: "cleaning",
        assigned_to: "",
        assigned_to_id: null,
        scheduled_date: "",
        scheduled_location: "",
        due_date: "",
        notes: "",
      });
    }
  }, [open]);

  // Re-apply defaults when the user changes the task type dropdown. Requires a
  // prefill carrying actual trip data — an empty {} (the "Add Task" path) has
  // no dates to derive, so recomputing would only blank what the user entered.
  useEffect(() => {
    if (!task && prefill && (prefill.trip_start || prefill.trip_end)) {
      const { scheduledDate, dueDate } = computeDefaults(
        formData.task_type,
        prefill.trip_start,
        prefill.trip_end,
      );
      let defaultLocation = formData.scheduled_location;
      if (formData.task_type === "pickup" || formData.task_type === "cleaning") {
        defaultLocation = prefill.return_location || prefill.delivery_location || prefill.pickup_location || "";
      } else if (formData.task_type === "delivery") {
        defaultLocation = prefill.pickup_location || prefill.delivery_location || "";
      }
      setFormData((prev) => ({
        ...prev,
        scheduled_date: scheduledDate,
        scheduled_location: defaultLocation,
        due_date: dueDate,
      }));
    }
  }, [formData.task_type]);

  // Fetch this trip's existing tasks once the modal opens so we can block
  // duplicates (same trip + same task type) before sending the create request.
  // Query by turo_trip_id — a capped global fetch (the old ?limit=1000) starts
  // missing tasks once the table outgrows the cap.
  const dupCheckTripId = !isEdit ? formData.turo_trip_id : null;
  const { data: existingTasksResp } = useQuery<{ data: OperationTask[] }>({
    queryKey: ["/api/operations/tasks", "duplicate-check", dupCheckTripId],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/operations/tasks?turo_trip_id=${dupCheckTripId}&limit=100`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    enabled: open && !!dupCheckTripId,
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
    // Keep one active-workflow task per type/trip. Completed departure cleaning
    // remains historical evidence and must not block the new return clean.
    if (!isEdit && formData.turo_trip_id) {
      const existsForSameTrip = existingTasks.some(
        (t) =>
          t.turo_trip_id === formData.turo_trip_id &&
          t.task_type === formData.task_type &&
          !(t.task_type === "cleaning" && t.task_phase === "departure"),
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
              <SelectTrigger aria-label="Task type" className="bg-card border-border text-foreground mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="delivery">Drop Off</SelectItem>
                <SelectItem value="pickup">Pick Up</SelectItem>
                <SelectItem value="refuel">Refuel</SelectItem>
                <SelectItem value="mechanic">Mechanic Run</SelectItem>
                <SelectItem value="windshield">Windshield Run</SelectItem>
                <SelectItem value="license_plate">License Plate Run</SelectItem>
              </SelectContent>
            </Select>
            {formData.task_type === "cleaning" && <p className="mt-1 text-xs text-muted-foreground">Clean after this trip returns so the vehicle is ready for its next booking.</p>}
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
              onChange={(v) => setFormData((prev) => ({ ...prev, assigned_to: v }))}
              onSelectEmployee={(emp) =>
                setFormData((prev) => ({
                  ...prev,
                  assigned_to_id: emp?.employee_aid ?? null,
                }))
              }
              placeholder="Select an employee..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">
              Scheduled Date/Time
            </label>
            <Input
              type="datetime-local"
              aria-label="Scheduled Date/Time"
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
              aria-label="Due Date"
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
