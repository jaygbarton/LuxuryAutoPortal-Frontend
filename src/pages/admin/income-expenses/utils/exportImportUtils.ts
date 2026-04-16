// Consolidated Export/Import utility functions for Income and Expenses
import type { IncomeExpenseData } from "../types";

/**
 * Export all income and expense data to CSV format
 * Includes all categories in a single file with proper sections
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
    
    // January of other years (2020+): Use 0 (would need another level of recursion)
    if (month === 1 && prevYear > 2019) {
      return 0;
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
  // SECTION 1: CAR MANAGEMENT OWNER SPLIT
  // ========================================
  csvContent += `SECTION,CAR MANAGEMENT OWNER SPLIT\n`;
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
  csvContent += `Car Management Split,`;
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
    { field: 'keyFob', label: 'Keys & Fob' },
    { field: 'laborCleaning', label: 'Labor - Detailing' },
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
  
  // Ave Per Rental Per Trips Taken
  csvContent += `Ave Per Rental Per Trips Taken,`;
  let aveRentalTotal = 0;
  MONTHS.forEach((_, idx) => {
    const monthNum = idx + 1;
    const rental = getMonthValue(data.incomeExpenses, monthNum, 'rentalIncome');
    const trips = getMonthValue(data.history, monthNum, 'tripsTaken');
    const value = trips > 0 ? rental / trips : 0;
    csvContent += `$${Number(value).toFixed(2)},`;
    aveRentalTotal += Number(value);
  });
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
  
  // ========================================
  // Download CSV File
  // ========================================
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const fileName = `Income-Expense-${carInfo?.makeModel?.replace(/\s+/g, '-') || 'Car'}-${year}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
      
      // Skip empty rows
      if (cells.length === 0 || (cells.length === 1 && !cells[0])) {
        currentSection = ''; // Reset section on empty line
        continue;
      }
      
      // Detect section headers
      const firstCell = cells[0].toUpperCase();
      
      // Check for INCOME & EXPENSES section (first line with month headers)
      if (firstCell.includes('INCOME') && firstCell.includes('EXPENSES') && cells.length > 1) {
        currentSection = 'INCOME & EXPENSES';
        continue; // Skip header line
      }
      
      // Check for OPERATING EXPENSE (Direct Delivery) section
      if (firstCell.includes('OPERATING EXPENSE') && firstCell.includes('DIRECT DELIVERY')) {
        currentSection = 'OPERATING EXPENSE (Direct Delivery)';
        skipNextLine = true; // Next line will be "Category" header
        continue;
      }
      
      // Check for OPERATING EXPENSE (COGS) section
      if (firstCell.includes('OPERATING EXPENSE') && firstCell.includes('COGS')) {
        currentSection = 'OPERATING EXPENSE (COGS - Per Vehicle)';
        continue; // Skip header line
      }
      
      // Check for PARKING FEE & LABOR CLEANING section
      if (firstCell.includes('PARKING FEE') && firstCell.includes('LABOR')) {
        currentSection = 'PARKING FEE & LABOR CLEANING';
        continue; // Skip header line
      }
      
      // Check for REIMBURSE section
      if (firstCell.includes('REIMBURSE') || firstCell.includes('NON-REIMBURSE')) {
        currentSection = 'REIMBURSE AND NON-REIMBURSE BILLS';
        continue; // Skip header line
      }
      
      // Check for HISTORY section
      if (firstCell === 'HISTORY') {
        currentSection = 'HISTORY';
        continue; // Skip header line
      }
      
      // Skip "Category" header lines
      if (firstCell === 'CATEGORY' || skipNextLine) {
        skipNextLine = false;
        continue;
      }
      
      // Parse data rows based on current section
      if (currentSection && cells.length > 1 && cells[0]) {
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
