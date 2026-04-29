                                                                                                                                                                                import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Plus, Image as ImageIcon, ChevronDown, ChevronRight, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { GraphsChartsReportSection } from "@/pages/admin/components/GraphsChartsReportSection";
import type { IncomeExpenseData } from "@/pages/admin/income-expenses/types";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const generateMonths = (year: string): string[] => {
  const yearNum = parseInt(year, 10);
  return [
    `Jan ${yearNum}`,
    `Feb ${yearNum}`,
    `Mar ${yearNum}`,
    `Apr ${yearNum}`,
    `May ${yearNum}`,
    `Jun ${yearNum}`,
    `Jul ${yearNum}`,
    `Aug ${yearNum}`,
    `Sep ${yearNum}`,
    `Oct ${yearNum}`,
    `Nov ${yearNum}`,
    `Dec ${yearNum}`,
  ];
};

// Helper to get value by month from income-expense data
const getMonthValue = (arr: any[], month: number, field: string): number => {
  if (!arr || !Array.isArray(arr)) return 0;
  const item = arr.find((x) => x && x.month === month);
  if (!item) return 0;
  const value = item[field];
  if (value === null || value === undefined) return 0;
  const numValue = Number(value);
  return isNaN(numValue) ? 0 : numValue;
};

// Helper to calculate total from array of values
const calculateTotal = (values: number[]): number => {
  return values.reduce((sum, val) => sum + val, 0);
};

