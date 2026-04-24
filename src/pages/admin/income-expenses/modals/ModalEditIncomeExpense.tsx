// Modal for INCOME & EXPENSES category
import React, { useState, useEffect, useRef } from "react";
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

// Helper to get value by month
const getMonthValue = (arr: any[], month: number, field: string): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  const item = arr.find((x) => x && x.month === month);
  if (!item) return 0;
  const value = item[field];
  if (value === null || value === undefined) return 0;
  const numValue = Number(value);
  return isNaN(numValue) ? 0 : numValue;
};

export default function ModalEditIncomeExpense() {
  const { editingCell, setEditingCell, updateCell, saveChanges, isSaving, year, carId, monthModes, data, dynamicSubcategories, getFormAmount } = useIncomeExpense();
  const [remarks, setRemarks] = useState("");

  const monthName = editingCell ? MONTHS[editingCell.month - 1] : "";
  const isOpen = !!editingCell && editingCell.category === "income";

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

  // Load remarks only when modal opens (not on every editingCell change)
  // Use a ref to track if we've already loaded remarks for this cell
  const remarksLoadedRef = useRef<string>("");
  
  useEffect(() => {
    if (isOpen && editingCell) {
      // Create a unique key for this cell
      const cellKey = `${editingCell.category}-${editingCell.field}-${editingCell.month}`;
      
      // Only load remarks if we haven't loaded them for this cell yet
      if (remarksLoadedRef.current !== cellKey) {
        remarksLoadedRef.current = cellKey;
        
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
    } else if (!isOpen) {
      // Reset the ref when modal closes
      remarksLoadedRef.current = "";
    }
  }, [isOpen, editingCell?.category, editingCell?.field, editingCell?.month, carId, year]);

  const handleClose = () => {
    setEditingCell(null);
    setRemarks("");
    resetImages();
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    try {
      // Upload images first if there are any new ones (skip for management/owner split)
      if (imageFiles.length > 0 && editingCell.field !== "carManagementSplit" && editingCell.field !== "carOwnerSplit") {
        await uploadImages();
      }
    
      // Save the change with remarks - remarks will be included in the save request
      // The saveChanges function will send remarks along with the value
      saveChanges({
        category: editingCell.category,
        field: editingCell.field,
        month: editingCell.month,
        value: editingCell.value,
        remarks: remarks.trim(), // Include remarks in the save
      });
    } catch (error) {
      // Error already handled in uploadImages or fetch
      console.error("Error saving:", error);
    }
  };

  if (!editingCell || editingCell.category !== "income") return null;

  // Get friendly field name
  const fieldNames: { [key: string]: string } = {
    rentalIncome: "Rental Income",
    deliveryIncome: "Delivery Income",
    electricPrepaidIncome: "Electric Prepaid Income",
    smokingFines: "Smoking Fines",
    gasPrepaidIncome: "Gas Prepaid Income",
    skiRacksIncome: "Ski Racks Income",
    milesIncome: "Miles Income",
    childSeatIncome: "Child Seat Income",
    coolersIncome: "Coolers Income",
    insuranceWreckIncome: "Income insurance and Client Wrecks",
    otherIncome: "Other Income",
    negativeBalanceCarryOver: "Negative Balance Carry Over",
    carPayment: "Car Payment",
    carManagementTotalExpenses: "Car Management Total Expenses",
    carOwnerTotalExpenses: "Car Owner Total Expenses",
  };

  const fieldName = fieldNames[editingCell.field] || editingCell.field;

  // Get all values for the current month (only for management/owner split)
  const month = editingCell.month;
  const isManagementSplit = editingCell.field === "carManagementSplit" || editingCell.field === "carOwnerSplit";
  
  // Income values
  const incomeValues = isManagementSplit ? {
    rentalIncome: getMonthValue(data.incomeExpenses, month, "rentalIncome"),
    deliveryIncome: getMonthValue(data.incomeExpenses, month, "deliveryIncome"),
    electricPrepaidIncome: getMonthValue(data.incomeExpenses, month, "electricPrepaidIncome"),
    smokingFines: getMonthValue(data.incomeExpenses, month, "smokingFines"),
    gasPrepaidIncome: getMonthValue(data.incomeExpenses, month, "gasPrepaidIncome"),
    skiRacksIncome: getMonthValue(data.incomeExpenses, month, "skiRacksIncome"),
    milesIncome: getMonthValue(data.incomeExpenses, month, "milesIncome"),
    childSeatIncome: getMonthValue(data.incomeExpenses, month, "childSeatIncome"),
    coolersIncome: getMonthValue(data.incomeExpenses, month, "coolersIncome"),
    insuranceWreckIncome: getMonthValue(data.incomeExpenses, month, "insuranceWreckIncome"),
    otherIncome: getMonthValue(data.incomeExpenses, month, "otherIncome"),
  } : null;
  
  // Direct Delivery values
  const directDeliveryValues = isManagementSplit ? {
    laborCarCleaning: getMonthValue(data.directDelivery, month, "laborCarCleaning"),
    laborDelivery: getMonthValue(data.directDelivery, month, "laborDelivery"),
    parkingAirport: getMonthValue(data.directDelivery, month, "parkingAirport"),
    parkingLot: getMonthValue(data.directDelivery, month, "parkingLot"),
    uberLyftLime: getMonthValue(data.directDelivery, month, "uberLyftLime"),
  } : null;
  
  // COGS values
  const cogsValues = isManagementSplit ? {
    autoBodyShopWreck: getMonthValue(data.cogs, month, "autoBodyShopWreck"),
    alignment: getMonthValue(data.cogs, month, "alignment"),
    battery: getMonthValue(data.cogs, month, "battery"),
    brakes: getMonthValue(data.cogs, month, "brakes"),
    carPayment: getMonthValue(data.cogs, month, "carPayment"),
    carInsurance: getMonthValue(data.cogs, month, "carInsurance"),
    carSeats: getMonthValue(data.cogs, month, "carSeats"),
    cleaningSuppliesTools: getMonthValue(data.cogs, month, "cleaningSuppliesTools"),
    emissions: getMonthValue(data.cogs, month, "emissions"),
    gpsSystem: getMonthValue(data.cogs, month, "gpsSystem"),
    keyFob: getMonthValue(data.cogs, month, "keyFob"),
    laborCleaning: getMonthValue(data.cogs, month, "laborCleaning"),
    licenseRegistration: getMonthValue(data.cogs, month, "licenseRegistration"),
    mechanic: getMonthValue(data.cogs, month, "mechanic"),
    oilLube: getMonthValue(data.cogs, month, "oilLube"),
    parts: getMonthValue(data.cogs, month, "parts"),
    skiRacks: getMonthValue(data.cogs, month, "skiRacks"),
    tickets: getMonthValue(data.cogs, month, "tickets"),
    tiredAirStation: getMonthValue(data.cogs, month, "tiredAirStation"),
    tires: getMonthValue(data.cogs, month, "tires"),
    towingImpoundFees: getMonthValue(data.cogs, month, "towingImpoundFees"),
    uberLyftLime: getMonthValue(data.cogs, month, "uberLyftLime"),
    windshield: getMonthValue(data.cogs, month, "windshield"),
    wipers: getMonthValue(data.cogs, month, "wipers"),
  } : null;
  
  // Parking Fee & Labor values
  const parkingFeeLaborValues = isManagementSplit ? {
    glaParkingFee: getMonthValue(data.parkingFeeLabor, month, "glaParkingFee"),
    laborCleaning: getMonthValue(data.parkingFeeLabor, month, "laborCleaning"),
  } : null;
  
  // Reimbursed Bills values
  const reimbursedBillsValues = isManagementSplit ? {
    electricReimbursed: getMonthValue(data.reimbursedBills, month, "electricReimbursed"),
    electricNotReimbursed: getMonthValue(data.reimbursedBills, month, "electricNotReimbursed"),
    gasReimbursed: getMonthValue(data.reimbursedBills, month, "gasReimbursed"),
    gasNotReimbursed: getMonthValue(data.reimbursedBills, month, "gasNotReimbursed"),
    gasServiceRun: getMonthValue(data.reimbursedBills, month, "gasServiceRun"),
    parkingAirport: getMonthValue(data.reimbursedBills, month, "parkingAirport"),
    uberLyftLimeNotReimbursed: getMonthValue(data.reimbursedBills, month, "uberLyftLimeNotReimbursed"),
    uberLyftLimeReimbursed: getMonthValue(data.reimbursedBills, month, "uberLyftLimeReimbursed"),
  } : null;
  
  // Calculate totals
  const totalDirectDelivery = isManagementSplit && directDeliveryValues ? 
    Object.values(directDeliveryValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0) : 0;
  
  const totalCogs = isManagementSplit && cogsValues ? 
    Object.values(cogsValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.cogs.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0) : 0;
  
  const totalParkingFeeLabor = isManagementSplit && parkingFeeLaborValues ? 
    Object.values(parkingFeeLaborValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0) : 0;
  
  const totalReimbursedBills = isManagementSplit && reimbursedBillsValues ? 
    Object.values(reimbursedBillsValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.reimbursedBills.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0) : 0;
  
  const storedMgmtPercent = isManagementSplit ? Number(getMonthValue(data.incomeExpenses, month, "carManagementSplit")) || 0 : 0;
  const mgmtPercent = storedMgmtPercent / 100;
  const storedOwnerPercent = isManagementSplit ? Number(getMonthValue(data.incomeExpenses, month, "carOwnerSplit")) || 0 : 0;
  const ownerPercent = storedOwnerPercent / 100;
  
  const carManagementTotalExpenses = isManagementSplit ? totalReimbursedBills + (totalDirectDelivery * mgmtPercent) + (totalCogs * mgmtPercent) : 0;
  const carOwnerTotalExpenses = isManagementSplit ? (totalDirectDelivery * ownerPercent) + (totalCogs * ownerPercent) : 0;
  const totalExpenses = carManagementTotalExpenses + carOwnerTotalExpenses;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={`bg-card border-border text-foreground ${isManagementSplit ? 'max-w-4xl max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-md'}`}>
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            {`Update ${fieldName}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter the amount for {fieldName} for {monthName} {year}
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
            <Label className="text-muted-foreground text-xs">
              {isManagementSplit
                ? "Percentage"
                : "Manual Amount"}
            </Label>
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
              step={isManagementSplit ? "1" : "0.01"}
              min={isManagementSplit ? "0" : undefined}
              max={isManagementSplit ? "100" : undefined}
              autoFocus
            />
            {!isManagementSplit && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Manually-entered amount. Set to 0 to remove it; the Form Amount is unaffected.
              </p>
            )}
          </div>

          {isManagementSplit ? (
            <div>
              <Label className="text-muted-foreground text-xs">Inputted Percentage:</Label>
              <Input
                value={`${editingCell.value.toFixed(0)}%`}
                disabled
                className="bg-card border-border text-muted-foreground text-sm mt-1"
              />
            </div>
          ) : (
            <AmountBreakdown
              formAmount={getFormAmount(editingCell.category, editingCell.field, editingCell.month)}
              manualAmount={editingCell.value}
            />
          )}

          {editingCell.field !== "carManagementSplit" && editingCell.field !== "carOwnerSplit" && (
          <div>
            <Label className="text-muted-foreground text-xs">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes..."
              className="bg-card border-border text-foreground text-sm min-h-[100px] mt-1"
            />
          </div>
          )}

          {/* All Subcategory Values Display for Management/Owner Split */}
          {isManagementSplit && incomeValues && directDeliveryValues && cogsValues && parkingFeeLaborValues && reimbursedBillsValues && (
            <div className="border-t border-border pt-4 mt-4">
              <Label className="text-muted-foreground text-sm font-semibold mb-3 block">
                All Values for {monthName} {year}
              </Label>
              <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                {/* INCOME */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">INCOME</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Rental Income:</span>
                      <span>${incomeValues.rentalIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Delivery Income:</span>
                      <span>${incomeValues.deliveryIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Electric Prepaid Income:</span>
                      <span>${incomeValues.electricPrepaidIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Smoking Fines:</span>
                      <span>${incomeValues.smokingFines.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gas Prepaid Income:</span>
                      <span>${incomeValues.gasPrepaidIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ski Racks Income:</span>
                      <span>${incomeValues.skiRacksIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Miles Income:</span>
                      <span>${incomeValues.milesIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Child Seat Income:</span>
                      <span>${incomeValues.childSeatIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Coolers Income:</span>
                      <span>${incomeValues.coolersIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Insurance and Client Wrecks:</span>
                      <span>${incomeValues.insuranceWreckIncome.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Other Income:</span>
                      <span>${incomeValues.otherIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* OPERATING EXPENSE (Direct Delivery) */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">OPERATING EXPENSE (Direct Delivery)</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Labor - Cleaning:</span>
                      <span>${directDeliveryValues.laborCarCleaning.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Labor - Delivery:</span>
                      <span>${directDeliveryValues.laborDelivery.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Parking - Airport:</span>
                      <span>${directDeliveryValues.parkingAirport.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Parking - Lot:</span>
                      <span>${directDeliveryValues.parkingLot.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Uber/Lyft/Lime:</span>
                      <span>${directDeliveryValues.uberLyftLime.toFixed(2)}</span>
                    </div>
                    {dynamicSubcategories.directDelivery.map((subcat) => {
                      const monthValue = subcat.values.find((v: any) => v.month === month);
                      const value = monthValue?.value || 0;
                      return value > 0 ? (
                        <div key={subcat.id} className="flex justify-between text-muted-foreground">
                          <span>{subcat.name}:</span>
                          <span>${value.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>TOTAL OPERATING EXPENSE (Direct Delivery):</span>
                      <span>${totalDirectDelivery.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* OPERATING EXPENSE (COGS - Per Vehicle) */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">OPERATING EXPENSE (COGS - Per Vehicle)</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Auto Body Shop / Wreck:</span>
                      <span>${cogsValues.autoBodyShopWreck.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Alignment:</span>
                      <span>${cogsValues.alignment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Battery:</span>
                      <span>${cogsValues.battery.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Brakes:</span>
                      <span>${cogsValues.brakes.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Car Payment:</span>
                      <span>${cogsValues.carPayment.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Car Insurance:</span>
                      <span>${cogsValues.carInsurance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Car Seats:</span>
                      <span>${cogsValues.carSeats.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Cleaning Supplies / Tools:</span>
                      <span>${cogsValues.cleaningSuppliesTools.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Emissions:</span>
                      <span>${cogsValues.emissions.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GPS System:</span>
                      <span>${cogsValues.gpsSystem.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Key & Fob:</span>
                      <span>${cogsValues.keyFob.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Labor - Cleaning:</span>
                      <span>${cogsValues.laborCleaning.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>License & Registration:</span>
                      <span>${cogsValues.licenseRegistration.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Mechanic:</span>
                      <span>${cogsValues.mechanic.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Oil/Lube:</span>
                      <span>${cogsValues.oilLube.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Parts:</span>
                      <span>${cogsValues.parts.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ski Racks:</span>
                      <span>${cogsValues.skiRacks.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tickets & Tolls:</span>
                      <span>${cogsValues.tickets.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tired Air Station:</span>
                      <span>${cogsValues.tiredAirStation.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tires:</span>
                      <span>${cogsValues.tires.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Towing / Impound Fees:</span>
                      <span>${cogsValues.towingImpoundFees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Uber/Lyft/Lime:</span>
                      <span>${cogsValues.uberLyftLime.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Windshield:</span>
                      <span>${cogsValues.windshield.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Wipers:</span>
                      <span>${cogsValues.wipers.toFixed(2)}</span>
                    </div>
                    {dynamicSubcategories.cogs.map((subcat) => {
                      const monthValue = subcat.values.find((v: any) => v.month === month);
                      const value = monthValue?.value || 0;
                      return value > 0 ? (
                        <div key={subcat.id} className="flex justify-between text-muted-foreground">
                          <span>{subcat.name}:</span>
                          <span>${value.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>TOTAL OPERATING EXPENSE (COGS - Per Vehicle):</span>
                      <span>${totalCogs.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* GLA PARKING FEE & LABOR CLEANING */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">GLA PARKING FEE & LABOR CLEANING</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>GLA Parking Fee:</span>
                      <span>${parkingFeeLaborValues.glaParkingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Labor - Cleaning:</span>
                      <span>${parkingFeeLaborValues.laborCleaning.toFixed(2)}</span>
                    </div>
                    {dynamicSubcategories.parkingFeeLabor.map((subcat) => {
                      const monthValue = subcat.values.find((v: any) => v.month === month);
                      const value = monthValue?.value || 0;
                      return value > 0 ? (
                        <div key={subcat.id} className="flex justify-between text-muted-foreground">
                          <span>{subcat.name}:</span>
                          <span>${value.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>Total Parking Fee & Labor Cleaning:</span>
                      <span>${totalParkingFeeLabor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* REIMBURSE AND NON-REIMBURSE BILLS */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">REIMBURSE AND NON-REIMBURSE BILLS</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Electric - Reimbursed:</span>
                      <span>${reimbursedBillsValues.electricReimbursed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Electric - Not Reimbursed:</span>
                      <span>${reimbursedBillsValues.electricNotReimbursed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gas - Reimbursed:</span>
                      <span>${reimbursedBillsValues.gasReimbursed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gas - Not Reimbursed:</span>
                      <span>${reimbursedBillsValues.gasNotReimbursed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gas - Service Run:</span>
                      <span>${reimbursedBillsValues.gasServiceRun.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Parking Airport:</span>
                      <span>${reimbursedBillsValues.parkingAirport.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Uber/Lyft/Lime - Not Reimbursed:</span>
                      <span>${reimbursedBillsValues.uberLyftLimeNotReimbursed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Uber/Lyft/Lime - Reimbursed:</span>
                      <span>${reimbursedBillsValues.uberLyftLimeReimbursed.toFixed(2)}</span>
                    </div>
                    {dynamicSubcategories.reimbursedBills.map((subcat) => {
                      const monthValue = subcat.values.find((v: any) => v.month === month);
                      const value = monthValue?.value || 0;
                      return value > 0 ? (
                        <div key={subcat.id} className="flex justify-between text-muted-foreground">
                          <span>{subcat.name}:</span>
                          <span>${value.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>TOTAL REIMBURSE AND NON-REIMBURSE BILLS:</span>
                      <span>${totalReimbursedBills.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Total Expenses */}
                <div>
                  <div className="text-primary text-xs font-semibold mb-2">TOTAL EXPENSES</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Car Management Total Expenses:</span>
                      <span>${carManagementTotalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Car Owner Total Expenses:</span>
                      <span>${carOwnerTotalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                      <span>Total Expenses:</span>
                      <span>${totalExpenses.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {editingCell.field !== "carManagementSplit" && editingCell.field !== "carOwnerSplit" && (
            <>
              <FormReceiptInModal carId={carId} year={year} editingCell={editingCell} isOpen={isOpen} />

              <ReceiptUploadZone
                inputId="receipt-upload-income"
                imageFiles={imageFiles}
                existingImages={existingImages}
                isLoadingImages={isLoadingImages}
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                onFilesDropped={handleFilesDropped}
                onRemoveNew={handleRemoveImage}
                onRemoveExisting={handleRemoveExistingImage}
              />
            </>
          )}
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
            disabled={isSaving || (isUploading && editingCell.field !== "carManagementSplit" && editingCell.field !== "carOwnerSplit")}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {isSaving || (isUploading && editingCell.field !== "carManagementSplit" && editingCell.field !== "carOwnerSplit") 
              ? "Saving..." 
              : editingCell.field === "carManagementSplit" || editingCell.field === "carOwnerSplit"
              ? "Save"
              : `Save${imageFiles.length > 0 ? ` & Upload ${imageFiles.length} Image${imageFiles.length > 1 ? 's' : ''}` : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
