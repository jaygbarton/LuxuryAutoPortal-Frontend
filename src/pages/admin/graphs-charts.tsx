import React from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { GraphsChartsReportSection } from "@/pages/admin/components/GraphsChartsReportSection";

export default function GraphsChartsPage() {
  const [, params] = useRoute("/admin/cars/:id/graphs");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;

  const { data: authData } = useQuery<{ user?: { isClient?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
  });
  const isClient = authData?.user?.isClient === true;

  const { data, isLoading, error } = useQuery<{
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

  const car = data?.data;

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

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
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

  // === Income/Expense data for charts (per-car) ===
  const selectedYear = new Date().getFullYear().toString();

  const { data: incomeExpenseResp } = useQuery<{ success: boolean; data: any }>(
    {
      queryKey: ["/api/income-expense", carId, selectedYear],
      queryFn: async () => {
        if (!carId) throw new Error("Invalid car ID");
        const url = buildApiUrl(`/api/income-expense/${carId}/${selectedYear}`);
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) return { success: true, data: null };
        return resp.json();
      },
      enabled: !!carId,
      retry: false,
    }
  );

  const incomeExpenseData = incomeExpenseResp?.data || null;

  const getMonthValue = (arr: any[] = [], month: number, field: string) => {
    if (!arr || arr.length === 0) return 0;
    const m = arr.find((x: any) => Number(x.month) === Number(month));
    return m ? Number(m[field] || 0) : 0;
  };

  const calculateCarManagementSplit = (month: number): number => {
    const percent = incomeExpenseData?.formulaSetting?.carManagementSplitPercent || 0;
    const mgmtPct = percent / 100;
    const rentalIncome = getMonthValue(incomeExpenseData?.incomeExpenses || [], month, "rentalIncome");
    return rentalIncome * mgmtPct;
  };

  const calculateCarOwnerSplit = (month: number): number => {
    const rentalIncome = getMonthValue(incomeExpenseData?.incomeExpenses || [], month, "rentalIncome");
    return rentalIncome - calculateCarManagementSplit(month);
  };

  const calculateCarManagementTotalExpenses = (month: number): number => {
    return getMonthValue(incomeExpenseData?.incomeExpenses || [], month, "carManagementTotalExpenses");
  };

  const calculateCarOwnerTotalExpenses = (month: number): number => {
    return getMonthValue(incomeExpenseData?.incomeExpenses || [], month, "carOwnerTotalExpenses");
  };

  const getMonthValueWrapper = (arr: any[], month: number, field: string) => getMonthValue(arr, month, field);

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
            <h1 className="text-2xl font-bold text-primary">Graphs and Charts Report</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Car Information */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Information</h3>
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
                  <p className="text-sm text-muted-foreground">{car.licensePlate || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Owner Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Name:</span>
                  <p className="text-sm text-[#B8860B] font-semibold">{ownerName}</p>
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

            {/* Car Specifications & Turo Links */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Specifications</h3>
              <div className="space-y-2 mb-4">
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
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Turo Links</h3>
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
                    <span className="text-muted-foreground text-sm">No Turo links available</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <GraphsChartsReportSection
          className="mb-6"
          incomeExpenseData={incomeExpenseData}
          selectedYear={selectedYear}
          calculateCarManagementSplit={calculateCarManagementSplit}
          calculateCarOwnerSplit={calculateCarOwnerSplit}
          calculateCarManagementTotalExpenses={calculateCarManagementTotalExpenses}
          calculateCarOwnerTotalExpenses={calculateCarOwnerTotalExpenses}
          getMonthValue={getMonthValueWrapper}
        />
      </div>
    </AdminLayout>
  );
}

