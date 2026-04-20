import React, { createContext, useContext, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { IncomeExpenseData, EditingCell } from "../types";


interface IncomeExpenseContextType {
  data: IncomeExpenseData;
  isLoading: boolean;
  editingCell: EditingCell | null;
  setEditingCell: (cell: EditingCell | null) => void;
  updateCell: (category: string, field: string, month: number, value: number) => void;
  saveChanges: (immediateChange?: { category: string; field: string; month: number; value: number; remarks?: string }) => void;
  isSaving: boolean;
  monthModes: { [month: number]: 50 | 70 };
  toggleMonthMode: (month: number) => Promise<void>;
  isSavingMode: boolean;
  skiRacksOwner: { [month: number]: "GLA" | "CAR_OWNER" };
  toggleSkiRacksOwner: (month: number) => Promise<void>;
  isSavingSkiRacksOwner: boolean;
  year: string;
  carId: number;
  isAllCars: boolean;
  // Dynamic subcategories
  dynamicSubcategories: {
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  };
  refreshDynamicSubcategories: () => Promise<void>;
  addDynamicSubcategory: (categoryType: string, name: string) => Promise<void>;
  updateDynamicSubcategoryName: (categoryType: string, metadataId: number, newName: string) => Promise<void>;
  deleteDynamicSubcategory: (categoryType: string, metadataId: number) => Promise<void>;
  updateDynamicSubcategoryValue: (categoryType: string, metadataId: number, month: number, value: number, subcategoryName: string) => Promise<void>;
}

const IncomeExpenseContext = createContext<IncomeExpenseContextType | undefined>(undefined);

export function useIncomeExpense() {
  const context = useContext(IncomeExpenseContext);
  if (!context) {
    throw new Error("useIncomeExpense must be used within IncomeExpenseProvider");
  }
  return context;
}

function getEmptyData(): IncomeExpenseData {
  const emptyMonthData = Array.from({ length: 12 }, (_, i) => ({ month: i + 1 }));
  return {
    formulaSetting: { carManagementSplitPercent: 50, carOwnerSplitPercent: 50 },
    incomeExpenses: emptyMonthData.map((m) => ({
      ...m,
      rentalIncome: 0,
      deliveryIncome: 0,
      electricPrepaidIncome: 0,
      smokingFines: 0,
      gasPrepaidIncome: 0,
      skiRacksIncome: 0,
      milesIncome: 0,
      childSeatIncome: 0,
      coolersIncome: 0,
      insuranceWreckIncome: 0,
      otherIncome: 0,
      negativeBalanceCarryOver: 0,
      carPayment: 0,
      carManagementTotalExpenses: 0,
      carOwnerTotalExpenses: 0,
    })),
    directDelivery: emptyMonthData.map((m) => ({
      ...m,
      laborCarCleaning: 0,
      laborDelivery: 0,
      parkingAirport: 0,
      parkingLot: 0,
      uberLyftLime: 0,
    })),
    cogs: emptyMonthData.map((m) => ({
      ...m,
      autoBodyShopWreck: 0,
      alignment: 0,
      battery: 0,
      brakes: 0,
      carPayment: 0,
      carInsurance: 0,
      carSeats: 0,
      cleaningSuppliesTools: 0,
      emissions: 0,
      gpsSystem: 0,
      keyFob: 0,
      laborCleaning: 0,
      licenseRegistration: 0,
      mechanic: 0,
      oilLube: 0,
      parts: 0,
      skiRacks: 0,
      tickets: 0,
      tiredAirStation: 0,
      tires: 0,
      towingImpoundFees: 0,
      uberLyftLime: 0,
      windshield: 0,
      wipers: 0,
    })),
    parkingFeeLabor: emptyMonthData.map((m) => ({
      ...m,
      glaParkingFee: 0,
      laborCleaning: 0,
    })),
    reimbursedBills: emptyMonthData.map((m) => ({
      ...m,
      electricReimbursed: 0,
      electricNotReimbursed: 0,
      gasReimbursed: 0,
      gasNotReimbursed: 0,
      gasServiceRun: 0,
      parkingAirport: 0,
      uberLyftLimeNotReimbursed: 0,
      uberLyftLimeReimbursed: 0,
    })),
    officeSupport: emptyMonthData.map((m) => ({
      ...m,
      accountingProfessionalFees: 0,
      advertizing: 0,
      bankCharges: 0,
      detailMobile: 0,
      charitableContributions: 0,
      computerInternet: 0,
      deliveryPostageFreight: 0,
      detailShopEquipment: 0,
      duesSubscription: 0,
      generalAdministrative: 0,
      healthWellness: 0,
      laborSales: 0,
      laborSoftware: 0,
      legalProfessional: 0,
      marketing: 0,
      mealsEntertainment: 0,
      officeExpense: 0,
      officeRent: 0,
      outsideStaffContractors: 0,
      parkNJetBooth: 0,
      printing: 0,
      referral: 0,
      repairsMaintenance: 0,
      salesTax: 0,
      securityCameras: 0,
      shippingFreightDelivery: 0,
      suppliesMaterials: 0,
      taxesLicense: 0,
      telephone: 0,
      travel: 0,
      depreciationExpense: 0,
      vehicleDepreciationExpense: 0,
      vehicleLoanInterestExpense: 0,
    })),
    history: emptyMonthData.map((m) => ({
      ...m,
      daysRented: 0,
      carsAvailableForRent: 0,
      tripsTaken: 0,
    })),
    parkingAirportQB: emptyMonthData.map((m) => ({
      ...m,
      totalParkingAirport: 0,
    })),
  };
}

export function IncomeExpenseProvider({
  children,
  carId,
  year,
  isAllCars = false,
}: {
  children: ReactNode;
  carId: number;
  year: string;
  isAllCars?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map());
  
  // Initialize monthModes with defaults
  const getDefaultMonthModes = (): { [month: number]: 50 | 70 } => {
    const modes: { [month: number]: 50 | 70 } = {};
    for (let i = 1; i <= 12; i++) {
      modes[i] = 50; // Default to 50:50 mode
    }
    return modes;
  };
  
  const [monthModes, setMonthModes] = useState<{ [month: number]: 50 | 70 }>(getDefaultMonthModes);
  const [isSavingMode, setIsSavingMode] = useState(false);
  
  // Initialize skiRacksOwner with defaults
  const getDefaultSkiRacksOwner = (): { [month: number]: "GLA" | "CAR_OWNER" } => {
    const owners: { [month: number]: "GLA" | "CAR_OWNER" } = {};
    for (let i = 1; i <= 12; i++) {
      owners[i] = "GLA"; // Default to GLA
    }
    return owners;
  };
  
  const [skiRacksOwner, setSkiRacksOwner] = useState<{ [month: number]: "GLA" | "CAR_OWNER" }>(getDefaultSkiRacksOwner);
  const [isSavingSkiRacksOwner, setIsSavingSkiRacksOwner] = useState(false);
  const [dynamicSubcategories, setDynamicSubcategories] = useState({
    directDelivery: [] as any[],
    cogs: [] as any[],
    parkingFeeLabor: [] as any[],
    reimbursedBills: [] as any[],
  });

  // Fetch income/expense data (aggregated for all cars, or per car)
  const { data: incomeExpenseData, isLoading } = useQuery<{
    success: boolean;
    data: IncomeExpenseData;
  }>({
    queryKey: isAllCars ? ["/api/income-expense/all-cars", year] : ["/api/income-expense", carId, year],
    queryFn: async () => {
      const url = isAllCars 
        ? buildApiUrl(`/api/income-expense/all-cars/${year}`)
        : buildApiUrl(`/api/income-expense/${carId}/${year}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch income/expense data");
      return response.json();
    },
    retry: false,
    // For "All Cars" view, always fetch fresh data (no caching)
    staleTime: isAllCars ? 0 : 1000 * 60 * 5, // 0 for all cars, 5 minutes for individual cars
    refetchOnMount: isAllCars ? "always" : true,
    refetchOnWindowFocus: isAllCars,
  });

  const data = incomeExpenseData?.data || getEmptyData();

  // Fetch dynamic subcategories
  const fetchDynamicSubcategories = async () => {
    const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
      'directDelivery',
      'cogs',
      'parkingFeeLabor',
      'reimbursedBills',
    ];
    
    const promises = categories.map(async (categoryType) => {
      try {
        const url = isAllCars
          ? buildApiUrl(`/api/income-expense/dynamic-subcategories/all-cars/${year}/${categoryType}`)
          : buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${year}/${categoryType}`);
        const response = await fetch(url, { credentials: "include" });
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
    const newSubcategories: any = {
      directDelivery: [],
      cogs: [],
      parkingFeeLabor: [],
      reimbursedBills: [],
    };
    
    results.forEach(({ categoryType, data }) => {
      newSubcategories[categoryType] = data;
    });
    
    setDynamicSubcategories(newSubcategories);
  };

  // Fetch dynamic subcategories when carId or year changes (including "All Cars" mode)
  React.useEffect(() => {
    if (year && (isAllCars || carId)) {
      fetchDynamicSubcategories();
    }
  }, [carId, year, isAllCars]);

  const refreshDynamicSubcategories = async () => {
    await fetchDynamicSubcategories();
  };

  const addDynamicSubcategory = async (categoryType: string, name: string) => {
    try {
      // Add subcategory globally (applies to all cars)
      const response = await fetch(buildApiUrl("/api/income-expense/dynamic-subcategories/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId, // Optional - if provided, initializes values for this car
          year: parseInt(year),
          categoryType,
          subcategoryName: name,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to add subcategory");
      
      await fetchDynamicSubcategories();
      toast({
        title: "Success",
        description: "Subcategory added globally (applies to all cars)",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add subcategory",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateDynamicSubcategoryName = async (categoryType: string, metadataId: number, newName: string) => {
    try {
      // Update subcategory name globally (affects all cars)
      const response = await fetch(buildApiUrl("/api/income-expense/dynamic-subcategories/update-name"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metadataId,
          newName,
          carId, // Optional - if provided, returns updated list for this car
          year: parseInt(year),
          categoryType,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to update subcategory name");
      
      await fetchDynamicSubcategories();
      toast({
        title: "Success",
        description: "Subcategory name updated globally (affects all cars)",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory name",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteDynamicSubcategory = async (categoryType: string, metadataId: number) => {
    try {
      // Delete subcategory globally (removes from all cars)
      const response = await fetch(
        buildApiUrl(`/api/income-expense/dynamic-subcategories/${metadataId}?carId=${carId}&year=${year}&categoryType=${categoryType}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      
      if (!response.ok) throw new Error("Failed to delete subcategory");
      
      await fetchDynamicSubcategories();
      toast({
        title: "Success",
        description: "Subcategory deleted globally (removed from all cars)",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subcategory",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateDynamicSubcategoryValue = async (
    categoryType: string,
    metadataId: number,
    month: number,
    value: number,
    subcategoryName: string
  ) => {
    try {
      const response = await fetch(buildApiUrl("/api/income-expense/dynamic-subcategories/update-value"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metadataId,
          month,
          value,
          carId,
          year: parseInt(year),
          categoryType,
          subcategoryName,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to update subcategory value");
      
      await fetchDynamicSubcategories();
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, year] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory value",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Load monthModes and skiRacksOwner from API response when data is fetched
  // Use a ref to track if we've loaded modes for this carId/year combo to prevent infinite loops
  const loadedKey = React.useRef<string>('');
  
  React.useEffect(() => {
    const currentKey = `${carId}-${year}`;
    
    // Only load if this is a new carId/year combination
    if (loadedKey.current !== currentKey && incomeExpenseData?.data) {
      loadedKey.current = currentKey;
      
      if (incomeExpenseData.data.formulaSetting?.monthModes) {
        // Merge with defaults to ensure all 12 months are present
        const defaults = getDefaultMonthModes();
        const loadedModes = { ...defaults, ...incomeExpenseData.data.formulaSetting.monthModes };
        setMonthModes(loadedModes);
      } else {
        // If formulaSetting exists but no monthModes, use defaults
        setMonthModes(getDefaultMonthModes());
      }
      
      if (incomeExpenseData.data.formulaSetting?.skiRacksOwner) {
        // Merge with defaults to ensure all 12 months are present
        const defaults = getDefaultSkiRacksOwner();
        const loadedOwners = { ...defaults, ...incomeExpenseData.data.formulaSetting.skiRacksOwner };
        setSkiRacksOwner(loadedOwners);
      } else {
        // If formulaSetting exists but no skiRacksOwner, use defaults
        setSkiRacksOwner(getDefaultSkiRacksOwner());
      }
    }
  }, [incomeExpenseData, carId, year]);

  // Toggle month mode and save to backend
  const toggleMonthMode = async (month: number) => {
    // Optimistically update UI — the edited month AND every later month in the
    // current year inherit the new mode. The backend does the same cascade
    // for subsequent years up to the current calendar month-year.
    const newMode = monthModes[month] === 50 ? 70 : 50;
    const newModes: { [month: number]: 50 | 70 } = { ...monthModes };
    for (let m = month; m <= 12; m++) {
      newModes[m] = newMode;
    }
    setMonthModes(newModes);

    // Update percentage values in database for just the edited month —
    // the backend `upsertIncomeExpense` cascade propagates the % values
    // forward (current year + subsequent years up to current calendar month).
    // Mode 50 = 50:50 split (Car Management : Car Owner)
    // Mode 70 = 30:70 split (Car Management : Car Owner) - NOT 70:30
    const newMgmtPercent = newMode === 70 ? 30 : 50;
    const newOwnerPercent = newMode === 70 ? 70 : 50;
    
    setIsSavingMode(true);

    try {
      // Update percentages for this month
      await Promise.all([
        saveChanges({
          category: "income",
          field: "carManagementSplit",
          month,
          value: newMgmtPercent,
        }),
        saveChanges({
          category: "income",
          field: "carOwnerSplit",
          month,
          value: newOwnerPercent,
        }),
      ]);
      
      // Then update the mode setting (with cascadeFromMonth so the backend
      // propagates the new mode into every later month + year).
      const response = await fetch(buildApiUrl("/api/income-expense/formula"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId,
          year: parseInt(year),
          monthModes: newModes,
          cascadeFromMonth: month,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save mode change");
      }

      const result = await response.json();
      
      // Update with server response to ensure consistency
      if (result.data?.monthModes) {
        setMonthModes({ ...getDefaultMonthModes(), ...result.data.monthModes });
      }

      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, year] });
      
      toast({
        title: "Success",
        description: "Mode updated successfully",
      });
    } catch (error: any) {
      // Revert on error
      setMonthModes(monthModes);
      toast({
        title: "Error",
        description: error.message || "Failed to save mode change",
        variant: "destructive",
      });
    } finally {
      setIsSavingMode(false);
    }
  };

  // Toggle ski racks owner and save to backend
  const toggleSkiRacksOwner = async (month: number) => {
    // Use functional update to get current state and calculate new value
    let newOwners: { [month: number]: "GLA" | "CAR_OWNER" } | undefined;
    let previousOwners: { [month: number]: "GLA" | "CAR_OWNER" } | undefined;
    
    setSkiRacksOwner((currentOwners) => {
      // Store current for error rollback
      previousOwners = { ...currentOwners };
      
      // Calculate new owner value
      const currentOwner = currentOwners[month] || "GLA";
      const newOwner = currentOwner === "GLA" ? "CAR_OWNER" : "GLA";
      
      // Create new owners object
      newOwners = {
        ...currentOwners,
        [month]: newOwner,
      };
      
      return newOwners;
    });
    
    if (!newOwners || !previousOwners) {
      console.error("State update failed");
      return;
    }
    
    setIsSavingSkiRacksOwner(true);

    try {
      // Update the ski racks owner setting
      const response = await fetch(buildApiUrl("/api/income-expense/formula"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId,
          year: parseInt(year),
          skiRacksOwner: newOwners,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save ski racks owner change: ${errorText}`);
      }

      const result = await response.json();
      
      // Update with server response to ensure consistency
      // The backend returns { success: true, data: { monthModes, skiRacksOwner, ... } }
      if (result.success && result.data) {
        if (result.data.skiRacksOwner) {
          const defaults = getDefaultSkiRacksOwner();
          setSkiRacksOwner({ ...defaults, ...result.data.skiRacksOwner });
        }
        // If no skiRacksOwner in response, keep the optimistic update (newOwners)
      }

      // Invalidate query to refresh data (but don't wait for it)
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, year] });
      
      toast({
        title: "Success",
        description: "Ski racks owner updated successfully",
      });
    } catch (error: any) {
      // Revert on error
      console.error("Error toggling ski racks owner:", error);
      setSkiRacksOwner(previousOwners);
      toast({
        title: "Error",
        description: error.message || "Failed to save ski racks owner change",
        variant: "destructive",
      });
    } finally {
      setIsSavingSkiRacksOwner(false);
    }
  };

  const updateCell = (category: string, field: string, month: number, value: number) => {
    const key = `${category}-${field}-${month}`;
    const newChanges = new Map(pendingChanges);
    newChanges.set(key, { category, field, month, value });
    setPendingChanges(newChanges);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changesByCategory = new Map<string, any>();

      // Group changes by category and month
      pendingChanges.forEach(({ category, field, month, value }) => {
        const key = `${category}-${month}`;
        if (!changesByCategory.has(key)) {
          changesByCategory.set(key, { category, month, fields: {} });
        }
        changesByCategory.get(key).fields[field] = value;
      });

      // Send updates to backend
      const promises: Promise<any>[] = [];

      changesByCategory.forEach(({ category, month, fields }) => {
        const endpoint = getCategoryEndpoint(category);
        if (endpoint) {
          promises.push(
            fetch(buildApiUrl(endpoint), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                carId,
                year: parseInt(year),
                month,
                ...fields,
              }),
            }).then((res) => {
              if (!res.ok) throw new Error(`Failed to update ${category}`);
              return res.json();
            })
          );
        }
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, year] });
      setPendingChanges(new Map());
      setEditingCell(null); // Close modal after successful save
      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    },
  });

  const saveChanges = (immediateChange?: { category: string; field: string; month: number; value: number; remarks?: string }) => {
    // If an immediate change is provided, add it to pendingChanges first
    if (immediateChange) {
      const key = `${immediateChange.category}-${immediateChange.field}-${immediateChange.month}`;
      const newChanges = new Map(pendingChanges);
      newChanges.set(key, immediateChange);
      setPendingChanges(newChanges);
      
      // Use the updated map for saving
      const changesByCategory = new Map<string, any>();
      const remarksByField: { [key: string]: string } = {};
      
      newChanges.forEach(({ category, field, month, value, remarks }) => {
        const catKey = `${category}-${month}`;
        if (!changesByCategory.has(catKey)) {
          changesByCategory.set(catKey, { category, month, fields: {} });
        }
        changesByCategory.get(catKey).fields[field] = value;
        
        // Collect remarks by field
        if (remarks) {
          remarksByField[field] = remarks;
        }
      });

      // Send updates to backend with remarks
      const promises: Promise<any>[] = [];
      changesByCategory.forEach(({ category, month, fields }) => {
        const endpoint = getCategoryEndpoint(category);
        if (endpoint) {
          // Include remarks in the request
          const requestBody: any = {
            carId,
            year: parseInt(year),
            month,
            ...fields,
          };
          
          // Add remarks if any exist for fields in this category/month
          const categoryRemarks: { [key: string]: string } = {};
          Object.keys(fields).forEach(field => {
            if (remarksByField[field]) {
              categoryRemarks[field] = remarksByField[field];
            }
          });
          
          if (Object.keys(categoryRemarks).length > 0) {
            requestBody.remarks = categoryRemarks;
          }
          
          promises.push(
            fetch(buildApiUrl(endpoint), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(requestBody),
            }).then((res) => {
              if (!res.ok) throw new Error(`Failed to update ${category}`);
              return res.json();
            })
          );
        }
      });

      Promise.all(promises)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, year] });
          setPendingChanges(new Map());
          setEditingCell(null);
          toast({
            title: "Success",
            description: "Changes saved successfully",
          });
        })
        .catch((error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to save changes",
            variant: "destructive",
          });
        });
      
      return;
    }

    // Original behavior: save from pendingChanges
    if (pendingChanges.size === 0) {
      toast({
        title: "No changes",
        description: "No changes to save",
      });
      return;
    }
    saveMutation.mutate();
  };

  function getCategoryEndpoint(category: string): string | null {
    const endpoints: { [key: string]: string } = {
      income: "/api/income-expense/income",
      directDelivery: "/api/income-expense/direct-delivery",
      cogs: "/api/income-expense/cogs",
      parkingFeeLabor: "/api/income-expense/parking-fee-labor",
      reimbursedBills: "/api/income-expense/reimbursed-bills",
      officeSupport: "/api/income-expense/office-support",
      history: "/api/income-expense/history",
      parkingAirportQB: "/api/income-expense/parking-airport-qb",
    };
    return endpoints[category] || null;
  }

  return (
    <IncomeExpenseContext.Provider
      value={{
        data,
        isLoading,
        editingCell,
        setEditingCell,
        updateCell,
        saveChanges,
        isSaving: saveMutation.isPending,
        monthModes,
        toggleMonthMode,
        isSavingMode,
        skiRacksOwner,
        toggleSkiRacksOwner,
        isSavingSkiRacksOwner,
        year,
        carId,
        isAllCars,
        dynamicSubcategories,
        refreshDynamicSubcategories,
        addDynamicSubcategory,
        updateDynamicSubcategoryName,
        deleteDynamicSubcategory,
        updateDynamicSubcategoryValue,
      }}
    >
      {children}
    </IncomeExpenseContext.Provider>
  );
}