export default function EarningsPage() {
  const [, params] = useRoute("/admin/cars/:id/earnings");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [expandedSections, setExpandedSections] = useState({
    managementOwner: true,
    incomeExpenses: true,
    history: true,
    rentalValue: true,
    directDelivery: true,
    cogs: true,
    parkingFeeLabor: true,
    parkingAverageQB: true,
    reimbursedBills: true,
  });
  const [uploadingChart, setUploadingChart] = useState<{ [month: number]: boolean }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const months = generateMonths(selectedYear);

  // Fetch user data to check if admin or client
  const { data: userData } = useQuery<{ user?: { isAdmin?: boolean; isClient?: boolean } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const isAdmin = userData?.user?.isAdmin === true;

  // Fetch car data
  const { data: carData, isLoading: isCarLoading, error: carError } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const car = carData?.data;

  // Fetch income-expenses data
  const { data: incomeExpenseData, isLoading: isIncomeExpenseLoading } = useQuery<{
    success: boolean;
    data: IncomeExpenseData;
  }>({
    queryKey: ["/api/income-expense", carId, selectedYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(
        buildApiUrl(`/api/income-expense/${carId}/${selectedYear}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        // Return empty data if not found
        return { success: true, data: null as any };
      }
      return response.json();
    },
    enabled: !!carId && !!selectedYear,
    retry: false,
  });

  const incomeExpenseDataValue = incomeExpenseData?.data;

  // Fetch previous year December data for January calculation
  const previousYear = String(parseInt(selectedYear) - 1);
  const { data: previousYearData } = useQuery<{
    success: boolean;
    data: IncomeExpenseData;
  }>({
    queryKey: ["/api/income-expense", carId, previousYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(
        buildApiUrl(`/api/income-expense/${carId}/${previousYear}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        // If previous year data doesn't exist, return empty data
        return { success: true, data: null as any };
      }
      return response.json();
    },
    retry: false,
    enabled: !!carId && !!selectedYear,
  });

  const prevYearDecData = previousYearData?.data;

  // Fetch previous year's dynamic subcategories separately (they might not be in the main API response)
  const { data: prevYearDynamicSubcategories } = useQuery<{
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  }>({
    queryKey: ["/api/income-expense/dynamic-subcategories", carId, previousYear],
    queryFn: async () => {
      if (!carId || !previousYear) return { directDelivery: [], cogs: [], parkingFeeLabor: [], reimbursedBills: [] };
      
      const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
        'directDelivery',
        'cogs',
        'parkingFeeLabor',
        'reimbursedBills',
      ];
      
      const promises = categories.map(async (categoryType) => {
        try {
          const response = await fetch(
            buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${previousYear}/${categoryType}`),
            { credentials: "include" }
          );
          if (response.ok) {
            const result = await response.json();
            return { categoryType, data: result.data || [] };
          }
          return { categoryType, data: [] };
        } catch (error) {
          console.error(`Error fetching ${categoryType} subcategories:`, error);
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
    enabled: !!carId && !!selectedYear,
  });

  // Fetch dynamic subcategories
  const { data: dynamicSubcategoriesData } = useQuery<{
    success: boolean;
    data: {
      directDelivery: any[];
      cogs: any[];
      parkingFeeLabor: any[];
      reimbursedBills: any[];
    };
  }>({
    queryKey: ["/api/income-expense/dynamic-subcategories", carId, selectedYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
        'directDelivery',
        'cogs',
        'parkingFeeLabor',
        'reimbursedBills',
      ];
      
      const promises = categories.map(async (categoryType) => {
        try {
          const response = await fetch(
            buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${selectedYear}/${categoryType}`),
            { credentials: "include" }
          );
          if (response.ok) {
            const result = await response.json();
            return { categoryType, data: result.data || [] };
          }
          return { categoryType, data: [] };
        } catch (error) {
          console.error(`Error fetching ${categoryType} subcategories:`, error);
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
      
      return { success: true, data: subcategories };
    },
    enabled: !!carId && !!selectedYear,
    retry: false,
  });

  const dynamicSubcategories = dynamicSubcategoriesData?.data || {
    directDelivery: [],
    cogs: [],
    parkingFeeLabor: [],
    reimbursedBills: [],
  };

  // Get month modes and ski racks owner from income expense data
  const monthModes = incomeExpenseDataValue?.formulaSetting?.monthModes || {};
  const skiRacksOwner = incomeExpenseDataValue?.formulaSetting?.skiRacksOwner || {};

  // Fetch onboarding data for additional car info
  const { data: onboardingData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const url = buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, data: null };
        }
        throw new Error("Failed to fetch onboarding");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.success ? onboardingData?.data : null;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }));
  };

  // Helper functions to calculate totals from income-expense data (same as IncomeExpenseTable)
  // Helper to get total operating expense (Direct Delivery) for a month (including dynamic subcategories)
  const getTotalDirectDeliveryForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue?.directDelivery || [], month, "laborCarCleaning") +
      getMonthValue(incomeExpenseDataValue?.directDelivery || [], month, "laborDelivery") +
      getMonthValue(incomeExpenseDataValue?.directDelivery || [], month, "parkingAirport") +
      getMonthValue(incomeExpenseDataValue?.directDelivery || [], month, "parkingLot") +
      getMonthValue(incomeExpenseDataValue?.directDelivery || [], month, "uberLyftLime")
    );
    const dynamicTotal = dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get total operating expense (COGS) for a month (including dynamic subcategories)
  const getTotalCogsForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "autoBodyShopWreck") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "alignment") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "battery") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "brakes") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "carPayment") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "carInsurance") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "carSeats") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "cleaningSuppliesTools") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "emissions") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "gpsSystem") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "keyFob") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "laborCleaning") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "licenseRegistration") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "mechanic") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "oilLube") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "parts") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "skiRacks") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "tickets") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "tiredAirStation") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "tires") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "towingImpoundFees") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "uberLyftLime") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "windshield") +
      getMonthValue(incomeExpenseDataValue?.cogs || [], month, "wipers")
    );
    const dynamicTotal = dynamicSubcategories.cogs.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get total reimbursed bills for a month (including dynamic subcategories)
  const getTotalReimbursedBillsForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "electricReimbursed") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "electricNotReimbursed") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "gasReimbursed") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "gasNotReimbursed") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "gasServiceRun") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "parkingAirport") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "uberLyftLimeNotReimbursed") +
      getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], month, "uberLyftLimeReimbursed")
    );
    const dynamicTotal = dynamicSubcategories.reimbursedBills.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get value from previous year data by month
  const getPrevYearValue = (arr: any[], month: number, field: string): number => {
    if (!arr || !Array.isArray(arr)) return 0;
    const item = arr.find((x) => x && x.month === month);
    if (!item) return 0;
    const value = item[field];
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
    // Include dynamic subcategories from previous year
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
    // Include dynamic subcategories from previous year
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

  // Helper to get total parking fee & labor cleaning from previous year by month (including dynamic subcategories)
  const getPrevYearTotalParkingFeeLabor = (month: number): number => {
    if (!prevYearDecData) return 0;
    const data = prevYearDecData;
    const fixedTotal = (
      getPrevYearValue(data.parkingFeeLabor || [], month, "glaParkingFee") +
      getPrevYearValue(data.parkingFeeLabor || [], month, "laborCleaning")
    );
    // Include dynamic subcategories from previous year
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

  // Calculate negative balance carry over for previous year (recursive)
  // Uses the same formulas as calculateNegativeBalanceCarryOver but for previous year data
  // Uses CURRENT month's mode (not previous month's mode)
  const calculatePrevYearNegativeBalance = (month: number): number => {
    if (!prevYearDecData) return 0;
    
    const prevYear = parseInt(selectedYear, 10) - 1;
    
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
      calculation = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevGasPrepaidIncome 
                   - prevSmokingFines - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome 
                   - prevTotalDirectDelivery - prevTotalCogs + prevNegativeBalanceCarryOver;
      
      // If calculation > 0, return 0; otherwise return calculation
      return calculation > 0 ? 0 : calculation;
    }
  };

  // Calculate Negative Balance Carry Over (exact copy from IncomeExpenseTable)
  const calculateNegativeBalanceCarryOver = (month: number): number => {
    const currentYear = parseInt(selectedYear, 10);
    
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
      prevRentalIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "rentalIncome");
      prevDeliveryIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "deliveryIncome");
      prevElectricPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "electricPrepaidIncome");
      prevSmokingFines = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "smokingFines");
      prevGasPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "gasPrepaidIncome");
      prevSkiRacksIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "skiRacksIncome");
      prevMilesIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "milesIncome");
      prevChildSeatIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "childSeatIncome");
      prevCoolersIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "coolersIncome");
      prevInsuranceWreckIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "insuranceWreckIncome");
      prevOtherIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "otherIncome");
      
      // Use the calculated value from previous month (recursive call)
      prevNegativeBalanceCarryOver = calculateNegativeBalanceCarryOver(prevMonth);
      
      prevTotalDirectDelivery = getTotalDirectDeliveryForMonth(prevMonth);
      prevTotalCogs = getTotalCogsForMonth(prevMonth);
      prevTotalParkingFeeLabor = getTotalParkingFeeLaborForMonth(prevMonth);
      prevCarOwnerSplitPercent = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], prevMonth, "carOwnerSplit") || 0;
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
      //   [return calculation]
      // )
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

  // Helper to get total parking fee & labor for a month (including dynamic subcategories)
  const getTotalParkingFeeLaborForMonth = (month: number): number => {
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue?.parkingFeeLabor || [], month, "glaParkingFee") +
      getMonthValue(incomeExpenseDataValue?.parkingFeeLabor || [], month, "laborCleaning")
    );
    const dynamicTotal = dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
      const monthValue = subcat.values.find((v: any) => v.month === month);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Calculate Car Management Split (exact copy from IncomeExpenseTable)
  const calculateCarManagementSplit = (month: number): number => {
    // Use stored percentage, default to 0 if not set (independent of car owner split)
    const storedPercent = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "carManagementSplit") || 0;
    const mgmtPercent = storedPercent / 100; // Split percentage for management
    
    const rentalIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "rentalIncome");
    const deliveryIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "deliveryIncome");
    const electricPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "electricPrepaidIncome");
    const smokingFines = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "smokingFines");
    const gasPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "gasPrepaidIncome");
    const skiRacksIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "skiRacksIncome");
    const milesIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "milesIncome");
    const childSeatIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "childSeatIncome");
    const coolersIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "coolersIncome");
    const insuranceWreckIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "insuranceWreckIncome");
    const otherIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "otherIncome");
    // Use calculated Negative Balance Carry Over (January 2019 will be 0, other Januaries use previous year's December)
    const negativeBalanceCarryOver = calculateNegativeBalanceCarryOver(month);
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    const totalReimbursedBills = getTotalReimbursedBillsForMonth(month);
    const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(month);
    
    const currentYear = parseInt(selectedYear, 10);
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

  // Calculate Car Owner Split (exact copy from IncomeExpenseTable)
  const calculateCarOwnerSplit = (month: number): number => {
    // Use stored percentage, default to 0 if not set (independent of car management split)
    const storedPercent = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "carOwnerSplit") || 0;
    const ownerPercent = storedPercent / 100; // Split percentage for owner
    
    const rentalIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "rentalIncome");
    const deliveryIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "deliveryIncome");
    const electricPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "electricPrepaidIncome");
    const smokingFines = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "smokingFines");
    const gasPrepaidIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "gasPrepaidIncome");
    const skiRacksIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "skiRacksIncome");
    const milesIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "milesIncome");
    const childSeatIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "childSeatIncome");
    const coolersIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "coolersIncome");
    const insuranceWreckIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "insuranceWreckIncome");
    const otherIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "otherIncome");
    // Use calculated Negative Balance Carry Over (January 2019 will be 0, other Januaries use previous year's December)
    const negativeBalanceCarryOver = calculateNegativeBalanceCarryOver(month);
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(month);
    
    const currentYear = parseInt(selectedYear, 10);
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

  // Calculate Car Management Total Expenses (exact copy from IncomeExpenseTable)
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
    const storedMgmtPercent = Number(getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "carManagementSplit")) || 0;
    const mgmtPercent = storedMgmtPercent / 100; // Convert percentage to decimal
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(month);
    const totalCogs = getTotalCogsForMonth(month);
    
    return totalReimbursedBills + ((totalDirectDelivery + totalCogs) * mgmtPercent);
  };

  // Calculate Car Owner Total Expenses (exact copy from IncomeExpenseTable)
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
      const storedOwnerPercent = Number(getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], month, "carOwnerSplit")) || 0;
      const ownerPercent = storedOwnerPercent / 100; // Convert percentage to decimal
      return (totalDirectDelivery + totalCogs) * ownerPercent;
    }
  };

  // Fetch Turo earnings chart images
  const { data: chartImagesData, refetch: refetchChartImages } = useQuery<{
    success: boolean;
    data: { [month: number]: string };
  }>({
    queryKey: ["/api/earnings/charts", carId, selectedYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(
        buildApiUrl(`/api/earnings/charts/${carId}/${selectedYear}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: {} };
        }
        throw new Error("Failed to fetch chart images");
      }
      return response.json();
    },
    enabled: !!carId && !!selectedYear,
    retry: false,
  });

  const chartImages = chartImagesData?.data || {};

  // Fetch rental income uploaded images for all months (to display in Turo Earnings section)
  const { data: rentalIncomeImagesData, refetch: refetchRentalIncomeImages } = useQuery<{
    [month: number]: { id: string; url: string; filename: string }[];
  }>({
    queryKey: ["/api/income-expense/images/rental", carId, selectedYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const monthPromises = Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
        const url = buildApiUrl(
          `/api/income-expense/images?carId=${carId}&year=${selectedYear}&month=${month}&category=income&field=rentalIncome`
        );
        const response = await fetch(url, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          return { month, images: data.images || data.data?.images || [] };
        }
        return { month, images: [] };
      });
      const results = await Promise.all(monthPromises);
      const imagesByMonth: { [month: number]: { id: string; url: string; filename: string }[] } = {};
      results.forEach(({ month, images }) => {
        imagesByMonth[month] = images;
      });
      return imagesByMonth;
    },
    enabled: !!carId && !!selectedYear,
    retry: false,
  });

  const rentalIncomeImages = rentalIncomeImagesData || {};
  const [previewRentalImage, setPreviewRentalImage] = useState<string | null>(null);

  // Handle chart image upload
  const handleChartUpload = async (month: number, file: File) => {
    if (!carId) return;

    setUploadingChart((prev) => ({ ...prev, [month]: true }));
    try {
      const formData = new FormData();
      formData.append("chart", file);
      formData.append("month", month.toString());
      formData.append("year", selectedYear);

      const response = await fetch(buildApiUrl(`/api/earnings/charts/${carId}`), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload chart");
      }

      const result = await response.json();
      
      // Refresh chart images
      await refetchChartImages();
      
      toast({
        title: "Success",
        description: result.message || "Chart uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload chart",
        variant: "destructive",
      });
    } finally {
      setUploadingChart((prev) => ({ ...prev, [month]: false }));
    }
  };

  // Handle chart image delete
  const handleChartDelete = async (month: number) => {
    if (!carId) return;

    if (!confirm(`Are you sure you want to delete the chart for ${MONTHS[month - 1]}?`)) {
      return;
    }

    try {
      const response = await fetch(
        buildApiUrl(`/api/earnings/charts/${carId}/${selectedYear}/${month}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete chart");
      }

      // Refresh chart images
      await refetchChartImages();
      
      toast({
        title: "Success",
        description: "Chart deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete chart",
        variant: "destructive",
      });
    }
  };

  if (isCarLoading || isIncomeExpenseLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (carError || !car) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
            className="mt-4 text-[#B8860B] hover:text-[#9A7209] hover:underline font-semibold"
          >
            ← Back to View Car
          </button>
        </div>
      </AdminLayout>
    );
  }

  const carName = car.makeModel || `${car.year || ""} ${car.vin}`.trim();
  const ownerName = car.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";
  const ownerContact = car.owner?.phone || "N/A";
  const ownerEmail = car.owner?.email || "N/A";
  const fuelType = onboarding?.fuelType || car.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car.tireSize || "N/A";
  const oilType = onboarding?.oilType || car.oilType || "N/A";

  return (
    <AdminLayout>
      <div className="flex flex-col w-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to View Car</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Earnings</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Car and Owner Information Header */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Car Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Car Name: </span>
                  <span className="text-foreground text-xs sm:text-sm break-words">{carName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">VIN #: </span>
                  <span className="text-foreground font-mono text-xs sm:text-sm break-all">{car.vin}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">License: </span>
                  <span className="text-foreground text-xs sm:text-sm">{car.licensePlate || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Owner Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Name: </span>
                  {car?.clientId ? (
                    <button
                      onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-xs sm:text-sm break-words cursor-pointer font-semibold"
                    >
                      {ownerName}
                    </button>
                  ) : (
                  <span className="text-[#B8860B] text-xs sm:text-sm break-words font-semibold">{ownerName}</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Contact #: </span>
                  <span className="text-foreground text-xs sm:text-sm">{ownerContact}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Email: </span>
                  <span className="text-foreground text-xs sm:text-sm break-all">{ownerEmail}</span>
                </div>
              </div>
            </div>

            {/* Car Specifications */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Specifications</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Fuel/Gas: </span>
                  <span className="text-foreground text-xs sm:text-sm">{fuelType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Tire Size: </span>
                  <span className="text-foreground text-xs sm:text-sm">{tireSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Oil Type: </span>
                  <span className="text-foreground text-xs sm:text-sm">{oilType}</span>
                </div>
              </div>
            </div>

            {/* Turo Links */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Turo Links</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {car.turoLink && (
                  <div>
                    <a
                      href={car.turoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline text-sm flex items-center gap-1 font-medium"
                    >
                      Turo Link: View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {car.adminTuroLink && (
                  <div>
                    <a
                      href={car.adminTuroLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline text-sm flex items-center gap-1 font-medium"
                    >
                      Admin Turo Link: View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {!car.turoLink && !car.adminTuroLink && (
                  <span className="text-muted-foreground text-sm">No Turo links available</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Earnings Header with Year Filter */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif text-primary italic">Earnings</h1>
          <div className="w-[150px]">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
                <SelectItem value="2021">2021</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Earnings Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="w-full h-[600px] overflow-y-auto overflow-x-auto">
            <table className="border-collapse w-full table-fixed" style={{ minWidth: '1200px' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                {months.map((_, idx) => <col key={idx} style={{ width: '5.5%' }} />)}
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead className="bg-card">
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-3 py-2 text-sm font-medium text-foreground sticky top-0 left-0 bg-card z-[5] border-r border-border align-middle">
                    Category / Expense
                  </th>
                  {months.map((month, index) => {
                    const monthNum = index + 1;
                    const year = parseInt(selectedYear, 10);
                    const showSkiRacksToggle = year >= 2026;
                    const currentMode = monthModes[monthNum] || 50;
                    const currentSkiRacksOwner = skiRacksOwner[monthNum] || "GLA";
                    const hasSkiRacksIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], monthNum, "skiRacksIncome") > 0;
                    
                    return (
                    <th
                      key={month}
                        className="border-l border-border px-2 py-2 text-center min-w-[100px] sticky top-0 bg-card z-[5] align-middle"
                      >
                        <div className="flex flex-col items-center gap-1 justify-center">
                          <span className="text-foreground text-xs font-medium">{month}</span>
                          <div className="flex items-center justify-center gap-1 h-[24px]">
                            {/* Mode Toggle (Read-only) - Shows 50:50 or 30:70 split mode */}
                            <div
                              className={cn(
                                "px-3 py-0.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-default",
                                currentMode === 50 
                                  ? "bg-green-600 text-white" 
                                  : "bg-blue-600 text-white"
                              )}
                              title={`Rate mode: ${currentMode === 50 ? "50:50 (green)" : "30:70 (blue)"} (Read-only)`}
                            >
                              {currentMode}
                            </div>
                            {/* Ski Racks Owner Toggle (Read-only) - Only show for years >= 2026 and when ski racks income exists */}
                            {showSkiRacksToggle && hasSkiRacksIncome && (
                              <div
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-semibold transition-all duration-200 min-w-[24px] cursor-default",
                                  currentSkiRacksOwner === "GLA"
                                    ? "bg-purple-600 text-white"
                                    : "bg-orange-600 text-white"
                                )}
                                title={`Ski racks owner: ${currentSkiRacksOwner === "GLA" ? "Management/GLA (purple)" : "Owner (orange)"} (Read-only)`}
                              >
                                {currentSkiRacksOwner === "GLA" ? "M" : "O"}
                              </div>
                            )}
                          </div>
                        </div>
                    </th>
                    );
                  })}
                  <th className="text-right px-2 py-2 text-sm font-medium text-foreground sticky top-0 bg-card z-[5] border-l border-border whitespace-nowrap align-middle">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="relative">
                {/* CAR MANAGEMENT OWNER SPLIT */}
                <CategorySection
                  title="CAR MANAGEMENT OWNER SPLIT"
                  isExpanded={expandedSections.managementOwner}
                  onToggle={() => toggleSection("managementOwner")}
                >
                  <TableRow
                    label="Car Management Split"
                    values={MONTHS.map((_, i) => calculateCarManagementSplit(i + 1))}
                  />
                  <TableRow
                    label="Car Owner Split"
                    values={MONTHS.map((_, i) => calculateCarOwnerSplit(i + 1))}
                  />
                </CategorySection>

                {/* INCOME AND EXPENSES */}
                <CategorySection
                  title="INCOME AND EXPENSES"
                  isExpanded={expandedSections.incomeExpenses}
                  onToggle={() => toggleSection("incomeExpenses")}
                >
                  <TableRow
                    label="Rental Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "rentalIncome"))}
                  />
                  <TableRow
                    label="Delivery Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "deliveryIncome"))}
                  />
                  <TableRow
                    label="Electric Prepaid Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "electricPrepaidIncome"))}
                  />
                  <TableRow
                    label="Smoking Fines"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "smokingFines"))}
                  />
                  <TableRow
                    label="Gas Prepaid Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "gasPrepaidIncome"))}
                  />
                  <TableRow
                    label="Ski Racks Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "skiRacksIncome"))}
                  />
                  <TableRow
                    label="Miles Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "milesIncome"))}
                  />
                  <TableRow
                    label="Child Seat Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "childSeatIncome"))}
                  />
                  <TableRow
                    label="Coolers Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "coolersIncome"))}
                  />
                  <TableRow
                    label="Income Insurance and Client Wrecks"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "insuranceWreckIncome"))}
                  />
                  <TableRow
                    label="Other Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "otherIncome"))}
                  />
                  <TableRow
                    label="Negative Balance Carry Over"
                    values={MONTHS.map((_, i) => calculateNegativeBalanceCarryOver(i + 1))}
                  />
                </CategorySection>

                {/* OPERATING EXPENSE (Direct Delivery) */}
                <CategorySection
                  title="OPERATING EXPENSE (DIRECT DELIVERY)"
                  isExpanded={expandedSections.directDelivery}
                  onToggle={() => toggleSection("directDelivery")}
                >
                  <TableRow
                    label="Labor - Cleaning"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.directDelivery || [], i + 1, "laborCarCleaning"))}
                  />
                  <TableRow
                    label="Labor - Delivery"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.directDelivery || [], i + 1, "laborDelivery"))}
                  />
                  <TableRow
                    label="Parking - Airport"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.directDelivery || [], i + 1, "parkingAirport"))}
                  />
                  <TableRow
                    label="Parking - Lot"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.directDelivery || [], i + 1, "parkingLot"))}
                  />
                  <TableRow
                    label="Uber/Lyft/Lime"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.directDelivery || [], i + 1, "uberLyftLime"))}
                  />
                  <TableRow
                    label="TOTAL OPERATING EXPENSE (Direct Delivery)"
                    values={MONTHS.map((_, i) => getTotalDirectDeliveryForMonth(i + 1))}
                    isTotal
                  />
                </CategorySection>

                {/* OPERATING EXPENSE (COGS - Per Vehicle) */}
                <CategorySection
                  title="OPERATING EXPENSE (COGS - PER VEHICLE)"
                  isExpanded={expandedSections.cogs}
                  onToggle={() => toggleSection("cogs")}
                >
                  <TableRow
                    label="Auto Body Shop / Wreck"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "autoBodyShopWreck"))}
                  />
                  <TableRow
                    label="Alignment"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "alignment"))}
                  />
                  <TableRow
                    label="Battery"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "battery"))}
                  />
                  <TableRow
                    label="Brakes"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "brakes"))}
                  />
                  <TableRow
                    label="Car Payment"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "carPayment"))}
                  />
                  <TableRow
                    label="Car Insurance"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "carInsurance"))}
                  />
                  <TableRow
                    label="Car Seats"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "carSeats"))}
                  />
                  <TableRow
                    label="Cleaning Supplies / Tools"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "cleaningSuppliesTools"))}
                  />
                  <TableRow
                    label="Emissions"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "emissions"))}
                  />
                  <TableRow
                    label="GPS System"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "gpsSystem"))}
                  />
                  <TableRow
                    label="Key & Fob"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "keyFob"))}
                  />
                  <TableRow
                    label="Labor - Cleaning"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "laborCleaning"))}
                  />
                  <TableRow
                    label="License & Registration"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "licenseRegistration"))}
                  />
                  <TableRow
                    label="Mechanic"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "mechanic"))}
                  />
                  <TableRow
                    label="Oil/Lube"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "oilLube"))}
                  />
                  <TableRow
                    label="Parts"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "parts"))}
                  />
                  <TableRow
                    label="Ski Racks"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "skiRacks"))}
                  />
                  <TableRow
                    label="Tickets & Tolls"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "tickets"))}
                  />
                  <TableRow
                    label="Tired Air Station"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "tiredAirStation"))}
                  />
                  <TableRow
                    label="Tires"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "tires"))}
                  />
                  <TableRow
                    label="Towing / Impound Fees"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "towingImpoundFees"))}
                  />
                  <TableRow
                    label="Uber/Lyft/Lime"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "uberLyftLime"))}
                  />
                  <TableRow
                    label="Windshield"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "windshield"))}
                  />
                  <TableRow
                    label="Wipers"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.cogs || [], i + 1, "wipers"))}
                  />
                  <TableRow
                    label="TOTAL OPERATING EXPENSE (COGS - Per Vehicle)"
                    values={MONTHS.map((_, i) => getTotalCogsForMonth(i + 1))}
                    isTotal
                  />
                </CategorySection>

                {/* GLA PARKING FEE & LABOR CLEANING */}
                <CategorySection
                  title="GLA PARKING FEE & LABOR CLEANING"
                  isExpanded={expandedSections.parkingFeeLabor}
                  onToggle={() => toggleSection("parkingFeeLabor")}
                >
                  <TableRow
                    label="GLA Parking Fee"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.parkingFeeLabor || [], i + 1, "glaParkingFee"))}
                  />
                  <TableRow
                    label="Labor - Cleaning"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.parkingFeeLabor || [], i + 1, "laborCleaning"))}
                  />
                </CategorySection>

                {/* REIMBURSED AND NON-REIMBURSED BILLS - Only visible to admin */}
                {isAdmin && (
                  <CategorySection
                    title="REIMBURSED AND NON-REIMBURSED BILLS"
                    isExpanded={expandedSections.reimbursedBills}
                    onToggle={() => toggleSection("reimbursedBills")}
                  >
                    <TableRow
                      label="Electric - Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "electricReimbursed"))}
                    />
                    <TableRow
                      label="Electric - Not Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "electricNotReimbursed"))}
                    />
                    <TableRow
                      label="Gas - Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "gasReimbursed"))}
                    />
                    <TableRow
                      label="Gas - Not Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "gasNotReimbursed"))}
                    />
                    <TableRow
                      label="Gas - Service Run"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "gasServiceRun"))}
                    />
                    <TableRow
                      label="Parking Airport"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "parkingAirport"))}
                    />
                    <TableRow
                      label="Uber/Lyft/Lime - Not Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "uberLyftLimeNotReimbursed"))}
                    />
                    <TableRow
                      label="Uber/Lyft/Lime - Reimbursed"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], i + 1, "uberLyftLimeReimbursed"))}
                    />
                    <TableRow
                      label="TOTAL REIMBURSED AND NON-REIMBURSED BILLS"
                      values={MONTHS.map((_, i) => getTotalReimbursedBillsForMonth(i + 1))}
                      isTotal
                    />
                  </CategorySection>
                )}

                {/* HISTORY */}
                <CategorySection
                  title="HISTORY"
                  isExpanded={expandedSections.history}
                  onToggle={() => toggleSection("history")}
                >
                  <TableRow
                    label="Days Rented"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.history || [], i + 1, "daysRented"))}
                    isInteger
                  />
                  {isAdmin && (
                    <TableRow
                      label="Cars Available For Rent"
                      values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.history || [], i + 1, "carsAvailableForRent"))}
                      isInteger
                    />
                  )}
                  <TableRow
                    label="Trips Taken"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.history || [], i + 1, "tripsTaken"))}
                    isInteger
                  />
                </CategorySection>

                {/* CAR RENTAL VALUE PER MONTH */}
                <CategorySection
                  title="CAR RENTAL VALUE PER MONTH"
                  isExpanded={expandedSections.rentalValue}
                  onToggle={() => toggleSection("rentalValue")}
                >
                  <TableRow
                    label="Total Car Rental Income"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], i + 1, "rentalIncome"))}
                  />
                  <TableRow
                    label="Trips Taken"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.history || [], i + 1, "tripsTaken"))}
                    isInteger
                  />
                  <TableRow
                    label="Ave Per Rental Per Trips Taken"
                    values={MONTHS.map((_, i) => {
                      const monthNum = i + 1;
                      const rental = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], monthNum, "rentalIncome");
                      const trips = getMonthValue(incomeExpenseDataValue?.history || [], monthNum, "tripsTaken");
                      return trips > 0 ? rental / trips : 0;
                    })}
                  />
                </CategorySection>

                {/* PARKING AIRPORT AVERAGE PER TRIP - GLA */}
                <CategorySection
                  title="PARKING AIRPORT AVERAGE PER TRIP - GLA"
                  isExpanded={expandedSections.parkingAverageQB}
                  onToggle={() => toggleSection("parkingAverageQB")}
                >
                  <TableRow
                    label="Total Trips Taken"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.history || [], i + 1, "tripsTaken"))}
                    isInteger
                  />
                  <TableRow
                    label="Total Parking Airport"
                    values={MONTHS.map((_, i) => getMonthValue(incomeExpenseDataValue?.parkingAirportQB || [], i + 1, "totalParkingAirport"))}
                  />
                  <TableRow
                    label="Average per trip"
                    values={MONTHS.map((_, i) => {
                      const monthNum = i + 1;
                      const parking = getMonthValue(incomeExpenseDataValue?.parkingAirportQB || [], monthNum, "totalParkingAirport");
                      const trips = getMonthValue(incomeExpenseDataValue?.history || [], monthNum, "tripsTaken");
                      return trips > 0 ? parking / trips : 0;
                    })}
                  />
                </CategorySection>
              </tbody>
            </table>
            <div className="h-8 pb-4"></div>
          </div>
        </div>

        {/* Turo Earnings Chart Section */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-muted-foreground">
                Turo Earnings, Upcoming Earnings, Reimbursements, Missed Earnings Chart
              </h2>
            </div>

            {/* Monthly Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {months.map((monthLabel, index) => {
                const monthNum = index + 1;
                const rentalIncome = getMonthValue(incomeExpenseDataValue?.incomeExpenses || [], monthNum, "rentalIncome");
                const chartImageUrl = chartImages[monthNum];
                const isUploading = uploadingChart[monthNum];
                
                // Calculate chart data for auto-generation
                // Note: When AI extraction is ready, add "Upcoming Earnings" and "Missed Earnings" fields here
                const reimbursedAmount = (
                  getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], monthNum, "electricReimbursed") +
                  getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], monthNum, "gasReimbursed") +
                  getMonthValue(incomeExpenseDataValue?.reimbursedBills || [], monthNum, "uberLyftLimeReimbursed")
                );
                
                // TODO: Add these when AI extraction provides the data:
                // - upcomingEarnings: from AI-extracted data
                // - missedEarnings: from AI-extracted data
                const upcomingEarnings = 0; // Placeholder - will be populated from AI extraction
                const missedEarnings = 0; // Placeholder - will be populated from AI extraction
                
                const chartData = [
                  {
                    name: "Turo Earnings",
                    value: rentalIncome,
                  },
                  {
                    name: "Reimbursements",
                    value: reimbursedAmount,
                  },
                  ...(upcomingEarnings > 0 ? [{
                    name: "Upcoming Earnings",
                    value: upcomingEarnings,
                  }] : []),
                  ...(missedEarnings > 0 ? [{
                    name: "Missed Earnings",
                    value: missedEarnings,
                  }] : []),
                ];

                const monthRentalImages = rentalIncomeImages[monthNum] || [];

                return (
                <div key={index} className="flex flex-col">
                    {/* Month Label with Rental Income */}
                  <div className="bg-primary text-primary-foreground px-3 py-2 text-sm font-medium rounded-t flex justify-between items-center">
                      <span>{monthLabel}</span>
                      <span className="font-semibold">{formatCurrency(rentalIncome)}</span>
                  </div>
                    
                    {/* Chart Image Area */}
                    <div className={cn("bg-card border border-border relative group min-h-[200px] flex items-center justify-center", monthRentalImages.length > 0 ? "rounded-b-none" : "rounded-b")}>
                      {chartImageUrl ? (
                        <>
                          {/* Manual Upload Override - Show uploaded image */}
                          <img
                            src={chartImageUrl}
                            alt={`Turo Earnings Chart - ${monthLabel}`}
                            className="w-full h-auto max-h-[300px] object-contain"
                          />
                          {/* Delete button on hover */}
                          {isAdmin && (
                            <button
                              onClick={() => handleChartDelete(monthNum)}
                              className="absolute top-2 right-2 bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30 text-foreground p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              title="Delete chart (will show auto-generated chart)"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          {/* Upload overlay for replacing manual upload */}
                          {chartImageUrl && isAdmin && (
                            <label className="absolute inset-0 bg-background bg-opacity-0 hover:bg-opacity-50 transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-b">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleChartUpload(monthNum, file);
                                  }
                                  e.target.value = "";
                                }}
                                disabled={isUploading}
                              />
                              <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80 transition-colors">
                                {isUploading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    <span className="text-sm">Replace Chart</span>
                                  </>
                                )}
                  </div>
                            </label>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Auto-Generated Chart */}
                          <div className="w-full h-full p-4">
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart 
                                data={chartData}
                                margin={{ top: 5, right: 5, left: 5, bottom: 40 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#9ca3af"
                                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                                  angle={-45}
                                  textAnchor="end"
                                  height={60}
                                />
                                <YAxis 
                                  stroke="#9ca3af"
                                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#1a1a1a', 
                                    border: '1px solid #2a2a2a',
                                    borderRadius: '4px',
                                    color: '#fff'
                                  }}
                                  formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar 
                                  dataKey="value"
                                  radius={[4, 4, 0, 0]}
                                  fill="#D3BC8D"
                                />
                              </BarChart>
                            </ResponsiveContainer>
                </div>
                          
                          {/* Upload button overlay for auto-generated chart */}
                          {isAdmin && (
                            <div className="absolute inset-0 bg-background bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-b">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleChartUpload(monthNum, file);
                                    }
                                    e.target.value = "";
                                  }}
                                  disabled={isUploading}
                                />
                                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span className="text-sm">Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4" />
                                      <span className="text-sm">Upload Custom Chart</span>
                                    </>
                                  )}
            </div>
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  {/* Rental Income Uploaded Photos */}
                  {monthRentalImages.length > 0 && (
                    <div className="border border-t-0 border-border rounded-b px-3 py-2 bg-card">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Rental Income Receipts</p>
                      <div className="flex flex-wrap gap-2">
                        {monthRentalImages.map((img) => (
                          <button
                            key={img.id}
                            onClick={() => setPreviewRentalImage(img.url)}
                            className="w-14 h-14 rounded border border-border overflow-hidden hover:border-primary transition-colors flex-shrink-0"
                            title={img.filename}
                          >
                            <img
                              src={img.url}
                              alt={img.filename}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rental Income Image Preview Modal */}
        {previewRentalImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => setPreviewRentalImage(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewRentalImage(null)}
                className="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewRentalImage}
                alt="Rental Income Receipt"
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Graphs and Charts Report Section (moved from Graphs and Charts Report page) */}
        <GraphsChartsReportSection
          className="mb-6"
          incomeExpenseData={incomeExpenseDataValue}
          selectedYear={selectedYear}
          calculateCarManagementSplit={calculateCarManagementSplit}
          calculateCarOwnerSplit={calculateCarOwnerSplit}
          calculateCarManagementTotalExpenses={calculateCarManagementTotalExpenses}
          calculateCarOwnerTotalExpenses={calculateCarOwnerTotalExpenses}
          getMonthValue={getMonthValue}
        />
      </div>
    </AdminLayout>
  );
}

// Helper Components
interface CategorySectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CategorySection({ title, isExpanded, onToggle, children }: CategorySectionProps) {
  return (
    <>
      <tr className="bg-primary">
        <td colSpan={14} className="sticky left-0 z-[3] bg-primary px-3 py-2 border-b border-primary">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onToggle}>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
            <span className="text-sm font-semibold text-white">{title}</span>
          </div>
        </td>
      </tr>
      {isExpanded && children}
    </>
  );
}

interface TableRowProps {
  label: string;
  values: number[];
  isInteger?: boolean;
  isTotal?: boolean;
}

function TableRow({ label, values, isInteger = false, isTotal = false }: TableRowProps) {
  const total = calculateTotal(values);
  // For Negative Balance Carry Over, display absolute value (remove minus sign)
  const isNegativeBalance = label === "Negative Balance Carry Over";
  
  return (
    <tr className={cn(
      "border-b border-border transition-colors",
      isTotal && "bg-background font-semibold"
    )}>
      <td className={cn(
        "px-3 py-2 text-sm sticky left-0 z-[3] border-r border-border",
        isTotal ? "text-primary bg-background" : "text-muted-foreground bg-card"
      )}>
        <span className="whitespace-nowrap">{label}</span>
      </td>
      {values.map((value, i) => {
        const cellValue = typeof value === 'number' && !isNaN(value) ? value : 0;
        // For Negative Balance Carry Over, display in parentheses format for negative values
        // e.g., -3 => (3), -100 => (100), 0 => $0.00
        let displayText: string;
        if (isNegativeBalance && cellValue < 0) {
          displayText = `(${Math.abs(cellValue).toFixed(2)})`;
        } else if (isInteger) {
          displayText = cellValue.toString();
        } else {
          displayText = formatCurrency(cellValue);
        }
        return (
          <td
            key={i}
            className={cn(
              "text-right px-2 py-2 text-sm border-l border-border",
              cellValue !== 0
                ? isTotal ? "text-primary font-semibold" : "text-[#B8860B] font-semibold"
                : "text-muted-foreground"
            )}
          >
            {displayText}
          </td>
        );
      })}
      <td className={cn(
        "text-right px-2 py-2 text-sm font-semibold border-l border-border bg-card sticky right-0 z-[3]",
        isTotal ? "text-primary" : total !== 0 ? "text-[#B8860B]" : "text-muted-foreground"
      )}>
        {isNegativeBalance && total < 0 
          ? `(${Math.abs(total).toFixed(2)})`
          : isInteger 
            ? total.toString() 
            : formatCurrency(total)}
      </td>
    </tr>
  );
}
