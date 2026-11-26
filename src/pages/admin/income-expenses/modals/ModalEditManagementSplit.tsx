// Modal for CAR MANAGEMENT ACCESS category
import React from "react";
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
import { formatAmount } from "@/lib/formatAmount";

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

export default function ModalEditManagementSplit() {
  const { editingCell, setEditingCell, updateCell, saveChanges, isSaving, monthModes, year, carId, data, dynamicSubcategories } = useIncomeExpense();

  const monthName = editingCell ? MONTHS[editingCell.month - 1] : "";
  const isOpen = !!editingCell && editingCell.category === "managementSplit";

  const handleClose = () => {
    setEditingCell(null);
  };

  const handleSave = () => {
    if (!editingCell) return;
    
    // Save the change immediately, passing it directly to saveChanges
    saveChanges({
      category: editingCell.category,
      field: editingCell.field,
      month: editingCell.month,
      value: editingCell.value,
    });
  };

  if (!editingCell || editingCell.category !== "managementSplit") return null;

  const fieldNames: { [key: string]: string } = {
    carManagementSplit: "Car Management Split",
    carOwnerSplit: "Car Owner Split",
  };

  const fieldName = fieldNames[editingCell.field] || editingCell.field;
  
  // Get current mode for this month
  const currentMode = monthModes[editingCell.month];
  const modeDisplay = currentMode === 50 ? "50:50" : "30:70";

  // Get all values for the current month
  const month = editingCell.month;
  
  // Income values
  const incomeValues = {
    rentalIncome: getMonthValue(data.incomeExpenses, month, "rentalIncome"),
    deliveryIncome: getMonthValue(data.incomeExpenses, month, "deliveryIncome"),
    electricPrepaidIncome: getMonthValue(data.incomeExpenses, month, "electricPrepaidIncome"),
    smokingFines: getMonthValue(data.incomeExpenses, month, "smokingFines"),
    gasPrepaidIncome: getMonthValue(data.incomeExpenses, month, "gasPrepaidIncome"),
    gasPrepaidOwnerIncome: getMonthValue(data.incomeExpenses, month, "gasPrepaidOwnerIncome"),
    skiRacksIncome: getMonthValue(data.incomeExpenses, month, "skiRacksIncome"),
    milesIncome: getMonthValue(data.incomeExpenses, month, "milesIncome"),
    childSeatIncome: getMonthValue(data.incomeExpenses, month, "childSeatIncome"),
    coolersIncome: getMonthValue(data.incomeExpenses, month, "coolersIncome"),
    insuranceWreckIncome: getMonthValue(data.incomeExpenses, month, "insuranceWreckIncome"),
    otherIncome: getMonthValue(data.incomeExpenses, month, "otherIncome"),
    otherCreditIncome: getMonthValue(data.incomeExpenses, month, "otherCreditIncome"),
    guestCancellationIncome: getMonthValue(data.incomeExpenses, month, "guestCancellationIncome"),
    gasReimbursementIncome: getMonthValue(data.incomeExpenses, month, "gasReimbursementIncome"),
    onTripChargingIncome: getMonthValue(data.incomeExpenses, month, "onTripChargingIncome"),
    postTripChargingIncome: getMonthValue(data.incomeExpenses, month, "postTripChargingIncome"),
  };
  
  // Direct Delivery values
  const directDeliveryValues = {
    laborCarCleaning: getMonthValue(data.directDelivery, month, "laborCarCleaning"),
    laborDelivery: getMonthValue(data.directDelivery, month, "laborDelivery"),
    parkingAirport: getMonthValue(data.directDelivery, month, "parkingAirport"),
    parkingAirportNotReimbursed: getMonthValue(data.directDelivery, month, "parkingAirportNotReimbursed"),
    parkingLot: getMonthValue(data.directDelivery, month, "parkingLot"),
    uberLyftLime: getMonthValue(data.directDelivery, month, "uberLyftLime"),
  };
  
  // COGS values
  const cogsValues = {
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
  };
  
  // Parking Fee & Labor values
  const parkingFeeLaborValues = {
    glaParkingFee: getMonthValue(data.parkingFeeLabor, month, "glaParkingFee"),
    laborCleaning: getMonthValue(data.parkingFeeLabor, month, "laborCleaning"),
  };
  
  // Reimbursed Bills values
  const reimbursedBillsValues = {
    electricReimbursed: getMonthValue(data.reimbursedBills, month, "electricReimbursed"),
    electricNotReimbursed: getMonthValue(data.reimbursedBills, month, "electricNotReimbursed"),
    gasReimbursed: getMonthValue(data.reimbursedBills, month, "gasReimbursed"),
    gasNotReimbursed: getMonthValue(data.reimbursedBills, month, "gasNotReimbursed"),
    gasServiceRun: getMonthValue(data.reimbursedBills, month, "gasServiceRun"),
    parkingAirport: getMonthValue(data.reimbursedBills, month, "parkingAirport"),
    uberLyftLimeNotReimbursed: getMonthValue(data.reimbursedBills, month, "uberLyftLimeNotReimbursed"),
    uberLyftLimeReimbursed: getMonthValue(data.reimbursedBills, month, "uberLyftLimeReimbursed"),
    creditToCarOwner: getMonthValue(data.reimbursedBills, month, "creditToCarOwner"),
  };
  
  // Calculate totals
  const totalDirectDelivery = Object.values(directDeliveryValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
  
  const totalCogs = Object.values(cogsValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.cogs.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
  
  const totalParkingFeeLabor = Object.values(parkingFeeLaborValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
  
  const totalReimbursedBills = Object.values(reimbursedBillsValues).reduce((sum, val) => sum + val, 0) +
    dynamicSubcategories.reimbursedBills.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
  
  // An unset percent must fall back to the car's configured default, not 0 —
  // a month synthesized by ensureAllMonths carries no split field at all, and
  // `|| 0` collapsed that into a real 0%, zeroing the expense share. A stored
  // 0 is honoured.
  const splitRow = data.incomeExpenses?.find((x: any) => x && x.month === month);
  const rawMgmtStored = splitRow?.carManagementSplit;
  const storedMgmtPercent =
    rawMgmtStored != null
      ? Number(rawMgmtStored)
      : (data.formulaSetting?.carManagementSplitPercent ?? 50);
  const mgmtPercent = storedMgmtPercent / 100;
  const rawOwnerStored = splitRow?.carOwnerSplit;
  const storedOwnerPercent =
    rawOwnerStored != null
      ? Number(rawOwnerStored)
      : (data.formulaSetting?.carOwnerSplitPercent ?? 50);
  const ownerPercent = storedOwnerPercent / 100;
  
  const carManagementTotalExpenses = totalReimbursedBills + (totalDirectDelivery * mgmtPercent) + (totalCogs * mgmtPercent);
  const carOwnerTotalExpenses = (totalDirectDelivery * ownerPercent) + (totalCogs * ownerPercent);
  const totalExpenses = carManagementTotalExpenses + carOwnerTotalExpenses;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            Update Car Management/Owner Split
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter management and owner split data for {monthName} {year}
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
            <Label className="text-muted-foreground text-xs">Current Mode:</Label>
            <div className="text-foreground text-sm font-medium mt-1">
              {modeDisplay} Split
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Split Percentage:</Label>
            <div className="text-foreground text-sm font-medium mt-1">
              {editingCell.field === "carManagementSplit" 
                ? `${currentMode === 50 ? "50" : "30"}%`
                : `${currentMode === 50 ? "50" : "70"}%`
              }
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
              min="0"
              max="100"
              step="0.01"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Calculated Amount:</Label>
            <Input
              value={`$${formatAmount(editingCell.value)}`}
              disabled
              className="bg-card border-border text-muted-foreground text-sm mt-1"
            />
          </div>
        </div>

        {/* All Subcategory Values Display */}
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
                  <span>Income Car Rentals - Turo (Trip Income):</span>
                  <span>${formatAmount(incomeValues.rentalIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Delivery:</span>
                  <span>${formatAmount(incomeValues.deliveryIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Electric Prepaid:</span>
                  <span>${formatAmount(incomeValues.electricPrepaidIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Smoking Fines:</span>
                  <span>${formatAmount(incomeValues.smokingFines)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Gas Prepaid:</span>
                  <span>${formatAmount(incomeValues.gasPrepaidIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Gas Prepaid (Owner Share):</span>
                  <span>${formatAmount(incomeValues.gasPrepaidOwnerIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Ski Racks:</span>
                  <span>${formatAmount(incomeValues.skiRacksIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Miles:</span>
                  <span>${formatAmount(incomeValues.milesIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Car Seats:</span>
                  <span>${formatAmount(incomeValues.childSeatIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Coolers/Camp Chairs:</span>
                  <span>${formatAmount(incomeValues.coolersIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Turo Claims & Insurance Payments:</span>
                  <span>${formatAmount(incomeValues.insuranceWreckIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Other Turo:</span>
                  <span>${formatAmount(incomeValues.otherIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Other Credit:</span>
                  <span>${formatAmount(incomeValues.otherCreditIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Guest Cancellation:</span>
                  <span>${formatAmount(incomeValues.guestCancellationIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income Gas Reimbursed:</span>
                  <span>${formatAmount(incomeValues.gasReimbursementIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income EV On-Trip Charging Reimbursed:</span>
                  <span>${formatAmount(incomeValues.onTripChargingIncome)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Income EV Post-Trip Charging Reimbursed:</span>
                  <span>${formatAmount(incomeValues.postTripChargingIncome)}</span>
                </div>
              </div>
            </div>

            {/* OPERATING EXPENSE (Direct Delivery) */}
            <div>
              <div className="text-primary text-xs font-semibold mb-2">OPERATING EXPENSE (Direct Delivery)</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor - Cleaning:</span>
                  <span>${formatAmount(directDeliveryValues.laborCarCleaning)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor - Delivery:</span>
                  <span>${formatAmount(directDeliveryValues.laborDelivery)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Parking Airport Reimbursed:</span>
                  <span>${formatAmount(directDeliveryValues.parkingAirport)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Parking Airport Not Reimbursed:</span>
                  <span>${formatAmount(directDeliveryValues.parkingAirportNotReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Parking - Lot:</span>
                  <span>${formatAmount(directDeliveryValues.parkingLot)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Uber/Lyft/Lime:</span>
                  <span>${formatAmount(directDeliveryValues.uberLyftLime)}</span>
                </div>
                {dynamicSubcategories.directDelivery.map((subcat) => {
                  const monthValue = subcat.values.find((v: any) => v.month === month);
                  const value = monthValue?.value || 0;
                  return value > 0 ? (
                    <div key={subcat.id} className="flex justify-between text-muted-foreground">
                      <span>{subcat.name}:</span>
                      <span>${formatAmount(value)}</span>
                    </div>
                  ) : null;
                })}
                <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                  <span>TOTAL OPERATING EXPENSE (Direct Delivery):</span>
                  <span>${formatAmount(totalDirectDelivery)}</span>
                </div>
              </div>
            </div>

            {/* OPERATING EXPENSE (COGS - Per Vehicle) */}
            <div>
              <div className="text-primary text-xs font-semibold mb-2">OPERATING EXPENSE (COGS - Per Vehicle)</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Auto Body Shop / Wreck:</span>
                  <span>${formatAmount(cogsValues.autoBodyShopWreck)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Alignment:</span>
                  <span>${formatAmount(cogsValues.alignment)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Battery:</span>
                  <span>${formatAmount(cogsValues.battery)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Brakes:</span>
                  <span>${formatAmount(cogsValues.brakes)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Car Payment:</span>
                  <span>${formatAmount(cogsValues.carPayment)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Car Insurance:</span>
                  <span>${formatAmount(cogsValues.carInsurance)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Car Seats:</span>
                  <span>${formatAmount(cogsValues.carSeats)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cleaning Supplies / Tools:</span>
                  <span>${formatAmount(cogsValues.cleaningSuppliesTools)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Emissions:</span>
                  <span>${formatAmount(cogsValues.emissions)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GPS System:</span>
                  <span>${formatAmount(cogsValues.gpsSystem)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Key & Fob:</span>
                  <span>${formatAmount(cogsValues.keyFob)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor - Cleaning:</span>
                  <span>${formatAmount(cogsValues.laborCleaning)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>License & Registration:</span>
                  <span>${formatAmount(cogsValues.licenseRegistration)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Mechanic:</span>
                  <span>${formatAmount(cogsValues.mechanic)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Oil/Lube:</span>
                  <span>${formatAmount(cogsValues.oilLube)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Parts:</span>
                  <span>${formatAmount(cogsValues.parts)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ski Racks:</span>
                  <span>${formatAmount(cogsValues.skiRacks)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tickets & Tolls:</span>
                  <span>${formatAmount(cogsValues.tickets)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tired Air Station:</span>
                  <span>${formatAmount(cogsValues.tiredAirStation)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tires:</span>
                  <span>${formatAmount(cogsValues.tires)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Towing / Impound Fees:</span>
                  <span>${formatAmount(cogsValues.towingImpoundFees)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Uber/Lyft/Lime:</span>
                  <span>${formatAmount(cogsValues.uberLyftLime)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Windshield:</span>
                  <span>${formatAmount(cogsValues.windshield)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Wipers:</span>
                  <span>${formatAmount(cogsValues.wipers)}</span>
                </div>
                {dynamicSubcategories.cogs.map((subcat) => {
                  const monthValue = subcat.values.find((v: any) => v.month === month);
                  const value = monthValue?.value || 0;
                  return value > 0 ? (
                    <div key={subcat.id} className="flex justify-between text-muted-foreground">
                      <span>{subcat.name}:</span>
                      <span>${formatAmount(value)}</span>
                    </div>
                  ) : null;
                })}
                <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                  <span>TOTAL OPERATING EXPENSE (COGS - Per Vehicle):</span>
                  <span>${formatAmount(totalCogs)}</span>
                </div>
              </div>
            </div>

            {/* GLA PARKING FEE & LABOR CLEANING */}
            <div>
              <div className="text-primary text-xs font-semibold mb-2">GLA PARKING FEE & LABOR CLEANING</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>GLA Parking Fee:</span>
                  <span>${formatAmount(parkingFeeLaborValues.glaParkingFee)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor - Cleaning:</span>
                  <span>${formatAmount(parkingFeeLaborValues.laborCleaning)}</span>
                </div>
                {dynamicSubcategories.parkingFeeLabor.map((subcat) => {
                  const monthValue = subcat.values.find((v: any) => v.month === month);
                  const value = monthValue?.value || 0;
                  return value > 0 ? (
                    <div key={subcat.id} className="flex justify-between text-muted-foreground">
                      <span>{subcat.name}:</span>
                      <span>${formatAmount(value)}</span>
                    </div>
                  ) : null;
                })}
                <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                  <span>Total Parking Fee & Labor Cleaning:</span>
                  <span>${formatAmount(totalParkingFeeLabor)}</span>
                </div>
              </div>
            </div>

            {/* REIMBURSE AND NON-REIMBURSE BILLS */}
            <div>
              <div className="text-primary text-xs font-semibold mb-2">REIMBURSE AND NON-REIMBURSE BILLS</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Electric - Reimbursed:</span>
                  <span>${formatAmount(reimbursedBillsValues.electricReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Electric - Not Reimbursed:</span>
                  <span>${formatAmount(reimbursedBillsValues.electricNotReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Gas – Charged to Guest:</span>
                  <span>${formatAmount(reimbursedBillsValues.gasReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Gas – Not Charged to Guest:</span>
                  <span>${formatAmount(reimbursedBillsValues.gasNotReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Gas - Service Run:</span>
                  <span>${formatAmount(reimbursedBillsValues.gasServiceRun)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Parking Airport:</span>
                  <span>${formatAmount(reimbursedBillsValues.parkingAirport)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Uber/Lyft/Lime - Not Reimbursed:</span>
                  <span>${formatAmount(reimbursedBillsValues.uberLyftLimeNotReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Uber/Lyft/Lime - Reimbursed:</span>
                  <span>${formatAmount(reimbursedBillsValues.uberLyftLimeReimbursed)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Expenses Credit to Car Owner:</span>
                  <span>${formatAmount(reimbursedBillsValues.creditToCarOwner)}</span>
                </div>
                {dynamicSubcategories.reimbursedBills.map((subcat) => {
                  const monthValue = subcat.values.find((v: any) => v.month === month);
                  const value = monthValue?.value || 0;
                  return value > 0 ? (
                    <div key={subcat.id} className="flex justify-between text-muted-foreground">
                      <span>{subcat.name}:</span>
                      <span>${formatAmount(value)}</span>
                    </div>
                  ) : null;
                })}
                <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                  <span>TOTAL REIMBURSE AND NON-REIMBURSE BILLS:</span>
                  <span>${formatAmount(totalReimbursedBills)}</span>
                </div>
              </div>
            </div>

            {/* Total Expenses */}
            <div>
              <div className="text-primary text-xs font-semibold mb-2">TOTAL EXPENSES</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Car Management Total Expenses:</span>
                  <span>${formatAmount(carManagementTotalExpenses)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Car Owner Total Expenses:</span>
                  <span>${formatAmount(carOwnerTotalExpenses)}</span>
                </div>
                <div className="flex justify-between text-primary font-semibold pt-1 border-t border-border">
                  <span>Total Expenses:</span>
                  <span>${formatAmount(totalExpenses)}</span>
                </div>
              </div>
            </div>
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
            disabled={isSaving}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
