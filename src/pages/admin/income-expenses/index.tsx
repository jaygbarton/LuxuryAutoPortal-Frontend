import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import CarHeader from "./components/CarHeader";
import IncomeExpenseTable from "./components/IncomeExpenseTable";
import TableActions from "./components/TableActions";
import FormSubmissionsAndReceipts from "./components/FormSubmissionsAndReceipts";
import { IncomeExpenseProvider } from "./context/IncomeExpenseContext";
import type { IncomeExpenseData } from "./types";
import ModalEditManagementSplit from "./modals/ModalEditManagementSplit";
import ModalEditIncomeExpense from "./modals/ModalEditIncomeExpense";
import ModalEditDirectDelivery from "./modals/ModalEditDirectDelivery";
import ModalEditCOGS from "./modals/ModalEditCOGS";
import ModalEditParkingFeeLabor from "./modals/ModalEditParkingFeeLabor";
import ModalEditReimbursedBills from "./modals/ModalEditReimbursedBills";
import ModalEditHistory from "./modals/ModalEditHistory";
import ModalEditParkingAirportQB from "./modals/ModalEditParkingAirportQB";
import ModalEditDynamicSubcategory from "./modals/ModalEditDynamicSubcategory";

interface IncomeExpensesPageProps {
  carIdFromRoute?: number; // When accessed from /admin/cars/:id/income-expense
}

