// Consolidated Export/Import utility functions for Income and Expenses
import JSZip from "jszip";
import type { IncomeExpenseData } from "../types";
import { buildApiUrl } from "@/lib/queryClient";

/**
 * Build the CSV content for the full income/expense export.
 * (Pure function — returns the string instead of triggering a download.)
 * Used both by the CSV-only download path and by the ZIP exporter that
 * bundles the CSV alongside receipt images.
 */
export function buildIncomeExpenseCSV(
  data: IncomeExpenseData,
  carInfo: any,
  year: string,
  monthModes: { [month: number]: 50 | 70 },
  dynamicSubcategories?: {
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  },
  previousYearData?: IncomeExpenseData | null,
  skiRacksOwner?: { [month: number]: "GLA" | "CAR_OWNER" }
): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Helper functions to calculate values - MUST match the logic used in IncomeExpenseTable.tsx
  // This finds items by month number, not array index
  const getMonthValue = (arr: any[], month: number, field: string): number => {
    if (!arr || !Array.isArray(arr)) return 0;
    const item = arr.find((x) => x && x.month === month);
    if (!item) return 0;
    const value = item[field];
    // Check if value exists (not null, not undefined)
    if (value === null || value === undefined) return 0;
    const numValue = Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };
  
  const getTotalDirectDeliveryForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.directDelivery, month, "laborCarCleaning") +
      getMonthValue(data.directDelivery, month, "laborDelivery") +
      getMonthValue(data.directDelivery, month, "parkingAirport") +
      getMonthValue(data.directDelivery, month, "parkingLot") +
      getMonthValue(data.directDelivery, month, "uberLyftLime")
    );
    const dynamicTotal = (dynamicSubcategories?.directDelivery || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      return sum + (Number(monthValue?.value) || 0);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };
  
  const getTotalCogsForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.cogs, month, "autoBodyShopWreck") +
      getMonthValue(data.cogs, month, "alignment") +
      getMonthValue(data.cogs, month, "battery") +
      getMonthValue(data.cogs, month, "brakes") +
      getMonthValue(data.cogs, month, "carPayment") +
      getMonthValue(data.cogs, month, "carInsurance") +
      getMonthValue(data.cogs, month, "carSeats") +
      getMonthValue(data.cogs, month, "cleaningSuppliesTools") +
      getMonthValue(data.cogs, month, "emissions") +
      getMonthValue(data.cogs, month, "gpsSystem") +
      getMonthValue(data.cogs, month, "keyFob") +
      getMonthValue(data.cogs, month, "laborCleaning") +
      getMonthValue(data.cogs, month, "licenseRegistration") +
      getMonthValue(data.cogs, month, "mechanic") +
      getMonthValue(data.cogs, month, "oilLube") +
      getMonthValue(data.cogs, month, "parts") +
      getMonthValue(data.cogs, month, "skiRacks") +
      getMonthValue(data.cogs, month, "tickets") +
      getMonthValue(data.cogs, month, "tiredAirStation") +
      getMonthValue(data.cogs, month, "tires") +
      getMonthValue(data.cogs, month, "towingImpoundFees") +
      getMonthValue(data.cogs, month, "uberLyftLime") +
      getMonthValue(data.cogs, month, "windshield") +
      getMonthValue(data.cogs, month, "wipers")
    );
    const dynamicTotal = (dynamicSubcategories?.cogs || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      return sum + (Number(monthValue?.value) || 0);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };
  
  const getTotalReimbursedBillsForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.reimbursedBills, month, "electricReimbursed") +
      getMonthValue(data.reimbursedBills, month, "electricNotReimbursed") +
      getMonthValue(data.reimbursedBills, month, "gasReimbursed") +
      getMonthValue(data.reimbursedBills, month, "gasNotReimbursed") +
      getMonthValue(data.reimbursedBills, month, "gasServiceRun") +
      getMonthValue(data.reimbursedBills, month, "parkingAirport") +
      getMonthValue(data.reimbursedBills, month, "uberLyftLimeNotReimbursed") +
      getMonthValue(data.reimbursedBills, month, "uberLyftLimeReimbursed")
    );
    const dynamicTotal = (dynamicSubcategories?.reimbursedBills || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      return sum + (Number(monthValue?.value) || 0);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };
  
  // Helper to get total parking fee & labor cleaning for a month (including dynamic subcategories)
  const getTotalParkingFeeLaborForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.parkingFeeLabor, month, "glaParkingFee") +
      getMonthValue(data.parkingFeeLabor, month, "laborCleaning")
    );
    const dynamicTotal = (dynamicSubcategories?.parkingFeeLabor || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      return sum + (Number(monthValue?.value) || 0);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };
  
  // Calculate Car Management Split - MUST match IncomeExpenseTable.tsx logic exactly
  const calculateCarManagementSplit = (month: number): number => {
    const storedPercent = Number(getMonthValue(data.incomeExpenses, month, "carManagementSplit")) || 0;
    const mgmtPercent = storedPercent / 100;
    
    const rentalIncome = getMonthValue(data.incomeExpenses, month, "rentalIncome");
    const deliveryIncome = getMonthValue(data.incomeExpenses, month, "deliveryIncome");
    const electricPrepaidIncome = getMonthValue(data.incomeExpenses, month, "electricPrepaidIncome");
    const smokingFines = getMonthValue(data.incomeExpenses, month, "smokingFines");
    const gasPrepaidIncome = getMonthValue(data.incomeExpenses, month, "gasPrepaidIncome");
    const skiRacksIncome = getMonthValue(data.incomeExpenses, month, "skiRacksIncome");
    const milesIncome = getMonthValue(data.incomeExpenses, month, "milesIncome");
    const childSeatIncome = getMonthValue(data.incomeExpenses, month, "childSeatIncome");
    const coolersIncome = getMonthValue(data.incomeExpenses, month, "coolersIncome");
    const insuranceWreckIncome = getMonthValue(data.incomeExpenses, month, "insuranceWreckIncome");
    const otherIncome = getMonthValue(data.incomeExpenses, month, "otherIncome");
    // Use calculated Negative Balance Carry Over (January 2019 will be 0, other Januaries use previous year's December) - MUST match page logic
    const negativeBalanceCarryOver = calculateNegativeBalanceCarryOver(month);
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    const totalReimbursedBills = getTotalReimbursedBillsForMonth(month);
    const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(month);
    
    const currentYear = parseInt(year, 10);
    const mode = monthModes[month] || 50;
    const isYear2026OrLater = currentYear >= 2026;
    const isYear2019To2025 = currentYear >= 2019 && currentYear <= 2025;
    
    // Year >= 2026
    if (isYear2026OrLater) {
      // 50:50 mode
      if (mode === 50) {
        // A) No ski racks income
        if (skiRacksIncome === 0) {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + 
                        childSeatIncome + coolersIncome + insuranceWreckIncome + otherIncome + 
                        (smokingFines * 0.9 + skiRacksIncome * mgmtPercent) - totalReimbursedBills;
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // B) If Car Management (GLA) is ski racks owner
        else if ((skiRacksOwner?.[month] || "GLA") === "GLA") {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + 
                        childSeatIncome + coolersIncome + insuranceWreckIncome + otherIncome + 
                        skiRacksIncome + (smokingFines * 0.9) - totalReimbursedBills;
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // C) If Car Owner is ski racks owner
        else {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + 
                        childSeatIncome + coolersIncome + insuranceWreckIncome + otherIncome + 
                        (smokingFines * 0.9) - totalReimbursedBills;
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      }
      // 70:30 mode
      else {
        // A) No ski racks income
        if (skiRacksIncome === 0) {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + 
                        (skiRacksIncome * mgmtPercent) + childSeatIncome + coolersIncome + 
                        insuranceWreckIncome + (smokingFines * 0.9) + otherIncome - 
                        totalReimbursedBills + totalParkingFeeLabor;
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // B) If Car Management (GLA) is ski racks owner
        else if ((skiRacksOwner?.[month] || "GLA") === "GLA") {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + skiRacksIncome + 
                        childSeatIncome + coolersIncome + insuranceWreckIncome + (smokingFines * 0.9) + 
                        otherIncome - totalReimbursedBills + totalParkingFeeLabor;
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // C) If Car Owner is ski racks owner
        else {
          const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + childSeatIncome + 
                        coolersIncome + insuranceWreckIncome + (smokingFines * 0.9) + otherIncome - 
                        totalReimbursedBills + totalParkingFeeLabor;
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * mgmtPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      }
    }
    // Year 2019-2025
    else if (isYear2019To2025) {
      // 50:50 mode
      if (mode === 50) {
        const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + smokingFines + 
                      (skiRacksIncome * mgmtPercent + childSeatIncome * mgmtPercent + 
                       coolersIncome * mgmtPercent + insuranceWreckIncome * mgmtPercent + 
                       otherIncome * mgmtPercent) - totalReimbursedBills;
        const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                       gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                       childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                       totalDirectDelivery - totalCogs) * mgmtPercent;
        const calculation = part1 + part2;
        return calculation >= 0 ? calculation : 0;
      }
      // 70:30 mode
      else {
        const part1 = deliveryIncome + electricPrepaidIncome + gasPrepaidIncome + skiRacksIncome + 
                      childSeatIncome + coolersIncome + insuranceWreckIncome + (smokingFines * 0.9) + 
                      otherIncome - totalReimbursedBills + totalParkingFeeLabor;
        const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                       milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                       insuranceWreckIncome - smokingFines - otherIncome) * mgmtPercent;
        const calculation = part1 + part2;
        return calculation >= 0 ? calculation : 0;
      }
    }
    
    // Default (should not reach here, but return 0 for safety)
    return 0;
  };
  
  // Calculate Car Owner Split - MUST match IncomeExpenseTable.tsx logic exactly
  const calculateCarOwnerSplit = (month: number): number => {
    const storedPercent = Number(getMonthValue(data.incomeExpenses, month, "carOwnerSplit")) || 0;
    const ownerPercent = storedPercent / 100;
    
    const rentalIncome = getMonthValue(data.incomeExpenses, month, "rentalIncome");
    const deliveryIncome = getMonthValue(data.incomeExpenses, month, "deliveryIncome");
    const electricPrepaidIncome = getMonthValue(data.incomeExpenses, month, "electricPrepaidIncome");
    const smokingFines = getMonthValue(data.incomeExpenses, month, "smokingFines");
    const gasPrepaidIncome = getMonthValue(data.incomeExpenses, month, "gasPrepaidIncome");
    const skiRacksIncome = getMonthValue(data.incomeExpenses, month, "skiRacksIncome");
    const milesIncome = getMonthValue(data.incomeExpenses, month, "milesIncome");
    const childSeatIncome = getMonthValue(data.incomeExpenses, month, "childSeatIncome");
    const coolersIncome = getMonthValue(data.incomeExpenses, month, "coolersIncome");
    const insuranceWreckIncome = getMonthValue(data.incomeExpenses, month, "insuranceWreckIncome");
    const otherIncome = getMonthValue(data.incomeExpenses, month, "otherIncome");
    // Use the calculated Negative Balance Carry Over (not stored in data) - MUST match page logic
    const negativeBalanceCarryOver = calculateNegativeBalanceCarryOver(month);
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(month);
    
    const currentYear = parseInt(year, 10);
    const mode = monthModes[month] || 50;
    const isYear2026OrLater = currentYear >= 2026;
    const isYear2019To2025 = currentYear >= 2019 && currentYear <= 2025;
    
    // Year >= 2026
    if (isYear2026OrLater) {
      // 50:50 mode
      if (mode === 50) {
        // A) No ski racks income
        if (skiRacksIncome === 0) {
          const part1 = milesIncome + (smokingFines * 0.1 + skiRacksIncome * ownerPercent);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // B) If Car Management (GLA) is ski racks owner
        else if ((skiRacksOwner?.[month] || "GLA") === "GLA") {
          const part1 = milesIncome + (smokingFines * 0.1);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // C) If Car Owner is ski racks owner
        else {
          const part1 = (milesIncome + skiRacksIncome) + (smokingFines * 0.1);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      }
      // 70:30 mode
      else {
        // A) No ski racks income
        if (skiRacksIncome === 0) {
          const part1 = (skiRacksIncome * ownerPercent + milesIncome) - totalDirectDelivery - totalCogs - 
                        totalParkingFeeLabor + negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // B) If Car Management (GLA) is ski racks owner
        else if ((skiRacksOwner?.[month] || "GLA") === "GLA") {
          const part1 = milesIncome - totalDirectDelivery - totalCogs - totalParkingFeeLabor + 
                        negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
        // C) If Car Owner is ski racks owner
        else {
          const part1 = skiRacksIncome + milesIncome - totalDirectDelivery - totalCogs - 
                        totalParkingFeeLabor + negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      }
    }
    // Year 2019-2025
    else if (isYear2019To2025) {
      // 50:50 mode
      if (mode === 50) {
        const part1 = milesIncome + (skiRacksIncome * ownerPercent + childSeatIncome * ownerPercent + 
                      coolersIncome * ownerPercent + insuranceWreckIncome * ownerPercent + 
                      otherIncome * ownerPercent);
        const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                       gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                       childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                       totalDirectDelivery - totalCogs) * ownerPercent;
        const calculation = part1 + part2;
        return calculation >= 0 ? calculation : 0;
      }
      // 70:30 mode
      else {
        const part1 = milesIncome - totalDirectDelivery - totalCogs - totalParkingFeeLabor + 
                      negativeBalanceCarryOver + (smokingFines * 0.1);
        const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                       milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                       insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
        const calculation = part1 + part2;
        return calculation >= 0 ? calculation : 0;
      }
    }
    
    // Default (should not reach here, but return 0 for safety)
    return 0;
  };
  
  // Helper to get value from previous year data by month
  const getPrevYearValue = (arr: any[], month: number, field: string): number => {
    if (!arr || !Array.isArray(arr)) return 0;
    const item = arr.find((x) => x && x.month === month);
    if (!item) return 0;
    const value = item[field];
    // Check if value exists (not null, not undefined)
    if (value === null || value === undefined) return 0;
    const numValue = Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Helper to get total from previous year for Direct Delivery by month (including dynamic subcategories)
  const getPrevYearTotalDirectDelivery = (month: number): number => {
    if (!previousYearData) return 0;
    const prevData = previousYearData;
    const fixedTotal = (
      getPrevYearValue(prevData.directDelivery || [], month, "laborCarCleaning") +
      getPrevYearValue(prevData.directDelivery || [], month, "laborDelivery") +
      getPrevYearValue(prevData.directDelivery || [], month, "parkingAirport") +
      getPrevYearValue(prevData.directDelivery || [], month, "parkingLot") +
      getPrevYearValue(prevData.directDelivery || [], month, "uberLyftLime")
    );
    // Include dynamic subcategories from previous year
    const dynamicTotal = (prevData.dynamicSubcategories?.directDelivery || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };

  // Helper to get total from previous year for COGS by month (including dynamic subcategories)
  const getPrevYearTotalCogs = (month: number): number => {
    if (!previousYearData) return 0;
    const prevData = previousYearData;
    const fixedTotal = (
      getPrevYearValue(prevData.cogs || [], month, "autoBodyShopWreck") +
      getPrevYearValue(prevData.cogs || [], month, "alignment") +
      getPrevYearValue(prevData.cogs || [], month, "battery") +
      getPrevYearValue(prevData.cogs || [], month, "brakes") +
      getPrevYearValue(prevData.cogs || [], month, "carPayment") +
      getPrevYearValue(prevData.cogs || [], month, "carInsurance") +
      getPrevYearValue(prevData.cogs || [], month, "carSeats") +
      getPrevYearValue(prevData.cogs || [], month, "cleaningSuppliesTools") +
      getPrevYearValue(prevData.cogs || [], month, "emissions") +
      getPrevYearValue(prevData.cogs || [], month, "gpsSystem") +
      getPrevYearValue(prevData.cogs || [], month, "keyFob") +
      getPrevYearValue(prevData.cogs || [], month, "laborCleaning") +
      getPrevYearValue(prevData.cogs || [], month, "licenseRegistration") +
      getPrevYearValue(prevData.cogs || [], month, "mechanic") +
      getPrevYearValue(prevData.cogs || [], month, "oilLube") +
      getPrevYearValue(prevData.cogs || [], month, "parts") +
      getPrevYearValue(prevData.cogs || [], month, "skiRacks") +
      getPrevYearValue(prevData.cogs || [], month, "tickets") +
      getPrevYearValue(prevData.cogs || [], month, "tiredAirStation") +
      getPrevYearValue(prevData.cogs || [], month, "tires") +
      getPrevYearValue(prevData.cogs || [], month, "towingImpoundFees") +
      getPrevYearValue(prevData.cogs || [], month, "uberLyftLime") +
      getPrevYearValue(prevData.cogs || [], month, "windshield") +
      getPrevYearValue(prevData.cogs || [], month, "wipers")
    );
    // Include dynamic subcategories from previous year
    const dynamicTotal = (prevData.dynamicSubcategories?.cogs || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };

  // Helper to get total parking fee & labor cleaning from previous year by month (including dynamic subcategories)
  const getPrevYearTotalParkingFeeLabor = (month: number): number => {
    if (!previousYearData) return 0;
    const prevData = previousYearData;
    const fixedTotal = (
      getPrevYearValue(prevData.parkingFeeLabor || [], month, "glaParkingFee") +
      getPrevYearValue(prevData.parkingFeeLabor || [], month, "laborCleaning")
    );
    // Include dynamic subcategories from previous year
    const dynamicTotal = (prevData.dynamicSubcategories?.parkingFeeLabor || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return Number(fixedTotal) + Number(dynamicTotal);
  };

  // Calculate negative balance carry over for previous year (recursive)
  // Uses the same formulas as calculateNegativeBalanceCarryOver but for previous year data
  // Uses CURRENT month's mode (not previous month's mode)
  const calculatePrevYearNegativeBalance = (month: number): number => {
    if (!previousYearData) return 0;
    
    const prevYear = parseInt(year, 10) - 1;
    
    // Year 2019: Always 0
    if (prevYear === 2019) {
      return 0;
    }

    // Negative balance always carries across a calendar-year boundary the
    // same as any other month-to-month transition — no special reset (see
    // calculateNegativeBalanceCarryOver below). This function only has ONE
    // year of prior data (previousYearData, i.e. year - 1), so January of
    // prevYear still bottoms out at 0 here — that's a real data-availability
    // limit (no year-2-back payload fetched), not an intentional reset.
    if (month === 1 && prevYear > 2019) {
      return 0; // data wall — no year-2-back payload available
    }
    
    // Get the CURRENT month's mode from previous year's formulaSetting (not previous month's mode)
    const currentMonthMode: 50 | 70 = previousYearData?.formulaSetting?.monthModes?.[month] || 50;
    
    // For months 2-12, calculate from previous month
    const prevMonth = month - 1;
    const prevRentalIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "rentalIncome");
    const prevDeliveryIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "deliveryIncome");
    const prevElectricPrepaidIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "electricPrepaidIncome");
    const prevSmokingFines = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "smokingFines");
    const prevGasPrepaidIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "gasPrepaidIncome");
    const prevSkiRacksIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "skiRacksIncome");
    const prevMilesIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "milesIncome");
    const prevChildSeatIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "childSeatIncome");
    const prevCoolersIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "coolersIncome");
    const prevInsuranceWreckIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "insuranceWreckIncome");
    const prevOtherIncome = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "otherIncome");
    const prevNegativeBalanceCarryOver = calculatePrevYearNegativeBalance(prevMonth);
    const prevTotalDirectDelivery = getPrevYearTotalDirectDelivery(prevMonth);
    const prevTotalCogs = getPrevYearTotalCogs(prevMonth);
    const prevTotalParkingFeeLabor = getPrevYearTotalParkingFeeLabor(prevMonth);
    
    // Get car owner split percentage from previous year data
    const prevCarOwnerSplitPercent = getPrevYearValue(previousYearData.incomeExpenses || [], prevMonth, "carOwnerSplit") || 0;
    const prevCarOwnerSplitDecimal = prevCarOwnerSplitPercent / 100;
    
    let calculation: number;
    
    if (currentMonthMode === 70) {
      // 30:70 Mode Formula
      // =IF(
      //   (Miles Income + (Smoking Fines × 10%))
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) 
      //   - TOTAL OPERATING EXPENSE (COGS - Per Vehicle) 
      //   - Total Parking Fee & Labor Cleaning
      //   + Negative Balance Carry Over 
      //   + (Rental Income - Delivery Income - Electric Prepaid Income 
      //      - Smoking Fines - Gas Prepaid Income - Miles Income 
      //      - Ski Racks Income - Child Seat Income - Coolers Income 
      //      - Insurance Wreck Income - Other Income)
      //    × Car Owner Split% > 0,
      //   0,
      //   (Miles Income + (Smoking Fines × 10%))
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) 
      //   - TOTAL OPERATING EXPENSE (COGS - Per Vehicle) 
      //   - Total Parking Fee & Labor Cleaning
      //   + Negative Balance Carry Over 
      //   + (Rental Income - Delivery Income - Electric Prepaid Income 
      //      - Smoking Fines - Gas Prepaid Income - Miles Income 
      //      - Ski Racks Income - Child Seat Income - Coolers Income 
      //      - Insurance Wreck Income - Other Income)
      //    × Car Owner Split%)
      const part1 = Number(prevMilesIncome) + (Number(prevSmokingFines) * 0.1);
      const part2 = Number(prevRentalIncome) - Number(prevDeliveryIncome) - Number(prevElectricPrepaidIncome) - Number(prevSmokingFines) 
                   - Number(prevGasPrepaidIncome) - Number(prevMilesIncome) - Number(prevSkiRacksIncome) - Number(prevChildSeatIncome) 
                   - Number(prevCoolersIncome) - Number(prevInsuranceWreckIncome) - Number(prevOtherIncome);
      
      // Calculate with Total Parking Fee & Labor Cleaning
      calculation = part1 - Number(prevTotalDirectDelivery) - Number(prevTotalCogs) - Number(prevTotalParkingFeeLabor) 
                   + Number(prevNegativeBalanceCarryOver) + (part2 * prevCarOwnerSplitDecimal);
      
      // IF result > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    } else {
      // 50:50 Mode Formula
      calculation = Number(prevRentalIncome) - Number(prevDeliveryIncome) - Number(prevElectricPrepaidIncome) - Number(prevGasPrepaidIncome) 
                   - Number(prevSmokingFines) - Number(prevMilesIncome) - Number(prevSkiRacksIncome) - Number(prevChildSeatIncome) 
                   - Number(prevCoolersIncome) - Number(prevInsuranceWreckIncome) - Number(prevOtherIncome) 
                   - Number(prevTotalDirectDelivery) - Number(prevTotalCogs) + Number(prevNegativeBalanceCarryOver);
      
      // If calculation > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    }
  };

  const calculateNegativeBalanceCarryOver = (month: number): number => {
    const currentYear = parseInt(year, 10);
    
    // Year 2019: Always 0
    if (currentYear === 2019) {
      return 0;
    }
    
    // Get the CURRENT month's mode (not previous month's mode)
    const currentMonthMode: 50 | 70 = monthModes[month] || 50;
    
    // Get all data from previous month (or December of previous year for January)
    let prevRentalIncome: number;
    let prevDeliveryIncome: number;
    let prevElectricPrepaidIncome: number;
    let prevSmokingFines: number;
    let prevGasPrepaidIncome: number;
    let prevSkiRacksIncome: number;
    let prevMilesIncome: number;
    let prevChildSeatIncome: number;
    let prevCoolersIncome: number;
    let prevInsuranceWreckIncome: number;
    let prevOtherIncome: number;
    let prevNegativeBalanceCarryOver: number;
    let prevTotalDirectDelivery: number;
    let prevTotalCogs: number;
    let prevTotalParkingFeeLabor: number;
    let prevCarOwnerSplitPercent: number;
    
    // January of other years (2020+): Use December of previous year
    if (month === 1 && currentYear > 2019) {
      const prevDec = 12;
      // Get all December data from previous year
      prevRentalIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "rentalIncome");
      prevDeliveryIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "deliveryIncome");
      prevElectricPrepaidIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "electricPrepaidIncome");
      prevSmokingFines = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "smokingFines");
      prevGasPrepaidIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "gasPrepaidIncome");
      prevSkiRacksIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "skiRacksIncome");
      prevMilesIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "milesIncome");
      prevChildSeatIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "childSeatIncome");
      prevCoolersIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "coolersIncome");
      prevInsuranceWreckIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "insuranceWreckIncome");
      prevOtherIncome = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "otherIncome");
      
      prevTotalDirectDelivery = getPrevYearTotalDirectDelivery(prevDec);
      prevTotalCogs = getPrevYearTotalCogs(prevDec);
      prevTotalParkingFeeLabor = getPrevYearTotalParkingFeeLabor(prevDec);
      prevCarOwnerSplitPercent = getPrevYearValue(previousYearData?.incomeExpenses || [], prevDec, "carOwnerSplit") || 0;
      
      // Calculate previous year December's negative balance carry over
      // The function will use December's mode internally
      prevNegativeBalanceCarryOver = calculatePrevYearNegativeBalance(prevDec);
    } else {
      // All other months (Feb-Dec): Use previous month
      const prevMonth = month - 1;
      prevRentalIncome = getMonthValue(data.incomeExpenses, prevMonth, "rentalIncome");
      prevDeliveryIncome = getMonthValue(data.incomeExpenses, prevMonth, "deliveryIncome");
      prevElectricPrepaidIncome = getMonthValue(data.incomeExpenses, prevMonth, "electricPrepaidIncome");
      prevSmokingFines = getMonthValue(data.incomeExpenses, prevMonth, "smokingFines");
      prevGasPrepaidIncome = getMonthValue(data.incomeExpenses, prevMonth, "gasPrepaidIncome");
      prevSkiRacksIncome = getMonthValue(data.incomeExpenses, prevMonth, "skiRacksIncome");
      prevMilesIncome = getMonthValue(data.incomeExpenses, prevMonth, "milesIncome");
      prevChildSeatIncome = getMonthValue(data.incomeExpenses, prevMonth, "childSeatIncome");
      prevCoolersIncome = getMonthValue(data.incomeExpenses, prevMonth, "coolersIncome");
      prevInsuranceWreckIncome = getMonthValue(data.incomeExpenses, prevMonth, "insuranceWreckIncome");
      prevOtherIncome = getMonthValue(data.incomeExpenses, prevMonth, "otherIncome");
      
      // Use the calculated value from previous month (recursive call)
      prevNegativeBalanceCarryOver = calculateNegativeBalanceCarryOver(prevMonth);
      
      prevTotalDirectDelivery = getTotalDirectDeliveryForMonth(prevMonth);
      prevTotalCogs = getTotalCogsForMonth(prevMonth);
      prevTotalParkingFeeLabor = getTotalParkingFeeLaborForMonth(prevMonth);
      prevCarOwnerSplitPercent = getMonthValue(data.incomeExpenses, prevMonth, "carOwnerSplit") || 0;
    }
    
    const prevCarOwnerSplitDecimal = prevCarOwnerSplitPercent / 100;
    
    let calculation: number;
    
    if (currentMonthMode === 70) {
      // 30:70 Mode Formula
      // =IF(
      //   (Miles Income + (Smoking Fines × 10%))
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) 
      //   - TOTAL OPERATING EXPENSE (COGS - Per Vehicle) 
      //   - Total Parking Fee & Labor Cleaning
      //   + Negative Balance Carry Over 
      //   + (Rental Income - Delivery Income - Electric Prepaid Income 
      //      - Smoking Fines - Gas Prepaid Income - Miles Income 
      //      - Ski Racks Income - Child Seat Income - Coolers Income 
      //      - Insurance Wreck Income - Other Income)
      //    × Car Owner Split% > 0,
      //   0,
      //   (Miles Income + (Smoking Fines × 10%))
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) 
      //   - TOTAL OPERATING EXPENSE (COGS - Per Vehicle) 
      //   - Total Parking Fee & Labor Cleaning
      //   + Negative Balance Carry Over 
      //   + (Rental Income - Delivery Income - Electric Prepaid Income 
      //      - Smoking Fines - Gas Prepaid Income - Miles Income 
      //      - Ski Racks Income - Child Seat Income - Coolers Income 
      //      - Insurance Wreck Income - Other Income)
      //    × Car Owner Split%)
      const part1 = Number(prevMilesIncome) + (Number(prevSmokingFines) * 0.1);
      const part2 = Number(prevRentalIncome) - Number(prevDeliveryIncome) - Number(prevElectricPrepaidIncome) - Number(prevSmokingFines) 
                   - Number(prevGasPrepaidIncome) - Number(prevMilesIncome) - Number(prevSkiRacksIncome) - Number(prevChildSeatIncome) 
                   - Number(prevCoolersIncome) - Number(prevInsuranceWreckIncome) - Number(prevOtherIncome);
      
      // Calculate with Total Parking Fee & Labor Cleaning
      calculation = part1 - Number(prevTotalDirectDelivery) - Number(prevTotalCogs) - Number(prevTotalParkingFeeLabor) 
                   + Number(prevNegativeBalanceCarryOver) + (part2 * prevCarOwnerSplitDecimal);
      
      // IF result > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    } else {
      // 50:50 Mode Formula
      calculation = Number(prevRentalIncome) - Number(prevDeliveryIncome) - Number(prevElectricPrepaidIncome) - Number(prevGasPrepaidIncome) 
                   - Number(prevSmokingFines) - Number(prevMilesIncome) - Number(prevSkiRacksIncome) - Number(prevChildSeatIncome) 
                   - Number(prevCoolersIncome) - Number(prevInsuranceWreckIncome) - Number(prevOtherIncome) 
                   - Number(prevTotalDirectDelivery) - Number(prevTotalCogs) + Number(prevNegativeBalanceCarryOver);
      
      // If calculation > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    }
  };
  
  const calculateCarPayment = (month: number): number => {
    return getMonthValue(data.cogs, month, "carPayment");
  };
  
  const calculateCarManagementTotalExpenses = (month: number): number => {
    // In 30:70 mode: "TOTAL REIMBURSE AND NON-REIMBURSE BILLS" only
    // In 50:50 mode: "TOTAL REIMBURSE AND NON-REIMBURSE BILLS" + ("TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)") * "Car Management Split %"
    const totalReimbursedBills = Number(getTotalReimbursedBillsForMonth(month)) || 0;
    
    // Get the mode for this month
    const mode = monthModes[month] || 50;
    
    // In 30:70 mode, return only TOTAL REIMBURSE AND NON-REIMBURSE BILLS
    if (mode === 70) {
      return totalReimbursedBills;
    }
    
    // In 50:50 mode, use the full formula
    const storedMgmtPercent = Number(getMonthValue(data.incomeExpenses, month, "carManagementSplit")) || 0;
    const mgmtPercent = storedMgmtPercent / 100; // Convert percentage to decimal
    const totalDirectDelivery = Number(getTotalDirectDeliveryForMonth(month)) || 0;
    const totalCogs = Number(getTotalCogsForMonth(month)) || 0;
    
    return Number(totalReimbursedBills) + ((Number(totalDirectDelivery) + Number(totalCogs)) * mgmtPercent);
  };
  
  const calculateCarOwnerTotalExpenses = (month: number): number => {
    // In 30:70 mode: "TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)" + "Total Parking Fee & Labor Cleaning"
    // In 50:50 mode: ("TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)") * "Car Owner Split %"
    const totalDirectDelivery = Number(getTotalDirectDeliveryForMonth(month)) || 0;
    const totalCogs = Number(getTotalCogsForMonth(month)) || 0;
    
    // Get the mode for this month
    const mode = monthModes[month] || 50;
    
    if (mode === 70) {
      // 30:70 mode: Direct Delivery + COGS + Total Parking Fee & Labor Cleaning
      const totalParkingFeeLabor = Number(getTotalParkingFeeLaborForMonth(month)) || 0;
      return Number(totalDirectDelivery) + Number(totalCogs) + totalParkingFeeLabor;
    } else {
      // 50:50 mode: (Direct Delivery + COGS) * Car Owner Split %
      const storedOwnerPercent = Number(getMonthValue(data.incomeExpenses, month, "carOwnerSplit")) || 0;
      const ownerPercent = storedOwnerPercent / 100; // Convert percentage to decimal
      return (Number(totalDirectDelivery) + Number(totalCogs)) * ownerPercent;
    }
  };
  
  let csvContent = "";
  
  // ========================================
  // HEADER: Car and Owner Information
  // ========================================
  csvContent += `CAR NAME,${carInfo?.makeModel || carInfo?.make + ' ' + carInfo?.model || 'N/A'}\n`;
  csvContent += `VIN #,${carInfo?.vin || 'N/A'}\n`;
  csvContent += `LICENSE,${carInfo?.licensePlate || 'N/A'}\n`;
  csvContent += `OWNER NAME,${carInfo?.owner?.firstName || ''} ${carInfo?.owner?.lastName || ''}\n`;
  csvContent += `CONTACT #,${carInfo?.owner?.phone || 'N/A'}\n`;
  csvContent += `EMAIL,${carInfo?.owner?.email || 'N/A'}\n`;
  csvContent += `FUEL/GAS,${carInfo?.fuelGas || 'N/A'}\n`;
  csvContent += `TIRE SIZE,${carInfo?.tireSize || 'N/A'}\n`;
  csvContent += `OIL TYPE,${carInfo?.oilType || 'N/A'}\n`;
  csvContent += `TURO LINK,${carInfo?.turoLink || 'N/A'}\n`;
  csvContent += `ADMIN TURO LINK,${carInfo?.adminTuroLink || 'N/A'}\n`;
  csvContent += `\n`;
  
  // ========================================
  // SECTION 1: CO HOSTING ACCESS
  // ========================================
  csvContent += `SECTION,CO HOSTING ACCESS\n`;
  csvContent += `Mode Settings,`;
  MONTHS.forEach((month, idx) => {
    csvContent += `${month} ${year}: ${monthModes[idx + 1] || 50},`;
  });
  csvContent += `\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  // Car Management Split row (calculated with percentage)
  csvContent += `Co-Host Split,`;
  let mgmtSplitTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const calculatedAmount = Number(calculateCarManagementSplit(monthNum)) || 0;
    const percentage = Number(getMonthValue(data.incomeExpenses, monthNum, "carManagementSplit")) || 0;
    csvContent += `$${calculatedAmount.toFixed(2)} (${percentage.toFixed(0)}%),`;
    mgmtSplitTotal += calculatedAmount;
  });
  csvContent += `$0.00,$0.00,$${mgmtSplitTotal.toFixed(2)}\n`;
  
  // Car Owner Split row (calculated with percentage)
  csvContent += `Car Owner Split,`;
  let ownerSplitTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const calculatedAmount = Number(calculateCarOwnerSplit(monthNum)) || 0;
    const percentage = Number(getMonthValue(data.incomeExpenses, monthNum, "carOwnerSplit")) || 0;
    csvContent += `$${calculatedAmount.toFixed(2)} (${percentage.toFixed(0)}%),`;
    ownerSplitTotal += calculatedAmount;
  });
  csvContent += `$0.00,$0.00,$${ownerSplitTotal.toFixed(2)}\n\n`;
  
  // ========================================
  // SECTION 2: INCOME & EXPENSES
  // ========================================
  csvContent += `SECTION,INCOME & EXPENSES\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  const incomeFields = [
    { field: 'rentalIncome', label: 'Rental Income' },
    { field: 'deliveryIncome', label: 'Delivery Income' },
    { field: 'electricPrepaidIncome', label: 'Electric Prepaid Income' },
    { field: 'smokingFines', label: 'Smoking Fines' },
    { field: 'gasPrepaidIncome', label: 'Gas Prepaid Income' },
    { field: 'skiRacksIncome', label: 'Ski Racks Income' },
    { field: 'milesIncome', label: 'Miles Income' },
    { field: 'childSeatIncome', label: 'Child Seat Income' },
    { field: 'coolersIncome', label: 'Coolers Income' },
    { field: 'insuranceWreckIncome', label: 'Income insurance and Client Wrecks' },
    { field: 'otherIncome', label: 'Other Income' },
  ];
  
  incomeFields.forEach(({ field, label }) => {
    csvContent += `${label},`;
    let total = 0;
    MONTHS.forEach((_, idx) => {
      const monthNum = idx + 1;
      const value = getMonthValue(data.incomeExpenses, monthNum, field);
      csvContent += `$${Number(value).toFixed(2)},`;
      total += Number(value);
    });
    csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
  });
  
  // Formula categories - Negative Balance Carry Over
  csvContent += `Negative Balance Carry Over,`;
  let negativeBalanceTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(calculateNegativeBalanceCarryOver(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    negativeBalanceTotal += value;
  });
  csvContent += `$0.00,$0.00,$${negativeBalanceTotal.toFixed(2)}\n`;
  
  // Formula category - Car Payment (from COGS)
  csvContent += `Car Payment,`;
  let carPaymentTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(calculateCarPayment(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    carPaymentTotal += value;
  });
  csvContent += `$0.00,$0.00,$${carPaymentTotal.toFixed(2)}\n`;
  
  // Formula category - Car Management Total Expenses
  csvContent += `Car Management Total Expenses,`;
  let mgmtExpensesTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(calculateCarManagementTotalExpenses(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    mgmtExpensesTotal += value;
  });
  csvContent += `$0.00,$0.00,$${mgmtExpensesTotal.toFixed(2)}\n`;
  
  // Formula category - Car Owner Total Expenses
  csvContent += `Car Owner Total Expenses,`;
  let ownerExpensesTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(calculateCarOwnerTotalExpenses(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    ownerExpensesTotal += value;
  });
  csvContent += `$0.00,$0.00,$${ownerExpensesTotal.toFixed(2)}\n`;
  
  // Formula category - Total Expenses
  csvContent += `Total Expenses,`;
  let totalExpensesTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const mgmt = Number(calculateCarManagementTotalExpenses(monthNum)) || 0;
    const owner = Number(calculateCarOwnerTotalExpenses(monthNum)) || 0;
    const value = mgmt + owner;
    csvContent += `$${value.toFixed(2)},`;
    totalExpensesTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalExpensesTotal.toFixed(2)}\n`;
  
  // Formula category - Total Car Profit
  csvContent += `Total Car Profit,`;
  let totalProfitTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const rentalIncome = Number(getMonthValue(data.incomeExpenses, monthNum, "rentalIncome")) || 0;
    const mgmt = Number(calculateCarManagementTotalExpenses(monthNum)) || 0;
    const owner = Number(calculateCarOwnerTotalExpenses(monthNum)) || 0;
    const totalExpenses = mgmt + owner;
    const value = rentalIncome - totalExpenses;
    csvContent += `$${value.toFixed(2)},`;
    totalProfitTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalProfitTotal.toFixed(2)}\n`;
  csvContent += `\n`;
  
  // ========================================
  // SECTION 3: OPERATING EXPENSE (Direct Delivery)
  // ========================================
  csvContent += `SECTION,OPERATING EXPENSE (Direct Delivery)\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  const directDeliveryFields = [
    { field: 'laborCarCleaning', label: 'Labor - Cleaning' },
    { field: 'laborDelivery', label: 'Labor - Delivery' },
    { field: 'parkingAirport', label: 'Parking - Airport' },
    { field: 'parkingLot', label: 'Parking - Lot' },
    { field: 'uberLyftLime', label: 'Uber/Lyft/Lime' },
  ];
  
  directDeliveryFields.forEach(({ field, label }) => {
    csvContent += `${label},`;
    let total = 0;
    MONTHS.forEach((_, idx) => {
      const monthNum = idx + 1;
      const value = getMonthValue(data.directDelivery, monthNum, field);
      csvContent += `$${Number(value).toFixed(2)},`;
      total += Number(value);
    });
    csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
  });
  
  // Export dynamic subcategories for Direct Delivery
  if (dynamicSubcategories?.directDelivery) {
    dynamicSubcategories.directDelivery.forEach((subcat) => {
      csvContent += `${subcat.name},`;
      let total = 0;
      MONTHS.forEach((_, idx) => {
        const monthValue = subcat.values.find((v: any) => v.month === idx + 1);
        const value = monthValue?.value || 0;
        csvContent += `$${Number(value).toFixed(2)},`;
        total += Number(value);
      });
      csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
    });
  }
  
  // Formula category - TOTAL OPERATING EXPENSE (Direct Delivery)
  csvContent += `TOTAL OPERATING EXPENSE (Direct Delivery),`;
  let totalDirectDeliveryTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(getTotalDirectDeliveryForMonth(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    totalDirectDeliveryTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalDirectDeliveryTotal.toFixed(2)}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 4: OPERATING EXPENSE (COGS - Per Vehicle)
  // ========================================
  csvContent += `SECTION,OPERATING EXPENSE (COGS - Per Vehicle)\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  const cogsFields = [
    { field: 'autoBodyShopWreck', label: 'Auto Body Shop / Wreck' },
    { field: 'alignment', label: 'Alignment' },
    { field: 'battery', label: 'Battery' },
    { field: 'brakes', label: 'Brakes' },
    { field: 'carPayment', label: 'Car Payment' },
    { field: 'carInsurance', label: 'Car Insurance' },
    { field: 'carSeats', label: 'Car Seats' },
    { field: 'cleaningSuppliesTools', label: 'Cleaning Supplies / Tools' },
    { field: 'emissions', label: 'Emissions' },
    { field: 'gpsSystem', label: 'GPS System' },
    { field: 'keyFob', label: 'Key & Fob' },
    { field: 'laborCleaning', label: 'Labor - Cleaning (COGS)' },
    { field: 'windshield', label: 'Windshield' },
    { field: 'wipers', label: 'Wipers' },
    { field: 'uberLyftLime', label: 'Uber/Lyft/Lime' },
    { field: 'towingImpoundFees', label: 'Towing / Impound Fees' },
    { field: 'tiredAirStation', label: 'Tired Air Station' },
    { field: 'tires', label: 'Tires' },
    { field: 'oilLube', label: 'Oil/Lube' },
    { field: 'parts', label: 'Parts' },
    { field: 'skiRacks', label: 'Ski Racks' },
    { field: 'tickets', label: 'Tickets & Tolls' },
    { field: 'mechanic', label: 'Mechanic' },
    { field: 'licenseRegistration', label: 'License & Registration' },
  ];
  
  cogsFields.forEach(({ field, label }) => {
    csvContent += `${label},`;
    let total = 0;
    MONTHS.forEach((_, idx) => {
      const monthNum = idx + 1;
      const value = getMonthValue(data.cogs, monthNum, field);
      csvContent += `$${Number(value).toFixed(2)},`;
      total += Number(value);
    });
    csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
  });
  
  // Export dynamic subcategories for COGS
  if (dynamicSubcategories?.cogs) {
    dynamicSubcategories.cogs.forEach((subcat) => {
      csvContent += `${subcat.name},`;
      let total = 0;
      MONTHS.forEach((_, idx) => {
        const monthValue = subcat.values.find((v: any) => v.month === idx + 1);
        const value = monthValue?.value || 0;
        csvContent += `$${Number(value).toFixed(2)},`;
        total += Number(value);
      });
      csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
    });
  }
  
  // Formula category - TOTAL OPERATING EXPENSE (COGS - Per Vehicle)
  csvContent += `TOTAL OPERATING EXPENSE (COGS - Per Vehicle),`;
  let totalCogsTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(getTotalCogsForMonth(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    totalCogsTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalCogsTotal.toFixed(2)}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 5: Parking Fee & Labor Cleaning
  // ========================================
  csvContent += `SECTION,Parking Fee & Labor Cleaning\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  const parkingFields = [
    { field: 'glaParkingFee', label: 'GLA Parking Fee' },
    { field: 'laborCleaning', label: 'Labor - Cleaning' },
  ];
  
  parkingFields.forEach(({ field, label }) => {
    csvContent += `${label},`;
    let total = 0;
    MONTHS.forEach((_, idx) => {
      const monthNum = idx + 1;
      const value = getMonthValue(data.parkingFeeLabor, monthNum, field);
      csvContent += `$${Number(value).toFixed(2)},`;
      total += Number(value);
    });
    csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
  });
  
  // Export dynamic subcategories for Parking Fee & Labor Cleaning
  if (dynamicSubcategories?.parkingFeeLabor) {
    dynamicSubcategories.parkingFeeLabor.forEach((subcat) => {
      csvContent += `${subcat.name},`;
      let total = 0;
      MONTHS.forEach((_, idx) => {
        const monthValue = subcat.values.find((v: any) => v.month === idx + 1);
        const value = monthValue?.value || 0;
        csvContent += `$${Number(value).toFixed(2)},`;
        total += Number(value);
      });
      csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
    });
  }
  
  // Formula category - Total Parking Fee & Labor Cleaning
  csvContent += `Total Parking Fee & Labor Cleaning,`;
  let totalParkingTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const fixedTotal = (
      Number(getMonthValue(data.parkingFeeLabor, monthNum, "glaParkingFee")) || 0 +
      Number(getMonthValue(data.parkingFeeLabor, monthNum, "laborCleaning")) || 0
    );
    const dynamicTotal = (dynamicSubcategories?.parkingFeeLabor || []).reduce((sum: number, subcat: any) => {
      const monthValue = subcat.values?.find((v: any) => v.month === monthNum);
      return sum + (Number(monthValue?.value) || 0);
    }, 0);
    const value = Number(fixedTotal) + Number(dynamicTotal);
    csvContent += `$${value.toFixed(2)},`;
    totalParkingTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalParkingTotal.toFixed(2)}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 6: REIMBURSE AND NON-REIMBURSE BILLS
  // ========================================
  csvContent += `SECTION,REIMBURSE AND NON-REIMBURSE BILLS\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  const reimbursedFields = [
    { field: 'electricReimbursed', label: 'Electric - Reimbursed' },
    { field: 'electricNotReimbursed', label: 'Electric - Not Reimbursed' },
    { field: 'gasReimbursed', label: 'Gas - Reimbursed' },
    { field: 'gasNotReimbursed', label: 'Gas - Not Reimbursed' },
    { field: 'gasServiceRun', label: 'Gas - Service Run' },
    { field: 'parkingAirport', label: 'Parking Airport' },
    { field: 'uberLyftLimeNotReimbursed', label: 'Uber/Lyft/Lime - Not Reimbursed' },
    { field: 'uberLyftLimeReimbursed', label: 'Uber/Lyft/Lime - Reimbursed' },
  ];
  
  reimbursedFields.forEach(({ field, label }) => {
    csvContent += `${label},`;
    let total = 0;
    MONTHS.forEach((_, idx) => {
      const monthNum = idx + 1;
      const value = getMonthValue(data.reimbursedBills, monthNum, field);
      csvContent += `$${Number(value).toFixed(2)},`;
      total += Number(value);
    });
    csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
  });
  
  // Export dynamic subcategories for Reimbursed Bills
  if (dynamicSubcategories?.reimbursedBills) {
    dynamicSubcategories.reimbursedBills.forEach((subcat) => {
      csvContent += `${subcat.name},`;
      let total = 0;
      MONTHS.forEach((_, idx) => {
        const monthValue = subcat.values.find((v: any) => v.month === idx + 1);
        const value = monthValue?.value || 0;
        csvContent += `$${Number(value).toFixed(2)},`;
        total += Number(value);
      });
      csvContent += `$0.00,$0.00,$${total.toFixed(2)}\n`;
    });
  }
  
  // Formula category - TOTAL REIMBURSE AND NON-REIMBURSE BILLS
  csvContent += `TOTAL REIMBURSE AND NON-REIMBURSE BILLS,`;
  let totalReimbursedTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(getTotalReimbursedBillsForMonth(monthNum)) || 0;
    csvContent += `$${value.toFixed(2)},`;
    totalReimbursedTotal += value;
  });
  csvContent += `$0.00,$0.00,$${totalReimbursedTotal.toFixed(2)}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 7: HISTORY
  // ========================================
  csvContent += `SECTION,HISTORY\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  // Days Rented (manual entry)
  csvContent += `Days Rented,`;
  let daysRentedTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(getMonthValue(data.history, monthNum, "daysRented")) || 0;
    csvContent += `${Number(value)},`;
    daysRentedTotal += Number(value);
  });
  csvContent += `0,0,${daysRentedTotal}\n`;
  
  // Cars Available For Rent (manual entry)
  csvContent += `Cars Available For Rent,`;
  let carsAvailableTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = Number(getMonthValue(data.history, monthNum, "carsAvailableForRent")) || 0;
    csvContent += `${Number(value)},`;
    carsAvailableTotal += Number(value);
  });
  csvContent += `0,0,${carsAvailableTotal}\n`;
  
  // Trips Taken (still from history)
  csvContent += `Trips Taken,`;
  let tripsTakenTotal = 0;
    MONTHS.forEach((_, idx) => {
    const value = (data.history[idx] as any)?.tripsTaken || 0;
      csvContent += `${Number(value)},`;
    tripsTakenTotal += Number(value);
    });
  csvContent += `0,0,${tripsTakenTotal}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 8: CAR RENTAL VALUE PER MONTH (Formula categories)
  // ========================================
  csvContent += `SECTION,CAR RENTAL VALUE PER MONTH\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  // Total Car Rental Income
  csvContent += `Total Car Rental Income,`;
  let rentalIncomeTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = getMonthValue(data.incomeExpenses, monthNum, 'rentalIncome');
    csvContent += `$${value.toFixed(2)},`;
    rentalIncomeTotal += value;
  });
  csvContent += `$0.00,$0.00,$${rentalIncomeTotal.toFixed(2)}\n`;
  
  // Trips Taken
  csvContent += `Trips Taken,`;
  let tripsTotalSection8 = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = getMonthValue(data.history, monthNum, 'tripsTaken');
    csvContent += `${value},`;
    tripsTotalSection8 += value;
  });
  csvContent += `0,0,${tripsTotalSection8}\n`;
  
  // Ave Rental Per Trips Taken
  csvContent += `Ave Rental Per Trips Taken,`;
  let totalRentalSection8 = 0;
  let totalTripsSection8 = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const rental = getMonthValue(data.incomeExpenses, monthNum, 'rentalIncome');
    const trips = getMonthValue(data.history, monthNum, 'tripsTaken');
    const value = trips > 0 ? rental / trips : 0;
    csvContent += `$${Number(value).toFixed(2)},`;
    totalRentalSection8 += Number(rental);
    totalTripsSection8 += Number(trips);
  });
  const aveRentalTotal = totalTripsSection8 > 0 ? totalRentalSection8 / totalTripsSection8 : 0;
  csvContent += `$0.00,$0.00,$${aveRentalTotal.toFixed(2)}\n`;
  
  csvContent += `\n`;
  
  // ========================================
  // SECTION 9: PARKING AIRPORT AVERAGE PER TRIP - GLA (Formula categories)
  // ========================================
  csvContent += `SECTION,PARKING AIRPORT AVERAGE PER TRIP - GLA\n`;
  csvContent += `Category,`;
  MONTHS.forEach((month) => {
    csvContent += `${month} ${year},`;
  });
  csvContent += `YER,YER SPLIT,TOTAL\n`;
  
  // Total Trips Taken
  csvContent += `Total Trips Taken,`;
  let tripsTotalGLA = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = getMonthValue(data.history, monthNum, 'tripsTaken');
    csvContent += `${value},`;
    tripsTotalGLA += value;
  });
  csvContent += `0,0,${tripsTotalGLA}\n`;
  
  // Total Parking Airport (from REIMBURSE AND NON-REIMBURSE BILLS)
  csvContent += `Total Parking Airport,`;
  let parkingAirportGLATotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const value = getMonthValue(data.reimbursedBills, monthNum, "parkingAirport");
    csvContent += `$${value.toFixed(2)},`;
    parkingAirportGLATotal += value;
  });
  csvContent += `$0.00,$0.00,$${parkingAirportGLATotal.toFixed(2)}\n`;
  
  // Average per trip
  csvContent += `Average per trip,`;
  let aveParkingGLATotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const parking = getMonthValue(data.reimbursedBills, monthNum, "parkingAirport");
    const trips = getMonthValue(data.history, monthNum, 'tripsTaken');
    const value = trips > 0 ? parking / trips : 0;
    csvContent += `$${Number(value).toFixed(2)},`;
    aveParkingGLATotal += Number(value);
  });
  csvContent += `$0.00,$0.00,$${aveParkingGLATotal.toFixed(2)}\n`;

  return csvContent;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function makeExportBaseName(carInfo: any, year: string): string {
  return `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, "-") || "Car"}-${year}`;
}

