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
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "./PhotoUpload";
import { CarSelectCombobox } from "./CarSelectCombobox";
import { Plus, Trash2 } from "lucide-react";
import type { Inspection } from "./types";

interface InspectionEntry {
  date: string;
  inspector: string;
}

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

function getEmployeeName(emp: any): string {
  if (emp.fullname) return emp.fullname;
  const first = emp.first_name || emp.emp_first_name || "";
  const last = emp.last_name || emp.emp_last_name || "";
  return `${first} ${last}`.trim() || `Employee ${emp.id}`;
}

export function InspectionModal({
  open,
  onOpenChange,
  inspection,
  prefill,
}: InspectionModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!inspection;

  const { data: employeesData } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });
  const employeeNames: string[] = (employeesData?.data ?? [])
    .map(getEmployeeName)
    .filter(Boolean)
    .sort();

  const [formData, setFormData] = useState({
    turo_trip_id: inspection?.turo_trip_id || prefill?.turo_trip_id || null,
    reservation_id: inspection?.reservation_id || prefill?.reservation_id || "",
    car_name: inspection?.car_name || prefill?.car_name || "",
    assigned_to: inspection?.assigned_to || "Cathy",
    inspection_date: inspection?.inspection_date
      ? inspection.inspection_date.slice(0, 16)
      : "",
    notes: inspection?.notes || "",
    photos: inspection?.photos || [],
  });

  // Additional inspection entries (multiple date/time + inspector)
  const [extraEntries, setExtraEntries] = useState<InspectionEntry[]>(
    (inspection as any)?.inspection_entries ?? [],
  );

  const addEntry = () =>
    setExtraEntries((prev) => [...prev, { date: "", inspector: "" }]);

  const removeEntry = (i: number) =>
    setExtraEntries((prev) => prev.filter((_, idx) => idx !== i));

  const updateEntry = (i: number, field: keyof InspectionEntry, val: string) =>
    setExtraEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)),
    );

  useEffect(() => {
    if (inspection) {
      setFormData({
        turo_trip_id: inspection.turo_trip_id,
        reservation_id: inspection.reservation_id || "",
        car_name: inspection.car_name,
        assigned_to: inspection.assigned_to,
        inspection_date: inspection.inspection_date
          ? inspection.inspection_date.slice(0, 16)
          : "",
        notes: inspection.notes || "",
        photos: inspection.photos || [],
      });
      setExtraEntries((inspection as any)?.inspection_entries ?? []);
    } else if (prefill) {
      setFormData((prev) => ({
        ...prev,
        turo_trip_id: prefill.turo_trip_id || null,
        reservation_id: prefill.reservation_id || "",
        car_name: prefill.car_name || "",
      }));
      setExtraEntries([]);
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
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({
        title: "Success",
        description: `Inspection ${isEdit ? "updated" : "created"} successfully`,
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
    if (!formData.car_name || !formData.assigned_to) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      ...formData,
      inspection_entries: extraEntries.filter((e) => e.date || e.inspector),
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Edit Inspection" : "Add Inspection"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Car *</label>
            <CarSelectCombobox
              value={formData.car_name}
              onChange={(v) => setFormData({ ...formData, car_name: v })}
            />
          </div>

          {/* Primary inspection entry — date/time + inspector are now inside the entry block */}
          <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Inspection Entry #1 (Primary)
              </label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Date / Time
              </label>
              <Input
                type="datetime-local"
                value={formData.inspection_date}
                onChange={(e) =>
                  setFormData({ ...formData, inspection_date: e.target.value })
                }
                className="bg-card border-border text-foreground mt-1"
                style={{ colorScheme: "dark" }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Inspected By
              </label>
              <Select
                value={formData.assigned_to}
                onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
              >
                <SelectTrigger className="bg-card border-border text-foreground mt-1">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional inspection entries */}
          {extraEntries.map((entry, i) => (
            <div
              key={i}
              className="rounded-md border border-border p-3 space-y-2 bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Inspection Entry #{i + 2}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(i)}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Date / Time
                </label>
                <Input
                  type="datetime-local"
                  value={entry.date}
                  onChange={(e) => updateEntry(i, "date", e.target.value)}
                  className="bg-card border-border text-foreground mt-1"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Inspected By
                </label>
                <Select
                  value={entry.inspector}
                  onValueChange={(v) => updateEntry(i, "inspector", v)}
                >
                  <SelectTrigger className="bg-card border-border text-foreground mt-1">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEntry}
            className="w-full gap-2 border-dashed text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
            Add Another Inspection Date / Inspector
          </Button>

          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="bg-card border-border text-foreground mt-1"
              placeholder="Inspection notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Photos
            </label>
            <PhotoUpload
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData({ ...formData, photos })}
              entityType="inspection"
              entityId={inspection?.id}
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
                  : "Create Inspection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
