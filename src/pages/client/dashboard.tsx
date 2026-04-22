import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, TrendingUp, TrendingDown, Car, Calendar,
  FileText, Loader2, Wrench, BarChart3, CreditCard,
  Globe, BookOpen, Calculator, ShoppingBag, Video,
  Star, ClipboardList, PlusCircle,
} from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { differenceInDays } from "date-fns";

import { MONTHS_SHORT } from "./_components/constants";
import { tripDays } from "./_components/utils";
import type {
  ClientProfile, ClientCar, Payment, TuroTrip, QuickLink,
  TotalsData, NadaDepreciation, MaintenanceRecord,
  MonthlyTripRow, MonthlyDaysTripsRow, YearTotals, YearTotalsTrips,
} from "./_components/types";

import { CarGallery }              from "./_components/CarGallery";
import { VehicleOwnerInfo }        from "./_components/VehicleOwnerInfo";
import { GlaContactCard }          from "./_components/GlaContactCard";
import { IncomeExpensesSection }   from "./_components/IncomeExpensesSection";
import { IncomeExpensesCharts }    from "./_components/IncomeExpensesCharts";
import { DonutCharts }             from "./_components/DonutCharts";
import { NadaChart }               from "./_components/NadaChart";
import { PaymentHistoryCard }      from "./_components/PaymentHistoryCard";
import { MaintenanceCard }         from "./_components/MaintenanceCard";
import { ReportCenter }            from "./_components/ReportCenter";
import { SupportCenter }           from "./_components/SupportCenter";