/**
 * Backwards-compatible CSV-only export.
 * Use {@link exportAllAsZip} when you want to bundle receipts as well.
 */
export function exportAllIncomeExpenseData(
  data: IncomeExpenseData,
  carInfo: any,
  year: string,
  monthModes: { [month: number]: 50 | 70 },
  dynamicSubcategories?: {
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  },
  previousYearData?: IncomeExpenseData | null,
  skiRacksOwner?: { [month: number]: "GLA" | "CAR_OWNER" }
): void {
  const csvContent = buildIncomeExpenseCSV(
    data,
    carInfo,
    year,
    monthModes,
    dynamicSubcategories,
    previousYearData,
    skiRacksOwner,
  );
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBlobDownload(blob, `${makeExportBaseName(carInfo, year)}.csv`);
}

// ─────────────────────────────────────────────────────────────────────────
// ZIP export — CSV + receipts/ + receipts.json manifest
// ─────────────────────────────────────────────────────────────────────────

interface ApprovedSubmissionForExport {
  id: number;
  carId: number;
  year: number;
  month: number;
  category: string;
  field: string;
  amount: number;
  receiptUrls: string[] | null;
  remarks: string | null;
}

interface ReceiptManifestEntry {
  /** Section in the ZIP that owns this receipt — matches submission category. */
  category: "directDelivery" | "cogs" | "reimbursedBills" | "income";
  /** Field within the section (e.g. "parts", "mechanic"). */
  field: string;
  /** Calendar month 1-12. */
  month: number;
  /** Relative path inside the ZIP (e.g. "receipts/cogs/parts/01-abc.jpg"). */
  file: string;
  /** Original URL on the server (kept for debugging / traceability). */
  originalUrl: string;
}

