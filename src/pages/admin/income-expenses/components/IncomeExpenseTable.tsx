import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { useIncomeExpense } from "../context/IncomeExpenseContext";
import EditableCell from "./EditableCell";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import type { IncomeExpenseData } from "../types";
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
import { useLocation } from "wouter";

interface IncomeExpenseTableProps {
  year: string;
  isFromRoute?: boolean; // True when accessed from individual car page (View Car → Income and Expense)
  showParkingAirportQB?: boolean; // True to show PARKING AIRPORT AVERAGE PER TRIP - QB section
  isAllCarsView?: boolean; // True when "All Cars" is selected
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Round a number to 2 decimals using PHP-style round-half-away-from-zero,
// matching GLA-V3's `number_format((float)$x, 2, ".", "")` used to store
// split amounts in the DB before they are re-fetched, summed, and displayed.
//
// IEEE-754 representation means values like 314.755 are actually held as
// 314.7549999999..., and both JS `Math.round` and `.toFixed(2)` then round
// DOWN to 314.75 even though PHP rounds UP to 314.76. Using `Number.EPSILON`
// (~2.22e-16) is useless at this magnitude because float precision near
// 31475 is only ~7e-12. We add a fixed 1e-9 nudge that is WAY below one cent
// (so it can't change values that aren't already on a half-cent boundary)
// but is large enough to clear float noise and push real ties upward.
//
// Applied to every monthly Car Management Split / Car Owner Split result so
// the per-month cell AND the yearly total match GLA-V3 to the cent.
const roundToPhp2Dp = (value: number): number => {
  if (!isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-9)) / 100;
};

