import React, { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getCurrentCost,
  getCurrentCostWithAdd,
  getNadaChange,
  getNadaChangeCurrent,
  getTotalEquity,
  generateMonths,
  formatCurrency,
  formatPercentage,
  handleExportNada,
  handleExportNadaExcel,
  type NadaDepreciation,
  type NadaDepreciationWithAdd,
  type CurrentCost,
  type CurrentCostWithAdd,
} from "@/lib/nadaDepreciationUtils";
import { NadaDepreciationModal } from "@/components/modals/NadaDepreciationModal";
import { NadaDepreciationLogModal } from "@/components/modals/NadaDepreciationLogModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function NADADepreciationPage() {
  const [, params] = useRoute("/admin/cars/:id/depreciation");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddModalWithAddOpen, setIsAddModalWithAddOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [itemEdit, setItemEdit] = useState<any>(null);
  const [isNadaWithAdd, setIsNadaWithAdd] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const previousYear = (parseInt(selectedYear) - 1).toString();
  const months = generateMonths(selectedYear);
  const monthsPreviousYear = generateMonths(previousYear);

  // Get user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
        if (!response.ok) return { user: undefined };
        return response.json();
      } catch (error) {
        return { user: undefined };
      }
    },
    retry: false,
  });

  const user = userData?.user;
  const isClient = user?.isClient === true;

  // Fetch car data
  const { data: carData, isLoading: isLoadingCar, error: carError } = useQuery<{
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

  // Fetch onboarding data
  const { data: onboardingData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const url = buildApiUrl(
        `/api/onboarding/vin/${encodeURIComponent(car.vin)}`
      );
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: true, data: null };
        }
        throw new Error("Failed to fetch onboarding data");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.data;

  // Fetch current cost categories
  const { 
    data: currentCostData,
    error: currentCostError,
    refetch: refetchCurrentCost
  } = useQuery<{
    success: boolean;
    count: number;
    data: CurrentCost[];
  }>({
    queryKey: ["/api/current-cost"],
    queryFn: async () => {
      const url = buildApiUrl("/api/current-cost");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to fetch current cost: ${response.statusText}`);
      }
      const result = await response.json();
      console.log("✅ [NADA Depreciation] Fetched current cost categories:", {
        count: result.count,
        categories: result.data?.length || 0
      });
      return result;
    },
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // Fetch current cost with add categories
  const { 
    data: currentCostWithAddData,
    error: currentCostWithAddError,
    refetch: refetchCurrentCostWithAdd
  } = useQuery<{
    success: boolean;
    count: number;
    data: CurrentCostWithAdd[];
  }>({
    queryKey: ["/api/current-cost-with-add"],
    queryFn: async () => {
      const url = buildApiUrl("/api/current-cost-with-add");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to fetch current cost with add: ${response.statusText}`);
      }
      const result = await response.json();
      console.log("✅ [NADA Depreciation] Fetched current cost with add categories:", {
        count: result.count,
        categories: result.data?.length || 0
      });
      return result;
    },
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // Fetch NADA depreciation (current year)
  const { 
    data: nadaDepreciationData, 
    isLoading: isLoadingNada,
    error: nadaDepreciationError,
    refetch: refetchNadaDepreciation
  } = useQuery<{
    success: boolean;
    count: number;
    data: NadaDepreciation[];
    all_year: Array<{ date_year: string }>;
  }>({
    queryKey: ["/api/nada-depreciation/read", carId, selectedYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl("/api/nada-depreciation/read");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          nada_depreciation_car_id: carId,
          nada_depreciation_date: selectedYear,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to fetch NADA depreciation: ${response.statusText}`);
      }
      const result = await response.json();
      console.log("✅ [NADA Depreciation] Fetched current year data:", {
        count: result.count,
        records: result.data?.length || 0,
        year: selectedYear,
        carId
      });
      return result;
    },
    enabled: !!carId && !!selectedYear,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // Fetch NADA depreciation with add (previous year)
  const {
    data: nadaDepreciationWithAddData,
    isLoading: isLoadingNadaWithAdd,
    error: nadaDepreciationWithAddError,
    refetch: refetchNadaDepreciationWithAdd
  } = useQuery<{
    success: boolean;
    count: number;
    data: NadaDepreciationWithAdd[];
    all_year: Array<{ date_year: string }>;
  }>({
    queryKey: ["/api/nada-depreciation-with-add/read", carId, previousYear],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl("/api/nada-depreciation-with-add/read");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          nada_depreciation_with_add_car_id: carId,
          nada_depreciation_with_add_date: previousYear,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to fetch NADA depreciation with add: ${response.statusText}`);
      }
      const result = await response.json();
      console.log("✅ [NADA Depreciation] Fetched previous year data:", {
        count: result.count,
        records: result.data?.length || 0,
        year: previousYear,
        requestedYear: selectedYear,
        carId
      });
      return result;
    },
    enabled: !!carId && !!selectedYear,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  // Default categories in case API hasn't loaded yet or returns empty
  const defaultCurrentCost: CurrentCost[] = [
    { currentCostAid: 1, currentCostIsActive: true, currentCostName: "NADA - Retail", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 2, currentCostIsActive: true, currentCostName: "NADA - Clean", currentCostCompute: "nada-clean", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 3, currentCostIsActive: true, currentCostName: "NADA - Average", currentCostCompute: "nada-average", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 4, currentCostIsActive: true, currentCostName: "NADA - Rough", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 5, currentCostIsActive: true, currentCostName: "MILES", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 6, currentCostIsActive: true, currentCostName: "Amounted Owed on Car $", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
  ];

  const defaultCurrentCostWithAdd: CurrentCostWithAdd[] = [
    { currentCostWithAddAid: 1, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Retail", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 2, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Clean", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 3, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Average", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 4, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Rough", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 5, currentCostWithAddIsActive: true, currentCostWithAddName: "MILES", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
  ];

  const currentCost = currentCostData?.data && currentCostData.data.length > 0 
    ? currentCostData.data 
    : defaultCurrentCost;
  const currentCostWithAdd = currentCostWithAddData?.data && currentCostWithAddData.data.length > 0
    ? currentCostWithAddData.data
    : defaultCurrentCostWithAdd;
  const nadaDepreciation = nadaDepreciationData?.data || [];
  const nadaDepreciationWithAdd = nadaDepreciationWithAddData?.data || [];

  // Fixed list of years for dropdown
  const availableYears = useMemo(() => {
    return ["2026", "2025", "2024", "2023", "2022", "2021"];
  }, []);

  // Calculate table rows for previous year
  // Sort by currentCostWithAddAid to ensure proper order: Retail (1), Clean (2), Average (3), Rough (4), MILES (5)
  const nadaPreviousRows = useMemo(() => {
    const sortedCostWithAdd = [...currentCostWithAdd].sort((a, b) => a.currentCostWithAddAid - b.currentCostWithAddAid);
    return sortedCostWithAdd.map((costItem) => {
      const values = monthsPreviousYear.map((_, index) => {
        const result = getCurrentCostWithAdd(
          index + 1,
          costItem.currentCostWithAddAid,
          nadaDepreciationWithAdd,
          previousYear
        );
        return result.amount;
      });
      const current = getCurrentCostWithAdd(
        null,
        costItem.currentCostWithAddAid,
        nadaDepreciationWithAdd,
        previousYear
      ).currentAmount;

      return {
        label: costItem.currentCostWithAddName,
        values,
        current,
        isMiles: costItem.currentCostWithAddName.includes("MILES"),
        categoryId: costItem.currentCostWithAddAid,
      };
    });
  }, [
    currentCostWithAdd,
    nadaDepreciationWithAdd,
    previousYear,
    monthsPreviousYear,
  ]);

  // Calculate table rows for current year
  // Sort by currentCostAid to ensure proper order: Retail (1), Clean (2), Average (3), Rough (4), MILES (5), Amount Owed (6)
  const nadaCurrentRows = useMemo(() => {
    const sortedCost = [...currentCost].sort((a, b) => a.currentCostAid - b.currentCostAid);
    return sortedCost.map((costItem) => {
      const values = months.map((_, index) => {
        const result = getCurrentCost(
          index + 1,
          costItem.currentCostAid,
          nadaDepreciation,
          selectedYear
        );
        return result.amount;
      });
      const current = getCurrentCost(
        null,
        costItem.currentCostAid,
        nadaDepreciation,
        selectedYear
      ).currentAmount;

      return {
        label: costItem.currentCostName,
        values,
        current,
        isMiles: costItem.currentCostName.includes("MILES"),
        categoryId: costItem.currentCostAid,
      };
    });
  }, [currentCost, nadaDepreciation, selectedYear, months]);

  // Calculate total equity row
  const totalEquityRow = useMemo(() => {
    const values = months.map((_, index) => {
      return getTotalEquity(
        index + 1,
        nadaDepreciation,
        selectedYear,
        currentCost
      );
    });
    return { values };
  }, [nadaDepreciation, selectedYear, currentCost, months]);

  // Calculate NADA Change % rows
  const nadaChangeRows = useMemo(() => {
    const categories = [
      { label: "NADA Change Retail %", id: 1 },
      { label: "NADA Change Clean %", id: 2 },
      { label: "NADA Change Average %", id: 3 },
      { label: "NADA Change Rough", id: 4 },
    ];

    return categories.map((cat) => {
      const values = months.map((_, index) => {
        const change = getNadaChange(
          index + 1,
          nadaDepreciationWithAdd,
          nadaDepreciation,
          selectedYear
        );
        if (cat.id === 1) return change.changeRetail;
        if (cat.id === 2) return change.changeClean;
        if (cat.id === 3) return change.changeAverage;
        if (cat.id === 4) return change.changeRough;
        return 0;
      });

      const average =
        values.reduce((acc, val) => acc + val, 0) / values.length || 0;
      const current = getNadaChangeCurrent(
        selectedYear,
        cat.id,
        nadaDepreciationWithAdd,
        nadaDepreciation
      );

      return {
        label: cat.label,
        values,
        average,
        current,
      };
    });
  }, [
    nadaDepreciationWithAdd,
    nadaDepreciation,
    selectedYear,
    months,
  ]);

  // Prepare chart data
  const previousChartData = useMemo(() => {
    return months.map((month, index) => {
      const monthShort = month.split(" ")[0];
      return {
        month: monthShort,
        "NADA - Retail": nadaPreviousRows.find((r) =>
          r.label.includes("Retail")
        )?.values[index] || 0,
        "NADA - Clean": nadaPreviousRows.find((r) =>
          r.label.includes("Clean")
        )?.values[index] || 0,
        "NADA - Average": nadaPreviousRows.find((r) =>
          r.label.includes("Average")
        )?.values[index] || 0,
        "NADA - Rough": nadaPreviousRows.find((r) =>
          r.label.includes("Rough")
        )?.values[index] || 0,
      };
    });
  }, [nadaPreviousRows, months]);

  const currentChartData = useMemo(() => {
    return months.map((month, index) => {
      const monthShort = month.split(" ")[0];
      return {
        month: monthShort,
        "NADA - Retail": nadaCurrentRows.find((r) =>
          r.label.includes("Retail")
        )?.values[index] || 0,
        "NADA - Clean": nadaCurrentRows.find((r) =>
          r.label.includes("Clean")
        )?.values[index] || 0,
        "NADA - Average": nadaCurrentRows.find((r) =>
          r.label.includes("Average")
        )?.values[index] || 0,
        "NADA - Rough": nadaCurrentRows.find((r) =>
          r.label.includes("Rough")
        )?.values[index] || 0,
      };
    });
  }, [nadaCurrentRows, months]);

  const changeChartData = useMemo(() => {
    return months.map((month, index) => {
      const monthShort = month.split(" ")[0];
      return {
        month: monthShort,
        "NADA - Retail": nadaChangeRows[0]?.values[index] || 0,
        "NADA - Clean": nadaChangeRows[1]?.values[index] || 0,
        "NADA - Average": nadaChangeRows[2]?.values[index] || 0,
        "NADA - Rough": nadaChangeRows[3]?.values[index] || 0,
      };
    });
  }, [nadaChangeRows, months]);

  const handleEdit = (item: any, isWithAdd: boolean) => {
    setItemEdit(item);
    setIsNadaWithAdd(isWithAdd);
    if (isWithAdd) {
      setIsAddModalWithAddOpen(true);
    } else {
      setIsAddModalOpen(true);
    }
  };

  const handleAdd = (isWithAdd: boolean) => {
    setItemEdit(null);
    setIsNadaWithAdd(isWithAdd);
    if (isWithAdd) {
      setIsAddModalWithAddOpen(true);
    } else {
      setIsAddModalOpen(true);
    }
  };

  const handleExport = () => {
    if (car && currentCostWithAdd.length > 0 && currentCost.length > 0) {
      // Export CSV template
      handleExportNada(
        currentCostWithAdd,
        nadaDepreciationWithAdd,
        nadaDepreciation,
        currentCost,
        car,
        selectedYear
      );
      
      // Export Excel template (with a small delay to allow CSV download to complete)
      setTimeout(() => {
        handleExportNadaExcel(
          currentCostWithAdd,
          nadaDepreciationWithAdd,
          nadaDepreciation,
          currentCost,
          car,
          selectedYear
        );
      }, 500);
    }
  };

  const handleImport = async () => {
    if (!importFile || !carId) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("carId", carId.toString());

      const url = buildApiUrl("/api/nada-depreciation/import");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = result.error || result.message || "Failed to import file";
        const details = result.details ? `\n\nDetails: ${result.details}` : "";
        throw new Error(`${errorMsg}${details}`);
      }

      // Show success message
      toast({
        title: "Import Successful",
        description: `Previous Year (${previousYear}): ${result.data.previousYear.inserted} inserted, ${result.data.previousYear.updated} updated\nCurrent Year (${selectedYear}): ${result.data.currentYear.inserted} inserted, ${result.data.currentYear.updated} updated`,
      });

      // Close modal and reset file
      setIsImportModalOpen(false);
      setImportFile(null);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/nada-depreciation/read", carId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["/api/nada-depreciation-with-add/read", carId, selectedYear] });
      refetchNadaDepreciation();
      refetchNadaDepreciationWithAdd();
    } catch (error: any) {
      console.error("Error importing file:", error);
      // Show more detailed error message
      const errorMessage = error.message || "Failed to import file. Please check the file format and try again.";
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoadingCar) {
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
            onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
            className="mt-4 text-blue-700 hover:underline"
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

  // Log data status for debugging
  if (nadaDepreciationData || nadaDepreciationWithAddData) {
    console.log("📊 [NADA Depreciation] Data Status:", {
      currentYear: {
        count: nadaDepreciationData?.count || 0,
        records: nadaDepreciation?.length || 0,
        year: selectedYear,
        carId
      },
      previousYear: {
        count: nadaDepreciationWithAddData?.count || 0,
        records: nadaDepreciationWithAdd?.length || 0,
        year: previousYear,
        carId
      },
      categories: {
        current: currentCost?.length || 0,
        previous: currentCostWithAdd?.length || 0
      }
    });
  }

  return (
    <AdminLayout>
      <div className="flex flex-col w-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to View Car</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary">NADA Depreciation Schedule</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1">
              {/* Car Information */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Car Information
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Car Name:</span>
                    <p className="text-sm text-muted-foreground">{carName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">VIN #:</span>
                    <p className="text-sm text-muted-foreground">{car.vin || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">License:</span>
                    <p className="text-sm text-muted-foreground">
                      {car.licensePlate || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Owner Information */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Owner Information
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Name:</span>
                    {car?.clientId ? (
                      <button
                        onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                        className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-sm cursor-pointer font-semibold"
                      >
                        {ownerName}
                      </button>
                    ) : (
                      <p className="text-sm text-[#B8860B] font-semibold">{ownerName}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Contact #:</span>
                    <p className="text-sm text-muted-foreground">{ownerContact}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email:</span>
                    <p className="text-sm text-muted-foreground">{ownerEmail}</p>
                  </div>
                </div>
              </div>

              {/* Car Specifications */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Car Specifications
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Fuel/Gas:</span>
                    <p className="text-sm text-muted-foreground">{fuelType}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tire Size:</span>
                    <p className="text-sm text-muted-foreground">{tireSize}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Oil Type:</span>
                    <p className="text-sm text-muted-foreground">{oilType}</p>
                  </div>
                </div>
              </div>

              {/* Turo Links */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Turo Links
                </h3>
                <div className="space-y-2">
                  {car.turoLink && (
                    <div>
                      <a
                        href={car.turoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:underline text-sm flex items-center gap-1"
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
                        className="text-blue-700 hover:underline text-sm flex items-center gap-1"
                      >
                        Admin Turo Link: View Car
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {!car.turoLink && !car.adminTuroLink && (
                    <span className="text-muted-foreground text-sm">
                      No Turo links available
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex gap-2 ml-4">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/80"
                onClick={handleExport}
                disabled={
                  !car ||
                  currentCostWithAdd.length === 0 ||
                  currentCost.length === 0
                }
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              {!isClient && (
                <Button
                  className="bg-card text-foreground hover:bg-muted border border-border"
                  onClick={() => setIsImportModalOpen(true)}
                  disabled={!car}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              )}
              {!isClient && (
                <Button
                  className="bg-card text-foreground hover:bg-muted border border-border"
                  onClick={() => setIsLogModalOpen(true)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Log
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* NADA Depreciation Schedule Header with Year Filter */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif text-primary italic">
            NADA Depreciation Schedule
          </h1>
          <div className="w-[150px]">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* NADA Depreciation Schedule Previous Year Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-muted-foreground">
              NADA Depreciation Schedule {parseInt(selectedYear) - 1}
            </h2>
            {!isClient && (
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/80"
                onClick={() => handleAdd(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            )}
          </div>
          <div className="w-full overflow-x-auto">
            <table className="border-collapse w-full table-auto">
              <thead className="bg-card">
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-3 py-3 text-sm font-medium text-foreground sticky top-0 left-0 bg-card z-index-[auto] border-r border-border whitespace-nowrap">
                    Current Cost of Vehicle
                  </th>
                  {monthsPreviousYear.map((month) => (
                    <th
                      key={month}
                      className="text-right px-2 py-3 text-sm font-medium text-muted-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                  <th className="text-right px-2 py-3 text-sm font-medium text-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap">
                    Current
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingNadaWithAdd ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center text-muted-foreground">
                      Loading previous year data...
                    </td>
                  </tr>
                ) : nadaDepreciationWithAddError ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center">
                      <div className="text-red-700 mb-2">
                        Error loading data: {nadaDepreciationWithAddError instanceof Error ? nadaDepreciationWithAddError.message : "Unknown error"}
                      </div>
                      <Button
                        onClick={() => refetchNadaDepreciationWithAdd()}
                        className="bg-primary text-primary-foreground hover:bg-primary/80 text-sm"
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : nadaPreviousRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center text-muted-foreground">
                      No data available for {previousYear}. Click "Add" to create entries.
                    </td>
                  </tr>
                ) : (
                  nadaPreviousRows.map((row, rowIndex) => {
                    const dataItem = nadaDepreciationWithAdd.find(
                      (item) =>
                        item.nadaDepreciationWithAddId === row.categoryId &&
                        item.nadaDepreciationWithAddDate.startsWith(selectedYear)
                    );
                    return (
                  <tr
                    key={rowIndex}
                    className="border-b border-border transition-colors"
                  >
                    <td className="px-3 py-2 text-sm text-muted-foreground sticky left-0 bg-card z-[50] border-r border-border">
                      <span className="whitespace-nowrap">{row.label}</span>
                    </td>
                        {row.values.map((value, monthIndex) => {
                          const monthData = nadaDepreciationWithAdd.find(
                            (item) =>
                              item.nadaDepreciationWithAddId ===
                                row.categoryId &&
                              item.nadaDepreciationWithAddDate ===
                                `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`
                          );
                          const hasData = value !== 0 && monthData;
                          return (
                      <td
                        key={monthIndex}
                              onClick={() => {
                                if (!row.isMiles && monthData) {
                                  handleEdit(monthData, true);
                                }
                              }}
                        className={cn(
                          "text-right px-2 py-2 text-sm border-l border-border whitespace-nowrap",
                                hasData && !row.isMiles
                                  ? "text-primary underline cursor-pointer hover:bg-card"
                                  : value !== 0
                            ? "text-muted-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                              {row.isMiles
                                ? value.toLocaleString()
                                : formatCurrency(value)}
                      </td>
                          );
                        })}
                    <td className="text-right px-2 py-2 text-sm border-l border-border bg-card whitespace-nowrap">
                          <span
                            className={cn(
                              row.current !== 0
                                ? "text-primary font-medium"
                          : "text-muted-foreground"
                            )}
                          >
                        {row.isMiles 
                              ? row.current.toLocaleString()
                              : formatCurrency(row.current)}
                      </span>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NADA Change % Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-border">
             <h2 className="text-lg font-semibold text-muted-foreground">
               NADA Change % {previousYear} - {selectedYear}
             </h2>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="border-collapse w-full table-auto">
              <thead className="bg-card">
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-3 py-3 text-sm font-medium text-foreground sticky top-0 left-0 bg-card z-index-[auto] border-r border-border whitespace-nowrap">
                    Category
                  </th>
                  {months.map((month) => (
                    <th
                      key={month}
                      className="text-right px-2 py-3 text-sm font-medium text-muted-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                  <th className="text-right px-2 py-3 text-sm font-medium text-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap">
                    Average
                  </th>
                  <th className="text-right px-2 py-3 text-sm font-medium text-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap">
                    Current
                  </th>
                </tr>
              </thead>
              <tbody>
                {nadaChangeRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-border transition-colors"
                  >
                    <td className="px-3 py-2 text-sm text-muted-foreground sticky left-0 bg-card z-[50] border-r border-border">
                      <span className="whitespace-nowrap">{row.label}</span>
                    </td>
                    {row.values.map((value, monthIndex) => (
                      <td
                        key={monthIndex}
                        className={cn(
                          "text-right px-2 py-2 text-sm border-l border-border whitespace-nowrap",
                          value !== 0
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatPercentage(value)}
                      </td>
                    ))}
                    <td className="text-right px-2 py-2 text-sm border-l border-border bg-card whitespace-nowrap">
                      <span
                        className={cn(
                          row.average !== 0
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatPercentage(row.average)}
                      </span>
                    </td>
                    <td className="text-right px-2 py-2 text-sm border-l border-border bg-card whitespace-nowrap">
                      <span
                        className={cn(
                          row.current !== 0
                            ? "text-primary font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatPercentage(row.current)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* NADA Depreciation Schedule Current Year Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="flex justify-between items-center p-4 border-b border-border">
             <h2 className="text-lg font-semibold text-primary">
               NADA Depreciation Schedule {selectedYear}
             </h2>
            {!isClient && (
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/80"
                onClick={() => handleAdd(false)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            )}
          </div>
          <div className="w-full overflow-x-auto">
            <table className="border-collapse w-full table-auto">
              <thead className="bg-card">
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-3 py-3 text-sm font-medium text-foreground sticky top-0 left-0 bg-card z-index-[auto] border-r border-border whitespace-nowrap">
                    Current Cost of Vehicle
                  </th>
                  {months.map((month) => (
                    <th
                      key={month}
                      className="text-right px-2 py-3 text-sm font-medium text-muted-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                  <th className="text-right px-2 py-3 text-sm font-medium text-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap">
                    Current
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingNada ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center text-muted-foreground">
                      Loading NADA depreciation data...
                    </td>
                  </tr>
                ) : nadaDepreciationError ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center">
                      <div className="text-red-700 mb-2">
                        Error loading data: {nadaDepreciationError instanceof Error ? nadaDepreciationError.message : "Unknown error"}
                      </div>
                      <Button
                        onClick={() => refetchNadaDepreciation()}
                        className="bg-primary text-primary-foreground hover:bg-primary/80 text-sm"
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : nadaCurrentRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center text-muted-foreground">
                      No data available for {selectedYear}. Click "Add" to create entries.
                    </td>
                  </tr>
                ) : (
                  <>
                    {nadaCurrentRows.map((row, rowIndex) => {
                      const dataItem = nadaDepreciation.find(
                        (item) =>
                          item.nadaDepreciationId === row.categoryId &&
                          item.nadaDepreciationDate.startsWith(selectedYear)
                      );
                  return (
                    <tr
                      key={rowIndex}
                      className="border-b border-border transition-colors"
                    >
                      <td className="px-3 py-2 text-sm text-muted-foreground sticky left-0 bg-card z-[50] border-r border-border">
                            <span className="whitespace-nowrap">
                              {row.label}
                            </span>
                      </td>
                          {row.values.map((value, monthIndex) => {
                            const monthData = nadaDepreciation.find(
                              (item) =>
                                item.nadaDepreciationId === row.categoryId &&
                                item.nadaDepreciationDate ===
                                  `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`
                            );
                            const hasData = value !== 0 && monthData;
                            return (
                        <td
                          key={monthIndex}
                                onClick={() => {
                                  if (monthData) {
                                    handleEdit(monthData, false);
                                  }
                                }}
                          className={cn(
                            "text-right px-2 py-2 text-sm border-l border-border whitespace-nowrap",
                                  hasData
                                    ? "text-primary underline cursor-pointer hover:bg-card"
                                    : value !== 0
                              ? "text-muted-foreground font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                                {row.isMiles
                                  ? value.toLocaleString()
                                  : formatCurrency(value)}
                        </td>
                            );
                          })}
                      <td className="text-right px-2 py-2 text-sm border-l border-border bg-card whitespace-nowrap">
                            <span
                              className={cn(
                                row.current !== 0
                                  ? "text-primary font-medium"
                            : "text-muted-foreground"
                              )}
                            >
                              {row.isMiles
                                ? row.current.toLocaleString()
                                : formatCurrency(row.current)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                    {/* Total Equity Row */}
                    <tr className="border-b border-border font-semibold">
                      <td className="px-3 py-2 text-sm text-primary sticky left-0 bg-muted/30 z-[50] border-r border-border">
                        <span className="whitespace-nowrap">
                          Total Equity in Car
                        </span>
                      </td>
                      {totalEquityRow.values.map((value, monthIndex) => (
                        <td
                          key={monthIndex}
                          className={cn(
                            "text-right px-2 py-2 text-sm border-l border-border whitespace-nowrap",
                            value !== 0 ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {formatCurrency(value)}
                        </td>
                      ))}
                      <td className="text-right px-2 py-2 text-sm border-l border-border bg-card whitespace-nowrap">
                        <span
                          className={cn(
                            totalEquityRow.values[totalEquityRow.values.length - 1] !== 0
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatCurrency(
                            totalEquityRow.values[totalEquityRow.values.length - 1]
                          )}
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NADA Depreciation Schedule Graphs */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-muted-foreground mb-4">
              NADA Depreciation Schedule Graphs
            </h2>
            <h3 className="text-md font-medium text-primary">
              NADA Depreciation Schedule {previousYear}
            </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={previousChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#fff",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend 
                  wrapperStyle={{ color: "#9ca3af" }}
                  iconType="square"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Retail"
                  stroke="#9333ea"
                  strokeWidth={2}
                  dot={{ fill: "#9333ea", r: 4 }}
                  name="NADA - Retail"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Clean"
                  stroke="#1e293b"
                  strokeWidth={2}
                  dot={{ fill: "#1e293b", r: 4 }}
                  name="NADA - Clean"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Average"
                  stroke="#D3BC8D"
                  strokeWidth={2}
                  dot={{ fill: "#D3BC8D", r: 4 }}
                  name="NADA - Average"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Rough"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: "#06b6d4", r: 4 }}
                  name="NADA - Rough"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NADA Change % Chart */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-border">
             <h3 className="text-md font-medium text-primary">
               NADA Change % {previousYear} - {selectedYear}
             </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={changeChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                  tickFormatter={(value) => formatPercentage(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#fff",
                  }}
                  formatter={(value: number) => formatPercentage(value)}
                />
                <Legend 
                  wrapperStyle={{ color: "#9ca3af" }}
                  iconType="square"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Retail"
                  stroke="#ea580c"
                  strokeWidth={2}
                  dot={{ fill: "#ea580c", r: 4 }}
                  name="NADA - Retail"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Clean"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ fill: "#38bdf8", r: 4 }}
                  name="NADA - Clean"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Average"
                  stroke="#D3BC8D"
                  strokeWidth={2}
                  dot={{ fill: "#D3BC8D", r: 4 }}
                  name="NADA - Average"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Rough"
                  stroke="#1e40af"
                  strokeWidth={2}
                  dot={{ fill: "#1e40af", r: 4 }}
                  name="NADA - Rough"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NADA Depreciation Schedule Current Year Chart */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-border">
             <h3 className="text-md font-medium text-primary">
               NADA Depreciation Schedule {selectedYear}
             </h3>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={currentChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tick={{ fill: "#9ca3af" }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    color: "#fff",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend 
                  wrapperStyle={{ color: "#9ca3af" }}
                  iconType="square"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Retail"
                  stroke="#9333ea"
                  strokeWidth={2}
                  dot={{ fill: "#9333ea", r: 4 }}
                  name="NADA - Retail"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Clean"
                  stroke="#1e293b"
                  strokeWidth={2}
                  dot={{ fill: "#1e293b", r: 4 }}
                  name="NADA - Clean"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Average"
                  stroke="#D3BC8D"
                  strokeWidth={2}
                  dot={{ fill: "#D3BC8D", r: 4 }}
                  name="NADA - Average"
                />
                <Line
                  type="monotone"
                  dataKey="NADA - Rough"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: "#06b6d4", r: 4 }}
                  name="NADA - Rough"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddModalOpen && (
        <NadaDepreciationModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setItemEdit(null);
          }}
          carId={carId!}
          year={selectedYear}
          itemEdit={itemEdit}
          isWithAdd={false}
          clientId={car?.userId}
          userId={car?.userId}
        />
      )}

      {isAddModalWithAddOpen && (
        <NadaDepreciationModal
          isOpen={isAddModalWithAddOpen}
          onClose={() => {
            setIsAddModalWithAddOpen(false);
            setItemEdit(null);
          }}
          carId={carId!}
          year={selectedYear}
          itemEdit={itemEdit}
          isWithAdd={true}
          clientId={car?.userId}
          userId={car?.userId}
        />
      )}

      {isLogModalOpen && (
        <NadaDepreciationLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          carId={carId!}
          item={`NADA-depreciation-schedule-${selectedYear}`}
        />
      )}

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Import NADA Depreciation Schedule</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a CSV or Excel file with the NADA Depreciation Schedule template format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Select File (CSV or Excel)
              </label>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                  }
                }}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
              {importFile && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                }}
                className="bg-card text-foreground hover:bg-muted border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                {isImporting ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
