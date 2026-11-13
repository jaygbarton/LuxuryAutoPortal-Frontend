import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { mtTodayKey } from "@/lib/mt-datetime";
import { isActiveFleetStatus, type OperationsVehicle } from "@/lib/operationsFleet";
import { CarComboboxField } from "./CarComboboxField";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { createRecall, RECALL_STATUS_OPTIONS, RECALLS_PATH, updateRecall, type Recall, type RecallInput, type RecallStatus } from "./recalls";

interface Form {
  carId: string;
  vehicleLabel: string;
  vin: string;
  plate: string;
  status: RecallStatus;
  assignedTo: string;
  assignedToId: number | null;
  scheduledRepairDate: string;
  repairCompletedDate: string;
  notes: string;
}

const blank = (assignedTo = ""): Form => ({
  carId: "", vehicleLabel: "", vin: "", plate: "", status: "new", assignedTo, assignedToId: null,
  scheduledRepairDate: "", repairCompletedDate: "", notes: "",
});

const fromRecall = (r: Recall): Form => ({
  carId: r.carId ? String(r.carId) : "",
  vehicleLabel: r.vehicleLabel ?? "",
  vin: r.vin ?? "",
  plate: r.plate ?? "",
  status: r.status,
  assignedTo: r.assignedTo ?? "",
  assignedToId: r.assignedToId,
  scheduledRepairDate: r.scheduledRepairDate ?? "",
  repairCompletedDate: r.repairCompletedDate ?? "",
  notes: r.notes ?? "",
});

export function RecallModal({
  open,
  onOpenChange,
  recall,
  defaultCarId,
  defaultAssignedTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recall: Recall | null;
  defaultCarId?: number | null;
  defaultAssignedTo?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(blank());

  useEffect(() => {
    if (!open) return;
    setForm(recall ? fromRecall(recall) : { ...blank(defaultAssignedTo), carId: defaultCarId ? String(defaultCarId) : "" });
  }, [open, recall, defaultCarId, defaultAssignedTo]);

  // Every car, active or not: an older or off-fleet vehicle can still be under recall.
  const { data: vehicles = [] } = useQuery<OperationsVehicle[]>({
    queryKey: ["/api/operations/fleet-vehicles"],
    staleTime: 15_000,
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/fleet-vehicles"), { credentials: "include" });
      if (!response.ok) throw new Error("Vehicles could not be loaded.");
      return (await response.json()).data ?? [];
    },
    enabled: open,
  });
  const carOptions = useMemo(
    () => vehicles
      .map((v) => ({
        id: v.carId,
        label: [v.carName, v.plateNumber, v.vinNumber].filter((s) => s && String(s).trim()).join(" - ") +
          (isActiveFleetStatus(v.carStatus) ? "" : " (Inactive)"),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [vehicles],
  );
  const selected = vehicles.find((v) => String(v.carId) === form.carId) ?? null;

  // VIN/plate come from the car record when it has them; type them only when it doesn't.
  const carVin = selected?.vinNumber?.trim() || "";
  const carPlate = selected?.plateNumber?.trim() || "";

  const save = useMutation({
    mutationFn: async () => {
      const input: RecallInput = {
        carId: form.carId ? Number(form.carId) : null,
        vehicleLabel: form.vehicleLabel.trim() || (selected?.carName ?? null),
        vin: carVin ? null : form.vin.trim() || null,
        plate: carPlate ? null : form.plate.trim() || null,
        status: form.status,
        assignedTo: form.assignedTo.trim() || null,
        assignedToId: form.assignedToId,
        scheduledRepairDate: form.scheduledRepairDate || null,
        repairCompletedDate: form.status === "repair_completed" ? form.repairCompletedDate || mtTodayKey() : form.repairCompletedDate || null,
        notes: form.notes.trim() || null,
      };
      return recall ? updateRecall(recall.id, input) : createRecall(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECALLS_PATH] });
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      toast({ title: recall ? "Recall updated" : "Recall added" });
      onOpenChange(false);
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const canSave = !!form.carId || !!form.vehicleLabel.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recall ? "Edit Recall" : "Add Recall"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {recall?.source === "email" ? "Added from a Turo safety-recall email." : "Track a vehicle that is under a safety recall."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Vehicle</Label>
            <CarComboboxField cars={carOptions} value={form.carId} onChange={(id) => set("carId", id)} />
            {recall?.source === "email" && !recall.carId && (
              <p className="mt-1 text-xs text-amber-600">
                Turo listed this as “{recall.vehicleLabel}”, but it didn’t match a car in the system. Pick the vehicle above.
              </p>
            )}
          </div>

          {!form.carId && (
            <div>
              <Label htmlFor="recall-vehicle-label" className="text-muted-foreground text-xs">Vehicle name (if it isn’t in the list)</Label>
              <Input id="recall-vehicle-label" value={form.vehicleLabel} onChange={(e) => set("vehicleLabel", e.target.value)} placeholder="e.g. Toyota Sienna" className="bg-card border-border mt-1" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="recall-plate" className="text-muted-foreground text-xs">Plate #</Label>
              <Input id="recall-plate" value={carPlate || form.plate} readOnly={!!carPlate} onChange={(e) => set("plate", e.target.value)} placeholder="Leave blank if unknown" className="bg-card border-border mt-1" />
            </div>
            <div>
              <Label htmlFor="recall-vin" className="text-muted-foreground text-xs">VIN #</Label>
              <Input id="recall-vin" value={carVin || form.vin} readOnly={!!carVin} onChange={(e) => set("vin", e.target.value)} placeholder="Leave blank if unknown" className="bg-card border-border mt-1" />
            </div>
          </div>
          {(carPlate || carVin) && <p className="-mt-2 text-xs text-muted-foreground">Plate and VIN come from the car record.</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as RecallStatus)}>
                <SelectTrigger className="bg-card border-border mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {RECALL_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Assigned To</Label>
              <div className="mt-1">
                <EmployeeSelectCombobox
                  value={form.assignedTo}
                  onChange={(v) => { set("assignedTo", v); if (!v) set("assignedToId", null); }}
                  onSelectEmployee={(emp) => {
                    if (!emp) return;
                    const name = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || emp.employee_email || `Employee #${emp.employee_aid}`;
                    setForm((f) => ({ ...f, assignedTo: name, assignedToId: emp.employee_aid }));
                  }}
                  placeholder="Assign..."
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="recall-scheduled" className="text-muted-foreground text-xs">Scheduled Date of Repair</Label>
              <Input id="recall-scheduled" type="date" value={form.scheduledRepairDate} onChange={(e) => set("scheduledRepairDate", e.target.value)} className="bg-card border-border mt-1" />
            </div>
            <div>
              <Label htmlFor="recall-completed" className="text-muted-foreground text-xs">Repair Completed</Label>
              <Input
                id="recall-completed"
                type="date"
                value={form.repairCompletedDate}
                onChange={(e) => setForm((f) => ({ ...f, repairCompletedDate: e.target.value, status: e.target.value ? "repair_completed" : f.status }))}
                className="bg-card border-border mt-1"
              />
              {form.status === "repair_completed" && !form.repairCompletedDate && (
                <p className="mt-1 text-xs text-muted-foreground">Saves as today if left blank.</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="recall-notes" className="text-muted-foreground text-xs">Notes</Label>
            <Textarea id="recall-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Recall details, dealership, campaign #..." className="bg-card border-border mt-1 min-h-[80px]" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/80">
            {save.isPending ? "Saving..." : recall ? "Save" : "Add Recall"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