export default function ClientDashboard() {
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedCarId,    setSelectedCarId]    = useState<number | null>(null);
  const [selectedYear,     setSelectedYear]     = useState<string>(String(currentYear));
  const [selectedYearTrips, setSelectedYearTrips] = useState<string>(String(currentYear));

  // ── Data Fetching ─────────────────────────────────────────────────────────────

  const { data: profileData, isLoading: profileLoading } = useQuery<{ success: boolean; data: ClientProfile }>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    retry: false,
  });

  const profile = profileData?.data;
  const cars    = profile?.cars ?? [];

  const activeCar = useMemo<ClientCar | undefined>(() => {
    if (!cars.length) return undefined;
    if (selectedCarId) return cars.find((c) => c.id === selectedCarId) ?? cars[0];
    return cars[0];
  }, [cars, selectedCarId]);

  const clientId = profile?.id ?? null;
  const carId    = activeCar?.id ?? null;

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{ success: boolean; data: Payment[] }>({
    queryKey: ["/api/payments/client", clientId],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/payments/client/${clientId}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!clientId,
    retry: false,
  });

  const { data: tripsData, isLoading: tripsLoading } = useQuery<{ success: boolean; data: { trips: TuroTrip[] } }>({
    queryKey: ["/api/turo-trips", carId],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/turo-trips"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
    retry: false,
  });

  const { data: totalsData, isLoading: totalsLoading } = useQuery<{ success: boolean; data: TotalsData }>({
    queryKey: ["/api/cars", carId, "totals", selectedYear],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ filter: "Year", from: selectedYear, to: selectedYear });
        const res = await fetch(buildApiUrl(`/api/cars/${carId}/totals?${params}`), { credentials: "include" });
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
      const res = await fetch(buildApiUrl("/api/quick-links"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quick links");
      const d = await res.json();
      return d.quickLinks ?? [];
    },
    retry: false,
  });

  const { data: nadaData, isLoading: nadaLoading } = useQuery<{ success: boolean; data: NadaDepreciation[]; count: number }>({
    queryKey: ["/api/nada-depreciation/read", carId, selectedYear],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/nada-depreciation/read"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nada_depreciation_car_id: carId, nada_depreciation_date: selectedYear }),
      });
      if (!res.ok) return { success: false, data: [], count: 0 };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const { data: carPhotosData } = useQuery<{ success: boolean; photos: string[] }>({
    queryKey: ["/api/client/cars", carId, "photos"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/client/cars/${carId}/photos`), { credentials: "include" });
      if (!res.ok) return { success: false, photos: [] };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  // ── Derived Data ──────────────────────────────────────────────────────────────

  const payments = useMemo<Payment[]>(() => {
    const raw = (paymentsData as any)?.data ?? (paymentsData as any)?.payments ?? [];
    return Array.isArray(raw)
      ? [...raw].sort((a, b) => b.payments_year_month.localeCompare(a.payments_year_month))
      : [];
  }, [paymentsData]);

  const allTrips = useMemo<TuroTrip[]>(() => {
    const raw = (tripsData as any)?.data?.trips ?? (tripsData as any)?.trips ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [tripsData]);

  const nadaRecords: NadaDepreciation[] = nadaData?.data ?? [];

  const maintenanceRecords = useMemo<MaintenanceRecord[]>(() => {
    if (!activeCar) return [];
    const records: MaintenanceRecord[] = [];
    if (activeCar.lastOilChange)
      records.push({ maintenanceType: "Oil Change", dateCompleted: activeCar.lastOilChange });
    if (activeCar.registrationExpiration)
      records.push({ maintenanceType: "License Registration", dateCompleted: activeCar.registrationExpiration });
    return records;
  }, [activeCar]);

  const yearNum      = parseInt(selectedYear, 10);
  const yearNumTrips = parseInt(selectedYearTrips, 10);

  const monthlyTripData = useMemo<MonthlyTripRow[]>(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum  = i + 1;
      const monthKey  = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
      const monthTrips = allTrips.filter((t) => {
        if (t.status === "cancelled") return false;
        const d = new Date(t.tripStart);
        return d.getFullYear() === yearNum && d.getMonth() + 1 === monthNum;
      });
      const days       = monthTrips.reduce((s, t) => s + tripDays(t), 0);
      const trips      = monthTrips.length;
      const income     = monthTrips.reduce((s, t) => s + (t.earnings || 0), 0);
      const monthPayments = payments.filter((p) => p.payments_year_month === monthKey);
      const expenses   = monthPayments.reduce((s, p) => s + (parseFloat(String(p.payments_amount)) || 0), 0);
      const profit     = income - expenses;
      return { month: `${m} ${yearNum}`, shortMonth: m, monthKey, income, expenses, profit, days, trips, avgPerTrip: trips > 0 ? income / trips : 0 };
    });
  }, [allTrips, payments, yearNum]);

  const yearTotals = useMemo<YearTotals>(() => {
    return monthlyTripData.reduce(
      (acc, row) => ({ income: acc.income + row.income, expenses: acc.expenses + row.expenses, profit: acc.profit + row.profit, days: acc.days + row.days, trips: acc.trips + row.trips }),
      { income: 0, expenses: 0, profit: 0, days: 0, trips: 0 }
    );
  }, [monthlyTripData]);

  const monthlyDaysTripsData = useMemo<MonthlyDaysTripsRow[]>(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum  = i + 1;
      const monthTrips = allTrips.filter((t) => {
        if (t.status === "cancelled") return false;
        const d = new Date(t.tripStart);
        return d.getFullYear() === yearNumTrips && d.getMonth() + 1 === monthNum;
      });
      const days  = monthTrips.reduce((s, t) => s + tripDays(t), 0);
      const trips = monthTrips.length;
      const income = monthTrips.reduce((s, t) => s + (t.earnings || 0), 0);
      return { month: `${m} ${yearNumTrips}`, shortMonth: m, days, trips, avgPerTrip: trips > 0 ? income / trips : 0, income };
    });
  }, [allTrips, yearNumTrips]);

  const yearTotalsTrips = useMemo<YearTotalsTrips>(() => {
    return monthlyDaysTripsData.reduce(
      (acc, row) => ({ days: acc.days + row.days, trips: acc.trips + row.trips, income: acc.income + row.income }),
      { days: 0, trips: 0, income: 0 }
    );
  }, [monthlyDaysTripsData]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2020; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  const quickLinks    = (quickLinksData ?? []).filter((l) => l.visibleToClients);
  const turoViewLink  = quickLinks.find((l) => l.title?.toLowerCase().includes("turo") && l.url)?.url ?? null;
  const manufacturerUrl = (profile?.onboarding as any)?.manufacturerUrl ?? null;

  const ownerName  = profile?.onboarding?.firstNameOwner
    ? `${profile.onboarding.firstNameOwner} ${profile.onboarding.lastNameOwner ?? ""}`.trim()
    : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Client";
  const ownerEmail = profile?.onboarding?.emailOwner || profile?.email || "";
  const ownerPhone = profile?.onboarding?.phoneOwner || profile?.phone || "";

  const reportLinks = [
    { href: activeCar ? `/admin/cars/${activeCar.id}/earnings` : "#",       icon: DollarSign,  label: "Earnings" },
    { href: "/admin/turo-trips",                                              icon: ClipboardList, label: "History" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/totals` : "#",          icon: BarChart3,   label: "Totals" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/records` : "#",         icon: FileText,    label: "Records and Files" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/graphs` : "#",          icon: TrendingUp,  label: "Graphs and Charts Report" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/maintenance` : "#",     icon: Wrench,      label: "Maintenance" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/income-expense` : "#",  icon: Calendar,    label: "Car Rental Value Per Month" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/depreciation` : "#",    icon: TrendingDown, label: "NADA Depreciation Schedule" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/purchase` : "#",        icon: ShoppingBag, label: "Purchase Details" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/calculator` : "#",      icon: Calculator,  label: "Payment Calculator" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/payments` : "#",        icon: CreditCard,  label: "Payment History" },
  ];

  const supportLinks = [
    { href: "#",                                      icon: ClipboardList, label: "Off-boarding Form" },
    { href: "#",                                      icon: Video,         label: "Schedule a Zoom Call" },
    { href: "/onboarding",                            icon: PlusCircle,    label: "List Another Car" },
    { href: turoViewLink ?? "#",                      icon: Car,           label: "Book Your Car", external: !!turoViewLink },
    { href: "/profile",                               icon: FileText,      label: "License/Insurance Updates" },
    { href: "/tutorial",                              icon: BookOpen,      label: "Training Manual" },
    { href: "/admin/testimonials",                    icon: Star,          label: "Client Testimonials" },
    { href: "#",                                      icon: Globe,         label: "News & Media" },
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
            <Select value={String(activeCar?.id ?? "")} onValueChange={(v) => setSelectedCarId(parseInt(v, 10))}>
              <SelectTrigger className="w-52 h-9 text-sm">
                <SelectValue placeholder="Select car" />
              </SelectTrigger>
              <SelectContent>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.makeModel || `Car #${c.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ROW 1: Car Gallery + Monthly Update Video */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <CarGallery apiPhotos={carPhotosData?.photos ?? []} activeCar={activeCar} />
          <div className="border border-border bg-card rounded-xl overflow-hidden h-full" style={{ minHeight: "300px", background: "#1a1a1a" }}>
            <iframe
              className="w-full h-full"
              style={{ minHeight: "300px" }}
              src="https://www.youtube.com/embed/W86cTIoMv2U?rel=0&modestbranding=1"
              title="Golden Luxury Auto Monthly Update"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

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

        {/* Section 5: Line + Bar charts */}
        <IncomeExpensesCharts
          monthlyTripData={monthlyTripData}
          monthlyDaysTripsData={monthlyDaysTripsData}
          selectedYear={selectedYear}
          selectedYearTrips={selectedYearTrips}
          isLoadingIncome={paymentsLoading}
          isLoadingTrips={tripsLoading}
        />

        {/* Sections 6-9: Donuts + NADA (left) | Payments + Maintenance (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-6">
            <DonutCharts
              yearTotals={yearTotals}
              currentMonthData={monthlyTripData[currentMonth - 1]}
              selectedYear={selectedYear}
              currentMonth={currentMonth}
              isLoading={totalsLoading || tripsLoading}
            />
            <NadaChart nadaRecords={nadaRecords} yearNum={yearNum} isLoading={nadaLoading} />
          </div>
          <div className="flex flex-col gap-6">
            <PaymentHistoryCard payments={payments} isLoading={paymentsLoading} />
            <MaintenanceCard maintenanceRecords={maintenanceRecords} activeCar={activeCar} />
          </div>
        </div>

        {/* Section 10: Report Center */}
        <ReportCenter reportLinks={reportLinks} />

        {/* Section 11: Support Center */}
        <SupportCenter supportLinks={supportLinks} />

      </div>
    </AdminLayout>
  );
}
