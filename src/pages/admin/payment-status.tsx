import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Archive, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface PaymentStatusItem {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
  payment_status_is_active: number;
  payment_status_is_compute_total?: number;
}

export default function PaymentStatusPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentStatusItem | null>(null);
  const [archiveItem, setArchiveItem] = useState<PaymentStatusItem | null>(null);
  const [restoreItem, setRestoreItem] = useState<PaymentStatusItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PaymentStatusItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#000000");
  const [formComputeTotal, setFormComputeTotal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: statusesData, isLoading } = useQuery<{
    success: boolean;
    data: PaymentStatusItem[];
  }>({
    queryKey: ["/api/payment-status", "all"],
    queryFn: async () => {
      const url = buildApiUrl("/api/payment-status?all=1");
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payment statuses");
      return response.json();
    },
  });

  const statuses = statusesData?.data || [];

  const resetForm = () => {
    setFormName("");
    setFormColor("#000000");
    setFormComputeTotal(false);
    setEditingItem(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleEdit = (item: PaymentStatusItem) => {
    setEditingItem(item);
    setFormName(item.payment_status_name);
    setFormColor(item.payment_status_color || "#000000");
    setFormComputeTotal(!!(item.payment_status_is_compute_total === 1));
    setIsAddModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const url = buildApiUrl("/api/payment-status");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status_name: formName.trim(),
          payment_status_color: formColor,
          payment_status_is_compute_total: formComputeTotal,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Failed to create");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      toast({ title: "Success", description: "Payment status added successfully" });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const url = buildApiUrl(`/api/payment-status/${editingItem.payment_status_aid}`);
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_status_name: formName.trim(),
          payment_status_color: formColor,
          payment_status_is_compute_total: formComputeTotal,
          payment_status_name_old: editingItem.payment_status_name,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      toast({ title: "Success", description: "Payment status updated successfully" });
      setIsAddModalOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildApiUrl(`/api/payment-status/active/${id}`);
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 0 }),
      });
      if (!response.ok) throw new Error("Failed to archive");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      toast({ title: "Success", description: "Archived successfully" });
      setArchiveItem(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildApiUrl(`/api/payment-status/active/${id}`);
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: 1 }),
      });
      if (!response.ok) throw new Error("Failed to restore");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      toast({ title: "Success", description: "Restored successfully" });
      setRestoreItem(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildApiUrl(`/api/payment-status/${id}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Failed to delete");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-status"] });
      toast({ title: "Success", description: "Deleted successfully" });
      setDeleteItem(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Payment Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage payment statuses for client payments
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground text-sm">Total: {statuses.length}</span>
          <Button
            onClick={handleAdd}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-auto flex-1">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-left text-foreground font-medium w-12">#</TableHead>
                  <TableHead className="text-left text-foreground font-medium w-24">Status</TableHead>
                  <TableHead className="text-left text-foreground font-medium">Name</TableHead>
                  <TableHead className="text-left text-foreground font-medium w-24">Color</TableHead>
                  <TableHead className="text-left text-foreground font-medium w-36">Computed TOTALS</TableHead>
                  <TableHead className="text-center text-foreground font-medium w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : statuses.length > 0 ? (
                  statuses.map((item, index) => (
                    <TableRow
                      key={item.payment_status_aid}
                      className="border-border hover:bg-card"
                    >
                      <TableCell className="text-muted-foreground">{index + 1}.</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.payment_status_is_active === 1 ? (
                            <>
                              <span className="w-3 h-3 rounded-full bg-green-600 shrink-0" />
                              <span className="text-sm text-muted-foreground">Active</span>
                            </>
                          ) : (
                            <>
                              <span className="w-3 h-3 rounded-full bg-gray-500 shrink-0" />
                              <span className="text-sm text-muted-foreground">Inactive</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{item.payment_status_name}</TableCell>
                      <TableCell>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium text-black"
                          style={{
                            backgroundColor: item.payment_status_color || "#666",
                          }}
                        >
                          {item.payment_status_color || "--"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.payment_status_is_compute_total === 1 ? "Yes" : "No"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {item.payment_status_is_active === 1 ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="text-muted-foreground hover:text-primary"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setArchiveItem(item)}
                                className="text-muted-foreground hover:text-amber-400"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRestoreItem(item)}
                                className="text-muted-foreground hover:text-primary"
                                title="Restore"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteItem(item)}
                                className="text-muted-foreground hover:text-red-700"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No payment statuses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {(isAddModalOpen || editingItem) && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setIsAddModalOpen(false);
                resetForm();
              }
            }}
          >
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Update" : "Add"} Status</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingItem ? "Edit payment status" : "Create a new payment status"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-card border-border text-foreground mt-1"
                    placeholder="e.g. To Pay, Paid"
                    required
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-12 h-9 p-1 bg-card border-border cursor-pointer"
                    />
                    <Input
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="bg-card border-border text-foreground flex-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="computeTotal"
                    checked={formComputeTotal}
                    onCheckedChange={(v) => setFormComputeTotal(!!v)}
                    className="border-gray-500 data-[state=checked]:bg-[#D3BC8D] data-[state=checked]:border-primary"
                  />
                  <Label htmlFor="computeTotal" className="text-muted-foreground text-sm cursor-pointer">
                    Mark check if computed to TOTALS menu
                  </Label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      resetForm();
                    }}
                    className="bg-card border-border text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending || !formName.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/80"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingItem ? (
                      "Save"
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Archive Confirm */}
        {archiveItem && (
          <Dialog open={true} onOpenChange={() => setArchiveItem(null)}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Archive Status</DialogTitle>
                <DialogDescription>
                  Are you sure you want to archive &quot;{archiveItem.payment_status_name}&quot;?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setArchiveItem(null)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => archiveMutation.mutate(archiveItem.payment_status_aid)}
                  disabled={archiveMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {archiveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Archive"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Restore Confirm */}
        {restoreItem && (
          <Dialog open={true} onOpenChange={() => setRestoreItem(null)}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Restore Status</DialogTitle>
                <DialogDescription>
                  Are you sure you want to restore &quot;{restoreItem.payment_status_name}&quot;?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRestoreItem(null)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => restoreMutation.mutate(restoreItem.payment_status_aid)}
                  disabled={restoreMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Restore"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirm */}
        {deleteItem && (
          <Dialog open={true} onOpenChange={() => setDeleteItem(null)}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Delete Status</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{deleteItem.payment_status_name}&quot;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteItem(null)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate(deleteItem.payment_status_aid)}
                  disabled={deleteMutation.isPending}
                  className="bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}
