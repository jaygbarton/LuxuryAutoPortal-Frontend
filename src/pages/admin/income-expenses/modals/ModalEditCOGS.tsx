// Modal for OPERATING EXPENSE (COGS - Per Vehicle) category
import React, { useState, useEffect } from "react";
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
import FormReceiptInModal from "../components/FormReceiptInModal";
import ReceiptUploadZone from "../components/ReceiptUploadZone";
import AmountBreakdown from "../components/AmountBreakdown";
import { useImageUpload } from "../utils/useImageUpload";
import { buildApiUrl } from "@/lib/queryClient";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ModalEditCOGS() {
  const { editingCell, setEditingCell, updateCell, saveChanges, isSaving, year, carId, getFormAmount } = useIncomeExpense();
  const [remarks, setRemarks] = useState("");

  // Load remarks when modal opens
  useEffect(() => {
    if (editingCell) {
      const loadRemarks = async () => {
        try {
          const response = await fetch(
            buildApiUrl(`/api/income-expense/remarks?carId=${carId}&year=${year}&month=${editingCell.month}&category=${editingCell.category}&field=${editingCell.field}`),
            { credentials: "include" }
          );
          if (response.ok) {
            const data = await response.json();
            setRemarks(data.remarks || "");
          }
        } catch (error) {
          // Failed to load remarks
        }
      };
      loadRemarks();
    }
  }, [editingCell, carId, year]);

  const monthName = editingCell ? MONTHS[editingCell.month - 1] : "";
  const isOpen = !!editingCell && editingCell.category === "cogs";

  const {
    imageFiles,
    existingImages,
    isUploading,
    isLoadingImages,
    fileInputRef,
    handleFileChange,
    handleFilesDropped,
    handleRemoveImage,
    handleRemoveExistingImage,
    uploadImages,
    resetImages,
  } = useImageUpload(
    carId,
    year,
    editingCell?.category || "",
    editingCell?.field || "",
    editingCell?.month || 1
  );

  const handleClose = () => {
    setEditingCell(null);
    setRemarks("");
    resetImages();
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    try {
      // Upload images first if there are any new ones
      if (imageFiles.length > 0) {
        await uploadImages();
      }
      
      // Save remarks
      try {
        const response = await fetch(buildApiUrl("/api/income-expense/remarks"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            carId,
            year: parseInt(year),
            month: editingCell.month,
            category: editingCell.category,
            field: editingCell.field,
            remarks: remarks.trim(),
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to save remarks");
        }
      } catch (error) {
        console.error("Error saving remarks:", error);
      }
    
    // Save the change immediately, passing it directly to saveChanges
    saveChanges({
      category: editingCell.category,
      field: editingCell.field,
      month: editingCell.month,
      value: editingCell.value,
    });
    } catch (error) {
      // Error already handled in uploadImages
      console.error("Error saving:", error);
    }
  };

  if (!editingCell || editingCell.category !== "cogs") return null;

  const fieldNames: { [key: string]: string } = {
    autoBodyShopWreck: "Auto Body Shop / Wreck",
    alignment: "Alignment",
    battery: "Battery",
    brakes: "Brakes",
    carPayment: "Car Payment",
    carInsurance: "Car Insurance",
    carSeats: "Car Seats",
    cleaningSuppliesTools: "Cleaning Supplies / Tools",
    emissions: "Emissions",
    gpsSystem: "GPS System",
    keyFob: "Keys & Fob",
    laborCleaning: "Labor - Detailing",
    licenseRegistration: "License & Registration",
    mechanic: "Mechanic",
    oilLube: "Oil/Lube",
    parts: "Parts",
    skiRacks: "Ski Racks",
    tickets: "Tickets & Tolls",
    tiredAirStation: "Tired Air Station",
    tires: "Tires",
    towingImpoundFees: "Towing / Impound Fees",
    uberLyftLime: "Uber/Lyft/Lime",
    windshield: "Windshield",
    wipers: "Wipers",
  };

  const fieldName = fieldNames[editingCell.field] || editingCell.field;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            Update COGS Expense
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter Cost of Goods Sold expenses for {monthName} {year}
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
            <Label className="text-muted-foreground text-xs">Manual Amount</Label>
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
            <p className="text-[11px] text-muted-foreground mt-1">
              Manually-entered amount. Set to 0 to remove it; the Form Amount is unaffected.
            </p>
          </div>

          <AmountBreakdown
            formAmount={getFormAmount(editingCell.category, editingCell.field, editingCell.month)}
            manualAmount={editingCell.value}
          />

          <div>
            <Label className="text-muted-foreground text-xs">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes..."
              className="bg-card border-border text-foreground text-sm min-h-[80px] mt-1"
            />
          </div>

          <FormReceiptInModal carId={carId} year={year} editingCell={editingCell} isOpen={isOpen} />

          <ReceiptUploadZone
            inputId="receipt-upload-cogs"
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
            {isSaving || isUploading ? "Saving..." : `Save${imageFiles.length > 0 ? ` & Upload ${imageFiles.length} Image${imageFiles.length > 1 ? 's' : ''}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
