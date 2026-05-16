/**
 * Car Issue Form Submission
 * Accessible by employees and admins from the Forms page.
 * Submitting creates a manual inspection record in the Operations → Car Issues tab.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, Car, AlertTriangle } from "lucide-react";

/** A simple car picker populated from /api/cars (shared endpoint) */
function CarSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (carName: string) => void;
}) {
  // The /api/cars endpoint returns aliased fields: id, make, model, year, licensePlate
  const { data } = useQuery<{
    data: {
      id: number;
      make: string | null;
      model: string | null;
      year: number | null;
      licensePlate: string | null;
      makeModel?: string | null;
    }[];
  }>({
    queryKey: ["/api/cars", "car-issue-picker"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/cars?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const cars = data?.data ?? [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Select a car…</option>
      {cars.map((c) => {
        // Use makeModel if available (pre-concatenated), otherwise build from parts
        const nameParts = c.makeModel
          ? c.makeModel
          : [c.make, c.model, c.year].filter(Boolean).join(" ");
        const label = [nameParts, c.licensePlate ? `(${c.licensePlate})` : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <option key={c.id} value={label || String(c.id)}>
            {label || `Car #${c.id}`}
          </option>
        );
      })}
    </select>
  );
}

/** Simple photo upload using the operations/inspections photo endpoint after the record is created */
function PhotoRow({
  files,
  onAdd,
  onRemove,
}: {
  files: File[];
  onAdd: (f: File) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        id="car-issue-photos"
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach(onAdd);
          e.target.value = "";
        }}
      />
      <label
        htmlFor="car-issue-photos"
        className="flex items-center justify-center gap-2 h-24 rounded-md border-2 border-dashed border-border text-muted-foreground text-sm cursor-pointer hover:border-primary/50 hover:text-primary transition-colors"
      >
        <Car className="w-5 h-5" />
        Click to upload photos (optional)
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="w-20 h-20 object-cover rounded-md border border-border"
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CarIssueFormSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    car_name: "",
    assigned_to: "",
    notes: "",
    inspection_date: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  /** Step 1 — create the inspection record */
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/inspections"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          car_name: form.car_name,
          source: "manual",
          assigned_to: form.assigned_to || null,
          inspection_date: form.inspection_date || null,
          notes: form.notes || null,
          status: "new",
        }),
      });
      if (!res.ok) throw new Error("Failed to submit car issue");
      const body = await res.json();
      return body as { id?: number; data?: { id: number } };
    },
    onSuccess: async (body) => {
      /** Step 2 — upload photos if any */
      const inspectionId = body?.id ?? body?.data?.id;
      if (inspectionId && photos.length > 0) {
        const fd = new FormData();
        photos.forEach((f) => fd.append("photos", f));
        try {
          await fetch(
            buildApiUrl(`/api/operations/inspections/${inspectionId}/photos`),
            {
              method: "POST",
              credentials: "include",
              body: fd,
            },
          );
        } catch {
          /* photo upload failure is non-fatal */
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({
        title: "Car issue submitted!",
        description:
          "It will appear in Operations → Car Issues for admin review.",
      });
      setSubmitted(true);
    },
    onError: (err: Error) =>
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.car_name.trim()) {
      toast({ title: "Car is required", variant: "destructive" });
      return;
    }
    if (!form.notes.trim()) {
      toast({ title: "Please describe the issue", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  const handleReset = () => {
    setForm({ car_name: "", assigned_to: "", notes: "", inspection_date: "" });
    setPhotos([]);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold text-primary">
            Car Issue Submitted
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Your car issue report has been created and is now visible in{" "}
            <strong>Operations → Car Issues</strong> for admin review.
          </p>
          <Button variant="outline" onClick={handleReset}>
            Report Another Issue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Car Issue Report
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Report a car issue or damage. Your submission will automatically
          appear in <strong>Operations → Car Issues</strong> for admin review.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Car */}
          <div className="space-y-1.5">
            <Label htmlFor="car-select">
              Car <span className="text-destructive">*</span>
            </Label>
            <CarSelect
              value={form.car_name}
              onChange={(v) => setForm((p) => ({ ...p, car_name: v }))}
            />
          </div>

          {/* Assigned To */}
          <div className="space-y-1.5">
            <Label htmlFor="assigned-to">Reported / Inspected By</Label>
            <Input
              id="assigned-to"
              value={form.assigned_to}
              onChange={(e) =>
                setForm((p) => ({ ...p, assigned_to: e.target.value }))
              }
              placeholder="Your name"
            />
          </div>

          {/* Inspection Date */}
          <div className="space-y-1.5">
            <Label htmlFor="inspection-date">Inspection Date / Time</Label>
            <Input
              id="inspection-date"
              type="datetime-local"
              value={form.inspection_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, inspection_date: e.target.value }))
              }
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Notes / Issue Description */}
          <div className="space-y-1.5">
            <Label htmlFor="issue-notes">
              Issue Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="issue-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Describe the issue, damage, or maintenance needed…"
              rows={4}
            />
          </div>

          {/* Photos */}
          <div className="space-y-1.5">
            <Label>Photos</Label>
            <PhotoRow
              files={photos}
              onAdd={(f) => setPhotos((prev) => [...prev, f])}
              onRemove={(i) =>
                setPhotos((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="min-w-[160px]"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit Car Issue"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