interface ReceiptManifest {
  schemaVersion: 1;
  carId: number;
  year: number;
  exportedAt: string;
  entries: ReceiptManifestEntry[];
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "unnamed";
}

function extFromUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.(jpg|jpeg|png|webp|gif|pdf|heic)$/i);
  return m ? m[1].toLowerCase() : "bin";
}

/**
 * Pulls a receipt file from our server. The receipt API expects credentials
 * and a fileId derived from the stored URL — but the URL itself works for
 * GCS/public ones, so try direct fetch first and fall back to the
 * /receipt/file endpoint if needed.
 */
async function fetchReceiptBlob(url: string, submissionId: number): Promise<Blob | null> {
  try {
    const direct = await fetch(url, { credentials: "include" });
    if (direct.ok) return await direct.blob();
  } catch {
    /* fall through */
  }
  try {
    const proxied = await fetch(
      buildApiUrl(
        `/api/expense-form-submissions/receipt/file?fileId=${encodeURIComponent(url)}&submissionId=${submissionId}`,
      ),
      { credentials: "include" },
    );
    if (proxied.ok) return await proxied.blob();
  } catch {
    /* nothing more to try */
  }
  return null;
}

/**
 * Export I&E data AND attached receipts as a single ZIP. The ZIP layout:
 *   data.csv               — identical to the legacy CSV export
 *   receipts.json          — manifest mapping each file to its cell
 *   receipts/<cat>/<field>/<MM>-<n>.<ext>
 */
