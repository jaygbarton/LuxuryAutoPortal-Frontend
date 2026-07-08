import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { PhotoUpload } from "./PhotoUpload";
import type { Claim } from "./types";

interface ClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim?: Claim | null;
  /** Default assignee shown for a brand-new claim (the current user). */
  defaultAssignedTo?: string;
  defaultAssignedToId?: number | null;
}

export function ClaimModal({
  open,
  onOpenChange,
  claim,
  defaultAssignedTo,
  defaultAssignedToId,
}: ClaimModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!claim;

  const [formData, setFormData] = useState({
    reservationId: claim?.reservationId || "",
    claimId: claim?.claimId || "",
    damageReport: claim?.damageReport || "",
    damageReportLink: claim?.damageReportLink || "",
    incidentReportLink: claim?.incidentReportLink || "",
    estimateCost: claim?.estimateCost != null ? String(claim.estimateCost) : "",
    shopName: claim?.shopName || "",
    deadline: claim?.deadline ? claim.deadline.slice(0, 10) : "",
    description: claim?.description || "",
    assignedTo: claim?.assignedTo || defaultAssignedTo || "",
    assignedToId: claim?.assignedToId ?? defaultAssignedToId ?? null,
  });
  // Receipt images are managed via their own upload endpoint (they need a saved
  // claim id), so they live outside formData and are kept in sync with the claim.
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>(claim?.receiptPhotos || []);

  useEffect(() => {
    if (claim) {
      setFormData({
        reservationId: claim.reservationId || "",
        claimId: claim.claimId || "",
        damageReport: claim.damageReport || "",
        damageReportLink: claim.damageReportLink || "",
        incidentReportLink: claim.incidentReportLink || "",
        estimateCost: claim.estimateCost != null ? String(claim.estimateCost) : "",
        shopName: claim.shopName || "",
        deadline: claim.deadline ? claim.deadline.slice(0, 10) : "",
        description: claim.description || "",
        assignedTo: claim.assignedTo || "",
        assignedToId: claim.assignedToId ?? null,
      });
      setReceiptPhotos(claim.receiptPhotos || []);
    } else {
      setFormData({
        reservationId: "",
        claimId: "",
        damageReport: "",
        damageReportLink: "",
        incidentReportLink: "",
        estimateCost: "",
        shopName: "",
        deadline: "",
        description: "",
        assignedTo: defaultAssignedTo || "",
        assignedToId: defaultAssignedToId ?? null,
      });
      setReceiptPhotos([]);
    }
  }, [claim, defaultAssignedTo, defaultAssignedToId, open]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEdit
        ? buildApiUrl(`/api/operations/claims/${claim.id}`)
        : buildApiUrl("/api/operations/claims");
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          deadline: data.deadline || null,
          estimateCost: data.estimateCost === "" ? null : data.estimateCost,
          // Only send the photo array on edit — a new claim's receipts are
          // uploaded after it exists (PhotoUpload needs the saved id).
          ...(isEdit ? { receiptPhotos } : {}),
        }),
      });
      if (!response.ok) throw new Error("Failed to save claim");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/claims"] });
      toast({ title: "Success", description: `Claim ${isEdit ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reservationId.trim()) {
      toast({
        title: "Missing required field",
        description: "Turo Reservation # is required.",
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
          <DialogTitle className="text-foreground">{isEdit ? "Edit Claim" : "Add Manual Claim"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Turo Reservation # *</label>
            <Input
              value={formData.reservationId}
              onChange={(e) => setFormData({ ...formData, reservationId: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="e.g. 58261797"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Trip details (car, guest, dates) auto-fill from this reservation once matched.
            </p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Claim ID</label>
            <Input
              value={formData.claimId}
              onChange={(e) => setFormData({ ...formData, claimId: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Turo claim reference #"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Damage Report</label>
            <Textarea
              value={formData.damageReport}
              onChange={(e) => setFormData({ ...formData, damageReport: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="What damage was reported..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Damage Report Link</label>
            <Input
              type="url"
              value={formData.damageReportLink}
              onChange={(e) => setFormData({ ...formData, damageReportLink: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Incident Report Link</label>
            <Input
              type="url"
              value={formData.incidentReportLink}
              onChange={(e) => setFormData({ ...formData, incidentReportLink: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Shop Name</label>
            <Input
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Repair shop handling the estimate"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Estimate Cost</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.estimateCost}
                onChange={(e) => setFormData({ ...formData, estimateCost: e.target.value })}
                className="bg-card border-border text-foreground pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Deadline</label>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-card border-border text-foreground mt-1"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Receipt</label>
            {isEdit ? (
              <PhotoUpload
                photos={receiptPhotos}
                onPhotosChange={setReceiptPhotos}
                entityType="claim"
                entityId={claim?.id}
              />
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Save the claim first, then re-open it to upload receipt images.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Assigned To</label>
            <EmployeeSelectCombobox
              value={formData.assignedTo}
              onChange={(v) => setFormData({ ...formData, assignedTo: v })}
              onSelectEmployee={(emp) =>
                setFormData((prev) => ({
                  ...prev,
                  assignedToId: emp?.employee_aid ?? null,
                }))
              }
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
