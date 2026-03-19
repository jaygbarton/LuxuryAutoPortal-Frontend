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

function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val ?? 0)) || 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// Summary card — variant: "black" | "gray" | "gold"
// Fixed min-height so cards in left/right columns stay the same height
function SummaryCard({
  label,
  value,
  variant = "gold",
}: {
  label: string;
  value: string;
  variant?: "black" | "gray" | "gold";
}) {
  const bg = variant === "black" ? "#1a1a1a" : variant === "gray" ? "#e5e5e5" : "#D4AF37";
  const textColor = variant === "black" ? "#EAEB80" : "#1a1a1a";
  const subColor = variant === "black" ? "#ccc" : "#333";
  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col justify-center gap-0.5 h-full"
      style={{ backgroundColor: bg, minHeight: "68px" }}
    >
      <p className="text-lg font-extrabold leading-tight" style={{ color: textColor }}>{value}</p>
      <p className="text-xs font-medium leading-snug" style={{ color: subColor }}>{label}</p>
    </div>
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
      const expenses = monthPayments.reduce((s, p) => s + (parseFloat(String(p.payments_amount)) || 0), 0);
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
            SECTIONS 1 & 2 — Row-based layout for matched heights
            ROW 1: Car Gallery (left) | Monthly Update Video (right) — same height
            ROW 2: Vehicle/Owner Info (left) | GLA Contact (right)  — same height
        ════════════════════════════════════════════════════════════════════ */}

        {/* ROW 1: Car Gallery + Video — both equal height via items-stretch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

          {/* Car Gallery */}
          <Card className="border-border bg-card overflow-hidden h-full">
            <div className="relative w-full h-full bg-muted/20 flex items-center justify-center" style={{ minHeight: "240px" }}>
              {activeCar?.photo ? (
                <img
                  src={getProxiedImageUrl(activeCar.photo)}
                  alt={activeCar?.makeModel ?? "Vehicle"}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground/30 py-12 z-10">
                  <Car className="w-24 h-24" />
                  <p className="text-sm text-muted-foreground">
                    {activeCar ? `${activeCar.year ?? ""} ${activeCar.makeModel}`.trim() : "No vehicle photo"}
                  </p>
                </div>
              )}
              {activeCar && (
                <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/70 to-transparent z-10">
                  <p className="text-sm font-semibold text-white">{activeCar.year} {activeCar.makeModel}</p>
                  {activeCar.licensePlate && <p className="text-xs text-white/70">Plate: {activeCar.licensePlate}</p>}
                </div>
              )}
            </div>
          </Card>

          {/* Monthly Update Video */}
          <Card className="border-border bg-card overflow-hidden h-full">
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{ minHeight: "240px", background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a10 100%)" }}
            >
              <div className="w-full flex flex-col items-center justify-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EAEB80" }}>
                  <Video className="w-8 h-8 text-[#1a1a1a]" />
                </div>
                <div className="text-center px-6">
                  <h1 className="text-2xl md:text-3xl font-extrabold leading-tight" style={{ color: "#EAEB80" }}>
                    Golden Luxury Auto
                  </h1>
                  <h2 className="text-xl md:text-2xl font-bold text-white mt-0.5">Monthly Update!!!</h2>
                  <p className="text-xs text-white/50 mt-3">Monthly update video coming soon</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 2: Vehicle/Owner Info + GLA Contact — both equal height via items-stretch */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

          {/* Vehicle & Owner Information */}
          <Card className="border-border bg-card h-full">
            <CardContent className="p-5 h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* Vehicle Details */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                    Vehicle Information
                  </h3>
                  {activeCar ? (
                    <div className="space-y-1.5">
                      {[
                        { label: "Car Name", value: `${activeCar.year ?? ""} ${activeCar.makeModel}`.trim() },
                        { label: "VIN #", value: activeCar.vin },
                        { label: "License", value: activeCar.licensePlate },
                        { label: "Fuel/Gas", value: activeCar.fuelType },
                        { label: "Tire Size", value: activeCar.tireSize ?? "No Data" },
                        { label: "Oil Type", value: activeCar.oilType ?? "No Data" },
                        { label: "Current Miles", value: activeCar.mileage ? activeCar.mileage.toLocaleString() : null },
                        { label: "Last Oil Change", value: activeCar.lastOilChange },
                        { label: "Lic./Reg. Date", value: activeCar.registrationExpiration },
                      ]
                        .filter((f) => f.value)
                        .map((f) => (
                          <div key={f.label} className="flex gap-1">
                            <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[90px]">{f.label}:</span>
                            <span className="text-xs text-foreground font-medium">{f.value}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No vehicle on file.</p>
                  )}
                </div>

                {/* Owner Details */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                    Owner Information
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { label: "Name", value: ownerName },
                      { label: "Contact #", value: ownerPhone },
                      { label: "Email", value: ownerEmail },
                    ]
                      .filter((f) => f.value)
                      .map((f) => (
                        <div key={f.label} className="flex gap-1">
                          <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[90px]">{f.label}:</span>
                          <span className="text-xs text-foreground font-medium">{f.value}</span>
                        </div>
                      ))}
                    {manufacturerUrl && (
                      <div className="flex gap-1">
                        <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[90px]">Manufacturer:</span>
                        <a href={manufacturerUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#EAEB80] hover:underline flex items-center gap-1">
                          {manufacturerUrl.replace(/^https?:\/\//, "")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {turoViewLink && (
                      <div className="pt-2">
                        <a href={turoViewLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-[#EAEB80]/50 text-[#EAEB80] hover:bg-[#EAEB80]/10 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          View Car on Turo
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GLA Company Info */}
          <Card className="border-border bg-card h-full">
            <CardContent className="p-5 h-full">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
                Golden Luxury Auto
              </h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 pb-1">
                  {[
                    { href: "https://www.facebook.com/goldenluxuryauto", label: "Facebook", icon: Globe },
                    { href: "https://www.instagram.com/goldenluxuryauto", label: "Instagram", icon: ImageIcon },
                    { href: "https://www.youtube.com/@goldenluxuryauto", label: "YouTube", icon: Video },
                    { href: "https://www.linkedin.com/company/goldenluxuryauto", label: "LinkedIn", icon: Users },
                  ].map((s) => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" title={s.label}
                      className="p-1.5 rounded border border-border hover:border-[#EAEB80]/50 text-muted-foreground hover:text-[#EAEB80] transition-colors">
                      <s.icon className="w-3.5 h-3.5" />
                    </a>
                  ))}
                </div>
                {[
                  { label: "Website",  value: "www.goldenluxuryauto.com",      href: "https://www.goldenluxuryauto.com" },
                  { label: "Address",  value: "South 500 West, Salt Lake City, Utah 84101" },
                  { label: "Email",    value: "golden@goldenluxuryauto.com",   href: "mailto:golden@goldenluxuryauto.com" },
                  { label: "Inquiries",value: "cathy@goldenluxuryauto.com",    href: "mailto:cathy@goldenluxuryauto.com" },
                  { label: "Phone",    value: "1-800-346-1394",                href: "tel:18003461394" },
                ].map((item) => (
                  <div key={item.label} className="flex gap-1">
                    <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[70px]">{item.label}:</span>
                    {item.href ? (
                      <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer" className="text-xs text-[#EAEB80] hover:underline break-all">
                        {item.value}
                      </a>
                    ) : (
                      <span className="text-xs text-foreground">{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>{/* end row 2 */}

        {/* ════════════════════════════════════════════════════════════════════
            SECTIONS 3 & 4 — Income/Expenses + Days/Trips (side by side)
            Shared 6-col card grids so left & right cards have equal heights
        ════════════════════════════════════════════════════════════════════ */}

        {/* Section titles + year selector — full width row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-end mb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase text-foreground tracking-wide">Income and Expenses</h2>
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
          <h2 className="text-lg font-bold uppercase text-foreground tracking-wide">Days Rented and Trips Taken</h2>
        </div>

        {/* Shared 6-card grid — Row 1: year totals (3 income + 3 days) */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
          <SummaryCard variant="black" label="Total Car Owner Rental Income" value={fmt(yearTotals.income)} />
          <SummaryCard variant="gray"  label="Total Car Owner Expenses"      value={fmt(yearTotals.expenses)} />
          <SummaryCard variant="gold"  label="Total Car Owner Profit"        value={fmt(yearTotals.profit)} />
          <SummaryCard variant="black" label="Total Days Rented"  value={String(yearTotals.days)} />
          <SummaryCard variant="gray"  label="Total Trips Taken"  value={String(yearTotals.trips)} />
          <SummaryCard variant="gold"  label="Ave / Trips Taken"  value={yearTotals.trips > 0 ? fmt(yearTotals.income / yearTotals.trips) : "$0.00"} />
        </div>

        {/* Shared 6-card grid — Row 2: current month */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <SummaryCard variant="black" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Car Owner Rental Income`} value={fmt(currentMonthData?.income ?? 0)} />
          <SummaryCard variant="gray"  label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Owner Expenses`}          value={fmt(currentMonthData?.expenses ?? 0)} />
          <SummaryCard variant="gold"  label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Owner Profit`}            value={fmt(currentMonthData?.profit ?? 0)} />
          <SummaryCard variant="black" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Days Rented`}  value={String(currentMonthData?.days ?? 0)} />
          <SummaryCard variant="gray"  label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Trips Taken`}  value={String(currentMonthData?.trips ?? 0)} />
          <SummaryCard variant="gold"  label="Ave / Trips Taken" value={(currentMonthData?.trips ?? 0) > 0 ? fmt((currentMonthData?.income ?? 0) / (currentMonthData?.trips ?? 1)) : "$0.00"} />
        </div>

        {/* Tables side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── SECTION 3 — Income and Expenses table ────────────────────── */}
        <div>

          {/* Monthly Income/Expense Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#1a1a1a" }} className="border-b border-border">
                    <TableHead className="text-white font-semibold text-xs py-3">Month and Year</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Car Owner Rental Income</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Car Owner Expenses</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Car Owner Split</TableHead>
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

        {/* ── SECTION 4 — Days Rented and Trips Taken table ──────────────── */}
        <div>

          {/* Monthly Days/Trips Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#1a1a1a" }} className="border-b border-border">
                    <TableHead className="text-white font-semibold text-xs py-3">Month and Year</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Days Rented</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Trips Taken</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Ave / Trips Taken</TableHead>
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

          {/* Bar Chart: Income, Profit, Expenses */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Monthly Car Owner Rental Income, Car Owner Profit and Expenses — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tripsLoading || paymentsLoading ? (
                <div className="flex items-center justify-center h-56">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : monthlyTripData.some((d) => d.income > 0 || d.expenses > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
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
                    <Bar dataKey="income" name="Rental Income" fill={CHART_GOLD} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="profit" name="Car Owner Profit" fill={CHART_GREEN} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill={CHART_RED} radius={[2, 2, 0, 0]} />
                  </BarChart>
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
                  <TableRow style={{ backgroundColor: "#1a1a1a" }} className="">
                    <TableHead className="text-white font-semibold text-xs py-3">Month</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Car Owner Split</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Amount Paid</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3 text-right">Balance</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3">Payment Date</TableHead>
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
                  <TableRow style={{ backgroundColor: "#1a1a1a" }} className="">
                    <TableHead className="text-white font-semibold text-xs py-3">Maintenance</TableHead>
                    <TableHead className="text-white font-semibold text-xs py-3">Date Completed</TableHead>
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
        <Card className="border-border bg-card overflow-hidden">
          <div className="px-6 py-3" style={{ backgroundColor: "#EAEB80" }}>
            <h2 className="text-base font-bold text-[#1a1a1a]">Report Center</h2>
          </div>
          <CardContent className="pt-4">
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
        <Card className="border-border bg-card overflow-hidden">
          <div className="px-6 py-3" style={{ backgroundColor: "#EAEB80" }}>
            <h2 className="text-base font-bold text-[#1a1a1a]">Support Center</h2>
          </div>
          <CardContent className="pt-4">
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