export async function exportAllAsZip(
  data: IncomeExpenseData,
  carInfo: any,
  year: string,
  monthModes: { [month: number]: 50 | 70 },
  carId: number,
  dynamicSubcategories?: {
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  },
  previousYearData?: IncomeExpenseData | null,
  skiRacksOwner?: { [month: number]: "GLA" | "CAR_OWNER" },
): Promise<{ receiptCount: number; missingCount: number }> {
  const csvContent = buildIncomeExpenseCSV(
    data,
    carInfo,
    year,
    monthModes,
    dynamicSubcategories,
    previousYearData,
    skiRacksOwner,
  );

  const zip = new JSZip();
  zip.file("data.csv", csvContent);

  // Pull approved submissions for this car+year.
  let submissions: ApprovedSubmissionForExport[] = [];
  try {
    const res = await fetch(
      buildApiUrl(`/api/expense-form-submissions/approved-by-car?carId=${carId}&year=${year}`),
      { credentials: "include" },
    );
    if (res.ok) {
      const json = await res.json();
      submissions = (json?.data ?? json ?? []) as ApprovedSubmissionForExport[];
    }
  } catch {
    /* If we can't reach the receipts API, just export the CSV alone. */
  }

  const manifest: ReceiptManifest = {
    schemaVersion: 1,
    carId,
    year: Number(year),
    exportedAt: new Date().toISOString(),
    entries: [],
  };
  let missing = 0;

  for (const sub of submissions) {
    const urls = sub.receiptUrls ?? [];
    if (!urls.length) continue;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const blob = await fetchReceiptBlob(url, sub.id);
      if (!blob) {
        missing++;
        continue;
      }
      const monthStr = String(sub.month).padStart(2, "0");
      const ext = extFromUrl(url);
      const fileName = `${monthStr}-${sub.id}-${i + 1}.${ext}`;
      const path = `receipts/${safeName(sub.category)}/${safeName(sub.field)}/${fileName}`;
      // Use ArrayBuffer so JSZip works in both browser and Node (test) environments.
      zip.file(path, await blob.arrayBuffer());
      manifest.entries.push({
        category: sub.category as ReceiptManifestEntry["category"],
        field: sub.field,
        month: sub.month,
        file: path,
        originalUrl: url,
      });
    }
  }

  zip.file("receipts.json", JSON.stringify(manifest, null, 2));

  const archive = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(archive, `${makeExportBaseName(carInfo, year)}.zip`);

  return { receiptCount: manifest.entries.length, missingCount: missing };
}

