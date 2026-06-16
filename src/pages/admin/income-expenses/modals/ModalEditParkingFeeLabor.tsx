// Modal for Parking Fee & Labor Cleaning category
import React, { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useIncomeExpense } from "../context/IncomeExpenseContext";
import ReceiptUploadZone from "../components/ReceiptUploadZone";
import { useImageUpload } from "../utils/useImageUpload";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ModalEditParkingFeeLabor() {
  const { editingCell, setEditingCell, updateCell, saveChanges, isSaving, year, carId } = useIncomeExpense();
  const [remarks, setRemarks] = useState("");

  const monthName = editingCell ? MONTHS[editingCell.month - 1] : "";
  const isOpen = !!editingCell && editingCell.category === "parkingFeeLabor";

  const {
    imageFiles, existingImages, isUploading, isLoadingImages,
    fileInputRef, handleFileChange, handleFilesDropped,
    handleRemoveImage, handleRemoveExistingImage, uploadImages, resetImages,
  } = useImageUpload(carId, year, editingCell?.category || "", editingCell?.field || "", editingCell?.month || 1);

  const handleClose = () => {
    setEditingCell(null);
    setRemarks("");
    resetImages();
  };

  const handleSave = async () => {
    if (!editingCell) return;
    if (imageFiles.length > 0) await uploadImages();
    saveChanges({
      category: editingCell.category,
      field: editingCell.field,
      month: editingCell.month,
      value: editingCell.value,
    });
  };

  if (!editingCell || editingCell.category !== "parkingFeeLabor") return null;

  const fieldNames: { [key: string]: string } = {
    glaParkingFee: "GLA Parking Fee",
    laborCleaning: "Labor - Cleaning",
  };

  const fieldName = fieldNames[editingCell.field] || editingCell.field;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            Update Parking Fee & Labor
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter parking fees and labor expenses for {monthName} {year}
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
            <Label className="text-muted-foreground text-xs">Amount</Label>
            <Input
              type="number"
              value={editingCell.value}
              onChange={(e) =>
                setEditingCell({
                  ...editingCell,
                  value: parseFloat(e.target.value) || 0,
                })
              }
              className="bg-card border-border text-foreground text-sm mt-1"
              step="0.01"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes..."
              className="bg-card border-border text-foreground text-sm min-h-[80px] mt-1"
            />
          </div>

          <ReceiptUploadZone
            inputId="receipt-upload-parkingfee"
            imageFiles={imageFiles}
            existingImages={existingImages}
            isLoadingImages={isLoadingImages}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onFilesDropped={handleFilesDropped}
            onRemoveNew={handleRemoveImage}
            onRemoveExisting={handleRemoveExistingImage}
          />
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
            disabled={isSaving || isUploading}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {isSaving || isUploading ? "Saving..." : imageFiles.length > 0 ? `Save & Upload ${imageFiles.length} Image${imageFiles.length > 1 ? "s" : ""}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
