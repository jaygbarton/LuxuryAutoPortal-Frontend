import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";

const additionalColumns = [
  "Yr End Recon",
  "Yr End Recon Split",
  "Total",
];

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

export default function TotalExpensesPage() {
  const [, params] = useRoute("/admin/cars/:id/expenses");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const [selectedYear, setSelectedYear] = useState<string>("2026");

  const months = generateMonths(selectedYear);

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

  const calculateYearEndRecon = (values: number[]): number => {
    return values.reduce((sum, val) => sum + val, 0);
  };

  const calculateYearEndReconSplit = (values: number[]): number => {
    return calculateYearEndRecon(values) * 0.5;
  };

  const calculateGrandTotal = (values: number[]): number => {
    return calculateYearEndRecon(values);
  };

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
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
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

  // Expense rows data
  const expenseRows = [
    { label: "Direct Delivery", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { label: "COGS", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { label: "Office Support", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];

  // Calculate total expenses
  const totalExpenses = months.map((_, monthIndex) =>
    expenseRows.reduce((sum, row) => sum + row.values[monthIndex], 0)
  );

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
            <h1 className="text-2xl font-bold text-primary">Total Expenses</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {/* Car Specifications */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Specifications</h3>
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

        {/* Total Expenses Header with Year Filter */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif text-primary italic">Total Expenses</h1>
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

        {/* Total Expenses Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="w-full overflow-x-auto">
            <table className="border-collapse w-full table-fixed" style={{ minWidth: '1200px' }}>
              <colgroup>
                <col style={{ width: '20%' }} />
                {months.map((_, idx) => <col key={idx} style={{ width: '5%' }} />)}
                {additionalColumns.map((_, idx) => <col key={idx} style={{ width: '6%' }} />)}
              </colgroup>
              <thead className="bg-card">
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-3 py-3 text-sm font-medium text-foreground sticky top-0 left-0 bg-card z-[60] border-r border-border">
                    Expenses
                  </th>
                  {months.map((month) => (
                    <th
                      key={month}
                      className="text-right px-2 py-3 text-sm font-medium text-muted-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                  {additionalColumns.map((col) => (
                    <th
                      key={col}
                      className="text-right px-2 py-3 text-sm font-medium text-muted-foreground sticky top-0 bg-card z-30 border-l border-border whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((row, rowIndex) => (
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
                          "text-right px-2 py-2 text-sm border-l border-border",
                          value !== 0
                            ? "text-muted-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatCurrency(value)}
                      </td>
                    ))}
                    <td className="text-right px-2 py-2 text-sm border-l border-border bg-card">
                      <span className={cn(
                        calculateYearEndRecon(row.values) !== 0
                          ? "text-muted-foreground font-medium"
                          : "text-muted-foreground"
                      )}>
                        {formatCurrency(calculateYearEndRecon(row.values))}
                      </span>
                    </td>
                    <td className="text-right px-2 py-2 text-sm border-l border-border bg-card">
                      <span className={cn(
                        calculateYearEndReconSplit(row.values) !== 0
                          ? "text-muted-foreground font-medium"
                          : "text-muted-foreground"
                      )}>
                        {formatCurrency(calculateYearEndReconSplit(row.values))}
                      </span>
                    </td>
                    <td className="text-right px-2 py-2 text-sm font-semibold border-l border-border bg-card">
                      <span className={cn(
                        calculateGrandTotal(row.values) !== 0
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                      )}>
                        {formatCurrency(calculateGrandTotal(row.values))}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total Expenses Row */}
                <tr className="border-b border-border hover:bg-muted/50 transition-colors bg-muted/30">
                  <td className="px-3 py-2 text-sm font-semibold text-primary sticky left-0 bg-muted/30 z-[50] border-r border-border">
                    <span className="whitespace-nowrap">Total Expenses</span>
                  </td>
                  {totalExpenses.map((value, monthIndex) => (
                    <td
                      key={monthIndex}
                      className={cn(
                        "text-right px-2 py-2 text-sm font-semibold border-l border-border",
                        value !== 0
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(value)}
                    </td>
                  ))}
                  <td className="text-right px-2 py-2 text-sm font-semibold border-l border-border bg-card">
                    <span className={cn(
                      calculateYearEndRecon(totalExpenses) !== 0
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}>
                      {formatCurrency(calculateYearEndRecon(totalExpenses))}
                    </span>
                  </td>
                  <td className="text-right px-2 py-2 text-sm font-semibold border-l border-border bg-card">
                    <span className={cn(
                      calculateYearEndReconSplit(totalExpenses) !== 0
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}>
                      {formatCurrency(calculateYearEndReconSplit(totalExpenses))}
                    </span>
                  </td>
                  <td className="text-right px-2 py-2 text-sm font-semibold border-l border-border bg-card">
                    <span className={cn(
                      calculateGrandTotal(totalExpenses) !== 0
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}>
                      {formatCurrency(calculateGrandTotal(totalExpenses))}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}