// ─────────────────────────────────────────────────────────────────────────
// ZIP import — accepts either a plain CSV (legacy) or the ZIP produced by
// exportAllAsZip (CSV + receipts.json + receipt files).
// ─────────────────────────────────────────────────────────────────────────

export interface ImportZipResult {
  csvImported: boolean;
  receiptCount: number;
  warnings: string[];
}

function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}

/**
 * Import I&E data from either a CSV or a ZIP produced by exportAllAsZip.
 * Handles uploading receipts and creating approved submissions so click-to-view works.
 */
export async function importFromFileWithReceipts(
  file: File,
  carId: number,
  year: number,
): Promise<ImportZipResult> {
  const warnings: string[] = [];
  let receiptCount = 0;

  // Detect ZIP by magic bytes (PK header) rather than trusting MIME/extension,
  // since browsers often report application/octet-stream for .zip files.
  const headerBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isPK = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b; // PK magic

  if (!isPK) {
    // Legacy CSV path
    const text = await file.text();
    const parsed = parseImportedCSV(text);
    if (!parsed.success) throw new Error(parsed.error || "Failed to parse CSV");
    await postCsvSections(carId, year, parsed.sections!);
    return { csvImported: true, receiptCount: 0, warnings: [] };
  }

  // ── ZIP path ──
  const zip = new JSZip();
  const archive = await zip.loadAsync(await file.arrayBuffer());

  // 1. Parse CSV — try root-level first, then any data.csv in a subdirectory.
  let csvFile = archive.file("data.csv");
  if (!csvFile) {
    const found = Object.keys(archive.files).find(n => n.endsWith("data.csv") && !archive.files[n].dir);
    if (found) csvFile = archive.file(found);
  }
  if (!csvFile) throw new Error("ZIP does not contain data.csv");
  const csvText = await csvFile.async("string");
  const parsed = parseImportedCSV(csvText);
  if (!parsed.success) throw new Error(parsed.error || "Failed to parse CSV");
  await postCsvSections(carId, year, parsed.sections!);

  // 2. Parse receipt manifest
  const manifestFile = archive.file("receipts.json");
  if (!manifestFile) {
    warnings.push("No receipts.json found — data imported without receipts.");
    return { csvImported: true, receiptCount: 0, warnings };
  }
  const manifest: ReceiptManifest = JSON.parse(await manifestFile.async("string"));

  // 3. Group entries by (category, field, month) so we can batch-upload per cell.
  // Use a Map keyed by a structured object-ref to avoid any delimiter collision.
  type CellKey = string; // JSON-stable key
  const byCell = new Map<CellKey, { category: string; field: string; month: number; entries: ReceiptManifestEntry[] }>();
  for (const entry of manifest.entries) {
    const key = JSON.stringify([entry.category, entry.field, entry.month]);
    if (!byCell.has(key)) byCell.set(key, { category: entry.category, field: entry.field, month: entry.month, entries: [] });
    byCell.get(key)!.entries.push(entry);
  }

  // 4. For each cell, upload files then register the receipt submission
  const receiptPayload: { category: string; field: string; month: number; fileIds: string[] }[] = [];

  for (const [, cell] of byCell) {
    const { category, field, month, entries } = cell;
    const fileIds: string[] = [];

    for (const entry of cell.entries) {
      const zipEntry = archive.file(entry.file);
      if (!zipEntry) {
        warnings.push(`Missing file in ZIP: ${entry.file}`);
        continue;
      }
      const blob = new Blob([await zipEntry.async("arraybuffer")]);
      const ext = entry.file.split(".").pop() || "bin";
      const formData = new FormData();
      formData.append("receipts", blob, `import-${category}-${field}-${month}.${ext}`);

      const uploadRes = await fetch(
        buildApiUrl("/api/expense-form-submissions/receipts/upload"),
        { method: "POST", credentials: "include", body: formData },
      );
      if (!uploadRes.ok) {
        warnings.push(`Failed to upload receipt for ${category}/${field} month ${month}`);
        continue;
      }
      const { fileIds: uploaded } = await uploadRes.json();
      fileIds.push(...(uploaded as string[]));
    }

    if (fileIds.length) {
      receiptPayload.push({ category, field, month, fileIds });
      receiptCount += fileIds.length;
    }
  }

  // 5. Register all receipts as approved submissions in one backend call
  if (receiptPayload.length) {
    const importRes = await fetch(buildApiUrl("/api/income-expense/import-receipts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ carId, year, receipts: receiptPayload }),
    });
    if (!importRes.ok) {
      const err = await importRes.json().catch(() => ({}));
      warnings.push(`Receipt registration failed: ${(err as any).error || "Unknown error"}`);
    }
  }

  return { csvImported: true, receiptCount, warnings };
}

