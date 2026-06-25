import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Car,
  Calendar,
  FileText,
  Folder,
  History,
  Loader2,
  Wrench,
  BarChart3,
  CreditCard,
  Globe,
  BookOpen,
  Video,
  Star,
  ClipboardList,
  PlusCircle,
  UserPlus,
  Map,
  CalendarOff,
} from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { differenceInDays } from "date-fns";

import { MONTHS_SHORT } from "./_components/constants";
import type {
  ClientProfile,
  ClientCar,
  Payment,
  QuickLink,
  TotalsData,
  NadaDepreciation,
  MaintenanceRecord,
  MonthlyTripRow,
  MonthlyDaysTripsRow,
  YearTotals,
  YearTotalsTrips,
} from "./_components/types";

import { VehicleOwnerInfo } from "./_components/VehicleOwnerInfo";
import { GlaContactCard } from "./_components/GlaContactCard";
import { NewsMediaSlot } from "./_components/NewsMediaSlot";
import { IncomeExpensesSection } from "./_components/IncomeExpensesSection";
import { TuroEarningsSection } from "./_components/TuroEarningsSection";
import { IncomeExpensesCharts } from "./_components/IncomeExpensesCharts";
import { DonutCharts } from "./_components/DonutCharts";
import { NadaChart } from "./_components/NadaChart";
import { PaymentHistoryCard } from "./_components/PaymentHistoryCard";
import { MaintenanceCard } from "./_components/MaintenanceCard";
import { ReportCenter } from "./_components/ReportCenter";
import { SupportCenter } from "./_components/SupportCenter";