export default function IncomeExpenseTable({ year, isFromRoute = false, showParkingAirportQB = false, isAllCarsView = false }: IncomeExpenseTableProps) {
  const [location] = useLocation();
  const isReadOnly = location.startsWith("/admin/income-expenses");
  
  const {
    data,
    monthModes,
    toggleMonthMode,
    isSavingMode,
    skiRacksOwner,
    toggleSkiRacksOwner,
    isSavingSkiRacksOwner,
    dynamicSubcategories,
    addDynamicSubcategory,
    updateDynamicSubcategoryName,
    deleteDynamicSubcategory,
    updateDynamicSubcategoryValue,
    carId,
    isAllCars,
    getCategoryMonthFormTotal,
  } = useIncomeExpense();

  // Fetch previous year December data for January calculation
  const previousYear = String(parseInt(year) - 1);
  const { data: previousYearData } = useQuery<{
    success: boolean;
    data: IncomeExpenseData;
  }>({
    queryKey: isAllCars ? ["/api/income-expense/all-cars", previousYear] : ["/api/income-expense", carId, previousYear],
    queryFn: async () => {
      const url = isAllCars
        ? buildApiUrl(`/api/income-expense/all-cars/${previousYear}`)
        : buildApiUrl(`/api/income-expense/${carId}/${previousYear}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        // If previous year data doesn't exist, return empty data
        return { success: true, data: null as any };
      }
      return response.json();
    },
    retry: false,
    enabled: (isAllCars || !!carId) && !!year, // Fetch if we have carId (or isAllCars) and year
  });

  const prevYearDecData = previousYearData?.data;

  // Fetch previous year's dynamic subcategories separately (they might not be in the main API response)
  const { data: prevYearDynamicSubcategories } = useQuery<{
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  }>({
    queryKey: isAllCars 
      ? ["/api/income-expense/dynamic-subcategories/all-cars", previousYear]
      : ["/api/income-expense/dynamic-subcategories", carId, previousYear],
    queryFn: async () => {
      if ((!isAllCars && !carId) || !previousYear) return { directDelivery: [], cogs: [], parkingFeeLabor: [], reimbursedBills: [] };
      
      const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
        'directDelivery',
        'cogs',
        'parkingFeeLabor',
        'reimbursedBills',
      ];
      
      const promises = categories.map(async (categoryType) => {
        try {
          const url = isAllCars
            ? buildApiUrl(`/api/income-expense/dynamic-subcategories/all-cars/${previousYear}/${categoryType}`)
            : buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${previousYear}/${categoryType}`);
          const response = await fetch(url, { credentials: "include" });
          if (response.ok) {
            const result = await response.json();
            return { categoryType, data: result.data || [] };
          }
          return { categoryType, data: [] };
        } catch (error) {
          console.error(`Error fetching previous year ${categoryType} subcategories:`, error);
          return { categoryType, data: [] };
        }
      });
      
      const results = await Promise.all(promises);
      const subcategories: any = {
        directDelivery: [],
        cogs: [],
        parkingFeeLabor: [],
        reimbursedBills: [],
      };
      
      results.forEach(({ categoryType, data }) => {
        subcategories[categoryType] = data;
      });
      
      return subcategories;
    },
    retry: false,
    enabled: (isAllCars || !!carId) && !!year && !!previousYearData?.data, // Only fetch if we have previous year data
  });
  
  const [addSubcategoryModal, setAddSubcategoryModal] = useState<{
    open: boolean;
    categoryType: string;
    name: string;
  }>({ open: false, categoryType: "", name: "" });
  
  const [editSubcategoryModal, setEditSubcategoryModal] = useState<{
    open: boolean;
    categoryType: string;
    metadataId: number;
    currentName: string;
    newName: string;
  }>({ open: false, categoryType: "", metadataId: 0, currentName: "", newName: "" });

  const [expandedSections, setExpandedSections] = useState({
    managementOwner: true,
    incomeExpenses: true,
    directDelivery: true,
    cogs: true,
    parkingFeeLabor: true,
    reimbursedBills: true,
    officeSupport: false,
    incomeExpenseSummary: false,
    ebitda: false,
    history: true,
    rentalValue: true,
    parkingAverageGLA: false,
    parkingAverageQB: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }));
  };

  // Helper to get value by month - checks if data exists and returns actual value or 0
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

  // Helper function to calculate total income for a month (sum all income items)
  // This is reactive to data.incomeExpenses changes - recalculates on every render
  // when income data is updated (via React Query invalidation after saves)
  //
  // NOTE: Per the Form/Manual separation spec, every category total must
  // include approved-form-submission contributions so that downstream rows
  // (Car Management Split, Net Income, EBITDA, etc.) stay consistent with
  // the per-cell totals shown in <EditableCell>. The form contribution is
  // sourced from useFormAmounts via the IncomeExpense context.
  const getTotalIncomeForMonth = (month: number): number => {
    return (
      getMonthValue(data.incomeExpenses, month, "rentalIncome") +
      getMonthValue(data.incomeExpenses, month, "deliveryIncome") +
      getMonthValue(data.incomeExpenses, month, "electricPrepaidIncome") +
      getMonthValue(data.incomeExpenses, month, "smokingFines") +
      getMonthValue(data.incomeExpenses, month, "gasPrepaidIncome") +
      getMonthValue(data.incomeExpenses, month, "skiRacksIncome") +
      getMonthValue(data.incomeExpenses, month, "milesIncome") +
      getMonthValue(data.incomeExpenses, month, "childSeatIncome") +
      getMonthValue(data.incomeExpenses, month, "coolersIncome") +
      getMonthValue(data.incomeExpenses, month, "insuranceWreckIncome") +
      getMonthValue(data.incomeExpenses, month, "otherIncome") +
      getCategoryMonthFormTotal("income", month)
    );
  };

  // Helper to get total operating expense (Direct Delivery) for a month (including dynamic subcategories)
  const getTotalDirectDeliveryForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.directDelivery, month, "laborCarCleaning") +
      getMonthValue(data.directDelivery, month, "laborDelivery") +
      getMonthValue(data.directDelivery, month, "parkingAirport") +
      getMonthValue(data.directDelivery, month, "parkingLot") +
      getMonthValue(data.directDelivery, month, "uberLyftLime")
    );
    const dynamicTotal = dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal + getCategoryMonthFormTotal("directDelivery", month);
  };

  // Helper to get total operating expense (COGS) for a month (including dynamic subcategories)
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
    const dynamicTotal = dynamicSubcategories.cogs.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal + getCategoryMonthFormTotal("cogs", month);
  };

  // Helper to get total reimbursed bills for a month (including dynamic subcategories)
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
    const dynamicTotal = dynamicSubcategories.reimbursedBills.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal + getCategoryMonthFormTotal("reimbursedBills", month);
  };

  // Helper to get total parking fee & labor cleaning for a month (including dynamic subcategories)
  const getTotalParkingFeeLaborForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(data.parkingFeeLabor, month, "glaParkingFee") +
      getMonthValue(data.parkingFeeLabor, month, "laborCleaning")
    );
    const dynamicTotal = dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper function to calculate total office support expenses for a month
  const getTotalOfficeSupportForMonth = (month: number): number => {
    if (!data.officeSupport || !Array.isArray(data.officeSupport)) return 0;
    return (
      getMonthValue(data.officeSupport, month, "accountingProfessionalFees") +
      getMonthValue(data.officeSupport, month, "advertizing") +
      getMonthValue(data.officeSupport, month, "bankCharges") +
      getMonthValue(data.officeSupport, month, "detailMobile") +
      getMonthValue(data.officeSupport, month, "charitableContributions") +
      getMonthValue(data.officeSupport, month, "computerInternet") +
      getMonthValue(data.officeSupport, month, "deliveryPostageFreight") +
      getMonthValue(data.officeSupport, month, "detailShopEquipment") +
      getMonthValue(data.officeSupport, month, "duesSubscription") +
      getMonthValue(data.officeSupport, month, "generalAdministrative") +
      getMonthValue(data.officeSupport, month, "healthWellness") +
      getMonthValue(data.officeSupport, month, "laborSales") +
      getMonthValue(data.officeSupport, month, "laborSoftware") +
      getMonthValue(data.officeSupport, month, "laborHumanResources") +
      getMonthValue(data.officeSupport, month, "laborMarketing") +
      getMonthValue(data.officeSupport, month, "legalProfessional") +
      getMonthValue(data.officeSupport, month, "marketing") +
      getMonthValue(data.officeSupport, month, "mealsEntertainment") +
      getMonthValue(data.officeSupport, month, "officeExpense") +
      getMonthValue(data.officeSupport, month, "officeRent") +
      getMonthValue(data.officeSupport, month, "outsideStaffContractors") +
      getMonthValue(data.officeSupport, month, "parkNJetBooth") +
      getMonthValue(data.officeSupport, month, "printing") +
      getMonthValue(data.officeSupport, month, "referral") +
      getMonthValue(data.officeSupport, month, "repairsMaintenance") +
      getMonthValue(data.officeSupport, month, "salesTax") +
      getMonthValue(data.officeSupport, month, "securityCameras") +
      getMonthValue(data.officeSupport, month, "shippingFreightDelivery") +
      getMonthValue(data.officeSupport, month, "suppliesMaterials") +
      getMonthValue(data.officeSupport, month, "taxesLicense") +
      getMonthValue(data.officeSupport, month, "telephone") +
      getMonthValue(data.officeSupport, month, "travel")
      // NOTE: EBITDA-only fields (vehicleLoanInterestExpense, depreciationExpense,
      // vehicleDepreciationExpense, amortizationExpense, ebitdaTaxes) are
      // intentionally excluded here. They are manual entries on the EBITDA
      // card and must not feed the "Totals OPERATING EXPENSE (Office Support)"
      // row, which only reflects the rendered Office Support rows.
    );
  };

  // Sum of the four EBITDA manual entries (Interest + Taxes + Depreciation +
  // Amortization). These are tracked separately from OPERATING EXPENSES
  // (OFFICE SUPPORT) so they don't pollute that total, but they still need to
  // be subtracted from Net Income (and added back to get EBITDA). See the
  // Total Expenses / Net Income / EBITDA rows in the EBITDA section below.
  const getEbitdaAddBacksForMonth = (month: number): number => {
    if (!data.officeSupport || !Array.isArray(data.officeSupport)) return 0;
    return (
      getMonthValue(data.officeSupport, month, "vehicleLoanInterestExpense") +
      getMonthValue(data.officeSupport, month, "ebitdaTaxes") +
      getMonthValue(data.officeSupport, month, "depreciationExpense") +
      getMonthValue(data.officeSupport, month, "amortizationExpense")
    );
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
    if (!prevYearDecData) return 0;
    const data = prevYearDecData;
    const fixedTotal = (
      getPrevYearValue(data.directDelivery || [], month, "laborCarCleaning") +
      getPrevYearValue(data.directDelivery || [], month, "laborDelivery") +
      getPrevYearValue(data.directDelivery || [], month, "parkingAirport") +
      getPrevYearValue(data.directDelivery || [], month, "parkingLot") +
      getPrevYearValue(data.directDelivery || [], month, "uberLyftLime")
    );
    // Include dynamic subcategories from previous year (use fetched data or fallback to API response)
    const prevYearDynamic = prevYearDynamicSubcategories?.directDelivery || data.dynamicSubcategories?.directDelivery || [];
    const dynamicTotal = prevYearDynamic.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get total from previous year for COGS by month (including dynamic subcategories)
  const getPrevYearTotalCogs = (month: number): number => {
    if (!prevYearDecData) return 0;
    const data = prevYearDecData;
    const fixedTotal = (
      getPrevYearValue(data.cogs || [], month, "autoBodyShopWreck") +
      getPrevYearValue(data.cogs || [], month, "alignment") +
      getPrevYearValue(data.cogs || [], month, "battery") +
      getPrevYearValue(data.cogs || [], month, "brakes") +
      getPrevYearValue(data.cogs || [], month, "carPayment") +
      getPrevYearValue(data.cogs || [], month, "carInsurance") +
      getPrevYearValue(data.cogs || [], month, "carSeats") +
      getPrevYearValue(data.cogs || [], month, "cleaningSuppliesTools") +
      getPrevYearValue(data.cogs || [], month, "emissions") +
      getPrevYearValue(data.cogs || [], month, "gpsSystem") +
      getPrevYearValue(data.cogs || [], month, "keyFob") +
      getPrevYearValue(data.cogs || [], month, "laborCleaning") +
      getPrevYearValue(data.cogs || [], month, "licenseRegistration") +
      getPrevYearValue(data.cogs || [], month, "mechanic") +
      getPrevYearValue(data.cogs || [], month, "oilLube") +
      getPrevYearValue(data.cogs || [], month, "parts") +
      getPrevYearValue(data.cogs || [], month, "skiRacks") +
      getPrevYearValue(data.cogs || [], month, "tickets") +
      getPrevYearValue(data.cogs || [], month, "tiredAirStation") +
      getPrevYearValue(data.cogs || [], month, "tires") +
      getPrevYearValue(data.cogs || [], month, "towingImpoundFees") +
      getPrevYearValue(data.cogs || [], month, "uberLyftLime") +
      getPrevYearValue(data.cogs || [], month, "windshield") +
      getPrevYearValue(data.cogs || [], month, "wipers")
    );
    // Include dynamic subcategories from previous year (use fetched data or fallback to API response)
    const prevYearDynamic = prevYearDynamicSubcategories?.cogs || data.dynamicSubcategories?.cogs || [];
    const dynamicTotal = prevYearDynamic.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Calculate negative balance carry over for previous year (recursive)
  // Uses the same formulas as calculateNegativeBalanceCarryOver but for previous year data
  // Uses CURRENT month's mode (not previous month's mode)
  const calculatePrevYearNegativeBalance = (month: number): number => {
    if (!prevYearDecData) return 0;
    
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
    const currentMonthMode: 50 | 70 = prevYearDecData?.formulaSetting?.monthModes?.[month] || 50;
    
    // For months 2-12, calculate from previous month
    const prevMonth = month - 1;
    const prevRentalIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "rentalIncome");
    const prevDeliveryIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "deliveryIncome");
    const prevElectricPrepaidIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "electricPrepaidIncome");
    const prevSmokingFines = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "smokingFines");
    const prevGasPrepaidIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "gasPrepaidIncome");
    const prevSkiRacksIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "skiRacksIncome");
    const prevMilesIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "milesIncome");
    const prevChildSeatIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "childSeatIncome");
    const prevCoolersIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "coolersIncome");
    const prevInsuranceWreckIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "insuranceWreckIncome");
    const prevOtherIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "otherIncome");
    const prevNegativeBalanceCarryOver = calculatePrevYearNegativeBalance(prevMonth);
    const prevTotalDirectDelivery = getPrevYearTotalDirectDelivery(prevMonth);
    const prevTotalCogs = getPrevYearTotalCogs(prevMonth);
    const prevTotalParkingFeeLabor = getPrevYearTotalParkingFeeLabor(prevMonth);
    
    // Get car owner split percentage from previous year data
    const prevCarOwnerSplitPercent = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevMonth, "carOwnerSplit") || 0;
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
      const part1 = prevMilesIncome + (prevSmokingFines * 0.1);
      const part2 = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevSmokingFines 
                   - prevGasPrepaidIncome - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome;
      
      // Calculate with Total Parking Fee & Labor Cleaning
      calculation = part1 - prevTotalDirectDelivery - prevTotalCogs - prevTotalParkingFeeLabor 
                   + prevNegativeBalanceCarryOver + (part2 * prevCarOwnerSplitDecimal);
      
      // IF result > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    } else {
      // 50:50 Mode Formula
      // =IF(
      //   Rental Income - Delivery Income - Electric Prepaid Income - Gas Prepaid Income - Smoking Fines
      //   - Miles Income - Ski Racks Income - Child Seat Income - Coolers Income - Insurance Wreck Income - Other Income
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) - TOTAL OPERATING EXPENSE (COGS - Per Vehicle)
      //   + Negative Balance Carry Over > 0,
      //   0,
      //   [return calculation]
      // )
      calculation = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevGasPrepaidIncome 
                   - prevSmokingFines - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome 
                   - prevTotalDirectDelivery - prevTotalCogs + prevNegativeBalanceCarryOver;
      
      // If calculation > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    }
  };

  // Helper to get total parking fee & labor cleaning from previous year by month (including dynamic subcategories)
  const getPrevYearTotalParkingFeeLabor = (month: number): number => {
    if (!prevYearDecData) return 0;
    const data = prevYearDecData;
    const fixedTotal = (
      getPrevYearValue(data.parkingFeeLabor || [], month, "glaParkingFee") +
      getPrevYearValue(data.parkingFeeLabor || [], month, "laborCleaning")
    );
    // Include dynamic subcategories from previous year (use fetched data or fallback to API response)
    const prevYearDynamic = prevYearDynamicSubcategories?.parkingFeeLabor || data.dynamicSubcategories?.parkingFeeLabor || [];
    const dynamicTotal = prevYearDynamic.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === month);
      const value = monthValue?.value;
      if (value === null || value === undefined) return sum;
      const numValue = Number(value);
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Calculate Negative Balance Carry Over:
  // Uses different formulas based on mode (30:70 or 50:50)
  // Year 2019: Always 0
  // January of other years (2020+): Uses December of previous year
  // All other months: Uses previous month
  // Uses CURRENT month's mode (not previous month's mode)
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
      prevRentalIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "rentalIncome");
      prevDeliveryIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "deliveryIncome");
      prevElectricPrepaidIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "electricPrepaidIncome");
      prevSmokingFines = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "smokingFines");
      prevGasPrepaidIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "gasPrepaidIncome");
      prevSkiRacksIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "skiRacksIncome");
      prevMilesIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "milesIncome");
      prevChildSeatIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "childSeatIncome");
      prevCoolersIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "coolersIncome");
      prevInsuranceWreckIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "insuranceWreckIncome");
      prevOtherIncome = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "otherIncome");
      
      prevTotalDirectDelivery = getPrevYearTotalDirectDelivery(prevDec);
      prevTotalCogs = getPrevYearTotalCogs(prevDec);
      prevTotalParkingFeeLabor = getPrevYearTotalParkingFeeLabor(prevDec);
      prevCarOwnerSplitPercent = getPrevYearValue(prevYearDecData?.incomeExpenses || [], prevDec, "carOwnerSplit") || 0;
      
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
      const part1 = prevMilesIncome + (prevSmokingFines * 0.1);
      const part2 = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevSmokingFines 
                   - prevGasPrepaidIncome - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome;
      
      // Calculate with Total Parking Fee & Labor Cleaning
      calculation = part1 - prevTotalDirectDelivery - prevTotalCogs - prevTotalParkingFeeLabor 
                   + prevNegativeBalanceCarryOver + (part2 * prevCarOwnerSplitDecimal);
      
      // IF result > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    } else {
      // 50:50 Mode Formula
      // =IF(
      //   Rental Income - Delivery Income - Electric Prepaid Income - Gas Prepaid Income - Smoking Fines
      //   - Miles Income - Ski Racks Income - Child Seat Income - Coolers Income - Insurance Wreck Income - Other Income
      //   - TOTAL OPERATING EXPENSE (Direct Delivery) - TOTAL OPERATING EXPENSE (COGS - Per Vehicle)
      //   + Negative Balance Carry Over > 0,
      //   0,
      //   [return calculation]
      // )
      calculation = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevGasPrepaidIncome 
                   - prevSmokingFines - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome 
                   - prevTotalDirectDelivery - prevTotalCogs + prevNegativeBalanceCarryOver;
      
      // If calculation > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    }
  };

  // Calculate Car Management Split based on formula
  const calculateCarManagementSplit = (month: number): number => {
    // Use stored percentage, default to 0 if not set (independent of car owner split)
    const storedPercent = getMonthValue(data.incomeExpenses, month, "carManagementSplit") || 0;
    const mgmtPercent = storedPercent / 100; // Split percentage for management
    
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
    // Use calculated Negative Balance Carry Over (January 2019 will be 0, other Januaries use previous year's December)
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
        else if ((skiRacksOwner[month] || "GLA") === "GLA") {
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
        else if ((skiRacksOwner[month] || "GLA") === "GLA") {
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

  // Calculate Car Owner Split based on formula
  const calculateCarOwnerSplit = (month: number): number => {
    // Use stored percentage, default to 0 if not set (independent of car management split)
    const storedPercent = getMonthValue(data.incomeExpenses, month, "carOwnerSplit") || 0;
    const ownerPercent = storedPercent / 100; // Split percentage for owner
    
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
    // Use calculated Negative Balance Carry Over (January 2019 will be 0, other Januaries use previous year's December)
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
        else if ((skiRacksOwner[month] || "GLA") === "GLA") {
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
        else if ((skiRacksOwner[month] || "GLA") === "GLA") {
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

  // Calculate Car Management Total Expenses:
  // In 30:70 mode: "TOTAL REIMBURSE AND NON-REIMBURSE BILLS" only
  // In 50:50 mode: "TOTAL REIMBURSE AND NON-REIMBURSE BILLS" + ("TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)") * "Car Management Split %"
  const calculateCarManagementTotalExpenses = (month: number): number => {
    const totalReimbursedBills = getTotalReimbursedBillsForMonth(month);
    
    // Get the mode for this month
    const mode = monthModes[month] || 50;
    
    // In 30:70 mode, return only TOTAL REIMBURSE AND NON-REIMBURSE BILLS
    if (mode === 70) {
      return totalReimbursedBills;
    }
    
    // In 50:50 mode, use the full formula
    const storedMgmtPercent = Number(getMonthValue(data.incomeExpenses, month, "carManagementSplit")) || 0;
    const mgmtPercent = storedMgmtPercent / 100; // Convert percentage to decimal
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    
    return totalReimbursedBills + ((totalDirectDelivery + totalCogs) * mgmtPercent);
  };

  // Calculate Car Owner Total Expenses:
  // In 30:70 mode: "TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)" + "Total Parking Fee & Labor Cleaning"
  // In 50:50 mode: ("TOTAL OPERATING EXPENSE (Direct Delivery)" + "TOTAL OPERATING EXPENSE (COGS - Per Vehicle)") * "Car Owner Split %"
  const calculateCarOwnerTotalExpenses = (month: number): number => {
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    
    // Get the mode for this month
    const mode = monthModes[month] || 50;
    
    if (mode === 70) {
      // 30:70 mode: Direct Delivery + COGS + Total Parking Fee & Labor Cleaning
      const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(month);
      return totalDirectDelivery + totalCogs + totalParkingFeeLabor;
    } else {
      // 50:50 mode: (Direct Delivery + COGS) * Car Owner Split %
      const storedOwnerPercent = Number(getMonthValue(data.incomeExpenses, month, "carOwnerSplit")) || 0;
      const ownerPercent = storedOwnerPercent / 100; // Convert percentage to decimal
      return (totalDirectDelivery + totalCogs) * ownerPercent;
    }
  };

  // Helper function to get split for a specific month
  const getSplitForMonth = (month: number) => {
    const mode = monthModes[month];
    if (mode === 70) {
      return { mgmt: 30, owner: 70 }; // 70 mode = 30:70 split (Car Management : Car Owner)
    }
    return { mgmt: 50, owner: 50 }; // 50 mode = 50:50 split
  };

  return (
    // `min-w-0` + `w-full` guarantee this wrapper fills—but never exceeds—the
    // width of whatever flex/grid ancestor it's dropped into. Without it, the
    // table's intrinsic min-width (Category + 12 months + Total) would push the
    // wrapper wider than its parent, cascading horizontal overflow up to the
    // window and making the sticky Category/Total columns scroll off-screen.
    //
    // IMPORTANT: we intentionally do NOT set `overflow-hidden` on this outer
    // wrapper. Doing so would create a second sticky-scroll-container above the
    // inner scroll div, which (together with `border-collapse: collapse`) causes
    // Chrome to anchor sticky <td>s to this outer wrapper—so they scroll away
    // with the content instead of pinning. We let the inner scroll container
    // own both the clipping and the sticky positioning.
    <div className="w-full min-w-0 bg-card border border-border rounded-lg">
      {/*
        Single scroll container for both axes with a bounded height so that
        position: sticky on the header row (top), the Category column (left),
        and the Total column (right) all have a real scrolling ancestor.
        `rounded-lg` here keeps the card's rounded corners clipping the table
        now that the outer wrapper no longer uses `overflow-hidden`.
      */}
      <div className="overflow-auto max-h-[calc(100vh-180px)] rounded-lg">
        <table className="w-full border-collapse text-xs">
          {/* Table Header */}
          {/*
            `md:sticky` — the column/row freeze only activates on desktop widths
            (md breakpoint = 768 px). On smaller/mobile screens the header row
            and Category/Total columns scroll normally with the table.
          */}
          <thead className="md:sticky md:top-0 md:z-40 bg-muted">
            <tr>
              <th className="md:sticky md:left-0 md:z-50 bg-muted border-r border-border px-2 py-1.5 text-left text-foreground min-w-[150px] max-w-[180px]">
                Category
              </th>
              {MONTHS.map((month, index) => {
                const monthNum = index + 1;
                const currentYear = parseInt(year, 10);
                const showSkiRacksToggle = currentYear >= 2026;
                const currentMode = monthModes[monthNum] || 50;
                const currentSkiRacksOwner = skiRacksOwner[monthNum] || "GLA";
                const hasSkiRacksIncome = getMonthValue(data.incomeExpenses, monthNum, "skiRacksIncome") > 0;
                return (
                  <th
                    key={month}
                    className="border-l border-border px-1 py-1.5 text-center min-w-[75px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-foreground text-[10px]">{month} {year}</span>
                      {/* Split-mode / ski-racks-owner toggles are editing controls.
                          Hide them entirely on the read-only /admin/income-expenses
                          page per UX: users only need to see values there. They
                          remain available in editable contexts (e.g. view-car). */}
                      {!isReadOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleMonthMode(monthNum)}
                            disabled={isSavingMode}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              currentMode === 50
                                ? "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-lg shadow-green-600/50"
                                : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-600/50",
                              isSavingMode && "animate-pulse"
                            )}
                            title={
                              isSavingMode
                                ? "Saving mode change..."
                                : `Click to toggle between 50:50 (green) and 30:70 (blue) split`
                            }
                          >
                            {isSavingMode ? "..." : currentMode}
                          </button>
                          {showSkiRacksToggle && hasSkiRacksIncome && (
                            <button
                              onClick={() => toggleSkiRacksOwner(monthNum)}
                              disabled={isSavingSkiRacksOwner}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-200 min-w-[24px]",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                currentSkiRacksOwner === "GLA"
                                  ? "bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-lg shadow-purple-600/50"
                                  : "bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 shadow-lg shadow-orange-600/50",
                                isSavingSkiRacksOwner && "animate-pulse"
                              )}
                              title={
                                isSavingSkiRacksOwner
                                  ? "Saving ski racks owner..."
                                  : `Click to toggle ski racks owner: ${currentSkiRacksOwner === "GLA" ? "Management/GLA (purple)" : "Owner (orange)"}`
                              }
                            >
                              {isSavingSkiRacksOwner ? "..." : currentSkiRacksOwner === "GLA" ? "M" : "O"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="md:sticky md:right-0 md:z-50 border-l border-border px-1 py-1.5 text-center text-foreground min-w-[75px] bg-card font-bold">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* CAR MANAGEMENT AND OWNER SPLIT */}
            <CategorySection
              title="CAR MANAGEMENT OWNER SPLIT"
              isExpanded={expandedSections.managementOwner}
              onToggle={() => toggleSection("managementOwner")}

            >
              {/* Car Management Split - Shows calculated amount + percentage.
                  Follow GLA-V3 decimal handling: each month's computed split
                  is rounded to 2dp at the source (same as GLA-V3's PHP
                  `number_format((float)$x, 2, ".", "")` before saving to DB),
                  so the per-month cells and the yearly total are computed
                  from identical 2dp values. CategoryRow's summedTotal then
                  sums these exact 2dp values - no sub-cent drift.

                  In All Cars mode the per-car formula cannot be re-run on
                  aggregated inputs (each car has its own split %, mode, and
                  ski-racks owner), so use the backend-precomputed
                  `mgmtIncome` / `ownerIncome` — these are summed per-car
                  results matching GLA-V3's SUM-of-stored-splits semantics. */}
              <CategoryRow
                label="Car Management Split"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "mgmtIncome")
                    : roundToPhp2Dp(calculateCarManagementSplit(monthNum));
                })}
                percentageValues={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  return getMonthValue(data.incomeExpenses, monthNum, "carManagementSplit");
                })}
                category="income"
                field="carManagementSplit"
                isEditable={!isReadOnly}
                formatType={isAllCarsView ? undefined : "managementSplit"}
                monthModes={monthModes}
                showAmountAndPercentage={!isAllCarsView}
              />
              {/* Car Owner Split - Same treatment as Car Management Split. */}
              <CategoryRow
                label="Car Owner Split"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "ownerIncome")
                    : roundToPhp2Dp(calculateCarOwnerSplit(monthNum));
                })}
                percentageValues={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  return getMonthValue(data.incomeExpenses, monthNum, "carOwnerSplit");
                })}
                category="income"
                field="carOwnerSplit"
                isEditable={!isReadOnly}
                formatType={isAllCarsView ? undefined : "ownerSplit"}
                monthModes={monthModes}
                showAmountAndPercentage={!isAllCarsView}
              />
            </CategorySection>

            {/* INCOME & EXPENSES */}
            <CategorySection
              title="INCOME & EXPENSES"
              isExpanded={expandedSections.incomeExpenses}
              onToggle={() => toggleSection("incomeExpenses")}

            >
              <CategoryRow
                label="Rental Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "rentalIncome"))}
                category="income"
                field="rentalIncome"
              />
              <CategoryRow
                label="Delivery Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "deliveryIncome"))}
                category="income"
                field="deliveryIncome"
              />
              <CategoryRow
                label="Electric Prepaid Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "electricPrepaidIncome"))}
                category="income"
                field="electricPrepaidIncome"
              />
              <CategoryRow
                label="Smoking Fines"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "smokingFines"))}
                category="income"
                field="smokingFines"
              />
              <CategoryRow
                label="Gas Prepaid Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "gasPrepaidIncome"))}
                category="income"
                field="gasPrepaidIncome"
              />
              <CategoryRow
                label="Ski Racks Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "skiRacksIncome"))}
                category="income"
                field="skiRacksIncome"
              />
              <CategoryRow
                label="Miles Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "milesIncome"))}
                category="income"
                field="milesIncome"
              />
              <CategoryRow
                label="Child Seat Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "childSeatIncome"))}
                category="income"
                field="childSeatIncome"
              />
              <CategoryRow
                label="Coolers Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "coolersIncome"))}
                category="income"
                field="coolersIncome"
              />
              <CategoryRow
                label="Income insurance and Client Wrecks"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "insuranceWreckIncome"))}
                category="income"
                field="insuranceWreckIncome"
              />
              <CategoryRow
                label="Other Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "otherIncome"))}
                category="income"
                field="otherIncome"
              />
              <CategoryRow
                label="Negative Balance Carry Over"
                values={MONTHS.map((_, i) => calculateNegativeBalanceCarryOver(i + 1))}
                category="income"
                field="negativeBalanceCarryOver"
                isEditable={false} // All months are calculated (January is always 0, not editable)
                hideTotal={true} // Hide total column
              />
              <CategoryRow
                label="Car Payment"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "carPayment"))}
                category="income"
                field="carPayment"
                isEditable={false}
              />
              <CategoryRow
                label="Car Management Total Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // In All Cars mode, use backend-provided pre-computed values (frontend formula breaks with aggregated split percentages)
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses")
                    : calculateCarManagementTotalExpenses(monthNum);
                })}
                category="income"
                field="carManagementTotalExpenses"
                isEditable={false}
              />
              <CategoryRow
                label="Car Owner Total Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // In All Cars mode, use backend-provided pre-computed values
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses")
                    : calculateCarOwnerTotalExpenses(monthNum);
                })}
                category="income"
                field="carOwnerTotalExpenses"
                isEditable={false}
              />
              <CategoryRow
                label="Total Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const mgmt = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses")
                    : calculateCarManagementTotalExpenses(monthNum);
                  const owner = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses")
                    : calculateCarOwnerTotalExpenses(monthNum);
                  return mgmt + owner;
                })}
                isEditable={false}
              />
              <CategoryRow
                label="Total Car Profit"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const rentalIncome = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                  const mgmt = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses")
                    : calculateCarManagementTotalExpenses(monthNum);
                  const owner = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses")
                    : calculateCarOwnerTotalExpenses(monthNum);
                  const totalExpenses = mgmt + owner;
                  return rentalIncome - totalExpenses;
                })}
                isEditable={false}
              />
            </CategorySection>

            {/* OPERATING EXPENSE (Direct Delivery) */}
            <CategorySection
              title="OPERATING EXPENSE (Direct Delivery)"
              isExpanded={expandedSections.directDelivery}
              onToggle={() => toggleSection("directDelivery")}

            >
              <CategoryRow
                label="Labor - Cleaning"
                values={MONTHS.map((_, i) => getMonthValue(data.directDelivery, i + 1, "laborCarCleaning"))}
                category="directDelivery"
                field="laborCarCleaning"
              />
              <CategoryRow
                label="Labor - Delivery"
                values={MONTHS.map((_, i) => getMonthValue(data.directDelivery, i + 1, "laborDelivery"))}
                category="directDelivery"
                field="laborDelivery"
              />
              <CategoryRow
                label="Parking - Airport"
                values={MONTHS.map((_, i) => getMonthValue(data.directDelivery, i + 1, "parkingAirport"))}
                category="directDelivery"
                field="parkingAirport"
              />
              <CategoryRow
                label="Parking - Lot"
                values={MONTHS.map((_, i) => getMonthValue(data.directDelivery, i + 1, "parkingLot"))}
                category="directDelivery"
                field="parkingLot"
              />
              <CategoryRow
                label="Uber/Lyft/Lime"
                values={MONTHS.map((_, i) => getMonthValue(data.directDelivery, i + 1, "uberLyftLime"))}
                category="directDelivery"
                field="uberLyftLime"
              />
              {/* Dynamic Subcategories */}
              {dynamicSubcategories.directDelivery.map((subcat) => (
                <DynamicSubcategoryRow
                  key={subcat.id}
                  subcategory={subcat}
                  categoryType="directDelivery"
                  onEditName={() => setEditSubcategoryModal({
                    open: true,
                    categoryType: "directDelivery",
                    metadataId: subcat.id,
                    currentName: subcat.name,
                    newName: subcat.name,
                  })}
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete "${subcat.name}"?`)) {
                      deleteDynamicSubcategory("directDelivery", subcat.id);
                    }
                  }}
                  onUpdateValue={updateDynamicSubcategoryValue}
                  isReadOnly={isReadOnly}
                />
              ))}
              {/* Add Subcategory Button */}
              {!isReadOnly && (
                <tr>
                  <td colSpan={14} className="px-3 py-2">
                    <button
                      onClick={() => setAddSubcategoryModal({ open: true, categoryType: "directDelivery", name: "" })}
                      className="flex items-center gap-2 text-xs text-[#B8860B] hover:text-[#9A7209] transition-colors font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Add Subcategory
                    </button>
                  </td>
                </tr>
              )}
              <CategoryRow
                label="TOTAL OPERATING EXPENSE (Direct Delivery)"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const fixedTotal = (
                    getMonthValue(data.directDelivery, monthNum, "laborCarCleaning") +
                    getMonthValue(data.directDelivery, monthNum, "laborDelivery") +
                    getMonthValue(data.directDelivery, monthNum, "parkingAirport") +
                    getMonthValue(data.directDelivery, monthNum, "parkingLot") +
                    getMonthValue(data.directDelivery, monthNum, "uberLyftLime")
                  );
                  const dynamicTotal = dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
                    const monthValue = subcat.values.find((v: any) => v.month === monthNum);
                    return sum + (monthValue?.value || 0);
                  }, 0);
                  return fixedTotal + dynamicTotal;
                })}
                isEditable={false}
                isTotal
              />
            </CategorySection>

            {/* OPERATING EXPENSE (COGS - Per Vehicle) */}
            <CategorySection
              title="OPERATING EXPENSE (COGS - Per Vehicle)"
              isExpanded={expandedSections.cogs}
              onToggle={() => toggleSection("cogs")}

            >
              <CategoryRow
                label="Auto Body Shop / Wreck"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "autoBodyShopWreck"))}
                category="cogs"
                field="autoBodyShopWreck"
              />
              <CategoryRow
                label="Alignment"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "alignment"))}
                category="cogs"
                field="alignment"
              />
              <CategoryRow
                label="Battery"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "battery"))}
                category="cogs"
                field="battery"
              />
              <CategoryRow
                label="Brakes"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "brakes"))}
                category="cogs"
                field="brakes"
              />
              <CategoryRow
                label="Car Payment"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "carPayment"))}
                category="cogs"
                field="carPayment"
              />
              <CategoryRow
                label="Car Insurance"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "carInsurance"))}
                category="cogs"
                field="carInsurance"
              />
              <CategoryRow
                label="Car Seats"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "carSeats"))}
                category="cogs"
                field="carSeats"
              />
              <CategoryRow
                label="Cleaning Supplies / Tools"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "cleaningSuppliesTools"))}
                category="cogs"
                field="cleaningSuppliesTools"
              />
              <CategoryRow
                label="Emissions"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "emissions"))}
                category="cogs"
                field="emissions"
              />
              <CategoryRow
                label="GPS System"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "gpsSystem"))}
                category="cogs"
                field="gpsSystem"
              />
              <CategoryRow
                label="Keys & Fob"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "keyFob"))}
                category="cogs"
                field="keyFob"
              />
              <CategoryRow
                label="Labor - Detailing"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "laborCleaning"))}
                category="cogs"
                field="laborCleaning"
              />
              <CategoryRow
                label="Windshield"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "windshield"))}
                category="cogs"
                field="windshield"
              />
              <CategoryRow
                label="Wipers"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "wipers"))}
                category="cogs"
                field="wipers"
              />
              <CategoryRow
                label="Uber/Lyft/Lime"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "uberLyftLime"))}
                category="cogs"
                field="uberLyftLime"
              />
              <CategoryRow
                label="Towing / Impound Fees"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "towingImpoundFees"))}
                category="cogs"
                field="towingImpoundFees"
              />
              <CategoryRow
                label="Tired Air Station"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "tiredAirStation"))}
                category="cogs"
                field="tiredAirStation"
              />
              <CategoryRow
                label="Tires"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "tires"))}
                category="cogs"
                field="tires"
              />
              <CategoryRow
                label="Oil/Lube"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "oilLube"))}
                category="cogs"
                field="oilLube"
              />
              <CategoryRow
                label="Parts"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "parts"))}
                category="cogs"
                field="parts"
              />
              <CategoryRow
                label="Ski Racks"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "skiRacks"))}
                category="cogs"
                field="skiRacks"
              />
              <CategoryRow
                label="Tickets & Tolls"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "tickets"))}
                category="cogs"
                field="tickets"
              />
              <CategoryRow
                label="Mechanic"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "mechanic"))}
                category="cogs"
                field="mechanic"
              />
              <CategoryRow
                label="License & Registration"
                values={MONTHS.map((_, i) => getMonthValue(data.cogs, i + 1, "licenseRegistration"))}
                category="cogs"
                field="licenseRegistration"
              />
              {/* Dynamic Subcategories */}
              {dynamicSubcategories.cogs.map((subcat) => (
                <DynamicSubcategoryRow
                  key={subcat.id}
                  subcategory={subcat}
                  categoryType="cogs"
                  onEditName={() => setEditSubcategoryModal({
                    open: true,
                    categoryType: "cogs",
                    metadataId: subcat.id,
                    currentName: subcat.name,
                    newName: subcat.name,
                  })}
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete "${subcat.name}"?`)) {
                      deleteDynamicSubcategory("cogs", subcat.id);
                    }
                  }}
                  onUpdateValue={updateDynamicSubcategoryValue}
                  isReadOnly={isReadOnly}
                />
              ))}
              {/* Add Subcategory Button */}
              {!isReadOnly && (
                <tr>
                  <td colSpan={14} className="px-3 py-2">
                    <button
                      onClick={() => setAddSubcategoryModal({ open: true, categoryType: "cogs", name: "" })}
                      className="flex items-center gap-2 text-xs text-[#B8860B] hover:text-[#9A7209] transition-colors font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Add Subcategory
                    </button>
                  </td>
                </tr>
              )}
              <CategoryRow
                label="TOTAL OPERATING EXPENSE (COGS - Per Vehicle)"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const fixedTotal = (
                    getMonthValue(data.cogs, monthNum, "autoBodyShopWreck") +
                    getMonthValue(data.cogs, monthNum, "alignment") +
                    getMonthValue(data.cogs, monthNum, "battery") +
                    getMonthValue(data.cogs, monthNum, "brakes") +
                    getMonthValue(data.cogs, monthNum, "carPayment") +
                    getMonthValue(data.cogs, monthNum, "carInsurance") +
                    getMonthValue(data.cogs, monthNum, "carSeats") +
                    getMonthValue(data.cogs, monthNum, "cleaningSuppliesTools") +
                    getMonthValue(data.cogs, monthNum, "emissions") +
                    getMonthValue(data.cogs, monthNum, "gpsSystem") +
                    getMonthValue(data.cogs, monthNum, "keyFob") +
                    getMonthValue(data.cogs, monthNum, "laborCleaning") +
                    getMonthValue(data.cogs, monthNum, "licenseRegistration") +
                    getMonthValue(data.cogs, monthNum, "mechanic") +
                    getMonthValue(data.cogs, monthNum, "oilLube") +
                    getMonthValue(data.cogs, monthNum, "parts") +
                    getMonthValue(data.cogs, monthNum, "skiRacks") +
                    getMonthValue(data.cogs, monthNum, "tickets") +
                    getMonthValue(data.cogs, monthNum, "tiredAirStation") +
                    getMonthValue(data.cogs, monthNum, "tires") +
                    getMonthValue(data.cogs, monthNum, "towingImpoundFees") +
                    getMonthValue(data.cogs, monthNum, "uberLyftLime") +
                    getMonthValue(data.cogs, monthNum, "windshield") +
                    getMonthValue(data.cogs, monthNum, "wipers")
                  );
                  const dynamicTotal = dynamicSubcategories.cogs.reduce((sum, subcat) => {
                    const monthValue = subcat.values.find((v: any) => v.month === monthNum);
                    return sum + (monthValue?.value || 0);
                  }, 0);
                  return fixedTotal + dynamicTotal;
                })}
                isEditable={false}
                isTotal
              />
            </CategorySection>

            {/* Parking Fee & Labor Cleaning */}
            <CategorySection
              title="PARKING FEE & LABOR CLEANING"
              isExpanded={expandedSections.parkingFeeLabor}
              onToggle={() => toggleSection("parkingFeeLabor")}

            >
              <CategoryRow
                label="GLA Parking Fee"
                values={MONTHS.map((_, i) => getMonthValue(data.parkingFeeLabor, i + 1, "glaParkingFee"))}
                category="parkingFeeLabor"
                field="glaParkingFee"
              />
              <CategoryRow
                label="Labor - Cleaning"
                values={MONTHS.map((_, i) => getMonthValue(data.parkingFeeLabor, i + 1, "laborCleaning"))}
                category="parkingFeeLabor"
                field="laborCleaning"
              />
              {/* Dynamic Subcategories */}
              {dynamicSubcategories.parkingFeeLabor.map((subcat) => (
                <DynamicSubcategoryRow
                  key={subcat.id}
                  subcategory={subcat}
                  categoryType="parkingFeeLabor"
                  onEditName={() => setEditSubcategoryModal({
                    open: true,
                    categoryType: "parkingFeeLabor",
                    metadataId: subcat.id,
                    currentName: subcat.name,
                    newName: subcat.name,
                  })}
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete "${subcat.name}"?`)) {
                      deleteDynamicSubcategory("parkingFeeLabor", subcat.id);
                    }
                  }}
                  onUpdateValue={updateDynamicSubcategoryValue}
                  isReadOnly={isReadOnly}
                />
              ))}
              {/* Add Subcategory Button */}
              {!isReadOnly && (
                <tr>
                  <td colSpan={14} className="px-3 py-2">
                    <button
                      onClick={() => setAddSubcategoryModal({ open: true, categoryType: "parkingFeeLabor", name: "" })}
                      className="flex items-center gap-2 text-xs text-[#B8860B] hover:text-[#9A7209] transition-colors font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Add Subcategory
                    </button>
                  </td>
                </tr>
              )}
              <CategoryRow
                label="Total Parking Fee & Labor Cleaning"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const fixedTotal = (
                    getMonthValue(data.parkingFeeLabor, monthNum, "glaParkingFee") +
                    getMonthValue(data.parkingFeeLabor, monthNum, "laborCleaning")
                  );
                  const dynamicTotal = dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
                    const monthValue = subcat.values.find((v: any) => v.month === monthNum);
                    return sum + (monthValue?.value || 0);
                  }, 0);
                  return fixedTotal + dynamicTotal;
                })}
                isEditable={false}
                isTotal
              />
            </CategorySection>

            {/* REIMBURSE AND NON-REIMBURSE BILLS */}
            <CategorySection
              title="REIMBURSE AND NON-REIMBURSE BILLS"
              isExpanded={expandedSections.reimbursedBills}
              onToggle={() => toggleSection("reimbursedBills")}

            >
              <CategoryRow
                label="Electric - Reimbursed"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "electricReimbursed"))}
                category="reimbursedBills"
                field="electricReimbursed"
              />
              <CategoryRow
                label="Electric - Not Reimbursed"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "electricNotReimbursed"))}
                category="reimbursedBills"
                field="electricNotReimbursed"
              />
              <CategoryRow
                label="Gas - Reimbursed"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "gasReimbursed"))}
                category="reimbursedBills"
                field="gasReimbursed"
              />
              <CategoryRow
                label="Gas - Not Reimbursed"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "gasNotReimbursed"))}
                category="reimbursedBills"
                field="gasNotReimbursed"
              />
              <CategoryRow
                label="Gas - Service Run"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "gasServiceRun"))}
                category="reimbursedBills"
                field="gasServiceRun"
              />
              <CategoryRow
                label="Parking Airport"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "parkingAirport"))}
                category="reimbursedBills"
                field="parkingAirport"
              />
              <CategoryRow
                label="Uber/Lyft/Lime - Not Reimbursed (added)"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "uberLyftLimeNotReimbursed"))}
                category="reimbursedBills"
                field="uberLyftLimeNotReimbursed"
              />
              <CategoryRow
                label="Uber/Lyft/Lime - Reimbursed (added)"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "uberLyftLimeReimbursed"))}
                category="reimbursedBills"
                field="uberLyftLimeReimbursed"
              />
              {/* Dynamic Subcategories */}
              {dynamicSubcategories.reimbursedBills.map((subcat) => (
                <DynamicSubcategoryRow
                  key={subcat.id}
                  subcategory={subcat}
                  categoryType="reimbursedBills"
                  onEditName={() => setEditSubcategoryModal({
                    open: true,
                    categoryType: "reimbursedBills",
                    metadataId: subcat.id,
                    currentName: subcat.name,
                    newName: subcat.name,
                  })}
                  onDelete={() => {
                    if (confirm(`Are you sure you want to delete "${subcat.name}"?`)) {
                      deleteDynamicSubcategory("reimbursedBills", subcat.id);
                    }
                  }}
                  onUpdateValue={updateDynamicSubcategoryValue}
                  isReadOnly={isReadOnly}
                />
              ))}
              {/* Add Subcategory Button */}
              {!isReadOnly && (
                <tr>
                  <td colSpan={14} className="px-3 py-2">
                    <button
                      onClick={() => setAddSubcategoryModal({ open: true, categoryType: "reimbursedBills", name: "" })}
                      className="flex items-center gap-2 text-xs text-[#B8860B] hover:text-[#9A7209] transition-colors font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Add Subcategory
                    </button>
                  </td>
                </tr>
              )}
              <CategoryRow
                label="TOTAL REIMBURSE AND NON-REIMBURSE BILLS"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const fixedTotal = (
                    getMonthValue(data.reimbursedBills, monthNum, "electricReimbursed") +
                    getMonthValue(data.reimbursedBills, monthNum, "electricNotReimbursed") +
                    getMonthValue(data.reimbursedBills, monthNum, "gasReimbursed") +
                    getMonthValue(data.reimbursedBills, monthNum, "gasNotReimbursed") +
                    getMonthValue(data.reimbursedBills, monthNum, "gasServiceRun") +
                    getMonthValue(data.reimbursedBills, monthNum, "parkingAirport") +
                    getMonthValue(data.reimbursedBills, monthNum, "uberLyftLimeNotReimbursed") +
                    getMonthValue(data.reimbursedBills, monthNum, "uberLyftLimeReimbursed")
                  );
                  const dynamicTotal = dynamicSubcategories.reimbursedBills.reduce((sum, subcat) => {
                    const monthValue = subcat.values.find((v: any) => v.month === monthNum);
                    return sum + (monthValue?.value || 0);
                  }, 0);
                  return fixedTotal + dynamicTotal;
                })}
                isEditable={false}
                isTotal
              />
            </CategorySection>

            {/* OPERATING EXPENSES (OFFICE SUPPORT) - Only show when "All Cars" is selected */}
            {isAllCarsView && (
              <CategorySection
                title="OPERATING EXPENSES (OFFICE SUPPORT)"
                isExpanded={expandedSections.officeSupport}
                onToggle={() => toggleSection("officeSupport")}

              >
                <CategoryRow
                  label="Accounting & Professional Fees"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "accountingProfessionalFees"))}
                  category="officeSupport"
                  field="accountingProfessionalFees"
                />
                <CategoryRow
                  label="Advertizing"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "advertizing"))}
                  category="officeSupport"
                  field="advertizing"
                />
                <CategoryRow
                  label="Bank Charges"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "bankCharges"))}
                  category="officeSupport"
                  field="bankCharges"
                />
                <CategoryRow
                  label="Detail Mobile"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "detailMobile"))}
                  category="officeSupport"
                  field="detailMobile"
                />
                <CategoryRow
                  label="Charitable Contributions"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "charitableContributions"))}
                  category="officeSupport"
                  field="charitableContributions"
                />
                <CategoryRow
                  label="Computer & Internet"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "computerInternet"))}
                  category="officeSupport"
                  field="computerInternet"
                />
                <CategoryRow
                  label="Delivery, Postage & Freight"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "deliveryPostageFreight"))}
                  category="officeSupport"
                  field="deliveryPostageFreight"
                />
                <CategoryRow
                  label="Detail Shop Equipment"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "detailShopEquipment"))}
                  category="officeSupport"
                  field="detailShopEquipment"
                />
                <CategoryRow
                  label="Dues & Subscription"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "duesSubscription"))}
                  category="officeSupport"
                  field="duesSubscription"
                />
                <CategoryRow
                  label="General and administrative (G&A)"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "generalAdministrative"))}
                  category="officeSupport"
                  field="generalAdministrative"
                />
                <CategoryRow
                  label="Health & Wellness"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "healthWellness"))}
                  category="officeSupport"
                  field="healthWellness"
                />
                <CategoryRow
                  label="Labor - Human Resources"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "laborHumanResources"))}
                  category="officeSupport"
                  field="laborHumanResources"
                />
                <CategoryRow
                  label="Labor - Marketing"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "laborMarketing"))}
                  category="officeSupport"
                  field="laborMarketing"
                />
                <CategoryRow
                  label="Office Rent"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "officeRent"))}
                  category="officeSupport"
                  field="officeRent"
                />
                <CategoryRow
                  label="Outside & Staff Contractors"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "outsideStaffContractors"))}
                  category="officeSupport"
                  field="outsideStaffContractors"
                />
                <CategoryRow
                  label="Park n Jet Booth"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "parkNJetBooth"))}
                  category="officeSupport"
                  field="parkNJetBooth"
                />
                <CategoryRow
                  label="Printing"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "printing"))}
                  category="officeSupport"
                  field="printing"
                />
                <CategoryRow
                  label="Referral"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "referral"))}
                  category="officeSupport"
                  field="referral"
                />
                <CategoryRow
                  label="Repairs & Maintenance"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "repairsMaintenance"))}
                  category="officeSupport"
                  field="repairsMaintenance"
                />
                <CategoryRow
                  label="Sales Tax"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "salesTax"))}
                  category="officeSupport"
                  field="salesTax"
                />
                <CategoryRow
                  label="Security Cameras"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "securityCameras"))}
                  category="officeSupport"
                  field="securityCameras"
                />
                <CategoryRow
                  label="Supplies & Materials"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "suppliesMaterials"))}
                  category="officeSupport"
                  field="suppliesMaterials"
                />
                <CategoryRow
                  label="Taxes and License"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "taxesLicense"))}
                  category="officeSupport"
                  field="taxesLicense"
                />
                <CategoryRow
                  label="Telephone"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "telephone"))}
                  category="officeSupport"
                  field="telephone"
                />
                <CategoryRow
                  label="Travel"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "travel"))}
                  category="officeSupport"
                  field="travel"
                />
                <CategoryRow
                  label="Labor Software"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "laborSoftware"))}
                  category="officeSupport"
                  field="laborSoftware"
                />
                <CategoryRow
                  label="Legal & Professional"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "legalProfessional"))}
                  category="officeSupport"
                  field="legalProfessional"
                />
                <CategoryRow
                  label="Marketing"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "marketing"))}
                  category="officeSupport"
                  field="marketing"
                />
                <CategoryRow
                  label="Meals & Entertainment"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "mealsEntertainment"))}
                  category="officeSupport"
                  field="mealsEntertainment"
                />
                <CategoryRow
                  label="Office Expense"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "officeExpense"))}
                  category="officeSupport"
                  field="officeExpense"
                />
                <CategoryRow
                  label="Labor Sales"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "laborSales"))}
                  category="officeSupport"
                  field="laborSales"
                />
                <CategoryRow
                  label="Totals OPERATING EXPENSE (Office Support)"
                  values={MONTHS.map((_, i) => getTotalOfficeSupportForMonth(i + 1))}
                  isEditable={false}
                  isTotal
                />
              </CategorySection>
            )}

            {/* INCOME & EXPENSES SUMMARY - Always shown */}
            <CategorySection
              title="INCOME & EXPENSES SUMMARY"
              isExpanded={expandedSections.incomeExpenseSummary}
              onToggle={() => toggleSection("incomeExpenseSummary")}

            >
              <CategoryRow
                label="Total Rental Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "rentalIncome"))}
                isEditable={false}
              />
              <CategoryRow
                label="Total Car Management Income"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // Mirror the "Car Management Split" row value 1:1 — in All Cars
                  // view use the backend-aggregated per-car total (mgmtIncome);
                  // per-car view runs the same formula that drives that row.
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "mgmtIncome")
                    : roundToPhp2Dp(calculateCarManagementSplit(monthNum));
                })}
                isEditable={false}
              />
              <CategoryRow
                label="Total Car Owner Income"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // Mirror the "Car Owner Split" row value 1:1.
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "ownerIncome")
                    : roundToPhp2Dp(calculateCarOwnerSplit(monthNum));
                })}
                isEditable={false}
              />
              <CategoryRow
                label="Total Car Management Car Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // Mirror the "Car Management Total Expenses" row in INCOME & EXPENSES:
                  // use backend-provided value in All Cars view, otherwise compute from this car's data.
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses")
                    : calculateCarManagementTotalExpenses(monthNum);
                })}
                isEditable={false}
              />
              <CategoryRow
                label="Total Car Owner Car Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // Mirror the "Car Owner Total Expenses" row in INCOME & EXPENSES.
                  return isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses")
                    : calculateCarOwnerTotalExpenses(monthNum);
                })}
                isEditable={false}
              />
              {isAllCarsView && (
                <CategoryRow
                  label="Total Car Management Office Support Expenses"
                  values={MONTHS.map((_, i) => getTotalOfficeSupportForMonth(i + 1))}
                  isEditable={false}
                />
              )}
              <CategoryRow
                label="Total Expenses"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  // Total Expenses is the literal sum of the expense rows
                  // rendered above in this INCOME & EXPENSES SUMMARY section:
                  // Car Management Car Expenses + Car Owner Car Expenses
                  // (+ Office Support on the All Cars page). EBITDA items are
                  // not in this section and are intentionally excluded here.
                  const mgmtExpenses = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses")
                    : calculateCarManagementTotalExpenses(monthNum);
                  const ownerExpenses = isAllCarsView
                    ? getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses")
                    : calculateCarOwnerTotalExpenses(monthNum);
                  const officeSupportTotal = isAllCarsView ? getTotalOfficeSupportForMonth(monthNum) : 0;
                  return mgmtExpenses + ownerExpenses + officeSupportTotal;
                })}
                isEditable={false}
                isTotal
              />
            </CategorySection>

            {/* EBITDA - Only show when "All Cars" is selected */}
            {isAllCarsView && (
              <CategorySection
                title="EBITDA"
                isExpanded={expandedSections.ebitda}
                onToggle={() => toggleSection("ebitda")}

              >
                <CategoryRow
                  label="Total Rental Income"
                  values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "rentalIncome"))}
                  isEditable={false}
                />
                <CategoryRow
                  label="Total Expenses"
                  values={MONTHS.map((_, i) => {
                    const monthNum = i + 1;
                    // Match the Total Expenses row in INCOME & EXPENSES SUMMARY:
                    // Car Management Car Expenses + Car Owner Car Expenses +
                    // Office Support. EBITDA items (Interest/Taxes/Depreciation/
                    // Amortization) are shown as their own rows below and are
                    // subtracted separately in the Net Income formula.
                    const mgmtExpenses = getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses");
                    const ownerExpenses = getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses");
                    const officeSupportTotal = getTotalOfficeSupportForMonth(monthNum);
                    return mgmtExpenses + ownerExpenses + officeSupportTotal;
                  })}
                  isEditable={false}
                />
                {/* EBITDA manual entries — only in All Cars view.
                    These write into the shared officeSupport store at carId=0
                    (same pattern as Parking Airport QB), so they are not
                    tied to any individual car. `alwaysEditable` bypasses the
                    admin-page blanket read-only guard used for aggregated
                    rows so the admin can type these values here. */}
                <CategoryRow
                  label="Interest"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "vehicleLoanInterestExpense"))}
                  category="officeSupport"
                  field="vehicleLoanInterestExpense"
                  isEditable={true}
                  alwaysEditable
                />
                <CategoryRow
                  label="Taxes"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "ebitdaTaxes"))}
                  category="officeSupport"
                  field="ebitdaTaxes"
                  isEditable={true}
                  alwaysEditable
                />
                <CategoryRow
                  label="Depreciation"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "depreciationExpense"))}
                  category="officeSupport"
                  field="depreciationExpense"
                  isEditable={true}
                  alwaysEditable
                />
                <CategoryRow
                  label="Amortization"
                  values={MONTHS.map((_, i) => getMonthValue(data.officeSupport, i + 1, "amortizationExpense"))}
                  category="officeSupport"
                  field="amortizationExpense"
                  isEditable={true}
                  alwaysEditable
                />
                <CategoryRow
                  label="Net Income"
                  values={MONTHS.map((_, i) => {
                    const monthNum = i + 1;
                    // Net Income = Total Rental Income - Total Expenses
                    //            - (Interest + Taxes + Depreciation + Amortization).
                    // Total Expenses mirrors the row above (operating expenses
                    // only). The EBITDA add-backs are subtracted here so they
                    // affect Net Income without being lumped into the shown
                    // Total Expenses row.
                    const rentalIncome = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                    const mgmtExpenses = getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses");
                    const ownerExpenses = getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses");
                    const officeSupportTotal = getTotalOfficeSupportForMonth(monthNum);
                    const addBacks = getEbitdaAddBacksForMonth(monthNum);
                    return rentalIncome - mgmtExpenses - ownerExpenses - officeSupportTotal - addBacks;
                  })}
                  isEditable={false}
                />
                <CategoryRow
                  label="EBITDA"
                  values={MONTHS.map((_, i) => {
                    const monthNum = i + 1;
                    // EBITDA = Net Income + Interest + Taxes + Depreciation + Amortization
                    //        = Rental Income - Total Expenses (operating expenses only).
                    const rentalIncome = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                    const mgmtExpenses = getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses");
                    const ownerExpenses = getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses");
                    const officeSupportTotal = getTotalOfficeSupportForMonth(monthNum);
                    return rentalIncome - mgmtExpenses - ownerExpenses - officeSupportTotal;
                  })}
                  isEditable={false}
                />
                <CategoryRow
                  label="EBITDA Margin"
                  isPercentage
                  percentageDecimals={2}
                  values={MONTHS.map((_, i) => {
                    const monthNum = i + 1;
                    // EBITDA Margin = (EBITDA / Total Rental Income) * 100
                    const rentalIncome = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                    if (rentalIncome === 0) return 0;
                    const mgmtExpenses = getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses");
                    const ownerExpenses = getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses");
                    const officeSupportTotal = getTotalOfficeSupportForMonth(monthNum);
                    const ebitda = rentalIncome - mgmtExpenses - ownerExpenses - officeSupportTotal;
                    return (ebitda / rentalIncome) * 100;
                  })}
                  // Annual EBITDA margin uses total EBITDA / total rental
                  // income (not an average of monthly margins), matching how
                  // EBITDA margin is normally reported on a P&L.
                  totalOverride={(() => {
                    let annualEbitda = 0;
                    let annualRental = 0;
                    for (let i = 0; i < 12; i++) {
                      const monthNum = i + 1;
                      const rentalIncome = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                      const mgmtExpenses = getMonthValue(data.incomeExpenses, monthNum, "carManagementTotalExpenses");
                      const ownerExpenses = getMonthValue(data.incomeExpenses, monthNum, "carOwnerTotalExpenses");
                      const officeSupportTotal = getTotalOfficeSupportForMonth(monthNum);
                      annualEbitda += rentalIncome - mgmtExpenses - ownerExpenses - officeSupportTotal;
                      annualRental += rentalIncome;
                    }
                    return annualRental === 0 ? 0 : (annualEbitda / annualRental) * 100;
                  })()}
                  isEditable={false}
                />
              </CategorySection>
            )}

            {/* HISTORY */}
            <CategorySection
              title="HISTORY"
              isExpanded={expandedSections.history}
              onToggle={() => toggleSection("history")}

            >
              <CategoryRow
                label="Days Rented"
                values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "daysRented"))}
                category="history"
                field="daysRented"
                isEditable={true}
                isInteger
              />
              <CategoryRow
                label="Cars Available For Rent"
                values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "carsAvailableForRent"))}
                category="history"
                field="carsAvailableForRent"
                isEditable={true}
                isInteger
              />
              <CategoryRow
                label="Trips Taken"
                values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "tripsTaken"))}
                category="history"
                field="tripsTaken"
                isEditable={true}
                isInteger
              />
            </CategorySection>

            {/* CAR RENTAL VALUE PER MONTH */}
            <CategorySection
              title="CAR RENTAL VALUE PER MONTH"
              isExpanded={expandedSections.rentalValue}
              onToggle={() => toggleSection("rentalValue")}
              hasActions={false}

            >
              <CategoryRow
                label="Total Car Rental Income"
                values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "rentalIncome"))}
                isEditable={false}
              />
              <CategoryRow
                label="Trips Taken"
                values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "tripsTaken"))}
                isEditable={false}
                isInteger
              />
              <CategoryRow
                label="Ave Rental Per Trips Taken"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const rental = getMonthValue(data.incomeExpenses, monthNum, "rentalIncome");
                  const trips = getMonthValue(data.history, monthNum, "tripsTaken");
                  return trips > 0 ? rental / trips : 0;
                })}
                totalOverride={(() => {
                  const totalRental = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.incomeExpenses, i + 1, "rentalIncome"), 0);
                  const totalTrips  = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.history,        i + 1, "tripsTaken"),  0);
                  return totalTrips > 0 ? totalRental / totalTrips : 0;
                })()}
                isEditable={false}
              />
            </CategorySection>

            {/* PARKING AIRPORT AVERAGE PER TRIP - GLA */}
            <CategorySection
              title="PARKING AIRPORT AVERAGE PER TRIP - GLA"
              isExpanded={expandedSections.parkingAverageGLA}
              onToggle={() => toggleSection("parkingAverageGLA")}
              hasActions={false}

            >
              <CategoryRow
                label="Total Trips Taken"
                values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "tripsTaken"))}
                isEditable={false}
                isInteger
              />
              <CategoryRow
                label="Total Parking Airport"
                values={MONTHS.map((_, i) => getMonthValue(data.reimbursedBills, i + 1, "parkingAirport"))}
                isEditable={false}
              />
              <CategoryRow
                label="Average per trip"
                values={MONTHS.map((_, i) => {
                  const monthNum = i + 1;
                  const parking = getMonthValue(data.reimbursedBills, monthNum, "parkingAirport");
                  const trips = getMonthValue(data.history, monthNum, "tripsTaken");
                  return trips > 0 ? parking / trips : 0;
                })}
                totalOverride={(() => {
                  const totalParking = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.reimbursedBills, i + 1, "parkingAirport"), 0);
                  const totalTrips = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.history, i + 1, "tripsTaken"), 0);
                  return totalTrips > 0 ? totalParking / totalTrips : 0;
                })()}
                isEditable={false}
              />
            </CategorySection>

            {/* PARKING AIRPORT AVERAGE PER TRIP - QB - Only show when "All Cars" is selected */}
            {showParkingAirportQB && (
              <CategorySection
                title="PARKING AIRPORT AVERAGE PER TRIP - QB"
                isExpanded={expandedSections.parkingAverageQB}
                onToggle={() => toggleSection("parkingAverageQB")}
                hasActions={false}

              >
                <CategoryRow
                  label="Total Trips Taken"
                  values={MONTHS.map((_, i) => getMonthValue(data.history, i + 1, "tripsTaken"))}
                  isEditable={false}
                  isInteger
                />
                <CategoryRow
                  label="Total Parking Airport"
                  values={MONTHS.map((_, i) => getMonthValue(data.parkingAirportQB || [], i + 1, "totalParkingAirport"))}
                  category="parkingAirportQB"
                  field="totalParkingAirport"
                  isEditable={true}
                  alwaysEditable
                />
                <CategoryRow
                  label="Average per trip"
                  values={MONTHS.map((_, i) => {
                    const monthNum = i + 1;
                    const parking = getMonthValue(data.parkingAirportQB || [], monthNum, "totalParkingAirport");
                    const trips = getMonthValue(data.history, monthNum, "tripsTaken");
                    return trips > 0 ? parking / trips : 0;
                  })}
                  totalOverride={(() => {
                    const totalParking = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.parkingAirportQB || [], i + 1, "totalParkingAirport"), 0);
                    const totalTrips = MONTHS.reduce((sum, _, i) => sum + getMonthValue(data.history, i + 1, "tripsTaken"), 0);
                    return totalTrips > 0 ? totalParking / totalTrips : 0;
                  })()}
                  isEditable={false}
                />
              </CategorySection>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Subcategory Modal */}
      <Dialog open={addSubcategoryModal.open} onOpenChange={(open) => setAddSubcategoryModal({ ...addSubcategoryModal, open })}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Add Subcategory</DialogTitle>
            <DialogDescription>Enter a name for the new subcategory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Subcategory Name</Label>
              <Input
                value={addSubcategoryModal.name}
                onChange={(e) => setAddSubcategoryModal({ ...addSubcategoryModal, name: e.target.value })}
                className="bg-muted border-border text-foreground"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddSubcategoryModal({ open: false, categoryType: "", name: "" })}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (addSubcategoryModal.name.trim()) {
                  await addDynamicSubcategory(addSubcategoryModal.categoryType, addSubcategoryModal.name.trim());
                  setAddSubcategoryModal({ open: false, categoryType: "", name: "" });
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              disabled={!addSubcategoryModal.name.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subcategory Name Modal */}
      <Dialog open={editSubcategoryModal.open} onOpenChange={(open) => setEditSubcategoryModal({ ...editSubcategoryModal, open })}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Edit Subcategory Name</DialogTitle>
            <DialogDescription>Update the name of this subcategory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Subcategory Name</Label>
              <Input
                value={editSubcategoryModal.newName}
                onChange={(e) => setEditSubcategoryModal({ ...editSubcategoryModal, newName: e.target.value })}
                className="bg-muted border-border text-foreground"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSubcategoryModal({ open: false, categoryType: "", metadataId: 0, currentName: "", newName: "" })}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (editSubcategoryModal.newName.trim()) {
                  await updateDynamicSubcategoryName(
                    editSubcategoryModal.categoryType,
                    editSubcategoryModal.metadataId,
                    editSubcategoryModal.newName.trim()
                  );
                  setEditSubcategoryModal({ open: false, categoryType: "", metadataId: 0, currentName: "", newName: "" });
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              disabled={!editSubcategoryModal.newName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Dynamic Subcategory Row Component
interface DynamicSubcategoryRowProps {
  subcategory: any;
  categoryType: string;
  onEditName: () => void;
  onDelete: () => void;
  onUpdateValue: (categoryType: string, metadataId: number, month: number, value: number, subcategoryName: string) => Promise<void>;
  isReadOnly?: boolean;
}

function DynamicSubcategoryRow({
  subcategory,
  categoryType,
  onEditName,
  onDelete,
  onUpdateValue,
  isReadOnly = false,
}: DynamicSubcategoryRowProps) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const { setEditingCell } = useIncomeExpense();
  
  const total = subcategory.values.reduce((sum: number, val: any) => sum + (val.value || 0), 0);
  
  const handleCellClick = (month: number, currentValue: number) => {
    if (isReadOnly) return;
    setEditingCell({
      category: `dynamic-${categoryType}`,
      field: `subcategory-${subcategory.id}`,
      month,
      value: currentValue,
    });
  };
  
  return (
    <tr className="border-b border-border">
      <td className="md:sticky md:left-0 md:z-20 bg-card px-2 py-1 text-left text-muted-foreground border-r border-border text-xs">
        <div className="flex items-center gap-2">
          <span className="truncate">{subcategory.name}</span>
          {!isReadOnly && (
            <>
              <button
                onClick={onEditName}
                className="text-[#D3BC8D] hover:text-[#d4d570] transition-colors"
                title="Edit name"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={onDelete}
                className="text-red-700 hover:text-red-700 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </td>
      {MONTHS.map((_, i) => {
        const month = i + 1;
        const monthValue = subcategory.values.find((v: any) => v.month === month);
        const value = monthValue?.value || 0;
        
        return (
          <td key={month} className="border-l border-border px-1 py-1 text-right">
            <span
              onClick={() => handleCellClick(month, value)}
              className={cn(
                "px-1 py-0.5 rounded block text-xs text-right transition-colors",
                isReadOnly 
                  ? "cursor-default" 
                  : "cursor-pointer hover:bg-muted",
                value === 0 ? "text-gray-600" : "text-[#D3BC8D]"
              )}
            >
              ${value.toFixed(2)}
            </span>
          </td>
        );
      })}
      <td className={cn(
        "md:sticky md:right-0 md:z-20 border-l border-border px-1 py-1 text-right font-bold text-xs bg-card",
        total === 0 ? "text-gray-600" : "text-[#D3BC8D]"
      )}>
        ${total.toFixed(2)}
      </td>
    </tr>
  );
}

// Helper components
interface CategorySectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  hasActions?: boolean;
}

function CategorySection({ title, isExpanded, onToggle, children, hasActions = true }: CategorySectionProps) {
  return (
    <>
      <tr className="bg-primary">
        {/*
          Split into two cells so the title can be sticky on desktop:
          • Cell 1 (sticky): holds the title text, same min-width as the
            Category column so it perfectly overlaps that column on freeze.
          • Cell 2 (scrollable): fills the remaining 13 columns with the
            primary background colour and scrolls away to the right.
          On mobile (< md) both cells are static and scroll normally.
          The chevron toggle is always shown — both per-car and All Cars
          views support expand/collapse.
        */}
        <td
          className="md:sticky md:left-0 md:z-30 bg-primary px-2 py-1.5 border-b border-primary min-w-[150px] max-w-[180px] cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-primary-foreground shrink-0" />
              : <ChevronRight className="w-4 h-4 text-primary-foreground shrink-0" />}
            <span className="text-xs font-semibold text-primary-foreground">{title}</span>
          </div>
        </td>
        <td colSpan={13} className="bg-primary border-b border-primary cursor-pointer" onClick={onToggle} />
      </tr>
      {isExpanded && children}
    </>
  );
}

interface CategoryRowProps {
  label: string;
  values: number[];
  percentageValues?: number[]; // For split rows, this stores the percentage
  category?: string;
  field?: string;
  isEditable?: boolean;
  isEditablePerMonth?: (month: number) => boolean; // Function to determine if a specific month is editable
  isInteger?: boolean;
  isTotal?: boolean;
  hideTotal?: boolean; // Hide the total column for this row
  formatType?: "managementSplit" | "ownerSplit";
  monthModes?: { [month: number]: 50 | 70 };
  isPercentage?: boolean;
  // Number of decimal places to render when isPercentage is true. Defaults to
  // 0 to keep split-mode rows rendering as "50%"/"30%" as before.
  percentageDecimals?: number;
  showAmountAndPercentage?: boolean; // Show both amount and percentage
  totalOverride?: number; // Override the auto-summed total (e.g. for averages)
  // Bypass the /admin/income-expenses (All Cars page) read-only guard so this
  // specific row can still be typed in by the admin. Used for true All-Cars
  // manual entries (EBITDA Interest/Taxes/Depreciation/Amortization and the
  // QB Parking Airport row) that have no per-car source.
  alwaysEditable?: boolean;
}

function CategoryRow({
  label,
  values,
  percentageValues,
  category,
  field,
  isEditable = true,
  isEditablePerMonth,
  isInteger = false,
  isTotal = false,
  hideTotal = false,
  formatType,
  monthModes,
  isPercentage = false,
  percentageDecimals = 0,
  showAmountAndPercentage = false,
  totalOverride,
  alwaysEditable = false,
}: CategoryRowProps) {
  const [location] = useLocation();
  // Categories whose data is stored globally at car_id = 0 (not aggregated from
  // per-car rows) — these are manual entries on the All Cars page and should
  // stay editable there, so they bypass the blanket read-only guard.
  const isGlobalManualEntryCategory =
    category === "officeSupport" || category === "parkingAirportQB";
  const isReadOnly =
    location.startsWith("/admin/income-expenses") &&
    !alwaysEditable &&
    !isGlobalManualEntryCategory;
  // Override isEditable if in read-only mode
  const effectiveIsEditable = isReadOnly ? false : isEditable;
  
  // Calculate total - ensure all values are numbers (or use override if provided).
  // For currency rows, round each month's value to the nearest cent before summing
  // so the yearly total exactly matches the sum of what's shown in each month cell
  // (otherwise accumulated sub-cent floats can drift the total by several dollars).
  const summedTotal = values.reduce((sum, val) => {
    const numVal = typeof val === 'number' && !isNaN(val) ? val : 0;
    const rounded = isInteger ? numVal : Math.round(numVal * 100) / 100;
    return sum + rounded;
  }, 0);
  const total = typeof totalOverride === "number" && !isNaN(totalOverride) ? totalOverride : summedTotal;

  // Helper to format value based on formatType
  const formatValue = (value: number, month: number) => {
    // For Negative Balance Carry Over, display in parentheses format for negative values
    // e.g., -3 => (3), -100 => (100), 0 => $0.00
    if (field === "negativeBalanceCarryOver") {
      if (value < 0) {
        return `(${Math.abs(value).toFixed(2)})`;
      }
      return `$${value.toFixed(2)}`;
    }
    
    if (showAmountAndPercentage && percentageValues) {
      // Show both calculated amount and percentage
      const percentage = percentageValues[month - 1] || 0;
      return `$${value.toFixed(2)} (${percentage.toFixed(0)}%)`;
    } else if (isPercentage) {
      // Format as percentage; number of decimals configurable via `percentageDecimals`.
      return `${value.toFixed(percentageDecimals)}%`;
    } else if (formatType === "managementSplit") {
      // Get mode for this month to determine percentage
      const mode = monthModes?.[month] || 50;
      const percentage = mode === 70 ? 30 : 50; // 30:70 split when mode is 70 (Car Management : Car Owner)
      // Format: $ {splitAmount.toFixed(2)}({percentage}%)
      return `$ ${value.toFixed(2)}(${percentage}%)`;
    } else if (formatType === "ownerSplit") {
      // Format: $ {splitAmount.toFixed(2)}
      return `$ ${value.toFixed(2)}`;
    } else if (isInteger) {
      return value.toString();
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format total based on formatType
  // For all currency values, format as: $ {total.toFixed(2)}
  const formatTotal = () => {
    if (showAmountAndPercentage && percentageValues) {
      // Show both total amount and average percentage
      const avgPercentage = percentageValues.reduce((sum, val) => sum + (val || 0), 0) / 12;
      return `$${total.toFixed(2)} (${avgPercentage.toFixed(0)}%)`;
    } else if (isPercentage) {
      // When the caller supplies a totalOverride for a percentage row, it is
      // already the correct annual figure (e.g. annual EBITDA / annual rental)
      // and should be rendered as-is. Otherwise fall back to the per-month
      // average, preserving the original behavior for rows like split %.
      const displayTotal =
        typeof totalOverride === "number" && !isNaN(totalOverride) ? total : total / 12;
      return `${displayTotal.toFixed(percentageDecimals)}%`;
    } else if (formatType === "managementSplit") {
      // For management split, calculate average percentage or use default
      const avgMode = monthModes 
        ? Object.values(monthModes).reduce((sum, mode) => sum + (mode === 70 ? 30 : 50), 0) / 12 // 30:70 split when mode is 70
        : 50;
      return `$ ${total.toFixed(2)}(${Math.round(avgMode)}%)`;
    } else if (formatType === "ownerSplit") {
      // Owner split: $ {total.toFixed(2)}
      return `$ ${total.toFixed(2)}`;
    } else if (isInteger) {
      // Integer values (like trips, days): just the number
      return total.toString();
    } else {
      // All other currency values: $ {total.toFixed(2)}
      return `$ ${total.toFixed(2)}`;
    }
  };

  return (
    <tr className={cn(
      "border-b border-border",
      isTotal && "bg-background font-semibold"
    )}>
      <td className="md:sticky md:left-0 md:z-20 bg-card px-2 py-1 text-left text-muted-foreground border-r border-border text-xs" title={label}>
        <span className="truncate block">{label}</span>
      </td>
      {values.map((value, i) => {
        const month = i + 1;
        // Ensure value is a number and handle null/undefined
        const cellValue = typeof value === 'number' && !isNaN(value) ? value : 0;
        // Determine if this specific month is editable
        const isMonthEditable = isReadOnly ? false : (isEditablePerMonth ? isEditablePerMonth(month) : effectiveIsEditable);
        
        return (
          <td 
            key={month} 
            className="border-l border-border px-1 py-1 text-right"
          >
            {category && field && isMonthEditable ? (
              showAmountAndPercentage && percentageValues ? (
                // For split rows, edit the percentage value
                <>
                  <div className="text-xs text-right">
                    <span className={cn(cellValue === 0 && "text-gray-600")}>
                      ${cellValue.toFixed(2)}
                    </span>
                  </div>
                  <EditableCell
                    value={percentageValues[month - 1] || 0}
                    month={month}
                    category={category}
                    field={field}
                    isEditable={effectiveIsEditable}
                    isInteger={false}
                    isPercentage={true}
                  />
                </>
              ) : (
                <EditableCell
                  value={cellValue}
                  month={month}
                  category={category}
                  field={field}
                  isEditable={effectiveIsEditable}
                  isInteger={isInteger}
                  isPercentage={isPercentage}
                />
              )
            ) : (
              <span className={cn("text-xs text-right block", cellValue === 0 && "text-gray-600")}>
                {formatValue(cellValue, month)}
              </span>
            )}
          </td>
        );
      })}
      {!hideTotal && (
        <td className={cn(
          "md:sticky md:right-0 md:z-20 border-l border-border px-1 py-1 text-right text-foreground font-bold text-xs",
          isTotal ? "bg-background" : "bg-card"
        )}>
          {formatTotal()}
        </td>
      )}
    </tr>
  );
}