async function postCsvSections(carId: number, year: number, sections: any): Promise<void> {
  const res = await fetch(buildApiUrl("/api/income-expense/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ carId, year, sections }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || (err as any).error || "Import failed");
  }
}

/**
 * Helper function to calculate total income for a month
 */
function calculateMonthTotalIncome(monthData: any): number {
  if (!monthData) return 0;
  
  return (
    Number(monthData.rentalIncome || 0) +
    Number(monthData.deliveryIncome || 0) +
    Number(monthData.electricPrepaidIncome || 0) +
    Number(monthData.smokingFines || 0) +
    Number(monthData.gasPrepaidIncome || 0) +
    Number(monthData.skiRacksIncome || 0) +
    Number(monthData.milesIncome || 0) +
    Number(monthData.childSeatIncome || 0) +
    Number(monthData.coolersIncome || 0) +
    Number(monthData.insuranceWreckIncome || 0) +
    Number(monthData.otherIncome || 0)
  );
}

/**
 * Parse imported CSV file and validate structure
 */
export function parseImportedCSV(
  fileContent: string
): {
  success: boolean;
  data?: any;
  error?: string;
  sections?: {
    managementSplit?: any;
    incomeExpenses?: any[];
    directDelivery?: any[];
    cogs?: any[];
    parkingFeeLabor?: any[];
    reimbursedBills?: any[];
    history?: any[];
    monthModes?: { [month: number]: 50 | 70 };
  };
} {
  try {
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 10) {
      return { success: false, error: 'File appears to be empty or invalid' };
    }
    
    const sections: any = {
      incomeExpenses: [],
      directDelivery: [],
      cogs: [],
      parkingFeeLabor: [],
      reimbursedBills: [],
      history: [],
      monthModes: {},
    };
    
    let currentSection = '';
    let skipNextLine = false; // Flag to skip "Category" header lines
    
    // Helper function to parse CSV line (handles quoted values)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim()); // Add last field
      return result;
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const cells = parseCSVLine(line);
      
      // Skip blank separator rows (empty line or all-comma row like ",,,,,,,,,,,,")
      if (cells.length === 0 || cells.every(c => !c)) {
        continue; // Don't reset currentSection — sections flow until the next SECTION marker
      }
      
      // Detect section headers.
      // The exporter writes:  SECTION,<Section Name>[,...]
      // Legacy CSVs write the section name directly in column 0.
      // We handle both formats so old and new files both import correctly.
      const firstCell = cells[0].toUpperCase();
      // Section header detection.
      // New format (written by current exporter): first cell is the literal word "SECTION",
      // section name is in cell[1].
      // Legacy format: section name IS the first cell (no values after it, or just blank cells).
      const isNewSectionRow = firstCell === 'SECTION' && !!cells[1]?.trim();
      // Legacy: detect specific known section header names exactly (after
      // normalising case + whitespace). This covers the template CSV format
      // where the section header line is `INCOME & EXPENSES,Jan-23,...` —
      // the trailing cells contain month labels rather than dollar values.
      const normalized = firstCell.replace(/\s+/g, ' ').trim();
      const KNOWN_LEGACY_SECTION_NAMES = [
        'INCOME & EXPENSES',
        'INCOME AND EXPENSES',
        'OPERATING EXPENSE (DIRECT DELIVERY)',
        'OPERATING EXPENSE (COGS - PER VEHICLE)',
        'OPERATING EXPENSE (COGS)',
        'PARKING FEE & LABOR CLEANING',
        'PARKING FEE AND LABOR CLEANING',
        'REIMBURSE AND NON-REIMBURSE BILLS',
        'REIMBURSE & NON-REIMBURSE BILLS',
        'HISTORY',
        'CO HOSTING ACCESS',
      ];
      const isKnownLegacyName = KNOWN_LEGACY_SECTION_NAMES.includes(normalized);
      const looksLikeLegacySectionHeader = !isNewSectionRow && isKnownLegacyName;

      // Parse Mode Settings row inside CO HOSTING ACCESS section.
      // Format: "Mode Settings,Jan 2026: 50,Feb 2026: 70,..."
      if (currentSection === 'CO HOSTING ACCESS' && firstCell === 'MODE SETTINGS') {
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const cell = cells[monthIdx + 1] || '';
          // Extract the number after the colon (e.g. "Jan 2026: 70" → 70)
          const match = cell.match(/:\s*(\d+)/);
          if (match) {
            const modeVal = parseInt(match[1], 10);
            if (modeVal === 50 || modeVal === 70) {
              sections.monthModes[monthIdx + 1] = modeVal as 50 | 70;
            }
          }
        }
        continue;
      }

      // Parse Car Management Split / Car Owner Split percentage rows.
      // Format: "Co-Host Split,$1234.56 (30%),...". We only care about
      // the percentage embedded in each cell — not the calculated dollar amount.
      if (
        currentSection === 'CO HOSTING ACCESS' &&
        (firstCell === 'CAR MANAGEMENT SPLIT' || firstCell === 'CO-HOST SPLIT' || firstCell === 'CAR OWNER SPLIT')
      ) {
        const field = (firstCell === 'CAR MANAGEMENT SPLIT' || firstCell === 'CO-HOST SPLIT') ? 'carManagementSplit' : 'carOwnerSplit';
        const splitRow: any = { category: field };
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const cell = cells[monthIdx + 1] || '';
          const match = cell.match(/\((\d+(?:\.\d+)?)%\)/);
          splitRow[`month${monthIdx + 1}`] = match ? parseFloat(match[1]) : null;
        }
        sections.managementSplit = sections.managementSplit || [];
        sections.managementSplit.push(splitRow);
        continue;
      }

      if (isNewSectionRow || looksLikeLegacySectionHeader) {
        const sectionLabel = isNewSectionRow ? cells[1].toUpperCase() : firstCell;

        if (sectionLabel.includes('CO HOSTING ACCESS')) {
          currentSection = 'CO HOSTING ACCESS';
          continue;
        }
        if (sectionLabel.includes('INCOME') && sectionLabel.includes('EXPENSES')) {
          currentSection = 'INCOME & EXPENSES';
          continue;
        }
        if (sectionLabel.includes('OPERATING EXPENSE') && sectionLabel.includes('DIRECT DELIVERY')) {
          currentSection = 'OPERATING EXPENSE (Direct Delivery)';
          skipNextLine = true;
          continue;
        }
        if (sectionLabel.includes('OPERATING EXPENSE') && sectionLabel.includes('COGS')) {
          currentSection = 'OPERATING EXPENSE (COGS - Per Vehicle)';
          continue;
        }
        if (sectionLabel.includes('PARKING FEE') && sectionLabel.includes('LABOR')) {
          currentSection = 'PARKING FEE & LABOR CLEANING';
          continue;
        }
        if (sectionLabel.includes('REIMBURSE') || sectionLabel.includes('NON-REIMBURSE')) {
          currentSection = 'REIMBURSE AND NON-REIMBURSE BILLS';
          continue;
        }
        if (sectionLabel === 'HISTORY') {
          currentSection = 'HISTORY';
          continue;
        }
        // Skip-only sections (computed totals, not raw input)
        if (
          sectionLabel.includes('CAR RENTAL VALUE') ||
          sectionLabel.includes('PARKING AIRPORT AVERAGE') ||
          sectionLabel.includes('TOTAL TRIPS') ||
          sectionLabel.includes('TOTAL MANAGEMENT') ||
          sectionLabel.includes('TOTAL CAR OWNER')
        ) {
          currentSection = 'SKIP';
          continue;
        }
      }

      // Skip the line flagged by the previous section header (e.g. the "Category" sub-header after Direct Delivery)
      if (skipNextLine) {
        skipNextLine = false;
        continue;
      }
      
      // Parse data rows based on current section.
      // Skip: unrecognised sections, summary/total rows, and the CO HOSTING ACCESS section.
      // "Car Payment" is a formula row inside INCOME & EXPENSES (skip it there),
      // but it is also a real data row inside COGS (keep it there).
      const isIncomeSection = currentSection === 'INCOME & EXPENSES';
      const isSummaryRow = firstCell.startsWith('TOTAL') ||
        firstCell.startsWith('CAR MANAGEMENT') ||
        firstCell.startsWith('CAR OWNER') ||
        firstCell === 'NEGATIVE BALANCE CARRY OVER' ||
        (firstCell === 'CAR PAYMENT' && isIncomeSection) ||
        firstCell === 'TOTAL EXPENSES' ||
        firstCell === 'CATEGORY' ||                 // column header row
        firstCell === '0' ||                        // history filler rows
        firstCell.includes('SECTION') ||            // stray SECTION markers
        // Section header names that may appear as data rows when they carry non-zero values
        firstCell === 'HISTORY' ||
        firstCell.includes('REIMBURSE AND NON-REIMBURSE') ||
        firstCell.includes('PARKING FEE & LABOR') ||
        (firstCell.includes('OPERATING EXPENSE') && (firstCell.includes('COGS') || firstCell.includes('DIRECT DELIVERY'))) ||
        firstCell.includes('INCOME & EXPENSES') ||
        firstCell.includes('INCOME AND EXPENSES');

      if (currentSection && currentSection !== 'SKIP' && currentSection !== 'CO HOSTING ACCESS' && cells.length > 1 && cells[0] && !isSummaryRow) {
        const rowData: any = { category: cells[0] };
        
        // Parse 12 month values (columns 1-12)
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
          const cellValue = cells[monthIdx + 1] || '$0.00';
          // Remove quotes, dollar signs, commas, and parentheses, then parse
          const cleanedValue = cellValue.replace(/["$,()]/g, '').trim();
          const numValue = parseFloat(cleanedValue) || 0;
          rowData[`month${monthIdx + 1}`] = numValue;
        }
        
        // Add to appropriate section
        if (currentSection.includes('INCOME') && currentSection.includes('EXPENSES')) {
          sections.incomeExpenses.push(rowData);
        } else if (currentSection.includes('Direct Delivery')) {
          sections.directDelivery.push(rowData);
        } else if (currentSection.includes('COGS')) {
          sections.cogs.push(rowData);
        } else if (currentSection.includes('Parking Fee') || currentSection.includes('LABOR')) {
          sections.parkingFeeLabor.push(rowData);
        } else if (currentSection.includes('REIMBURSE')) {
          sections.reimbursedBills.push(rowData);
        } else if (currentSection === 'HISTORY') {
          sections.history.push(rowData);
        }
      }
    }
    
    return { success: true, sections };
    
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to parse CSV file' };
  }
}

/**
 * Export all data to JSON format (for backup/advanced users)
 */
export function exportToJSON(
  data: IncomeExpenseData,
  carInfo: any,
  year: string,
  monthModes: { [month: number]: 50 | 70 }
): void {
  const exportData = {
    carInfo: {
      name: carInfo?.makeModel || carInfo?.make + ' ' + carInfo?.model,
      vin: carInfo?.vin,
      license: carInfo?.licensePlate,
      owner: {
        name: `${carInfo?.owner?.firstName || ''} ${carInfo?.owner?.lastName || ''}`.trim(),
        email: carInfo?.owner?.email,
      },
    },
    year,
    monthModes,
    data: {
      incomeExpenses: data.incomeExpenses,
      directDelivery: data.directDelivery,
      cogs: data.cogs,
      parkingFeeLabor: data.parkingFeeLabor,
      reimbursedBills: data.reimbursedBills,
      history: data.history,
    },
    exportedAt: new Date().toISOString(),
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const fileName = `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, '-') || 'Car'}-${year}.json`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
