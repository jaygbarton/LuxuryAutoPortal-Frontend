import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";

interface Payment {
  payments_aid: number;
  payments_client_id: number;
  payments_status_id: number;
  payments_car_id: number;
  payments_year_month: string;
  payments_amount: number;
  payments_amount_payout: number;
  payments_amount_balance: number;
  payments_reference_number: string;
  payments_invoice_id: string;
  payments_invoice_date: string | null;
  payments_attachment: string | null;
  payments_remarks: string | null;
  payment_status_name: string;
}

interface PaymentStatus {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
  payment_status_is_active: number;
}

interface AddEditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  carId: number;
  clientId: number;
}

export function AddEditPaymentModal({
  isOpen,
  onClose,
  payment,
  carId,
  clientId,
}: AddEditPaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = payment !== null;

  // Form state
  const [yearMonth, setYearMonth] = useState("");
  const [statusId, setStatusId] = useState("");
  const [payable, setPayable] = useState("");
  const [payout, setPayout] = useState("");
  const [balance, setBalance] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch payment statuses
  const { data: statusesData } = useQuery<{
    success: boolean;
    data: PaymentStatus[];
  }>({
    queryKey: ["/api/payment-status"],
    queryFn: async () => {
      const url = buildApiUrl("/api/payment-status");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payment statuses");
      return response.json();
    },
  });

  const statuses = statusesData?.data || [];

  // Extract year and month from yearMonth
  const [year, month] = yearMonth ? yearMonth.split("-").map(Number) : [null, null];

  // Fetch income/expense data to calculate car owner split
  const { data: incomeExpenseData, isLoading: isLoadingIncomeExpense } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/income-expense", carId, year],
    queryFn: async () => {
      if (!year || !carId) throw new Error("Year or Car ID not set");
      const url = buildApiUrl(`/api/income-expense/${carId}/${year}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        // If income/expense not found, return empty data
        return { success: false, data: null };
      }
      return response.json();
    },
    enabled: !!yearMonth && !!carId && !!year,
  });

  // Fetch dynamic subcategories for the year
  const { data: dynamicSubcategoriesData } = useQuery<{
    success: boolean;
    data: {
      directDelivery: any[];
      cogs: any[];
      parkingFeeLabor: any[];
      reimbursedBills: any[];
    };
  }>({
    queryKey: ["/api/income-expense/dynamic-subcategories", carId, year],
    queryFn: async () => {
      if (!carId || !year) throw new Error("Car ID or Year not set");
      const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
        'directDelivery',
        'cogs',
        'parkingFeeLabor',
        'reimbursedBills',
      ];
      
      const promises = categories.map(async (categoryType) => {
        try {
          const response = await fetch(
            buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${year}/${categoryType}`),
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
    enabled: !!yearMonth && !!carId && !!year,
    retry: false,
  });

  const dynamicSubcategories = useMemo(
    () =>
      dynamicSubcategoriesData?.data || {
        directDelivery: [],
        cogs: [],
        parkingFeeLabor: [],
        reimbursedBills: [],
      },
    [dynamicSubcategoriesData?.data]
  );

  // Fetch previous year data for January calculations
  const previousYear = year ? String(year - 1) : null;
  const { data: previousYearData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/income-expense", carId, previousYear],
    queryFn: async () => {
      if (!carId || !previousYear) throw new Error("Car ID or Previous Year not set");
      const response = await fetch(
        buildApiUrl(`/api/income-expense/${carId}/${previousYear}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        return { success: true, data: null };
      }
      return response.json();
    },
    enabled: !!yearMonth && !!carId && !!year && month === 1,
    retry: false,
  });

  const incomeExpenseDataValue = incomeExpenseData?.data;
  const prevYearDecData = previousYearData?.data;
  const monthModes = useMemo(
    () => incomeExpenseDataValue?.formulaSetting?.monthModes || {},
    [incomeExpenseDataValue?.formulaSetting?.monthModes]
  );
  const skiRacksOwner = useMemo(
    () => incomeExpenseDataValue?.formulaSetting?.skiRacksOwner || {},
    [incomeExpenseDataValue?.formulaSetting?.skiRacksOwner]
  );

  // Helper to get value by month from income-expense data
  const getMonthValue = (arr: any[], monthNum: number, field: string): number => {
    if (!arr || !Array.isArray(arr)) return 0;
    const item = arr.find((x) => x && x.month === monthNum);
    if (!item) return 0;
    const value = item[field];
    if (value === null || value === undefined) return 0;
    const numValue = Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Helper to get value from previous year data by month
  const getPrevYearValue = (arr: any[], monthNum: number, field: string): number => {
    if (!arr || !Array.isArray(arr)) return 0;
    const item = arr.find((x) => x && x.month === monthNum);
    if (!item) return 0;
    const value = item[field];
    if (value === null || value === undefined) return 0;
    const numValue = Number(value);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Helper to get total Direct Delivery for a month (including dynamic subcategories)
  const getTotalDirectDeliveryForMonth = (monthNum: number): number => {
    if (!incomeExpenseDataValue) return 0;
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue.directDelivery || [], monthNum, "laborCarCleaning") +
      getMonthValue(incomeExpenseDataValue.directDelivery || [], monthNum, "laborDelivery") +
      getMonthValue(incomeExpenseDataValue.directDelivery || [], monthNum, "parkingAirport") +
      getMonthValue(incomeExpenseDataValue.directDelivery || [], monthNum, "parkingLot") +
      getMonthValue(incomeExpenseDataValue.directDelivery || [], monthNum, "uberLyftLime")
    );
    const dynamicTotal = dynamicSubcategories.directDelivery.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === monthNum);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get total COGS for a month (including dynamic subcategories)
  const getTotalCogsForMonth = (monthNum: number): number => {
    if (!incomeExpenseDataValue) return 0;
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "autoBodyShopWreck") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "alignment") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "battery") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "brakes") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "carPayment") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "carInsurance") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "carSeats") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "cleaningSuppliesTools") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "emissions") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "gpsSystem") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "keyFob") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "laborCleaning") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "licenseRegistration") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "mechanic") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "oilLube") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "parts") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "skiRacks") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "tickets") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "tiredAirStation") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "tires") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "towingImpoundFees") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "uberLyftLime") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "windshield") +
      getMonthValue(incomeExpenseDataValue.cogs || [], monthNum, "wipers")
    );
    const dynamicTotal = dynamicSubcategories.cogs.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === monthNum);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Helper to get total parking fee & labor for a month (including dynamic subcategories)
  const getTotalParkingFeeLaborForMonth = (monthNum: number): number => {
    if (!incomeExpenseDataValue) return 0;
    const fixedTotal = (
      getMonthValue(incomeExpenseDataValue.parkingFeeLabor || [], monthNum, "glaParkingFee") +
      getMonthValue(incomeExpenseDataValue.parkingFeeLabor || [], monthNum, "laborCleaning")
    );
    const dynamicTotal = dynamicSubcategories.parkingFeeLabor.reduce((sum, subcat) => {
      const monthValue = subcat.values?.find((v: any) => v.month === monthNum);
      return sum + (monthValue?.value || 0);
    }, 0);
    return fixedTotal + dynamicTotal;
  };

  // Calculate Negative Balance Carry Over (simplified version for modal)
  const calculateNegativeBalanceCarryOver = (
    monthNum: number,
    visiting: Set<number> = new Set()
  ): number => {
    if (!incomeExpenseDataValue || !year) return 0;
    if (monthNum < 1 || monthNum > 12) return 0;
    if (visiting.has(monthNum)) return 0;
    const currentYear = parseInt(String(year), 10);

    if (currentYear === 2019) return 0;

    const currentMonthMode: 50 | 70 = monthModes[monthNum] || 50;
    
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
    
    if (monthNum === 1 && currentYear > 2019 && prevYearDecData) {
      const prevDec = 12;
      prevRentalIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "rentalIncome");
      prevDeliveryIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "deliveryIncome");
      prevElectricPrepaidIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "electricPrepaidIncome");
      prevSmokingFines = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "smokingFines");
      prevGasPrepaidIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "gasPrepaidIncome");
      prevSkiRacksIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "skiRacksIncome");
      prevMilesIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "milesIncome");
      prevChildSeatIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "childSeatIncome");
      prevCoolersIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "coolersIncome");
      prevInsuranceWreckIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "insuranceWreckIncome");
      prevOtherIncome = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "otherIncome");
      prevCarOwnerSplitPercent = getPrevYearValue(prevYearDecData.incomeExpenses || [], prevDec, "carOwnerSplit") || 0;
      
      // For January, we'll use 0 for negative balance carry over from previous year December
      // (full calculation would require recursive calculation of previous year)
      prevNegativeBalanceCarryOver = 0;
      prevTotalDirectDelivery = 0; // Simplified
      prevTotalCogs = 0; // Simplified
      prevTotalParkingFeeLabor = 0; // Simplified
    } else {
      const prevMonth = monthNum - 1;
      if (prevMonth < 1) return 0;
      prevRentalIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "rentalIncome");
      prevDeliveryIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "deliveryIncome");
      prevElectricPrepaidIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "electricPrepaidIncome");
      prevSmokingFines = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "smokingFines");
      prevGasPrepaidIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "gasPrepaidIncome");
      prevSkiRacksIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "skiRacksIncome");
      prevMilesIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "milesIncome");
      prevChildSeatIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "childSeatIncome");
      prevCoolersIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "coolersIncome");
      prevInsuranceWreckIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "insuranceWreckIncome");
      prevOtherIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "otherIncome");
      prevCarOwnerSplitPercent = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], prevMonth, "carOwnerSplit") || 0;
      const nextVisiting = new Set(visiting);
      nextVisiting.add(monthNum);
      prevNegativeBalanceCarryOver = calculateNegativeBalanceCarryOver(prevMonth, nextVisiting);
      prevTotalDirectDelivery = getTotalDirectDeliveryForMonth(prevMonth);
      prevTotalCogs = getTotalCogsForMonth(prevMonth);
      prevTotalParkingFeeLabor = getTotalParkingFeeLaborForMonth(prevMonth);
    }
    
    const prevCarOwnerSplitDecimal = prevCarOwnerSplitPercent / 100;
    
    let calculation: number;
    
    if (currentMonthMode === 70) {
      const part1 = prevMilesIncome + (prevSmokingFines * 0.1);
      const part2 = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevSmokingFines 
                   - prevGasPrepaidIncome - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome;
      calculation = part1 - prevTotalDirectDelivery - prevTotalCogs - prevTotalParkingFeeLabor 
                   + prevNegativeBalanceCarryOver + (part2 * prevCarOwnerSplitDecimal);
      return calculation > 0 ? 0 : calculation;
    } else {
      calculation = prevRentalIncome - prevDeliveryIncome - prevElectricPrepaidIncome - prevGasPrepaidIncome 
                   - prevSmokingFines - prevMilesIncome - prevSkiRacksIncome - prevChildSeatIncome 
                   - prevCoolersIncome - prevInsuranceWreckIncome - prevOtherIncome 
                   - prevTotalDirectDelivery - prevTotalCogs + prevNegativeBalanceCarryOver;
      return calculation > 0 ? 0 : calculation;
    }
  };

  // Calculate Car Owner Split (same logic as earnings.tsx)
  const calculateCarOwnerSplit = (monthNum: number): number => {
    if (!incomeExpenseDataValue || !year || !monthNum) return 0;
    
    const storedPercent = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "carOwnerSplit") || 0;
    const ownerPercent = storedPercent / 100;
    
    const rentalIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "rentalIncome");
    const deliveryIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "deliveryIncome");
    const electricPrepaidIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "electricPrepaidIncome");
    const smokingFines = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "smokingFines");
    const gasPrepaidIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "gasPrepaidIncome");
    const skiRacksIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "skiRacksIncome");
    const milesIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "milesIncome");
    const childSeatIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "childSeatIncome");
    const coolersIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "coolersIncome");
    const insuranceWreckIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "insuranceWreckIncome");
    const otherIncome = getMonthValue(incomeExpenseDataValue.incomeExpenses || [], monthNum, "otherIncome");
    const negativeBalanceCarryOver = calculateNegativeBalanceCarryOver(monthNum);
    const totalDirectDelivery = getTotalDirectDeliveryForMonth(monthNum);
    const totalCogs = getTotalCogsForMonth(monthNum);
    const totalParkingFeeLabor = getTotalParkingFeeLaborForMonth(monthNum);
    
    const currentYear = parseInt(String(year), 10);
    const mode = monthModes[monthNum] || 50;
    const isYear2026OrLater = currentYear >= 2026;
    const isYear2019To2025 = currentYear >= 2019 && currentYear <= 2025;
    
    if (isYear2026OrLater) {
      if (mode === 50) {
        if (skiRacksIncome === 0) {
          const part1 = milesIncome + (smokingFines * 0.1 + skiRacksIncome * ownerPercent);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        } else if ((skiRacksOwner[monthNum] || "GLA") === "GLA") {
          const part1 = milesIncome + (smokingFines * 0.1);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        } else {
          const part1 = (milesIncome + skiRacksIncome) + (smokingFines * 0.1);
          const part2 = (rentalIncome + negativeBalanceCarryOver - deliveryIncome - electricPrepaidIncome - 
                         gasPrepaidIncome - smokingFines - milesIncome - skiRacksIncome - 
                         childSeatIncome - coolersIncome - insuranceWreckIncome - otherIncome - 
                         totalDirectDelivery - totalCogs) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      } else {
        if (skiRacksIncome === 0) {
          const part1 = (skiRacksIncome * ownerPercent + milesIncome) - totalDirectDelivery - totalCogs - 
                        totalParkingFeeLabor + negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        } else if ((skiRacksOwner[monthNum] || "GLA") === "GLA") {
          const part1 = milesIncome - totalDirectDelivery - totalCogs - totalParkingFeeLabor + 
                        negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        } else {
          const part1 = skiRacksIncome + milesIncome - totalDirectDelivery - totalCogs - 
                        totalParkingFeeLabor + negativeBalanceCarryOver + (smokingFines * 0.1);
          const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                         milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                         insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
          const calculation = part1 + part2;
          return calculation >= 0 ? calculation : 0;
        }
      }
    } else if (isYear2019To2025) {
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
      } else {
        const part1 = milesIncome - totalDirectDelivery - totalCogs - totalParkingFeeLabor + 
                      negativeBalanceCarryOver + (smokingFines * 0.1);
        const part2 = (rentalIncome - deliveryIncome - electricPrepaidIncome - gasPrepaidIncome - 
                       milesIncome - skiRacksIncome - childSeatIncome - coolersIncome - 
                       insuranceWreckIncome - smokingFines - otherIncome) * ownerPercent;
        const calculation = part1 + part2;
        return calculation >= 0 ? calculation : 0;
      }
    }
    
    return 0;
  };

  // Initialize form with payment data (for edit mode)
  useEffect(() => {
    if (payment) {
      setYearMonth(payment.payments_year_month);
      setStatusId(payment.payments_status_id.toString());
      setPayable(payment.payments_amount.toString());
      setPayout(payment.payments_amount_payout.toString());
      setBalance(payment.payments_amount_balance.toString());
      setReferenceNumber(payment.payments_reference_number || "");
      
      // Format payment date for input field (YYYY-MM-DD)
      if (payment.payments_invoice_date) {
        const date = new Date(payment.payments_invoice_date);
        const formattedDate = date.toISOString().split('T')[0];
        setPaymentDate(formattedDate);
      } else {
        setPaymentDate("");
      }
      
      setRemarks(payment.payments_remarks || "");
      setReceiptFiles([]);
    } else {
      // Reset form for new payment
      const today = new Date();
      const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      setYearMonth(defaultYearMonth);
      setStatusId("");
      setPayable("0");
      setPayout("0");
      setBalance("0");
      setReferenceNumber("");
      setPaymentDate("");
      setRemarks("");
      setReceiptFiles([]);
    }
  }, [payment, isOpen]);

  // Auto-calculate balance when payout or payable changes
  useEffect(() => {
    const payoutNum = parseFloat(payout) || 0;
    const payableNum = parseFloat(payable) || 0;
    const balanceNum = payoutNum - payableNum;
    setBalance(balanceNum.toFixed(2));
  }, [payout, payable]);

  // Update payable when income/expense data is fetched and year/month changes
  // Always calculate from income/expense data (both add and edit modes)
  useEffect(() => {
    if (year && month && incomeExpenseData?.success && incomeExpenseData?.data) {
      // Calculate car owner split for the selected month
      const ownerSplit = calculateCarOwnerSplit(month);
      setPayable(ownerSplit.toFixed(2));
    } else if (year && month && incomeExpenseData && !incomeExpenseData.success) {
      // If income/expense data not found, set to 0
      setPayable("0.00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeExpenseData?.success, incomeExpenseData?.data, year, month, dynamicSubcategories, previousYearData, monthModes, skiRacksOwner]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setReceiptFiles((prev) => [...prev, ...newFiles]);
    }
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove file from list
  const handleRemoveFile = (index: number) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = buildApiUrl("/api/payments");
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("paymentsClientId", data.paymentsClientId.toString());
      formData.append("paymentsStatusId", data.paymentsStatusId.toString());
      formData.append("paymentsCarId", data.paymentsCarId.toString());
      formData.append("paymentsYearMonth", data.paymentsYearMonth);
      formData.append("paymentsAmount", data.paymentsAmount.toString());
      formData.append("paymentsAmountPayout", data.paymentsAmountPayout.toString());
      formData.append("paymentsReferenceNumber", data.paymentsReferenceNumber || "");
      formData.append("paymentsInvoiceId", "");
      formData.append("paymentsInvoiceDate", data.paymentsInvoiceDate || "");
      formData.append("paymentsRemarks", data.paymentsRemarks || "");
      
      // Append receipt files
      if (data.receiptFiles && data.receiptFiles.length > 0) {
        data.receiptFiles.forEach((file: File) => {
          formData.append("receiptFiles", file);
        });
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to create payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      toast({
        title: "Success",
        description: "Payment created successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!payment) throw new Error("No payment to update");
      const url = buildApiUrl(`/api/payments/${payment.payments_aid}`);
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("paymentsClientId", data.paymentsClientId.toString());
      formData.append("paymentsStatusId", data.paymentsStatusId.toString());
      formData.append("paymentsCarId", data.paymentsCarId.toString());
      formData.append("paymentsYearMonth", data.paymentsYearMonth);
      formData.append("paymentsAmount", data.paymentsAmount.toString());
      formData.append("paymentsAmountPayout", data.paymentsAmountPayout.toString());
      formData.append("paymentsReferenceNumber", data.paymentsReferenceNumber || "");
      formData.append("paymentsInvoiceId", "");
      formData.append("paymentsInvoiceDate", data.paymentsInvoiceDate || "");
      formData.append("paymentsRemarks", data.paymentsRemarks || "");
      
      // Append receipt files
      if (data.receiptFiles && data.receiptFiles.length > 0) {
        data.receiptFiles.forEach((file: File) => {
          formData.append("receiptFiles", file);
        });
      }
      
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to update payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      toast({
        title: "Success",
        description: "Payment updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!yearMonth) {
      toast({
        title: "Validation Error",
        description: "Please select a year/month",
        variant: "destructive",
      });
      return;
    }

    if (!statusId) {
      toast({
        title: "Validation Error",
        description: "Please select a payment status",
        variant: "destructive",
      });
      return;
    }

    if (!clientId || clientId === 0) {
      toast({
        title: "Validation Error",
        description: "Client ID is missing. Please ensure the car has an associated client.",
        variant: "destructive",
      });
      return;
    }

    if (!carId || carId === 0) {
      toast({
        title: "Validation Error",
        description: "Car ID is missing.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      paymentsClientId: clientId,
      paymentsStatusId: parseInt(statusId),
      paymentsCarId: carId,
      paymentsYearMonth: yearMonth,
      paymentsAmount: parseFloat(payable) || 0,
      paymentsAmountPayout: parseFloat(payout) || 0,
      paymentsReferenceNumber: referenceNumber || "",
      paymentsInvoiceId: "",
      paymentsInvoiceDate: paymentDate || null,
      paymentsRemarks: remarks || "",
      receiptFiles: receiptFiles,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const balanceNum = parseFloat(balance) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground text-xl font-semibold">
            {isEdit ? "Edit Payment" : "Add Payment"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? "Update the payment record. Payable is recalculated from Income & Expense."
              : "Create a new payment. Payable will auto-fill from Income & Expense for the chosen month."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Section: Period & Status */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Period & Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="yearMonth" className="text-muted-foreground text-xs">
                  Year / Month <span className="text-red-700">*</span>
                </Label>
                <Input
                  id="yearMonth"
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  disabled={isPending || isEdit}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-muted-foreground text-xs">
                  Payment Status <span className="text-red-700">*</span>
                </Label>
                <Select value={statusId} onValueChange={setStatusId} disabled={isPending}>
                  <SelectTrigger className="bg-muted border-border text-foreground mt-1 h-10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    {statuses.map((status) => (
                      <SelectItem
                        key={status.payment_status_aid}
                        value={status.payment_status_aid.toString()}
                      >
                        {status.payment_status_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Section: Amounts */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amounts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="payable" className="text-muted-foreground text-xs">
                  Payable
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="payable"
                    type="text"
                    value={payable}
                    readOnly
                    disabled={isPending || isLoadingIncomeExpense}
                    className="bg-background border-border text-foreground pl-7 h-10 cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Auto from Income & Expense
                </p>
              </div>

              <div>
                <Label htmlFor="payout" className="text-muted-foreground text-xs">
                  Payout <span className="text-red-700">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="payout"
                    type="number"
                    step="0.01"
                    value={payout}
                    onChange={(e) => setPayout(e.target.value)}
                    disabled={isPending}
                    className="bg-muted border-border text-foreground pl-7 h-10"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Amount actually paid
                </p>
              </div>

              <div>
                <Label htmlFor="balance" className="text-muted-foreground text-xs">
                  Balance
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="balance"
                    type="text"
                    value={balance}
                    disabled
                    className={`bg-background border-border pl-7 h-10 font-semibold ${
                      balanceNum < 0
                        ? "text-red-500"
                        : balanceNum > 0
                        ? "text-emerald-500"
                        : "text-foreground"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Payout − Payable
                </p>
              </div>
            </div>
            {isLoadingIncomeExpense && (
              <p className="text-xs text-muted-foreground">
                Loading payable amount from Income & Expense…
              </p>
            )}
            {!isLoadingIncomeExpense && year && month && (!incomeExpenseData || !incomeExpenseData.success) && (
              <p className="text-xs text-yellow-700">
                Income & Expense not found for {year}-{String(month).padStart(2, "0")}. Payable set to $0.00.
              </p>
            )}
          </section>

          {/* Section: Reference */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referenceNumber" className="text-muted-foreground text-xs">
                  Reference Number
                </Label>
                <Input
                  id="referenceNumber"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  placeholder="e.g. Zelle #12345"
                />
              </div>
              <div>
                <Label htmlFor="paymentDate" className="text-muted-foreground text-xs">
                  Payment Date
                </Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                />
              </div>
            </div>
          </section>

          {/* Section: Receipt */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Receipt
            </h4>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileChange}
              disabled={isPending}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="w-full bg-muted border-dashed border-border text-foreground hover:bg-muted h-12"
            >
              <Upload className="w-4 h-4 mr-2" />
              {receiptFiles.length > 0 ? "Add More Files" : "Upload Receipt (PDF / image)"}
            </Button>

            {receiptFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {receiptFiles.length} file(s) selected
                </p>
                {receiptFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-background border border-border rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-[#EAEB80] flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#EAEB80] flex-shrink-0" />
                      )}
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isPending}
                      className="text-red-700 hover:text-red-700 hover:bg-red-400/10 ml-2 h-7 w-7 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Remarks */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remarks
            </h4>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isPending}
              className="bg-muted border-border text-foreground"
              placeholder="Add any notes about this payment…"
              rows={3}
            />
          </section>

          {/* Sticky footer actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 sticky bottom-0 bg-card">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="bg-muted text-foreground hover:bg-muted border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/80 min-w-[140px]"
            >
              {isPending ? "Saving…" : isEdit ? "Update Payment" : "Create Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

