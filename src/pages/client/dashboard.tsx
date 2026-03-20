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
  manufacturerWebsite?: string | null;
  manufacturerUsername?: string | null;
  turoPassword?: string | null;
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
const CHART_GOLD  = "#EAEB80";   // bright yellow-gold  — Income / Days Rented
const CHART_GOLD2 = "#F59E0B";   // amber/orange-gold   — Profit / Trips Taken
const CHART_RED   = "#EF4444";   // red                 — Expenses
const CHART_DARK  = "#2a2a2a";
const PIE_COLORS       = [CHART_GOLD, CHART_RED];   // for fallback
const PIE_DONUT_COLORS = ["#EAEB80", "#C9A227"];    // bright gold (profit) + dark amber gold (expenses)

// Shared chart theme constants
const CHART_TOOLTIP_STYLE = { background: "#1a1a1a", border: "1px solid #444", borderRadius: 6 };
const CHART_LEGEND_STYLE  = { fontSize: 11, paddingTop: 6 };
const CHART_AXIS_TICK     = { fontSize: 10, fill: "#999" };
const CHART_GRID_COLOR    = "#2d2d2d";

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

// Summary card — label on top (optional), large bold value centered
// variant: "black" | "light" | "gold"
function SummaryCard({
  label,
  value,
  variant = "gold",
  valueColor,
  className = "",
}: {
  label: string;
  value: string;
  variant?: "black" | "light" | "gold";
  valueColor?: string;
  className?: string;
}) {
  const bg       = variant === "black" ? "#1a1a1a" : variant === "gold" ? "#C9A227" : "#f0ece0";
  const valueClr = valueColor ?? (variant === "black" ? "#ffffff" : "#1a1a1a");
  return (
    <div
      style={{ backgroundColor: bg, minHeight: "54px" }}
      className={`flex flex-col items-center justify-center px-3 py-1.5 border border-[#d8d0b8] rounded-lg ${className}`}
    >
      {label && <p className="text-xs text-gray-400 mb-0.5">{label}</p>}
      <p className="text-lg font-extrabold leading-tight text-center" style={{ color: valueClr }}>{value}</p>
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
  const [selectedYearTrips, setSelectedYearTrips] = useState<string>(String(currentYear));

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
      try {
        const params = new URLSearchParams({ filter: "Year", from: selectedYear, to: selectedYear });
        const res = await fetch(buildApiUrl(`/api/cars/${carId}/totals?${params}`), {
          credentials: "include",
        });
        if (!res.ok) return { success: false, data: {} };
        return res.json();
      } catch {
        return { success: false, data: {} };
      }
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

  // ── NADA Depreciation ────────────────────────────────────────────────────────

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

  const nadaRecords: NadaDepreciation[] = nadaData?.data ?? [];

  // ── Maintenance History (from onboarding data in profile) ─────────────────────
  // No dedicated maintenance API for clients — build from car profile fields
  const maintenanceRecords: MaintenanceRecord[] = useMemo(() => {
    if (!activeCar) return [];
    const records: MaintenanceRecord[] = [];
    if (activeCar.lastOilChange) {
      records.push({ maintenanceType: "Oil Change", dateCompleted: activeCar.lastOilChange });
    }
    if (activeCar.registrationExpiration) {
      records.push({ maintenanceType: "License Registration", dateCompleted: activeCar.registrationExpiration });
    }
    return records;
  }, [activeCar]);
  const maintenanceLoading = false;

  // ── Car Photos Gallery ────────────────────────────────────────────────────────

  const { data: carPhotosData } = useQuery<{ success: boolean; photos: string[] }>({
    queryKey: ["/api/client/cars", carId, "photos"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/client/cars/${carId}/photos`), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, photos: [] };
      return res.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const carPhotos: string[] = useMemo(() => {
    const photos = carPhotosData?.photos ?? [];

    // Parse activeCar.photo — may be JSON array, JSON object, or plain URL string
    const rawPhoto = activeCar?.photo;
    let parsedMainPhotos: string[] = [];
    if (rawPhoto) {
      try {
        const parsed = JSON.parse(rawPhoto);
        if (Array.isArray(parsed)) {
          parsedMainPhotos = parsed.filter((u): u is string => typeof u === "string" && u.startsWith("http"));
        } else if (typeof parsed === "string" && parsed.startsWith("http")) {
          parsedMainPhotos = [parsed];
        } else if (parsed?.url) {
          parsedMainPhotos = [parsed.url];
        }
      } catch {
        if (typeof rawPhoto === "string" && rawPhoto.startsWith("http")) {
          parsedMainPhotos = [rawPhoto];
        }
      }
    }

    // Merge: API photos first, then parsed main photo (deduped)
    const all = [...photos];
    for (const url of parsedMainPhotos) {
      if (!all.includes(url)) all.push(url);
    }
    return all;
  }, [carPhotosData, activeCar]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const activePhoto = carPhotos[activePhotoIndex] ?? null;

  // ── Computed Monthly Data ─────────────────────────────────────────────────────

  const yearNum = parseInt(selectedYear, 10);
  const yearNumTrips = parseInt(selectedYearTrips, 10);

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

  // Separate monthly data for the Days/Trips section (uses its own year filter)
  const monthlyDaysTripsData = useMemo(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const monthTrips = allTrips.filter((t) => {
        if (t.status === "cancelled") return false;
        const d = new Date(t.tripStart);
        return d.getFullYear() === yearNumTrips && d.getMonth() + 1 === monthNum;
      });
      const days = monthTrips.reduce((s, t) => s + tripDays(t), 0);
      const trips = monthTrips.length;
      const income = monthTrips.reduce((s, t) => s + (t.earnings || 0), 0);
      const avgPerTrip = trips > 0 ? income / trips : 0;
      return { month: `${m} ${yearNumTrips}`, shortMonth: m, days, trips, avgPerTrip, income };
    });
  }, [allTrips, yearNumTrips]);

  const yearTotalsTrips = useMemo(() => {
    return monthlyDaysTripsData.reduce(
      (acc, row) => ({
        days: acc.days + row.days,
        trips: acc.trips + row.trips,
        income: acc.income + row.income,
      }),
      { days: 0, trips: 0, income: 0 }
    );
  }, [monthlyDaysTripsData]);

  const currentMonthDaysTripsData = monthlyDaysTripsData[currentMonth - 1];

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

          {/* Car Gallery — carousel with arrows, counter, dot indicators */}
          <Card className="border-border bg-card overflow-hidden h-full">
            <div className="flex flex-col h-full">
              {/* Main photo */}
              <div className="relative flex-1 bg-muted/20 flex items-center justify-center" style={{ minHeight: "300px" }}>
                {activePhoto ? (
                  <img
                    src={getProxiedImageUrl(activePhoto)}
                    alt={activeCar?.makeModel ?? "Vehicle"}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground/30 py-12">
                    <Car className="w-24 h-24" />
                    <p className="text-sm text-muted-foreground">
                      {activeCar ? `${activeCar.year ?? ""} ${activeCar.makeModel}`.trim() : "No vehicle photo"}
                    </p>
                  </div>
                )}

                {/* Floating nav pill: ‹  15 / 20  › */}
                {carPhotos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow text-sm font-medium text-gray-800 select-none">
                    <button
                      onClick={() => setActivePhotoIndex((i) => (i - 1 + carPhotos.length) % carPhotos.length)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                      aria-label="Previous photo"
                    >
                      ‹
                    </button>
                    <span className="min-w-[40px] text-center text-xs font-semibold">
                      {activePhotoIndex + 1} / {carPhotos.length}
                    </span>
                    <button
                      onClick={() => setActivePhotoIndex((i) => (i + 1) % carPhotos.length)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                      aria-label="Next photo"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              {/* Dot indicators */}
              {carPhotos.length > 1 && (
                <div className="flex justify-center gap-1.5 py-2 px-2 flex-wrap">
                  {carPhotos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhotoIndex(i)}
                      className="rounded-full transition-colors"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: i === activePhotoIndex ? "#EAEB80" : "#1a1a1a",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Monthly Update Video */}
          <Card className="border-border bg-card overflow-hidden h-full">
            <div className="relative w-full h-full flex flex-col" style={{ minHeight: "300px", background: "#1a1a1a" }}>
              {/* YouTube embed — temporal public video */}
              <iframe
                className="w-full flex-1"
                style={{ minHeight: "300px" }}
                src="https://www.youtube.com/embed/W86cTIoMv2U?rel=0&modestbranding=1"
                title="Golden Luxury Auto Monthly Update"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
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
                    <div className="text-sm space-y-3">
                      {/* Group 1: Identification */}
                      <div className="space-y-1">
                        <p><span className="font-bold">Car Name</span> :{`${activeCar.year ?? ""} ${activeCar.makeModel}`.trim()}</p>
                        {activeCar.vin && <p><span className="font-bold">VIN #</span> :{activeCar.vin}</p>}
                        {activeCar.licensePlate && <p><span className="font-bold">Liscense</span> :{activeCar.licensePlate}</p>}
                      </div>
                      {/* Group 2: Specs */}
                      <div className="space-y-1">
                        <p><span className="font-bold">Fuel/Gas</span> :{activeCar.fuelType || "No Data"}</p>
                        <p><span className="font-bold">Tire Size</span> :{activeCar.tireSize || "No Data"}</p>
                        <p><span className="font-bold">Oil Type</span> :{activeCar.oilType || "No Data"}</p>
                      </div>
                      {/* Group 3: Service */}
                      <div className="space-y-1">
                        {activeCar.mileage != null && <p><span className="font-bold">Current Miles:</span> {activeCar.mileage.toLocaleString()}</p>}
                        {activeCar.lastOilChange && <p><span className="font-bold">Last Oil Change</span> : {activeCar.lastOilChange}</p>}
                        {activeCar.registrationExpiration && <p><span className="font-bold">Lic./Reg. Date</span>: {activeCar.registrationExpiration}</p>}
                      </div>
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
                  <div className="space-y-1.5 text-sm">
                    {ownerName && (
                      <p><span className="font-bold text-foreground">Name</span> :{ownerName}</p>
                    )}
                    {ownerPhone && (
                      <p><span className="font-bold text-foreground">Contact #</span> :{ownerPhone}</p>
                    )}
                    {ownerEmail && (
                      <p><span className="font-bold text-foreground">Email</span> :{ownerEmail}</p>
                    )}

                    {/* Manufacturer URL */}
                    {(manufacturerUrl || activeCar?.manufacturerWebsite) && (
                      <div className="pt-1">
                        <span className="font-bold text-foreground">Manufacturer URL</span>
                        {": "}
                        <a href={manufacturerUrl || activeCar?.manufacturerWebsite || "#"}
                          target="_blank" rel="noopener noreferrer"
                          className="text-foreground underline hover:text-[#EAEB80]">
                          {(manufacturerUrl || activeCar?.manufacturerWebsite || "").replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}

                    {/* Username */}
                    {activeCar?.manufacturerUsername && (
                      <p><span className="font-bold text-foreground">Username</span>: {activeCar.manufacturerUsername}</p>
                    )}

                    {/* Password */}
                    {activeCar?.turoPassword && (
                      <p><span className="font-bold text-foreground">Password</span>: {activeCar.turoPassword}</p>
                    )}

                    {/* Turo Link */}
                    {turoViewLink && (
                      <div className="pt-1">
                        <span className="font-bold text-foreground">Turo Link</span>
                        {" :"}
                        <a href={turoViewLink} target="_blank" rel="noopener noreferrer"
                          className="text-foreground underline hover:text-[#EAEB80] ml-1">
                          View Car
                        </a>
                      </div>
                    )}

                    {/* Book Your Car */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="font-bold text-foreground">Book Your Car</span>
                      {" :"}
                      <a href="https://turo.com" target="_blank" rel="noopener noreferrer"
                        className="ml-1 text-foreground hover:text-[#EAEB80]" title="Book on Turo">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                          <rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                          <rect x="18" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                          <rect x="14" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                          <rect x="18" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                        </svg>
                      </a>
                    </div>

                    {/* Schedule a Zoom call */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="font-bold text-foreground">Schedule a Zoom call</span>
                      {" "}
                      <a href="https://calendly.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer"
                        className="text-foreground hover:text-[#EAEB80]" title="Schedule a Zoom call">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>
                          <circle cx="17" cy="7" r="4"/>
                          <path d="M15 7h4M17 5v4"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GLA Company Info */}
          <Card className="border-border bg-card h-full">
            <CardContent className="p-5 h-full">

              {/* Header: "Golden Luxury Auto:" + colored social icons inline */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="font-bold text-foreground text-base">Golden Luxury Auto:</span>
                {/* Facebook */}
                <a href="https://www.facebook.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="Facebook">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="4" fill="#1877F2"/>
                    <path d="M16 8h-2a1 1 0 0 0-1 1v2h3l-.5 3H13v7h-3v-7H8v-3h2V9a4 4 0 0 1 4-4h2v3z" fill="white"/>
                  </svg>
                </a>
                {/* Instagram */}
                <a href="https://www.instagram.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="Instagram">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f09433"/>
                        <stop offset="25%" stopColor="#e6683c"/>
                        <stop offset="50%" stopColor="#dc2743"/>
                        <stop offset="75%" stopColor="#cc2366"/>
                        <stop offset="100%" stopColor="#bc1888"/>
                      </linearGradient>
                    </defs>
                    <rect width="24" height="24" rx="5" fill="url(#ig)"/>
                    <rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="white" strokeWidth="1.5"/>
                    <circle cx="12" cy="12" r="2.5" fill="none" stroke="white" strokeWidth="1.5"/>
                    <circle cx="17" cy="7" r="1" fill="white"/>
                  </svg>
                </a>
                {/* YouTube */}
                <a href="https://www.youtube.com/@goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="YouTube">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="4" fill="#FF0000"/>
                    <polygon points="10,8 10,16 17,12" fill="white"/>
                  </svg>
                </a>
                {/* LinkedIn */}
                <a href="https://www.linkedin.com/company/goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="4" fill="#0A66C2"/>
                    <text x="4" y="17" fontFamily="Arial" fontWeight="bold" fontSize="14" fill="white">in</text>
                  </svg>
                </a>
                {/* TikTok */}
                <a href="https://www.tiktok.com/@goldenluxuryauto" target="_blank" rel="noopener noreferrer" title="TikTok">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="4" fill="#010101"/>
                    <path d="M19 8.5a4 4 0 0 1-4-4V4h-2.5v10.5a2 2 0 1 1-2-2 2 2 0 0 1 .5.07V10a4.5 4.5 0 1 0 4 4.5V8.5a6.4 6.4 0 0 0 4 1.4V7.4A4 4 0 0 1 19 8.5z" fill="white"/>
                  </svg>
                </a>
                {/* Gmail / Google */}
                <a href="mailto:goldenluxuryauto@gmail.com" title="Gmail">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="4" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
                    {/* Google "G" logo colors */}
                    <path d="M12 11.2h5.5c.1.5.2 1 .2 1.8 0 4-2.7 6-6.7 6-3.9 0-7-3.1-7-7s3.1-7 7-7c1.9 0 3.4.7 4.6 1.8L13.8 8.6C13 7.9 12 7.5 11 7.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5c2.2 0 3.7-1.2 4.1-2.8H12v-2.5z" fill="#4285F4"/>
                    <path d="M12 11.2h5.5c.1.5.2 1 .2 1.8 0 4-2.7 6-6.7 6-3.9 0-7-3.1-7-7s3.1-7 7-7c1.9 0 3.4.7 4.6 1.8L13.8 8.6C13 7.9 12 7.5 11 7.5" fill="none"/>
                  </svg>
                </a>
              </div>

              {/* Contact rows with large outline icons */}
              <div className="space-y-3">
                {/* Website */}
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <a href="https://www.goldenluxuryauto.com" target="_blank" rel="noopener noreferrer"
                    className="text-sm text-foreground hover:underline hover:text-[#EAEB80]">
                    www.goldenluxuryauto.com
                  </a>
                </div>
                {/* Address */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">South 500 West, Salt Lake City, Utah 84101</span>
                </div>
                {/* Both emails on one row */}
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">
                    <a href="mailto:golden@goldenluxuryauto.com" className="hover:underline hover:text-[#EAEB80]">golden@goldenluxuryauto.com</a>
                    {" / "}
                    <a href="mailto:goldenluxuryauto@gmail.com" className="hover:underline hover:text-[#EAEB80]">goldenluxuryauto@gmail.com</a>
                  </span>
                </div>
                {/* Account inquiries email */}
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">
                    <a href="mailto:cathy@goldenluxuryauto.com" className="hover:underline hover:text-[#EAEB80]">cathy@goldenluxuryauto.com</a>
                    {" (Account Inquiries)"}
                  </span>
                </div>
                {/* Phone */}
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <a href="tel:18003461394" className="text-sm text-foreground hover:underline hover:text-[#EAEB80]">
                    1-800-346-1394
                  </a>
                </div>
              </div>

            </CardContent>
          </Card>

        </div>{/* end row 2 */}

        {/* ════════════════════════════════════════════════════════════════════
            SECTIONS 3 & 4 — Income/Expenses + Days/Trips (side by side)
            Shared 6-col card grids so left & right cards have equal heights
        ════════════════════════════════════════════════════════════════════ */}

        {/* Section titles + year selectors — full width row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-end mb-2">
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase text-foreground tracking-wide">Days Rented and Trips Taken</h2>
            <Select value={selectedYearTrips} onValueChange={setSelectedYearTrips}>
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
        </div>

        {/* ── Summary card rows — match target screenshot ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-2">

          {/* ── Income/Expenses block ── */}
          <div>
            {/* Column headers — grid aligned with the cards below */}
            <div className="grid mb-1" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px" }}>
              <div />
              <div className="text-center text-sm font-semibold text-foreground">Rental income</div>
              <div className="text-center text-sm font-semibold text-foreground">Expenses</div>
              <div className="text-center text-sm font-semibold" style={{ color: "#C9A227" }}>Profit</div>
            </div>
            {/* Total row */}
            <div className="grid" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px", marginBottom: "2px" }}>
              <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">Total</div>
              <SummaryCard variant="black" label="" value={fmt(yearTotals.income)} />
              <SummaryCard variant="light" label="" value={fmt(yearTotals.expenses)} />
              <SummaryCard variant="gold"  label="" value={fmt(yearTotals.profit)} valueColor={yearTotals.profit < 0 ? "#ef4444" : "#1a1a1a"} />
            </div>
            {/* Current month row */}
            <div className="grid" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px" }}>
              <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">{MONTHS_SHORT[currentMonth - 1]} {selectedYear}</div>
              <SummaryCard variant="black" label="" value={fmt(currentMonthData?.income ?? 0)} />
              <SummaryCard variant="light" label="" value={fmt(currentMonthData?.expenses ?? 0)} />
              <SummaryCard variant="gold"  label="" value={fmt(currentMonthData?.profit ?? 0)} valueColor={(currentMonthData?.profit ?? 0) < 0 ? "#ef4444" : "#1a1a1a"} />
            </div>
          </div>

          {/* ── Days/Trips block ── */}
          <div>
            {/* Column headers */}
            <div className="grid mb-1" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px" }}>
              <div />
              <div className="text-center text-sm font-semibold text-foreground">Days Rented</div>
              <div className="text-center text-sm font-semibold text-foreground">Trips Taken</div>
              <div className="text-center text-sm font-semibold" style={{ color: "#C9A227" }}>Ave / Trip</div>
            </div>
            {/* Total row */}
            <div className="grid" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px", marginBottom: "2px" }}>
              <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">Total</div>
              <SummaryCard variant="black" label="" value={String(yearTotalsTrips.days)} />
              <SummaryCard variant="light" label="" value={String(yearTotalsTrips.trips)} />
              <SummaryCard variant="gold"  label="" value={yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "$0.00"} />
            </div>
            {/* Current month row */}
            <div className="grid" style={{ gridTemplateColumns: "88px 1fr 1fr 1fr", gap: "2px" }}>
              <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">{MONTHS_SHORT[currentMonth - 1]} {selectedYearTrips}</div>
              <SummaryCard variant="black" label="" value={String(currentMonthDaysTripsData?.days ?? 0)} />
              <SummaryCard variant="light" label="" value={String(currentMonthDaysTripsData?.trips ?? 0)} />
              <SummaryCard variant="gold"  label="" value={(currentMonthDaysTripsData?.trips ?? 0) > 0 ? fmt((currentMonthDaysTripsData?.income ?? 0) / (currentMonthDaysTripsData?.trips ?? 1)) : "$0.00"} />
            </div>
          </div>
        </div>

        {/* Tables side by side — no Card wrapper so they share width with the cards grids above */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* ── SECTION 3 — Income and Expenses table ────────────────────── */}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "88px" }} />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-white font-bold text-xs py-3 px-3 text-left">Month</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner rental income</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner expenses</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner split</th>
              </tr>
            </thead>
            <tbody>
              {tripsLoading || paymentsLoading ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#EAEB80] mx-auto" /></td></tr>
              ) : (
                <>
                  {monthlyTripData.map((row, idx) => (
                    <tr key={row.month} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f5f0e8" }}>
                      <td className="text-sm py-2 px-3 font-medium text-gray-900">{row.month}</td>
                      <td className="text-sm py-2 px-3 text-right text-gray-800">{fmt(row.income)}</td>
                      <td className="text-sm py-2 px-3 text-right text-gray-800">{fmt(row.expenses)}</td>
                      <td className={`text-sm py-2 px-3 text-right font-medium ${row.profit > 0 ? "text-[#C9A227]" : row.profit < 0 ? "text-[#ef4444]" : "text-gray-800"}`}>{fmt(row.profit)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#1a1a1a" }}>
                    <td className="text-sm font-extrabold text-white py-2.5 px-3">Total</td>
                    <td className="text-sm font-bold text-white py-2.5 px-3 text-right">{fmt(yearTotals.income)}</td>
                    <td className="text-sm font-bold text-white py-2.5 px-3 text-right">{fmt(yearTotals.expenses)}</td>
                    <td className={`text-sm font-bold py-2.5 px-3 text-right ${yearTotals.profit >= 0 ? "text-[#EAEB80]" : "text-[#f87171]"}`}>{fmt(yearTotals.profit)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>{/* end section 3 */}

        {/* ── SECTION 4 — Days Rented and Trips Taken table ──────────────── */}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "88px" }} />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-white font-bold text-xs py-3 px-3 text-left">Month</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Days Rented</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Trips Taken</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Ave / Trips Taken</th>
              </tr>
            </thead>
            <tbody>
              {tripsLoading ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#EAEB80] mx-auto" /></td></tr>
              ) : (
                <>
                  {monthlyDaysTripsData.map((row, idx) => (
                    <tr key={row.month} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f5f0e8" }}>
                      <td className="text-sm py-2 px-3 font-medium text-gray-900">{row.month}</td>
                      <td className="text-sm py-2 px-3 text-right text-gray-800">{row.days}</td>
                      <td className="text-sm py-2 px-3 text-right text-gray-800">{row.trips}</td>
                      <td className="text-sm py-2 px-3 text-right text-gray-800">{row.trips > 0 ? fmt(row.avgPerTrip) : "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#1a1a1a" }}>
                    <td className="text-sm font-extrabold text-white py-2.5 px-3">Total</td>
                    <td className="text-sm font-bold text-white py-2.5 px-3 text-right">{yearTotalsTrips.days}</td>
                    <td className="text-sm font-bold text-white py-2.5 px-3 text-right">{yearTotalsTrips.trips}</td>
                    <td className="text-sm font-bold text-[#EAEB80] py-2.5 px-3 text-right">{yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "—"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
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
                Monthly Car Owner Rental Income, Car Owner Profit and Expenses — {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tripsLoading || paymentsLoading ? (
                <div className="flex items-center justify-center h-56">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={monthlyTripData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={CHART_AXIS_TICK}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                      axisLine={{ stroke: "#444" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "#eee", fontWeight: 600 }}
                      formatter={(val: number, name: string) => [fmt(val), name]}
                    />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} iconType="line" />
                    <Line type="monotone" dataKey="income"   name="Car Owner Rental Income" stroke={CHART_GOLD}  strokeWidth={2} dot={{ r: 3, fill: CHART_GOLD }}  activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="profit"   name="Car Owner Profit"        stroke={CHART_GOLD2} strokeWidth={2} dot={{ r: 3, fill: CHART_GOLD2 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="expenses" name="Car Owner Expenses"      stroke={CHART_RED}   strokeWidth={2} dot={{ r: 3, fill: CHART_RED }}   activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart: Days Rented + Trips Taken */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">
                Monthly Days Rented and Trips Taken — {selectedYearTrips}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tripsLoading ? (
                <div className="flex items-center justify-center h-56">
                  <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={monthlyDaysTripsData}
                    margin={{ top: 8, right: 16, left: -20, bottom: 48 }}
                    barCategoryGap="25%"
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={CHART_AXIS_TICK}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                      axisLine={{ stroke: "#444" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: "#eee", fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={CHART_LEGEND_STYLE} iconType="square" />
                    <Bar dataKey="days"  name="Days Rented" fill={CHART_GOLD}  radius={[2, 2, 0, 0]} />
                    <Bar dataKey="trips" name="Trips Taken" fill={CHART_GOLD2} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTIONS 6-9 — 2-column layout:
            LEFT  col: Donut charts (stacked) + NADA chart
            RIGHT col: Payment History + Maintenance History
        ════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Donut charts — side by side within left column */}
            <div className="grid grid-cols-2 gap-6">

              {/* Full year donut */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">Total Car Owner Profit and Expenses</h3>
                {totalsLoading || tripsLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={donutYearData.length > 0 ? donutYearData : [{ name: "No data", value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                        isAnimationActive={true}
                      >
                        {donutYearData.length > 0
                          ? donutYearData.map((entry, i) => (
                              <Cell key={i} fill={PIE_DONUT_COLORS[i % PIE_DONUT_COLORS.length]} />
                            ))
                          : <Cell fill="#2a2a2a" stroke="#555" strokeWidth={1} />
                        }
                      </Pie>
                      {donutYearData.length > 0 && (
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(val: number, name: string) => [fmt(val), name]}
                        />
                      )}
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => <span style={{ color: "#1a1a1a" }}>{value}</span>}
                        payload={
                          donutYearData.length > 0
                            ? undefined
                            : [{ value: "No data", type: "square", color: "#2a2a2a" }]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Current month donut */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">
                  {MONTHS_SHORT[currentMonth - 1]} {selectedYear} Car Owner Profit and Expenses
                </h3>
                {paymentsLoading || tripsLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={donutMonthData.length > 0 ? donutMonthData : [{ name: "No data", value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                        isAnimationActive={true}
                      >
                        {donutMonthData.length > 0
                          ? donutMonthData.map((entry, i) => (
                              <Cell key={i} fill={PIE_DONUT_COLORS[i % PIE_DONUT_COLORS.length]} />
                            ))
                          : <Cell fill="#2a2a2a" stroke="#555" strokeWidth={1} />
                        }
                      </Pie>
                      {donutMonthData.length > 0 && (
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(val: number, name: string) => [fmt(val), name]}
                        />
                      )}
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => <span style={{ color: "#1a1a1a" }}>{value}</span>}
                        payload={
                          donutMonthData.length > 0
                            ? undefined
                            : [{ value: "No data", type: "square", color: "#2a2a2a" }]
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* NADA Change % chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide" style={{ color: "#EAEB80" }}>
                  NADA Change %
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {nadaLoading ? (
                  <div className="flex items-center justify-center h-52">
                    <Loader2 className="w-5 h-5 animate-spin text-[#EAEB80]" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={nadaChartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="nadaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EAEB80" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#EAEB80" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                      <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={{ stroke: "#444" }} tickLine={false} />
                      <YAxis
                        tick={CHART_AXIS_TICK}
                        tickFormatter={(v) => fmt(v)}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelStyle={{ color: "#eee", fontWeight: 600 }}
                        formatter={(val: number | null) => (val !== null ? fmt(val) : "N/A")}
                      />
                      <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                      <Area
                        type="monotone"
                        dataKey="retail"
                        name="Retail Value"
                        stroke={CHART_GOLD}
                        strokeWidth={2}
                        fill="url(#nadaGradient)"
                        connectNulls
                        dot={{ r: 3, fill: CHART_GOLD }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>{/* end left column */}

          {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* SECTION 8 — Payment History */}
            <Card className="border-border bg-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase text-foreground tracking-wide">
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
                      <TableRow style={{ backgroundColor: "#1a1a1a" }}>
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
                            <span className={p.payments_amount_balance >= 0 ? "text-green-400" : "text-red-400"}>
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

            {/* SECTION 9 — Maintenance History */}
            <Card className="border-border bg-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase text-foreground tracking-wide">
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
                      <TableRow style={{ backgroundColor: "#1a1a1a" }}>
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
                      <Link href={`/admin/cars/${activeCar.id}/maintenance`} className="text-xs text-[#EAEB80] hover:underline mt-1">
                        View full maintenance page →
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>{/* end right column */}

        </div>{/* end sections 6-9 grid */}

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