export default function ClientDashboard() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedYearTrips, setSelectedYearTrips] = useState<string>(
    String(currentYear),
  );

  // ── Data Fetching ─────────────────────────────────────────────────────────────

  const { data: profileData, isLoading: profileLoading } = useQuery<{
    success: boolean;
    data: ClientProfile;
  }>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    retry: false,
  });

  const profile = profileData?.data;
  const cars = profile?.cars ?? [];

  const activeCar = useMemo<ClientCar | undefined>(() => {
    if (!cars.length) return undefined;
    if (selectedCarId)
      return cars.find((c) => c.id === selectedCarId) ?? cars[0];
    return cars[0];
  }, [cars, selectedCarId]);

  const clientId = profile?.id ?? null;
  const carId = activeCar?.id ?? null;

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{
    success: boolean;
    data: Payment[];
  }>({
    queryKey: ["/api/payments/client", clientId],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payments/client/${clientId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!clientId,
    retry: false,
  });

  // Fetch per-car income/expense data for the selected year — same source as admin I&E page.
  // This gives accurate rentalIncome per month from car_income_expenses
  // and accurate daysRented/tripsTaken from car_history.
  const { data: ieCarData, isLoading: ieCarLoading } = useQuery<{
    success: boolean;
    data: {
      incomeExpenses: {
        month: number;
        rentalIncome: number;
        carOwnerTotalExpenses: number;
        // Authoritative DOLLAR values computed by the backend split formula.
        computedCarOwnerSplit?: number;
        computedCarOwnerTotalExpenses?: number;
        computedCarManagementSplit?: number;
        computedCarManagementTotalExpenses?: number;
      }[];
      history: { month: number; daysRented: number; tripsTaken: number }[];
    };
  }>({
    queryKey: ["/api/income-expense", carId, selectedYear],
    queryFn: async () => {
      if (!carId) return { success: false, data: { incomeExpenses: [], history: [] } };
      const res = await fetch(buildApiUrl(`/api/income-expense/${carId}/${selectedYear}`), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, data: { incomeExpenses: [], history: [] } };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  // Separate query for trips year (may differ from income year)
  const { data: ieCarDataTrips } = useQuery<{
    success: boolean;
    data: {
      incomeExpenses: { month: number; rentalIncome: number }[];
      history: { month: number; daysRented: number; tripsTaken: number }[];
    };
  }>({
    queryKey: ["/api/income-expense", carId, selectedYearTrips],
    queryFn: async () => {
      if (!carId) return { success: false, data: { incomeExpenses: [], history: [] } };
      const res = await fetch(buildApiUrl(`/api/income-expense/${carId}/${selectedYearTrips}`), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, data: { incomeExpenses: [], history: [] } };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const tripsLoading = ieCarLoading;

  const { data: totalsData, isLoading: totalsLoading } = useQuery<{
    success: boolean;
    data: TotalsData;
  }>({
    queryKey: ["/api/cars", carId, "totals", selectedYear],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          filter: "Year",
          from: selectedYear,
          to: selectedYear,
        });
        const res = await fetch(
          buildApiUrl(`/api/cars/${carId}/totals?${params}`),
          { credentials: "include" },
        );
        if (!res.ok) return { success: false, data: {} };
        return res.json();
      } catch {
        return { success: false, data: {} };
      }
    },
    enabled: !!carId,
    retry: false,
  });

  const { data: quickLinksData } = useQuery<QuickLink[]>({
    queryKey: ["/api/quick-links"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/quick-links"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch quick links");
      const d = await res.json();
      return d.quickLinks ?? [];
    },
    retry: false,
  });

  const { data: nadaData, isLoading: nadaLoading } = useQuery<{
    success: boolean;
    data: NadaDepreciation[];
    count: number;
  }>({
    queryKey: ["/api/nada-depreciation/read", carId, selectedYear],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/nada-depreciation/read"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nada_depreciation_car_id: carId,
          nada_depreciation_date: selectedYear,
        }),
      });
      if (!res.ok) return { success: false, data: [], count: 0 };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const { data: newsDashboardData, isLoading: newsLoading } = useQuery<{
    success: boolean;
    slot1: any[];
    slot2: any[];
  }>({
    queryKey: ["/api/news-media/dashboard"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/news-media/dashboard"), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, slot1: [], slot2: [] };
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: maintenanceTasksData } = useQuery<{
    success: boolean;
    data: Array<{
      id: number;
      car_id: number | null;
      task_description: string | null;
      scheduled_date: string | null;
      due_date: string | null;
      status: string | null;
    }>;
  }>({
    queryKey: ["/api/operations/maintenance", carId],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance?limit=100"), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
    retry: false,
  });

  // ── Derived Data ──────────────────────────────────────────────────────────────

  const payments = useMemo<Payment[]>(() => {
    const raw =
      (paymentsData as any)?.data ?? (paymentsData as any)?.payments ?? [];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p: Payment) => {
        // Filter by selected year — only show payments whose year_month starts with the selected year
        const yearMatch =
          !selectedYear ||
          (p.payments_year_month || "").startsWith(selectedYear);
        // Filter by active car — only show this car's payments when a specific car is selected
        const carMatch = !carId || p.payments_car_id === carId;
        return yearMatch && carMatch;
      })
      .sort((a: Payment, b: Payment) =>
        b.payments_year_month.localeCompare(a.payments_year_month),
      );
  }, [paymentsData, selectedYear, carId]);

  // Per-car income/expense rows from car_income_expenses + car_history (authoritative source)
  const ieMonths = ieCarData?.data?.incomeExpenses ?? [];
  const histMonths = ieCarData?.data?.history ?? [];
  const histMonthsTrips = ieCarDataTrips?.data?.history ?? [];

  const nadaRecords: NadaDepreciation[] = nadaData?.data ?? [];

  const maintenanceRecords = useMemo<MaintenanceRecord[]>(() => {
    if (!activeCar) return [];
    // Only show REAL maintenance — actual records from the operations
    // Maintenance tab (maintenance_tasks) for this car. We intentionally do NOT
    // synthesize rows from car onboarding fields (last oil change / registration
    // expiration): the registration date is an EXPIRATION, not a completed
    // maintenance, so showing it under "Date Completed" was misleading.
    const records: MaintenanceRecord[] = [];
    const tasks = maintenanceTasksData?.data ?? [];
    for (const t of tasks) {
      if (carId != null && t.car_id !== carId) continue;
      records.push({
        maintenanceType: t.task_description ?? "Maintenance Task",
        dateCompleted: t.scheduled_date ?? t.due_date ?? undefined,
        status: t.status ?? undefined,
      });
    }
    return records;
  }, [activeCar, maintenanceTasksData, carId]);

  const yearNum = parseInt(selectedYear, 10);
  const yearNumTrips = parseInt(selectedYearTrips, 10);

  const monthlyTripData = useMemo<MonthlyTripRow[]>(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const monthKey = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
      // Income from car_income_expenses table (authoritative)
      const ieRow = ieMonths.find((r: any) => Number(r.month) === monthNum);
      const income = Number(ieRow?.rentalIncome ?? 0);
      // Days/trips from car_history table (authoritative)
      const histRow = histMonths.find((r: any) => Number(r.month) === monthNum);
      const days = Number(histRow?.daysRented ?? 0);
      const trips = Number(histRow?.tripsTaken ?? 0);
      // Car owner's share of expenses + the Car Owner Split, both computed by
      // the authoritative backend formula (same value the admin I&E page shows).
      // Previously this column wrongly used rentalIncome - sum(clientPayments).
      const expenses = Number(ieRow?.computedCarOwnerTotalExpenses ?? 0);
      const profit = Number(ieRow?.computedCarOwnerSplit ?? 0);
      return {
        month: `${m} ${yearNum}`,
        shortMonth: m,
        monthKey,
        income,
        expenses,
        profit,
        days,
        trips,
        avgPerTrip: trips > 0 ? income / trips : 0,
      };
    });
  }, [ieMonths, histMonths, yearNum]);

  const yearTotals = useMemo<YearTotals>(() => {
    return monthlyTripData.reduce(
      (acc, row) => ({
        income: acc.income + row.income,
        expenses: acc.expenses + row.expenses,
        profit: acc.profit + row.profit,
        days: acc.days + row.days,
        trips: acc.trips + row.trips,
      }),
      { income: 0, expenses: 0, profit: 0, days: 0, trips: 0 },
    );
  }, [monthlyTripData]);

  const monthlyDaysTripsData = useMemo<MonthlyDaysTripsRow[]>(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const histRow = histMonthsTrips.find((r: any) => Number(r.month) === monthNum);
      const days = Number(histRow?.daysRented ?? 0);
      const trips = Number(histRow?.tripsTaken ?? 0);
      // income for avgPerTrip — use same IE data (trips year may differ from income year)
      const ieRowTrips = (ieCarDataTrips?.data?.incomeExpenses ?? []).find(
        (r: any) => Number(r.month) === monthNum,
      );
      const income = Number(ieRowTrips?.rentalIncome ?? 0);
      return {
        month: `${m} ${yearNumTrips}`,
        shortMonth: m,
        days,
        trips,
        avgPerTrip: trips > 0 ? income / trips : 0,
        income,
      };
    });
  }, [histMonthsTrips, ieCarDataTrips, yearNumTrips]);

  const yearTotalsTrips = useMemo<YearTotalsTrips>(() => {
    return monthlyDaysTripsData.reduce(
      (acc, row) => ({
        days: acc.days + row.days,
        trips: acc.trips + row.trips,
        income: acc.income + row.income,
      }),
      { days: 0, trips: 0, income: 0 },
    );
  }, [monthlyDaysTripsData]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2020; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  const quickLinks = (quickLinksData ?? []).filter((l) => l.visibleToClients);
  const turoViewLink =
    quickLinks.find((l) => l.title?.toLowerCase().includes("turo") && l.url)
      ?.url ?? null;
  const manufacturerUrl = (profile?.onboarding as any)?.manufacturerUrl ?? null;

  const ownerName = profile?.onboarding?.firstNameOwner
    ? `${profile.onboarding.firstNameOwner} ${profile.onboarding.lastNameOwner ?? ""}`.trim()
    : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
      "Client";
  const ownerEmail = profile?.onboarding?.emailOwner || profile?.email || "";
  const ownerPhone = profile?.onboarding?.phoneOwner || profile?.phone || "";

  // Order is row-major across the 4-column grid — kept in sync with
  // src/components/client/ClientPageLinks.tsx so every client-facing page
  // shows the same Report Center / Support Center layout.
  const carHref = (segment: string) =>
    activeCar ? `/admin/cars/${activeCar.id}/${segment}` : "#";

  const reportLinks = [
    { href: carHref("earnings"),       icon: DollarSign,   label: "Earnings" },
    { href: "/client/trip-history",    icon: History,      label: "History" },
    { href: carHref("totals"),         icon: BarChart3,    label: "Totals" },
    { href: carHref("records"),        icon: Folder,       label: "Records and Files" },

    { href: carHref("graphs"),         icon: TrendingUp,   label: "Graphs and Charts Report" },
    { href: carHref("maintenance"),    icon: Wrench,       label: "Maintenance" },
    { href: carHref("income-expense"), icon: Calendar,     label: "Car Rental Value Per Month" },
    { href: carHref("depreciation"),   icon: TrendingDown, label: "NADA Depreciation Schedule" },

    { href: carHref("payments"),       icon: CreditCard,   label: "Payment History" },
  ];

  const supportLinks = [
    { href: "/admin/car-block-off", icon: CalendarOff, label: "Car Block Off Form" },
    { href: "/client/offboarding-form", icon: ClipboardList, label: "Off-boarding Form" },
    { href: "https://rent.goldenluxuryauto.com/start-block", icon: Car, label: "Book Your Car", external: true },
    { href: "/tutorial",             icon: BookOpen,      label: "Training Manual" },
    { href: "/admin/news-media",     icon: Globe,         label: "News & Media" },

    { href: "https://rent.goldenluxuryauto.com/lyc-client-check-in", icon: Video, label: "Schedule a Zoom Call", external: true },
    { href: "/admin/forms", icon: FileText, label: "License Registration or Insurance Updates" },
    { href: "/admin/turo-guide",     icon: Map,           label: "Turo Guide" },
    { href: "",                      icon: Map,           label: "",                placeholder: true },

    { href: "/onboarding",           icon: PlusCircle,    label: "List Another Car" },
    { href: "/admin/forms",          icon: UserPlus,      label: "Refer Somebody" },
    { href: "/admin/testimonials",   icon: Star,          label: "Client Testimonials" },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#d3bc8d]" />
        </div>
      </AdminLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8 pb-12">
        {/* Car selector (multi-car clients) */}
        {cars.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Vehicle:</span>
            <Select
              value={String(activeCar?.id ?? "")}
              onValueChange={(v) => setSelectedCarId(parseInt(v, 10))}
            >
              <SelectTrigger className="w-auto max-w-sm h-9 text-sm">
                <SelectValue placeholder="Select car" />
              </SelectTrigger>
              <SelectContent>
                {cars.map((c) => {
                  const parts = [
                    c.year ? String(c.year) : null,
                    c.makeModel || null,
                    c.licensePlate ? `(${c.licensePlate})` : null,
                    c.vin ? `• ${c.vin}` : null,
                  ].filter(Boolean).join(" ");
                  return (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {parts || `Car #${c.id}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Add Car Block Off button */}
        <div className="flex justify-end">
          <a href="/admin/car-block-off">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/80 font-medium px-4 py-2 rounded-md text-sm transition-colors">
              <CalendarOff className="w-4 h-4" />
              Add Car Block Off
            </button>
          </a>
        </div>

        {/* ROW 1 (top): News & Media slots — moved from previous third position */}
        {newsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="h-10 border-b border-border bg-muted/40 animate-pulse" />
              <div className="aspect-video w-full bg-muted/40 animate-pulse" />
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="h-10 border-b border-border bg-muted/40 animate-pulse" />
              <div className="aspect-video w-full bg-muted/40 animate-pulse" />
            </div>
          </div>
        ) : (
          ((newsDashboardData?.slot1?.length ?? 0) > 0 ||
            (newsDashboardData?.slot2?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(newsDashboardData?.slot1?.length ?? 0) > 0 && (
                <NewsMediaSlot slot={1} items={newsDashboardData!.slot1} />
              )}
              {(newsDashboardData?.slot2?.length ?? 0) > 0 && (
                <NewsMediaSlot slot={2} items={newsDashboardData!.slot2} />
              )}
            </div>
          )
        )}

        {/* ROW 2: Vehicle/Owner Info + GLA Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <VehicleOwnerInfo
            activeCar={activeCar}
            ownerName={ownerName}
            ownerPhone={ownerPhone}
            ownerEmail={ownerEmail}
            manufacturerUrl={manufacturerUrl}
            turoViewLink={turoViewLink}
          />
          <GlaContactCard />
        </div>

        {/* Sections 3 & 4: Income/Expenses + Days/Trips (headers, summaries, tables) */}
        <IncomeExpensesSection
          selectedYear={selectedYear}
          selectedYearTrips={selectedYearTrips}
          yearOptions={yearOptions}
          onYearChange={setSelectedYear}
          onYearTripsChange={setSelectedYearTrips}
          monthlyTripData={monthlyTripData}
          monthlyDaysTripsData={monthlyDaysTripsData}
          yearTotals={yearTotals}
          yearTotalsTrips={yearTotalsTrips}
          currentMonthData={monthlyTripData[currentMonth - 1]}
          currentMonthDaysTripsData={monthlyDaysTripsData[currentMonth - 1]}
          currentMonth={currentMonth}
          isLoadingIncome={paymentsLoading}
          isLoadingTrips={tripsLoading}
        />

        {/* Turo earnings screenshots (ported from gla-v3) */}
        <TuroEarningsSection carId={carId} year={selectedYear} />

        {/* Section 5: Line + Bar charts */}
        <IncomeExpensesCharts
          monthlyTripData={monthlyTripData}
          monthlyDaysTripsData={monthlyDaysTripsData}
          selectedYear={selectedYear}
          selectedYearTrips={selectedYearTrips}
          isLoadingIncome={paymentsLoading}
          isLoadingTrips={tripsLoading}
        />

        {/* Row A: Donuts (left) | Payment History (right) — same top edge */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <DonutCharts
            yearTotals={yearTotals}
            currentMonthData={monthlyTripData[currentMonth - 1]}
            selectedYear={selectedYear}
            currentMonth={currentMonth}
            isLoading={totalsLoading || tripsLoading}
          />
          <PaymentHistoryCard
            payments={payments}
            isLoading={paymentsLoading}
          />
        </div>

        {/* Row B: NADA chart (left) | Maintenance (right) — same top edge */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <NadaChart
            nadaRecords={nadaRecords}
            yearNum={yearNum}
            isLoading={nadaLoading}
          />
          <MaintenanceCard
            maintenanceRecords={maintenanceRecords}
            activeCar={activeCar}
          />
        </div>

        {/* Sections 10 & 11: Report Center + Support Center */}
        <div className="space-y-6 mt-8 mb-12">
          <ReportCenter reportLinks={reportLinks} />
          <SupportCenter supportLinks={supportLinks} />
        </div>
      </div>
    </AdminLayout>
  );
}
