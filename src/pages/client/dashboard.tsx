import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Car,
  Calendar,
  ExternalLink,
  FileText,
  HelpCircle,
  Phone,
  Mail,
  Loader2,
  Wrench,
  AlertCircle,
  BarChart3,
  CreditCard,
  MapPin,
  Globe,
  BookOpen,
  Calculator,
  ShoppingBag,
  Image as ImageIcon,
  Video,
  Users,
  Star,
  ClipboardList,
  PlusCircle,
} from "lucide-react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { Link } from "wouter";
import { differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientCar {
  id: number;
  vin: string | null;
  makeModel: string;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  year: number | null;
  mileage: number;
  status: string;
  exteriorColor: string | null;
  interiorColor: string | null;
  tireSize: string | null;
  oilType: string | null;
  lastOilChange: string | null;
  fuelType: string | null;
  registrationExpiration: string | null;
  photo?: string | null;
}

interface ClientProfile {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  cars: ClientCar[];
  onboarding?: {
    firstNameOwner?: string;
    lastNameOwner?: string;
    emailOwner?: string;
    phoneOwner?: string;
    manufacturerUrl?: string;
  } | null;
  bankingInfo?: {
    bankName?: string | null;
    accountNumber?: string | null;
  } | null;
}

interface Payment {
  payments_aid: number;
  payments_year_month: string;
  payments_amount: number;
  payments_amount_payout: number;
  payments_amount_balance: number;
  payments_reference_number: string;
  payments_invoice_id: string;
  payments_invoice_date: string | null;
  payments_remarks: string | null;
  payment_status_name: string;
  payment_status_color: string;
  car_make_model: string;
  car_plate_number: string;
}

interface TuroTrip {
  id: number;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: "booked" | "cancelled" | "completed";
  totalDistance: string | null;
  carName: string | null;
}

interface QuickLink {
  id: number;
  category: string;
  title: string;
  url: string;
  visibleToClients: boolean;
}

interface TotalsData {
  income?: { totalProfit?: number };
  carManagementSplit?: number;
  expenses?: { totalOperatingExpenses?: number };
  payments?: { total?: number };
  history?: { daysRented?: number };
}

interface MaintenanceRecord {
  type?: string;
  maintenanceType?: string;
  dateCompleted?: string;
  date_completed?: string;
  status?: string;
  price?: number;
  remarks?: string;
}

interface NadaDepreciation {
  nadaDepreciationAid: number;
  nadaDepreciationDate: string;
  nadaDepreciationAmount: number;
  nadaDepreciationCarId: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHART_GOLD = "#EAEB80";
const CHART_DARK = "#2a2a2a";
const CHART_GREEN = "#4ade80";
const CHART_RED = "#f87171";
const PIE_COLORS = [CHART_GOLD, CHART_DARK];

function fmt(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]} ${y}`;
}

function tripDays(trip: TuroTrip): number {
  try {
    return Math.max(1, differenceInDays(new Date(trip.tripEnd), new Date(trip.tripStart)));
  } catch {
    return 1;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  yearTotal,
  monthValue,
  yearLabel,
  monthLabel,
}: {
  label: string;
  yearTotal: string;
  monthValue: string;
  yearLabel: string;
  monthLabel: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-0">
        <div
          className="px-4 py-3 rounded-t-lg"
          style={{ backgroundColor: "#EAEB80" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1a1a1a]">
            {label}
          </p>
        </div>
        <div className="px-4 py-3 flex justify-between items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{yearLabel}</p>
            <p className="text-base font-bold text-foreground">{yearTotal}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
            <p className="text-base font-bold text-[#EAEB80]">{monthValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportLinkCard({
  href,
  icon: Icon,
  label,
  external = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:border-[#EAEB80]/50 hover:bg-muted/30 transition-colors text-center cursor-pointer">
      <Icon className="w-6 h-6 text-[#EAEB80]" />
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status?.toLowerCase() ?? "";
  const cls =
    lower.includes("paid") || lower.includes("complete")
      ? "bg-green-900/40 text-green-300 border-green-700"
      : lower.includes("partial")
      ? "bg-yellow-900/40 text-yellow-300 border-yellow-700"
      : lower.includes("cancel") || lower.includes("unpaid") || lower.includes("overdue")
      ? "bg-red-900/40 text-red-300 border-red-700"
      : "bg-gray-800 text-gray-400 border-gray-600";
  return (
    <Badge className={`text-xs border ${cls} bg-transparent`} variant="outline">
      {status}
    </Badge>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const { data: profileData, isLoading: profileLoading } = useQuery<{
    success: boolean;
    data: ClientProfile;
  }>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    retry: false,
  });

  const profile = profileData?.data;
  const cars = profile?.cars ?? [];

  const activeCar = useMemo<ClientCar | undefined>(() => {
    if (!cars.length) return undefined;
    if (selectedCarId) return cars.find((c) => c.id === selectedCarId) ?? cars[0];
    return cars[0];
  }, [cars, selectedCarId]);

  const clientId = profile?.id ?? null;
  const carId = activeCar?.id ?? null;

  // ── Payments ─────────────────────────────────────────────────────────────────

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

  const payments = useMemo<Payment[]>(() => {
    const raw = (paymentsData as any)?.data ?? (paymentsData as any)?.payments ?? [];
    return Array.isArray(raw)
      ? [...raw].sort((a, b) => b.payments_year_month.localeCompare(a.payments_year_month))
      : [];
  }, [paymentsData]);

  // ── Turo Trips ───────────────────────────────────────────────────────────────

  const { data: tripsData, isLoading: tripsLoading } = useQuery<{
    success: boolean;
    data: { trips: TuroTrip[] };
  }>({
    queryKey: ["/api/turo-trips"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/turo-trips"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
    retry: false,
  });

  const allTrips = useMemo<TuroTrip[]>(() => {
    const raw = (tripsData as any)?.data?.trips ?? (tripsData as any)?.trips ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [tripsData]);

  // ── Income/Expense Totals ─────────────────────────────────────────────────────

  const { data: totalsData, isLoading: totalsLoading } = useQuery<{
    success: boolean;
    data: TotalsData;
  }>({
    queryKey: ["/api/cars", carId, "totals", selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams({ filter: "Year", from: selectedYear, to: selectedYear });
      const res = await fetch(buildApiUrl(`/api/cars/${carId}/totals?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch totals");
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const totals: TotalsData = totalsData?.data ?? {};

  // ── Quick Links ───────────────────────────────────────────────────────────────

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

  const quickLinks = (quickLinksData ?? []).filter((l) => l.visibleToClients);

  const turoViewLink = quickLinks.find(
    (l) => l.title?.toLowerCase().includes("turo") && l.url
  )?.url ?? null;

  const manufacturerUrl =
    (profile?.onboarding as any)?.manufacturerUrl ?? null;

  // ── NADA Depreciation ─────────────────────────────────────────────────────────

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
      if (!res.ok) throw new Error("Failed to fetch NADA data");
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const nadaRecords: NadaDepreciation[] = nadaData?.data ?? [];

  // ── Maintenance History ───────────────────────────────────────────────────────

  const { data: maintenanceData, isLoading: maintenanceLoading } = useQuery<{
    success: boolean;
    data: MaintenanceRecord[];
  }>({
    queryKey: ["/api/admin/cars", carId, "maintenance"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/cars/${carId}/maintenance`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch maintenance");
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const maintenanceRecords: MaintenanceRecord[] = useMemo(() => {
    const raw = (maintenanceData as any)?.data ?? (maintenanceData as any)?.maintenance ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [maintenanceData]);

  // ── Computed Monthly Data ─────────────────────────────────────────────────────

  const yearNum = parseInt(selectedYear, 10);

  // Monthly breakdown of trips (income + days + trips count)
  const monthlyTripData = useMemo(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const monthKey = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
      const monthTrips = allTrips.filter((t) => {
        if (t.status === "cancelled") return false;
        const d = new Date(t.tripStart);
        return d.getFullYear() === yearNum && d.getMonth() + 1 === monthNum;
      });
      const days = monthTrips.reduce((s, t) => s + tripDays(t), 0);
      const trips = monthTrips.length;
      const income = monthTrips.reduce((s, t) => s + (t.earnings || 0), 0);

      // Monthly payments
      const monthPayments = payments.filter((p) => p.payments_year_month === monthKey);
      const expenses = monthPayments.reduce((s, p) => s + (p.payments_amount || 0), 0);
      const profit = income - expenses;
      const avgPerTrip = trips > 0 ? income / trips : 0;

      return {
        month: `${m} ${yearNum}`,
        shortMonth: m,
        monthKey,
        income,
        expenses,
        profit,
        days,
        trips,
        avgPerTrip,
      };
    });
  }, [allTrips, payments, yearNum]);

  const yearTotals = useMemo(() => {
    return monthlyTripData.reduce(
      (acc, row) => ({
        income: acc.income + row.income,
        expenses: acc.expenses + row.expenses,
        profit: acc.profit + row.profit,
        days: acc.days + row.days,
        trips: acc.trips + row.trips,
      }),
      { income: 0, expenses: 0, profit: 0, days: 0, trips: 0 }
    );
  }, [monthlyTripData]);

  const currentMonthKey = `${yearNum}-${String(currentMonth).padStart(2, "0")}`;
  const currentMonthData = monthlyTripData[currentMonth - 1];

  // Year options
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2020; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  // NADA chart data
  const nadaChartData = useMemo(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
      const record = nadaRecords.find((r) => r.nadaDepreciationDate === dateKey);
      return {
        month: m,
        retail: record?.nadaDepreciationAmount ?? null,
      };
    });
  }, [nadaRecords, yearNum]);

  const hasNadaData = nadaChartData.some((d) => d.retail !== null);

  // Full-year donut
  const donutYearData = useMemo(() => {
    const profit = Math.max(0, yearTotals.profit);
    const expenses = Math.max(0, yearTotals.expenses);
    return profit + expenses > 0
      ? [
          { name: "Profit", value: profit },
          { name: "Expenses", value: expenses },
        ]
      : [];
  }, [yearTotals]);

  // Current month donut
  const donutMonthData = useMemo(() => {
    const profit = Math.max(0, currentMonthData?.profit ?? 0);
    const expenses = Math.max(0, currentMonthData?.expenses ?? 0);
    return profit + expenses > 0
      ? [
          { name: "Profit", value: profit },
          { name: "Expenses", value: expenses },
        ]
      : [];
  }, [currentMonthData]);

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#EAEB80]" />
        </div>
      </AdminLayout>
    );
  }

  const ownerName = profile?.onboarding?.firstNameOwner
    ? `${profile.onboarding.firstNameOwner} ${profile.onboarding.lastNameOwner ?? ""}`.trim()
    : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Client";

  const ownerEmail = profile?.onboarding?.emailOwner || profile?.email || "";
  const ownerPhone = profile?.onboarding?.phoneOwner || profile?.phone || "";

  // ── Report & Support links ────────────────────────────────────────────────────

  const reportLinks: { href: string; icon: React.ElementType; label: string }[] = [
    { href: activeCar ? `/admin/cars/${activeCar.id}/earnings` : "#", icon: DollarSign, label: "Earnings" },
    { href: "/admin/turo-trips", icon: ClipboardList, label: "History" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/totals` : "#", icon: BarChart3, label: "Totals" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/records` : "#", icon: FileText, label: "Records and Files" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/graphs` : "#", icon: TrendingUp, label: "Graphs and Charts Report" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/maintenance` : "#", icon: Wrench, label: "Maintenance" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/income-expense` : "#", icon: CreditCard, label: "Car Rental Value Per Month" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/depreciation` : "#", icon: TrendingDown, label: "NADA Depreciation Schedule" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/purchase` : "#", icon: ShoppingBag, label: "Purchase Details" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/calculator` : "#", icon: Calculator, label: "Payment Calculator" },
    { href: activeCar ? `/admin/cars/${activeCar.id}/payments` : "#", icon: CreditCard, label: "Payment History" },
  ];

  const supportLinks: { href: string; icon: React.ElementType; label: string; external?: boolean }[] = [
    { href: "#", icon: ClipboardList, label: "Off-boarding Form" },
    { href: "#", icon: Video, label: "Schedule a Zoom Call" },
    { href: "/onboarding", icon: PlusCircle, label: "List Another Car" },
    { href: turoViewLink ?? "#", icon: Car, label: "Book Your Car", external: !!turoViewLink },
    { href: "/profile", icon: FileText, label: "License/Insurance Updates" },
    { href: "/tutorial", icon: BookOpen, label: "Training Manual" },
    { href: "/admin/testimonials", icon: Star, label: "Client Testimonials" },
    { href: "#", icon: Globe, label: "News & Media" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8 pb-12">

        {/* ── Car selector (if multiple cars) ──────────────────────────────── */}
        {cars.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Vehicle:</span>
            <Select
              value={String(activeCar?.id ?? "")}
              onValueChange={(v) => setSelectedCarId(parseInt(v, 10))}
            >
              <SelectTrigger className="w-52 h-9 text-sm">
                <SelectValue placeholder="Select car" />
              </SelectTrigger>
              <SelectContent>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.makeModel || `Car #${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — Hero Header
        ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-border bg-card overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[240px]">
            {/* Left: Car photo — full half */}
            <div className="bg-muted/10 flex items-center justify-center border-b md:border-b-0 md:border-r border-border min-h-[200px]">
              {activeCar?.photo ? (
                <img
                  src={getProxiedImageUrl(activeCar.photo)}
                  alt={activeCar.makeModel}
                  className="w-full h-full object-cover max-h-64"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground/30 p-10">
                  <Car className="w-28 h-28" />
                  {activeCar && (
                    <p className="text-sm text-muted-foreground font-medium">
                      {activeCar.year} {activeCar.makeModel}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: GLA Branding */}
            <div
              className="flex items-end justify-start p-8 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d1a 100%)" }}
            >
              <div>
                <h1
                  className="text-4xl md:text-5xl font-extrabold leading-tight"
                  style={{ color: "#EAEB80", textShadow: "2px 2px 8px rgba(0,0,0,0.6)" }}
                >
                  Golden Luxury Auto
                </h1>
                <h2
                  className="text-3xl md:text-4xl font-extrabold mt-1"
                  style={{ color: "#EAEB80", textShadow: "2px 2px 8px rgba(0,0,0,0.6)" }}
                >
                  Monthly Update!!!
                </h2>
              </div>
            </div>
          </div>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — Vehicle & Owner Information (3-column)
        ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Col 1: Vehicle */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                  Vehicle Information
                </h3>
                {activeCar ? (
                  <div className="space-y-2">
                    {[
                      { label: "Year / Make Model", value: `${activeCar.year ?? ""} ${activeCar.makeModel}`.trim() },
                      { label: "VIN", value: activeCar.vin },
                      { label: "License Plate", value: activeCar.licensePlate },
                      { label: "Fuel Type", value: activeCar.fuelType },
                      { label: "Tire Size", value: activeCar.tireSize },
                      { label: "Oil Type", value: activeCar.oilType },
                      { label: "Current Miles", value: activeCar.mileage ? `${activeCar.mileage.toLocaleString()} mi` : null },
                      { label: "Last Oil Change", value: activeCar.lastOilChange },
                      { label: "Lic / Reg Date", value: activeCar.registrationExpiration },
                    ]
                      .filter((f) => f.value)
                      .map((f) => (
                        <div key={f.label} className="flex justify-between gap-2">
                          <span className="text-xs text-muted-foreground flex-shrink-0">{f.label}:</span>
                          <span className="text-xs text-foreground text-right">{f.value}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vehicle on file.</p>
                )}
              </div>

              {/* Col 2: Owner */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                  Owner Information
                </h3>
                <div className="space-y-2">
                  {[
                    { label: "Name", value: ownerName },
                    { label: "Phone", value: ownerPhone },
                    { label: "Email", value: ownerEmail },
                  ]
                    .filter((f) => f.value)
                    .map((f) => (
                      <div key={f.label} className="flex justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0">{f.label}:</span>
                        <span className="text-xs text-foreground text-right">{f.value}</span>
                      </div>
                    ))}

                  {manufacturerUrl && (
                    <div className="flex justify-between gap-2">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Manufacturer:</span>
                      <a
                        href={manufacturerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#EAEB80] hover:underline flex items-center gap-1"
                      >
                        Visit Site
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {turoViewLink && (
                    <div className="pt-2">
                      <a
                        href={turoViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-[#EAEB80]/50 text-[#EAEB80] hover:bg-[#EAEB80]/10 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Car on Turo
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Col 3: GLA Company */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                  Golden Luxury Auto
                </h3>
                <div className="space-y-2">
                  {/* Social Icons */}
                  <div className="flex gap-2 pb-1">
                    {[
                      { href: "https://www.facebook.com/goldenluxuryauto", label: "Facebook", icon: Globe },
                      { href: "https://www.instagram.com/goldenluxuryauto", label: "Instagram", icon: ImageIcon },
                      { href: "https://www.youtube.com/@goldenluxuryauto", label: "YouTube", icon: Video },
                      { href: "https://www.linkedin.com/company/goldenluxuryauto", label: "LinkedIn", icon: Users },
                    ].map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.label}
                        className="p-1.5 rounded border border-border hover:border-[#EAEB80]/50 text-muted-foreground hover:text-[#EAEB80] transition-colors"
                      >
                        <s.icon className="w-3.5 h-3.5" />
                      </a>
                    ))}
                  </div>

                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Website:</span>
                    <a
                      href="https://www.goldenluxuryauto.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#EAEB80] hover:underline"
                    >
                      www.goldenluxuryauto.com
                    </a>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Address:</span>
                    <span className="text-xs text-foreground text-right">
                      South 500 West, Salt Lake City, Utah 84101
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Email:</span>
                    <a
                      href="mailto:golden@goldenluxuryauto.com"
                      className="text-xs text-[#EAEB80] hover:underline"
                    >
                      golden@goldenluxuryauto.com
                    </a>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0">Phone:</span>
                    <span className="text-xs text-foreground">1-800-346-1394</span>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
            SECTIONS 3 & 4 — Income/Expenses + Days/Trips (side by side)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── SECTION 3 — Income and Expenses ────────────────────────────── */}
        <div>
          {/* Section header with year selector */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Income and Expenses</h2>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              label="Total Car Owner Rental Income"
              yearTotal={fmt(yearTotals.income)}
              monthValue={fmt(currentMonthData?.income ?? 0)}
              yearLabel={`${selectedYear} Total`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear}`}
            />
            <SummaryCard
              label="Total Car Owner Expenses"
              yearTotal={fmt(yearTotals.expenses)}
              monthValue={fmt(currentMonthData?.expenses ?? 0)}
              yearLabel={`${selectedYear} Total`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear}`}
            />
            <SummaryCard
              label="Total Car Owner Profit"
              yearTotal={fmt(yearTotals.profit)}
              monthValue={fmt(currentMonthData?.profit ?? 0)}
              yearLabel={`${selectedYear} Total`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear}`}
            />
          </div>

          {/* Monthly Income/Expense Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#EAEB80" }} className="border-b border-border hover:bg-[#EAEB80]">
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Month and Year</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Car Owner Rental Income</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Car Owner Expenses</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Car Owner Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripsLoading || paymentsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80] mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {monthlyTripData.map((row) => (
                        <TableRow key={row.month} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm py-2">{row.month}</TableCell>
                          <TableCell className="text-sm py-2 text-right">{fmt(row.income)}</TableCell>
                          <TableCell className="text-sm py-2 text-right">{fmt(row.expenses)}</TableCell>
                          <TableCell
                            className={`text-sm py-2 text-right font-medium ${
                              row.profit >= 0 ? "text-[#EAEB80]" : "text-[#f87171]"
                            }`}
                          >
                            {fmt(row.profit)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* TOTAL row */}
                      <TableRow style={{ backgroundColor: "#EAEB80" }} className="border-t border-border hover:bg-[#EAEB80]">
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2">TOTAL</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">{fmt(yearTotals.income)}</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">{fmt(yearTotals.expenses)}</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">{fmt(yearTotals.profit)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>{/* end section 3 */}

        {/* ── SECTION 4 — Days Rented and Trips Taken ────────────────────── */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Days Rented and Trips Taken</h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              label="Total Days Rented"
              yearTotal={String(yearTotals.days)}
              monthValue={String(currentMonthData?.days ?? 0)}
              yearLabel={`${selectedYear} Total`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear}`}
            />
            <SummaryCard
              label="Total Trips Taken"
              yearTotal={String(yearTotals.trips)}
              monthValue={String(currentMonthData?.trips ?? 0)}
              yearLabel={`${selectedYear} Total`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear}`}
            />
            <SummaryCard
              label="Ave / Trips Taken"
              yearTotal={yearTotals.trips > 0 ? fmt(yearTotals.income / yearTotals.trips) : "$0.00"}
              monthValue={
                (currentMonthData?.trips ?? 0) > 0
                  ? fmt((currentMonthData?.income ?? 0) / (currentMonthData?.trips ?? 1))
                  : "$0.00"
              }
              yearLabel={`${selectedYear} Avg`}
              monthLabel={`${MONTHS_SHORT[currentMonth - 1]} Avg`}
            />
          </div>

          {/* Monthly Days/Trips Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#EAEB80" }} className="border-b border-border hover:bg-[#EAEB80]">
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Month and Year</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Days Rented</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Trips Taken</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Ave / Trips Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80] mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {monthlyTripData.map((row) => (
                        <TableRow key={row.month} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm py-2">{row.month}</TableCell>
                          <TableCell className="text-sm py-2 text-right">{row.days}</TableCell>
                          <TableCell className="text-sm py-2 text-right">{row.trips}</TableCell>
                          <TableCell className="text-sm py-2 text-right">
                            {row.trips > 0 ? fmt(row.avgPerTrip) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* TOTAL row */}
                      <TableRow style={{ backgroundColor: "#EAEB80" }} className="border-t border-border hover:bg-[#EAEB80]">
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2">TOTAL</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">{yearTotals.days}</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">{yearTotals.trips}</TableCell>
                        <TableCell className="text-xs font-bold text-[#1a1a1a] py-2 text-right">
                          {yearTotals.trips > 0 ? fmt(yearTotals.income / yearTotals.trips) : "—"}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>{/* end section 4 */}

        </div>{/* end sections 3&4 grid */}

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 5 — Charts (Line + Bar)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Line Chart: Income, Profit, Expenses */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Monthly Car Owner Rental Income, Profit and Expenses — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tripsLoading || paymentsLoading ? (
                <div className="flex items-center justify-center h-56">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : monthlyTripData.some((d) => d.income > 0 || d.expenses > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={monthlyTripData}
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#888" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#ccc" }}
                      formatter={(val: number) => fmt(val)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="Rental Income"
                      stroke={CHART_GOLD}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke={CHART_GREEN}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke={CHART_RED}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No chart data for {selectedYear}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart: Days Rented + Trips Taken */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Monthly Days Rented and Trips Taken — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tripsLoading ? (
                <div className="flex items-center justify-center h-56">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : monthlyTripData.some((d) => d.days > 0 || d.trips > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={monthlyTripData}
                    margin={{ top: 4, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#ccc" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="days" name="Days Rented" fill={CHART_GOLD} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="trips" name="Trips Taken" fill={CHART_GREEN} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-56 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No trip data for {selectedYear}</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 6 — Donut Charts
        ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Full year donut */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Total Car Owner Profit and Expenses — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {totalsLoading || tripsLoading ? (
                <div className="flex items-center justify-center h-52">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : donutYearData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={donutYearData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {donutYearData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      formatter={(val: number) => fmt(val)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-52 text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-sm">No data for {selectedYear}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current month donut */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                {MONTHS_SHORT[currentMonth - 1]} {selectedYear} Car Owner Profit and Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {paymentsLoading || tripsLoading ? (
                <div className="flex items-center justify-center h-52">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : donutMonthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={donutMonthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {donutMonthData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      formatter={(val: number) => fmt(val)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-52 text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-sm">No data for {MONTHS_SHORT[currentMonth - 1]} {selectedYear}</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 7 — NADA Change %
        ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">
              NADA Change % — {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {nadaLoading ? (
              <div className="flex items-center justify-center h-52">
                <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
              </div>
            ) : hasNadaData ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={nadaChartData}
                  margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="nadaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAEB80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EAEB80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#888" }}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                    labelStyle={{ color: "#ccc" }}
                    formatter={(val: number | null) => (val !== null ? fmt(val) : "N/A")}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="retail"
                    name="Retail Value"
                    stroke={CHART_GOLD}
                    strokeWidth={2}
                    fill="url(#nadaGradient)"
                    connectNulls
                    dot={{ r: 3, fill: CHART_GOLD }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-52 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No NADA depreciation data for {selectedYear}</p>
                {activeCar?.id && (
                  <Link href={`/admin/cars/${activeCar.id}/depreciation`}>
                    <a className="text-xs text-[#EAEB80] hover:underline mt-1">
                      View NADA Depreciation Schedule →
                    </a>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
            SECTIONS 8 & 9 — Payment History + Maintenance (side by side)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── SECTION 8 — Payment History ────────────────────────────────── */}
        <Card className="border-border bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#EAEB80]" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto p-0">
            {paymentsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
              </div>
            ) : payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#EAEB80" }} className="hover:bg-[#EAEB80]">
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Month</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Car Owner Split</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Amount Paid</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3 text-right">Balance</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.payments_aid} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm py-2 font-medium">
                        {getMonthLabel(p.payments_year_month)}
                      </TableCell>
                      <TableCell className="text-sm py-2 text-right text-[#EAEB80]">
                        {fmt(p.payments_amount_payout)}
                      </TableCell>
                      <TableCell className="text-sm py-2 text-right">
                        {fmt(p.payments_amount)}
                      </TableCell>
                      <TableCell className="text-sm py-2 text-right">
                        <span
                          className={
                            p.payments_amount_balance >= 0 ? "text-green-400" : "text-red-400"
                          }
                        >
                          {fmt(p.payments_amount_balance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">
                        {p.payments_invoice_date ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-sm">No payment records found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 9 — Maintenance History ────────────────────────────── */}
        <Card className="border-border bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#EAEB80]" />
              Maintenance History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto p-0">
            {maintenanceLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
              </div>
            ) : maintenanceRecords.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#EAEB80" }} className="hover:bg-[#EAEB80]">
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Maintenance</TableHead>
                    <TableHead className="text-[#1a1a1a] font-semibold text-xs py-3">Date Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceRecords.map((record, i) => (
                    <TableRow key={i} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm py-2">
                        {record.maintenanceType ?? record.type ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm py-2 text-muted-foreground">
                        {record.dateCompleted ?? record.date_completed ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-sm">No maintenance records found</p>
                {activeCar?.id && (
                  <Link href={`/admin/cars/${activeCar.id}/maintenance`}>
                    <a className="text-xs text-[#EAEB80] hover:underline mt-1">
                      View full maintenance page →
                    </a>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        </div>{/* end sections 8&9 grid */}

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 10 — Report Center
        ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#EAEB80]" />
              Report Center
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {reportLinks.map((link) => (
                <ReportLinkCard
                  key={link.label}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 11 — Support Center
        ════════════════════════════════════════════════════════════════════ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#EAEB80]" />
              Support Center
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {supportLinks.map((link) => (
                <ReportLinkCard
                  key={link.label}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  external={link.external}
                />
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
}