export default function IncomeExpensesPage({ carIdFromRoute }: IncomeExpensesPageProps) {
  const [, setLocation] = useLocation();

  // Get car ID from URL query parameter OR route parameter
  const carIdFromQuery = useMemo(() => {
    if (carIdFromRoute) return carIdFromRoute; // Priority to route param
    
    if (typeof window === "undefined") return null;
    const carParam = new URLSearchParams(window.location.search).get("car");
    if (!carParam) return null;
    const parsed = parseInt(carParam, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [carIdFromRoute]);

  const isCarFocused = !!carIdFromQuery;
  const isFromRoute = !!carIdFromRoute; // User came from View Car menu
  const isAdminAllCarsView = !isCarFocused; // Admin viewing all cars (Income and Expenses menu)

  const [selectedCar, setSelectedCar] = useState<string>(
    carIdFromQuery ? String(carIdFromQuery) : "allcars"
  );
  const [carSelectOpen, setCarSelectOpen] = useState(false);
  
  // Get current year and generate year options (from 2019 to current year + 2 years)
  const currentYear = new Date().getFullYear();
  const startYear = 2019;
  const endYear = currentYear + 2;
  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  // Update selected car when carIdFromQuery changes
  useEffect(() => {
    if (carIdFromQuery) {
      setSelectedCar(String(carIdFromQuery));
    }
  }, [carIdFromQuery]);

  // Fetch car details if carIdFromQuery is present
  const { data: carData, isLoading: isCarLoading, error: carError } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/cars", carIdFromQuery],
    queryFn: async () => {
      if (!carIdFromQuery) throw new Error("Invalid car ID");
      const response = await fetch(buildApiUrl(`/api/cars/${carIdFromQuery}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carIdFromQuery,
    retry: false,
  });

  const car = carData?.data;

  // Fetch onboarding data for additional car info
  const { data: onboardingData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const response = await fetch(
        buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        if (response.status === 404) return { success: true, data: null };
        throw new Error("Failed to fetch onboarding data");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.data;

  // Fetch all cars for dropdown so the search box searches all vehicles in the system
  const { data: carsData } = useQuery({
    queryKey: ["/api/cars", "income-expenses", "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "1000", status: "all" });
      const response = await fetch(buildApiUrl(`/api/cars?${params}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch cars");
      return response.json();
    },
    enabled: true, // Always fetch so vehicle selection searches all vehicles in the system
  });

  const cars = carsData?.data || [];
  const [carComboboxOpen, setCarComboboxOpen] = useState(false);
  const [carComboboxOpenPerCar, setCarComboboxOpenPerCar] = useState(false);

  // Helper function to format car display name: "Make Model Year - Plate # - VIN #"
  // Format: "Car Make Model Year - Plate # - VIN #"
  const formatCarDisplayName = (car: any): string => {
    const makeModel = (car.makeModel || "").trim();
    const year = car.year ? String(car.year) : null;
    const plate = (car.licensePlate || "").trim();
    const vin = (car.vin || "").trim();
    
    // Build parts: Make Model Year, Plate, VIN
    const parts: string[] = [];
    
    // Part 1: Make Model Year
    if (makeModel) {
      parts.push(year ? `${makeModel} ${year}` : makeModel);
    } else if (year) {
      parts.push(year);
    }
    
    // Part 2: Plate #
    if (plate) {
      parts.push(plate);
    }
    
    // Part 3: VIN #
    if (vin) {
      parts.push(vin);
    }
    
    // Join with " - " separator
    return parts.length > 0 ? parts.join(" - ") : "Unknown Car";
  };

  if (isCarLoading && isCarFocused) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (isCarFocused && (carError || !car)) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => setLocation("/cars")}
            className="mt-4 text-[#EAEB80] hover:underline"
          >
            ← Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Determine which carId to use for data fetching
  // "all" = show aggregate data, "allcars" = show "All Cars" aggregate view, specific ID = individual car
  const activeCarId = selectedCar !== "all" && selectedCar !== "allcars" ? parseInt(selectedCar) : null;
  const isAllCarsView = selectedCar === "allcars";

  // Show different UI based on whether this is per-car view or all-cars admin view
  if (!activeCarId && !isAllCarsView) {
    // Admin "Income and Expenses" (plural) - Initial view with car selector
    return (
      <AdminLayout>
        <div className="flex flex-col w-full">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-primary mb-2">
              Income and Expenses
            </h1>
            <p className="text-muted-foreground text-sm">
              Financial tracking and expense management - All Cars
            </p>
          </div>

          {/* Car Selector and Year Filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-[400px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Select a car
              </label>
              <Popover open={carComboboxOpen} onOpenChange={setCarComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={carComboboxOpen}
                    className="w-full justify-between bg-muted border-border text-foreground hover:bg-muted overflow-hidden"
                  >
                    <span className="truncate text-left flex-1 min-w-0">
                    {selectedCar === "all"
                      ? "-- Select a Car --"
                      : selectedCar === "allcars"
                      ? "All Cars"
                      : (() => {
                          const selectedCarObj = cars.find((car: any) => car.id.toString() === selectedCar);
                          return selectedCarObj ? formatCarDisplayName(selectedCarObj) : "-- Select a Car --";
                        })()}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-muted border-border">
                  <Command className="bg-muted">
                    <CommandInput 
                      placeholder="Search car by make, model, plate, or VIN..." 
                      className="text-foreground placeholder:text-muted-foreground"
                    />
                    <CommandList>
                      <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
                        No car found.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedCar("all");
                            setCarComboboxOpen(false);
                          }}
                          className="text-foreground hover:bg-muted cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedCar === "all" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          -- Select a Car --
                        </CommandItem>
                        <CommandItem
                          value="All Cars"
                          onSelect={() => {
                            setSelectedCar("allcars");
                            setCarComboboxOpen(false);
                          }}
                          className="text-foreground hover:bg-muted cursor-pointer font-semibold"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedCar === "allcars" ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          All Cars
                        </CommandItem>
                        {cars.map((carItem: any) => {
                          const carDisplayName = formatCarDisplayName(carItem);
                          const isSelected = selectedCar === carItem.id.toString();
                          return (
                            <CommandItem
                              key={carItem.id}
                              value={carDisplayName}
                              onSelect={() => {
                                setSelectedCar(carItem.id.toString());
                                setCarComboboxOpen(false);
                              }}
                              className="text-foreground hover:bg-muted cursor-pointer"
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  isSelected ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {carDisplayName}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-[150px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground">
                  {yearOptions.map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Message to select a car */}
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground text-lg mb-2">Please select a car to view income and expenses</p>
            <p className="text-muted-foreground text-sm">
              Choose a car from the dropdown above to see detailed financial data
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Handle "All Cars" aggregate view
  if (isAllCarsView) {
    // Use a placeholder carId (0) for the provider - the aggregated API doesn't need a specific carId
    const placeholderCarId = 0;
    
    return (
      <IncomeExpenseProvider carId={placeholderCarId} year={selectedYear} isAllCars={true}>
        <AdminLayout>
          <div className="flex flex-col w-full">
            {/* Header */}
            <div className="mb-2 flex-shrink-0">
              <button
                onClick={() => setLocation("/cars")}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Cars</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-primary">Income and Expenses</h1>
                <p className="text-sm text-muted-foreground mt-1">All Cars - Aggregate View</p>
              </div>
            </div>

            {/* Page Title and Actions */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">INCOME AND EXPENSES - ALL CARS</h1>
              <div className="flex items-center gap-2">
                <div className="w-[300px]">
                  <Popover open={carComboboxOpenPerCar} onOpenChange={setCarComboboxOpenPerCar}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={carComboboxOpenPerCar}
                        className="w-full justify-between bg-muted border-border text-foreground hover:bg-muted text-sm overflow-hidden"
                      >
                        <span className="truncate text-left flex-1 min-w-0">All Cars</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-muted border-border">
                      <Command className="bg-muted">
                        <CommandInput 
                          placeholder="Search car by make, model, plate, or VIN..." 
                          className="text-foreground placeholder:text-muted-foreground"
                        />
                        <CommandList>
                          <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
                            No car found.
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="All Cars"
                              onSelect={() => {
                                setSelectedCar("allcars");
                                setCarComboboxOpenPerCar(false);
                              }}
                              className="text-foreground hover:bg-muted cursor-pointer font-semibold"
                            >
                              <Check className="mr-2 h-4 w-4 opacity-100" />
                              All Cars
                            </CommandItem>
                            {cars.map((carItem: any) => {
                              const carDisplayName = formatCarDisplayName(carItem);
                              const isSelected = selectedCar === carItem.id.toString();
                              return (
                                <CommandItem
                                  key={carItem.id}
                                  value={carDisplayName}
                                  onSelect={() => {
                                    setSelectedCar(carItem.id.toString());
                                    setCarComboboxOpenPerCar(false);
                                  }}
                                  className="text-foreground hover:bg-muted cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      isSelected ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {carDisplayName}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <TableActions
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  carId={placeholderCarId}
                  car={null}
                />
              </div>
            </div>

            {/* Main Content Area */}
            {/*
              `min-w-0` is required on this flex child so the table's internal
              min-width (Category + 12 months + Total) doesn't force this wrapper
              wider than the flex container, which would otherwise push the whole
              page into horizontal window scroll and defeat the sticky Category
              column inside the table.
            */}
            <div className="w-full min-w-0">
              <IncomeExpenseTable year={selectedYear} isFromRoute={false} showParkingAirportQB={true} isAllCarsView={true} />
            </div>

            {/* Category-specific Edit Modals */}
            <ModalEditManagementSplit />
            <ModalEditIncomeExpense />
            <ModalEditDirectDelivery />
            <ModalEditCOGS />
            <ModalEditParkingFeeLabor />
            <ModalEditReimbursedBills />
            <ModalEditHistory />
            <ModalEditParkingAirportQB />
            <ModalEditDynamicSubcategory />
          </div>
        </AdminLayout>
      </IncomeExpenseProvider>
    );
  }

  // Per-car view (both from route and from admin selection)
  // `activeCarId!` — by this point both early-return guards above have run:
  //   1. `!activeCarId && !isAllCarsView` → shows selector UI and returns
  //   2. `isAllCarsView` → shows all-cars view and returns
  // So activeCarId is guaranteed to be a non-null number here.
  return (
    <IncomeExpenseProvider carId={activeCarId!} year={selectedYear}>
      <AdminLayout>
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="mb-2 flex-shrink-0">
            {isFromRoute ? (
              // From View Car menu
              <button
                onClick={() => setLocation(`/admin/view-car/${activeCarId}`)}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to View Car</span>
              </button>
            ) : (
              // From admin Income and Expenses menu
              <button
                onClick={() => setLocation("/cars")}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Cars</span>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-primary">Income and Expenses</h1>
              {car && (
                <p className="text-sm text-muted-foreground mt-1">
                  Car: {car.makeModel || "Unknown Car"}
                </p>
              )}
            </div>
          </div>

          {/* Car Header */}
          <div className="flex-shrink-0 mb-2">
            <CarHeader 
              car={car} 
              onboarding={onboarding} 
              onNavigateToClient={(clientId) => setLocation(`/admin/clients/${clientId}`)}
            />
          </div>

          {/* Page Title and Actions */}
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h1 className="text-2xl font-bold text-primary">INCOME AND EXPENSES</h1>
            <div className="flex items-center gap-2">
              {/* Show car selector only in admin all-cars view */}
              {!isFromRoute && (
                <div className="w-[300px]">
                  <Popover open={carComboboxOpenPerCar} onOpenChange={setCarComboboxOpenPerCar}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={carComboboxOpenPerCar}
                        className="w-full justify-between bg-muted border-border text-foreground hover:bg-muted text-sm overflow-hidden"
                      >
                        <span className="truncate text-left flex-1 min-w-0">
                        {selectedCar === "all"
                          ? "-- Select a Car --"
                          : selectedCar === "allcars"
                          ? "All Cars"
                          : (() => {
                              const selectedCarObj = cars.find((car: any) => car.id.toString() === selectedCar);
                              return selectedCarObj ? formatCarDisplayName(selectedCarObj) : "-- Select a Car --";
                            })()}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-muted border-border">
                      <Command className="bg-muted">
                        <CommandInput 
                          placeholder="Search car by make, model, plate, or VIN..." 
                          className="text-foreground placeholder:text-muted-foreground"
                        />
                        <CommandList>
                          <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
                            No car found.
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="All Cars"
                              onSelect={() => {
                                setSelectedCar("allcars");
                                setCarComboboxOpenPerCar(false);
                              }}
                              className="text-foreground hover:bg-muted cursor-pointer font-semibold"
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedCar === "allcars" ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              All Cars
                            </CommandItem>
                            {cars.map((carItem: any) => {
                              const carDisplayName = formatCarDisplayName(carItem);
                              const isSelected = selectedCar === carItem.id.toString();
                              return (
                                <CommandItem
                                  key={carItem.id}
                                  value={carDisplayName}
                                  onSelect={() => {
                                    setSelectedCar(carItem.id.toString());
                                    setCarComboboxOpenPerCar(false);
                                  }}
                                  className="text-foreground hover:bg-muted cursor-pointer"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      isSelected ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {carDisplayName}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <TableActions
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                carId={activeCarId!}
                car={car}
              />
            </div>
          </div>

          {/* Form Submissions & Receipts - separated from manual I&E entries */}
          <FormSubmissionsAndReceipts carId={activeCarId!} year={selectedYear} />

          {/* Main Content Area */}
          {/*
            `min-w-0` keeps this flex child from growing to the table's intrinsic
            min-width (Category + 12 months + Total) so horizontal scroll happens
            inside the table, not on the whole page. Without it, the sticky
            Category column slides off-screen with the window scroll.
          */}
          <div className="w-full min-w-0">
            <IncomeExpenseTable year={selectedYear} isFromRoute={isFromRoute} showParkingAirportQB={false} />
          </div>

          {/* Category-specific Edit Modals */}
          <ModalEditManagementSplit />
          <ModalEditIncomeExpense />
          <ModalEditDirectDelivery />
          <ModalEditCOGS />
          <ModalEditParkingFeeLabor />
          <ModalEditReimbursedBills />
          <ModalEditHistory />
          <ModalEditParkingAirportQB />
          <ModalEditDynamicSubcategory />
        </div>
      </AdminLayout>
    </IncomeExpenseProvider>
  );
}
