// Modal for HISTORY category
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIncomeExpense } from "../context/IncomeExpenseContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ModalEditHistory() {
  const { editingCell, setEditingCell, saveChanges, isSaving, year, data } = useIncomeExpense();

  const [quantity,setQuantity] = useState('');
  useEffect(() => {
    if (editingCell?.category === 'history') {
      const stored = (data.history.find(row=>row.month===editingCell.month) as any)?.[editingCell.field];
      setQuantity(stored == null ? '' : String(editingCell.value));
    }
  },[editingCell?.category,editingCell?.field,editingCell?.month]);
  const validQuantity = /^\d+$/.test(quantity) && Number.isSafeInteger(Number(quantity));
  const monthName = editingCell ? MONTHS[editingCell.month - 1] : "";
  const isOpen = !!editingCell && editingCell.category === "history";

  const handleClose = () => {
    setEditingCell(null);
  };

  const handleSave = () => {
    if (!editingCell || !validQuantity) return;
    
    // Save the change immediately, passing it directly to saveChanges
    saveChanges({
      category: editingCell.category,
      field: editingCell.field,
      month: editingCell.month,
      value: Number(quantity),
    });
  };

  if (!editingCell || editingCell.category !== "history") return null;

  const fieldNames: { [key: string]: string } = {
    daysRented: "Days Rented",
    carsAvailableForRent: "Cars Available",
    tripsTaken: "Trips Taken",
  };

  const fieldName = fieldNames[editingCell.field] || editingCell.field;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            Update Car History
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter a reviewed value for {monthName} {year}. This manual entry takes priority over automatic Turo calculations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground text-xs">Type:</Label>
            <div className="text-foreground text-sm font-medium mt-1">{fieldName}</div>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Date:</Label>
            <div className="text-foreground text-sm font-medium mt-1">
              {monthName} {year}
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Quantity</Label>
            <Input
              type="number"
              value={quantity}
              onChange={e=>setQuantity(e.target.value)}
              min={0}
              placeholder="Enter reviewed quantity"
              className="bg-card border-border text-foreground text-sm mt-1"
              step="1"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !validQuantity}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
