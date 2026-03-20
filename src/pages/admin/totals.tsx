import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, ExternalLink, Download, Plus, Minus } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
  turoLink?: string | null;
  adminTuroLink?: string | null;
  fuelType?: string | null;
  tireSize?: string | null;
  oilType?: string | null;
}

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function TotalsPage() {
  const [individualRoute, individualParams] = useRoute("/admin/cars/:id/totals");
  const [allCarsRoute] = useRoute("/admin/totals/all");
  const [, setLocation] = useLocation();
  
  const isAllCarsReport = !!allCarsRoute;
  const carId = individualParams?.id ? parseInt(individualParams.id, 10) : null;

  // Role check
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
  
  const [filterType, setFilterType] = useState<string>("Year");
  const [fromYear, setFromYear] = useState<string>(new Date().getFullYear().toString());
  const [toYear, setToYear] = useState<string>(new Date().getFullYear().toString());
  const [fromMonth, setFromMonth] = useState<string>("1");
  const [toMonth, setToMonth] = useState<string>("12");

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
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
    enabled: !!carId && !isAllCarsReport,
    retry: false,
  });

  const car: CarDetail | undefined = data?.data;

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

  // Fetch totals data
  const { data: totalsData, isLoading: totalsLoading } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: isAllCarsReport 
      ? ["/api/cars/totals/all", filterType, fromYear, toYear, fromMonth, toMonth]
      : ["/api/cars", carId, "totals", filterType, fromYear, toYear, fromMonth, toMonth],
    queryFn: async () => {
      const params = new URLSearchParams({
        filter: filterType,
        from: fromYear,
        to: toYear,
      });
      
      if (filterType === "Month" || filterType === "Quarter") {
        params.append("fromMonth", fromMonth);
        params.append("toMonth", toMonth);
      }
      
      const url = isAllCarsReport
        ? buildApiUrl(`/api/cars/totals/all?${params.toString()}`)
        : buildApiUrl(`/api/cars/${carId}/totals?${params.toString()}`);
        
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch totals");
      }
      return response.json();
    },
    enabled: isAllCarsReport || !!carId,
    retry: false,
  });

  const totals = totalsData?.data || null;

  if ((isLoading || totalsLoading) && !isAllCarsReport) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (!isAllCarsReport && (error || !car)) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => setLocation("/cars")}
            className="mt-4 text-blue-700 hover:underline"
          >
            ← Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Define car-related variables only when car is defined (i.e., when not in all cars report)
  const carName = car ? (car.makeModel || `${car.year || ""} ${car.vin}`.trim()) : "";
  const ownerName = car?.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";
  const ownerContact = car?.owner?.phone || "N/A";
  const ownerEmail = car?.owner?.email || "N/A";
  const fuelType = onboarding?.fuelType || car?.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car?.tireSize || "N/A";
  const oilType = onboarding?.oilType || car?.oilType || "N/A";

  const categories = [
    { id: "expenses", label: "EXPENSES", total: totals?.carManagementSplit || 0 },
    { id: "income", label: "INCOME", total: totals?.income?.totalProfit || 0 },
    { id: "operating-expenses-direct", label: "OPERATING EXPENSES (DIRECT DELIVERY)", total: totals?.operatingExpensesDirect?.total || 0 },
    { id: "operating-expenses-cogs", label: "OPERATING EXPENSES (COGS - Per Vehicle)", total: totals?.expenses?.totalOperatingExpenses || 0 },
    { id: "gla", label: "GLA PARKING FEE & LABOR CLEANING", total: totals?.gla?.total || 0 },
    ...(isAllCarsReport ? [{ id: "operating-expenses-office", label: "OPERATING EXPENSES (Office Support)", total: totals?.operatingExpensesOffice?.total || 0 }] : []),
    { id: "reimbursed-bills", label: "REIMBURSED AND NON-REIMBURSED BILLS", total: (totals?.reimbursedBills?.electricReimbursed || 0) + (totals?.reimbursedBills?.gasReimbursed || 0) + (totals?.reimbursedBills?.uberLyftLimeReimbursed || 0) },
    { id: "history", label: "VEHICLE HISTORY", total: totals?.history?.daysRented || 0 },
    { id: "payments", label: "PAYMENT HISTORY", total: totals?.payments?.total || 0 },
  ];

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          {!isAllCarsReport && (
            <button
              onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to View Car</span>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-primary">
              {isAllCarsReport ? "ALL CARS REPORT - TOTALS" : "INDIVIDUAL CAR REPORT - TOTALS"}
            </h1>
            {!isAllCarsReport && car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Car and Owner Information Header */}
        {!isAllCarsReport && car && (
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-primary mb-2">Totals</h1>
              </div>
              <Button
                variant="outline"
                className="bg-card border-border text-foreground hover:bg-muted flex items-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
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
                  {car.clientId ? (
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
        )}

        {/* Filters Section */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-card border-border text-foreground w-[150px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="Year">Year</SelectItem>
                <SelectItem value="Month">Month</SelectItem>
                <SelectItem value="Quarter">Quarter</SelectItem>
              </SelectContent>
            </Select>

            {(filterType === "Month" || filterType === "Quarter") && (
              <>
                <Select value={fromMonth} onValueChange={setFromMonth}>
                  <SelectTrigger className="bg-card border-border text-foreground w-[120px]">
                    <SelectValue placeholder="From Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2000, month - 1).toLocaleString('default', { month: 'short' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={toMonth} onValueChange={setToMonth}>
                  <SelectTrigger className="bg-card border-border text-foreground w-[120px]">
                    <SelectValue placeholder="To Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2000, month - 1).toLocaleString('default', { month: 'short' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Select value={fromYear} onValueChange={setFromYear}>
              <SelectTrigger className="bg-card border-border text-foreground w-[120px]">
                <SelectValue placeholder="From Year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={toYear} onValueChange={setToYear}>
              <SelectTrigger className="bg-card border-border text-foreground w-[120px]">
                <SelectValue placeholder="To Year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Totals Categories */}
        <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ overflowY: 'auto' }}>
          <Accordion type="multiple" className="w-full">
            {categories.map((category) => {
              // Special handling for EXPENSES category
              if (category.id === "expenses") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Category Header */}
                        <div className="flex justify-between text-muted-foreground text-sm font-bold mb-2">
                          <span>Car Management and Car Owner Split</span>
                        </div>
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Car Management Split</span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(totals?.carManagementSplit || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Car Owner Split</span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(totals?.carOwnerSplit || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for OPERATING EXPENSES (DIRECT DELIVERY) category
              if (category.id === "operating-expenses-direct") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor - Car Cleaning</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesDirect?.laborCarCleaning || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor - Driver</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesDirect?.laborDriver || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Parking - Airport</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesDirect?.parkingAirport || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Taxi/Uber/Lyft/Lime</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesDirect?.taxiUberLyftLime || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold pt-2 border-t border-border">
                          <span>Total OPERATING EXPENSES (Direct Delivery)</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.operatingExpensesDirect?.total || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for OPERATING EXPENSES (COGS - Per Vehicle) category
              if (category.id === "operating-expenses-cogs") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Auto Body Shop / Wreck</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.autoBodyShop || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Alignment</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.alignment || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Battery</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.battery || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Brakes</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.brakes || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Car Payment</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.carPayment || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Car Insurance</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.carInsurance || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Car Seats</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.carSeats || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Cleaning Supplies / Tools</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.cleaningSupplies || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Emissions</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.emissions || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>GPS System</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.gpsSystem || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Keys & Fob</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.keysFob || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor - Cleaning</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.laborDetailing || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Parking Airport (Reimbursed - GLA - Client Owner Rentals)</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.parkingAirport || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Uber/Lyft/Lime - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.uberNotReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Uber/Lyft/Lime - Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.uberReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas - Service Run</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.gasServiceRun || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.gasReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.gasNotReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Electric Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.electricReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Electric - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.electricNotReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Windshield</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.windshield || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Wipers</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.wipers || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Uber/Lyft/Lime</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.uberLyftLime || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Towing / Impound Fees</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.towingImpoundFees || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Tired Air Station</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.tiredAirStation || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Tires</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.tires || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Oil/Lube</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.oilLube || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Parts</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.parts || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Ski Racks</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.skiRacks || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Tickets & Tolls</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.ticketsTolls || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Mechanic</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.mechanic || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>License & Registration</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.expenses?.licenseRegistration || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold pt-2 border-t border-border">
                          <span className="font-bold">Total OPERATING EXPENSES (COGS - Per Vehicle)</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.expenses?.totalOperatingExpenses || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for INCOME category
              if (category.id === "income") {
                const negativeBalance = totals?.income?.negativeBalance || 0;
                const formatNegativeCurrency = (value: number): string => {
                  if (value < 0) {
                    return `$ (${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
                  }
                  return formatCurrency(value);
                };

                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Income Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Rental Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.rentalIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Delivery Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.deliveryIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Electric Prepaid Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.electricPrepaidIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Smoking Fines</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.smokingFines || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas Prepaid Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.gasPrepaidIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Miles Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.milesIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Ski Racks Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.skiRacksIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Child Seat Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.childSeatIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Coolers Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.coolersIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Income Insurance and Client Wrecks</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.incomeInsurance || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Other Income</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.income?.otherIncome || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Negative Balance Carry Over</span>
                          <span className={negativeBalance < 0 ? "text-primary" : "text-foreground"}>
                            {formatNegativeCurrency(negativeBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm pt-2 border-t border-border">
                          <span className="font-medium">Car Management Total Expenses</span>
                          <span className="text-foreground font-semibold">
                            {formatCurrency(totals?.income?.carManagementTotalExpenses || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span className="font-medium">Car Owner Total Expenses</span>
                          <span className="text-foreground font-semibold">
                            {formatCurrency(totals?.income?.carOwnerTotalExpenses || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold pt-2 border-t border-border">
                          <span>Total Expenses</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.income?.totalExpenses || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold">
                          <span>Car Payment</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.income?.carPayment || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold">
                          <span>Total Profit</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.income?.totalProfit || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for GLA PARKING FEE & LABOR CLEANING category
              if (category.id === "gla") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>GLA Labor - Cleaning</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.gla?.laborCleaning || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>GLA Parking Fee</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.gla?.parkingFee || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold pt-2 border-t border-border">
                          <span className="font-bold">Total GLA PARKING FEE & LABOR CLEANING</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.gla?.total || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for REIMBURSED AND NON-REIMBURSED BILLS category
              if (category.id === "reimbursed-bills") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Electric - Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.electricReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Electric - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.electricNotReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas - Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.gasReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.gasNotReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Gas - Service Run</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.gasServiceRun || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Parking Airport</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.parkingAirport || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Uber/Lyft/Lime - Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.uberLyftLimeReimbursed || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Uber/Lyft/Lime - Not Reimbursed</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.reimbursedBills?.uberLyftLimeNotReimbursed || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for OPERATING EXPENSES (Office Support) category - Only for All Cars Report
              if (category.id === "operating-expenses-office") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Accounting & Professional Fees</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.accountingProfessionalFees || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Advertizing</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.advertizing || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Bank Charges</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.bankCharges || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Detail Mobile</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.detailMobile || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Charitable Contributions</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.charitableContributions || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Computer & Internet</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.computerInternet || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Delivery, Postage & Freight</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.deliveryPostageFreight || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Detail Shop Equipment</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.detailShopEquipment || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Dues & Subscription</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.duesSubscription || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>General and administrative (G&A)</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.generalAdministrative || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Health & Wellness</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.healthWellness || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor - Human Resources</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.laborHumanResources || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor - Marketing</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.laborMarketing || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Office Rent</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.officeRent || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Outside & Staff Contractors</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.outsideStaffContractors || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Park n Jet Booth</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.parknJetBooth || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Printing</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.printing || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Referral</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.referral || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Repairs & Maintenance</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.repairsMaintenance || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Sales Tax</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.salesTax || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Security Cameras</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.securityCameras || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Supplies & Materials</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.suppliesMaterials || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Taxes and License</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.taxesLicense || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Telephone</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.telephone || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Travel</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.travel || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor Software</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.laborSoftware || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Legal & Professional</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.legalProfessional || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Marketing</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.marketing || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Meals & Entertainment</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.mealsEntertainment || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Office Expense</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.officeExpense || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Labor Sales</span>
                          <span className="text-foreground">
                            {formatCurrency(totals?.operatingExpensesOffice?.laborSales || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm font-bold pt-2 border-t border-border">
                          <span className="font-bold">Total OPERATING EXPENSES (Office Support)</span>
                          <span className="text-foreground font-bold">
                            {formatCurrency(totals?.operatingExpensesOffice?.total || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-base font-extrabold">
                          <span className="font-extrabold">Total Expenses</span>
                          <span className="text-foreground font-extrabold">
                            {formatCurrency(totals?.operatingExpensesOffice?.totalExpenses || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for HISTORY OF THE CARS category
              if (category.id === "history") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Days Rented</span>
                          <span className="text-foreground font-medium">
                            {totals?.history?.daysRented || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Cars Available For Rent</span>
                          <span className="text-foreground font-medium">
                            {totals?.history?.carsAvailableForRent || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>Trips Taken</span>
                          <span className="text-foreground font-medium">
                            {totals?.history?.tripsTaken || 0}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Special handling for PAYMENT HISTORY category
              if (category.id === "payments") {
                return (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                  >
                    <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                          <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                          <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                        </div>
                        <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                      <div className="space-y-2 pt-2">
                        {/* Child Items */}
                        <div className="flex justify-between text-muted-foreground text-sm">
                          <span>{fromYear} - {toYear}</span>
                          <span className="text-foreground font-semibold">
                            {formatCurrency(totals?.payments?.total || 0)}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              // Default handling for other categories
              return (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  className="border border-border rounded-lg overflow-hidden bg-card mb-2 last:mb-0"
                >
                  <AccordionTrigger className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted transition-colors [&>svg]:hidden">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                        <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                        <span className="text-foreground font-medium text-sm sm:text-base">{category.label}</span>
                      </div>
                      <span className="text-foreground font-semibold text-sm sm:text-base">TOTALS</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-6 pb-4 bg-background">
                    <div className="space-y-2 pt-2">
                      {/* Placeholder content - will be replaced with actual data from API */}
                      <div className="flex justify-between text-muted-foreground text-sm">
                        <span>No data available</span>
                        <span className="text-foreground">{formatCurrency(category.total)}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </AdminLayout>
  );
}

