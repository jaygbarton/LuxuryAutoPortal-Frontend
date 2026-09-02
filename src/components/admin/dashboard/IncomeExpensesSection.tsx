import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader, SummaryCard } from "@/components/admin/dashboard";
import { AvailableCarsEditHistory } from "@/components/admin/dashboard/AvailableCarsEditHistory";
import {
  formatCurrency,
  formatShortMonth,
  formatFullMonth,
} from "./utils";
import { cn } from "@/lib/utils";
import type {
  IncomeExpenseData,
  IncomeExpenseMonth,
} from "@/pages/admin/income-expenses/types";

// ── Types ──────────────────────────────────────────────────────────────

interface IncomeExpensesSectionProps {
  year: string;
  onYearChange?: (year: string) => void;
}

interface ApiResponse {
  success: boolean;
  data: IncomeExpenseData;
}

// ── Computed helpers ───────────────────────────────────────────────────

function getMonthEntry<T extends { month: number }>(arr: T[], month: number): T | undefined {
  return arr.find((e) => e.month === month);
}

function grossRentalIncome(m: IncomeExpenseMonth): number {
  return (
    m.rentalIncome +
    m.deliveryIncome +
    m.electricPrepaidIncome +
    m.smokingFines +
    m.gasPrepaidIncome +
    m.skiRacksIncome +
    m.milesIncome +
    m.childSeatIncome +
    m.coolersIncome +
    m.insuranceWreckIncome +
    m.otherIncome
  );
}

// Pre-computed fields from aggregated API (per-car splits summed on backend)
interface IncomeExpenseMonthWithSplits extends IncomeExpenseMonth {
  mgmtIncome?: number;
  ownerIncome?: number;
}

// ── Shimmer loading state ──────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-700 ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-20" />
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-56 flex-1" />
        ))}
      </div>
      <Shimmer className="h-64" />
      <Shimmer className="h-72" />
    </div>
  );
}

// ── Donut chart wrapper ────────────────────────────────────────────────

interface DonutChartProps {
  data: { name: string; value: number }[];
  formatValue?: (v: number) => string;
}

const DONUT_COLOR_LIGHT = "#D3BC8D";
const DONUT_COLOR_DARK = "#D9D9D9";

function DonutChart({ data, formatValue = formatCurrency }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const isEmpty = total <= 0;
  const pieData = isEmpty ? [{ name: "__empty__", value: 1 }] : data;

  // Amount label centred on each slice band — no external labels.
  const renderLabel = (props: any) => {
    if (isEmpty) return null; // empty ring carries no amount label
    const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
    const RADIAN = Math.PI / 180;
    const r = (innerRadius + outerRadius) / 2;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
        style={{ fontWeight: 700, fontSize: 11, fill: "#000000" }}>
        {formatValue(value)}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Legend above the chart */}
      <div className="flex flex-col gap-0.5 mb-1">
        {data.map((entry, idx) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
          const color = entry.value === maxValue ? DONUT_COLOR_LIGHT : DONUT_COLOR_DARK;
          return (
            <div key={idx} className="flex items-center gap-1 text-[10px] leading-tight">
              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-700 truncate">{entry.name}</span>
              <span className="ml-auto font-semibold text-gray-900 flex-shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
      {/* Chart takes remaining space */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={pieData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="42%"
              outerRadius="82%"
              paddingAngle={0}
              label={renderLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {pieData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={isEmpty
                    ? DONUT_COLOR_DARK
                    : entry.value === maxValue ? DONUT_COLOR_LIGHT : DONUT_COLOR_DARK}
                  stroke="none"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Bar chart wrapper ──────────────────────────────────────────────────

interface BarChartCardProps {
  title: string;
  data: Record<string, string | number>[];
  bars: { dataKey: string; fill: string }[];
  yAxisPrefix?: string;
}

function BarChartCard({ title, data, bars, yAxisPrefix = "$" }: BarChartCardProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-black" style={{ letterSpacing: "0.3px" }}>
        {title}
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E8E8E8" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#000000" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6B6B6B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              yAxisPrefix === "$" ? `$${v.toLocaleString()}` : v.toLocaleString()
            }
          />
          <Tooltip
            formatter={(v: number) =>
              yAxisPrefix === "$" ? formatCurrency(v) : v.toLocaleString()
            }
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          />
          {bars.map((b) => (
            <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} barSize={22} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Line chart wrapper ─────────────────────────────────────────────────

interface LineChartCardProps {
  title: string;
  data: Record<string, string | number>[];
  lines: { dataKey: string; stroke: string }[];
  yAxisPrefix?: string;
}

function LineChartCard({ title, data, lines, yAxisPrefix = "$" }: LineChartCardProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-black" style={{ letterSpacing: "0.3px" }}>
        {title}
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E8E8E8" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#000000" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6B6B6B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              yAxisPrefix === "$" ? `$${v.toLocaleString()}` : v.toLocaleString()
            }
          />
          <Tooltip
            formatter={(v: number) =>
              yAxisPrefix === "$" ? formatCurrency(v) : v.toLocaleString()
            }
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          />
          {lines.map((l) => (
            <Line
              key={l.dataKey}
              type="linear"
              dataKey={l.dataKey}
              stroke={l.stroke}
              strokeWidth={2}
              dot={{ r: 2.5, fill: l.stroke, stroke: l.stroke }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Horizontal bar chart with x-axis scale ────────────────────────────

interface HorizontalBarChartProps {
  items: { label: string; value: number }[];
}

function HorizontalBarChart({ items }: HorizontalBarChartProps) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  // Round up max to next nice tick for axis
  const niceMax = (() => {
    const order = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const norm = maxValue / order;
    let nice: number;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * order;
  })();
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => Math.round(niceMax * t));
  const labelColWidth = 130;
  const valueColWidth = 60;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 flex-col justify-around gap-1 pt-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div
              className="shrink-0 text-xs text-black"
              style={{ width: labelColWidth }}
            >
              {item.label}
            </div>
            <div className="relative h-20 flex-1 bg-transparent">
              <div
                className="h-full bg-[#D3BC8D] rounded-r-md"
                style={{
                  width: `${niceMax > 0 ? (item.value / niceMax) * 100 : 0}%`,
                }}
              />
            </div>
            <div
              className="shrink-0 text-right text-xs text-black"
              style={{ width: valueColWidth }}
            >
              {item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>
      {/* x-axis */}
      <div
        className="mt-2 flex items-center"
        style={{ paddingLeft: labelColWidth + 12, paddingRight: valueColWidth + 12 }}
      >
        <div className="flex w-full justify-between text-[11px] text-[#6B6B6B]">
          {ticks.map((t) => (
            <span key={t}>{t.toLocaleString()}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export default function IncomeExpensesSection({ year, onYearChange }: IncomeExpensesSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/income-expense/all-cars", year];

  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/income-expense/all-cars/${year}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to fetch income data: ${res.status}`);
      return res.json();
    },
  });

  const ieData = data?.data;

  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const saveAvailableCars = useMutation({
    mutationFn: async ({ month, value }: { month: number; value: number }) => {
      const res = await fetch(buildApiUrl("/api/income-expense/history"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId: 0,
          year: parseInt(year, 10),
          month,
          carsAvailableForRent: value,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense"] });
      setEditingMonth(null);
    },
    onError: () => {
      toast({
        title: "Failed to save",
        description: "Available Cars could not be updated. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Compute aggregates ─────────────────────────────────────────────

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const monthlyComputed = months.map((m) => {
    const ie = getMonthEntry(ieData?.incomeExpenses ?? [], m) as IncomeExpenseMonthWithSplits | undefined;
    const hist = getMonthEntry(ieData?.history ?? [], m);
    const dd = getMonthEntry(ieData?.directDelivery ?? [], m);

    const gross = ie ? grossRentalIncome(ie) : 0;
    const rentalIncome = ie ? Number(ie.rentalIncome ?? 0) : 0;
    // All-Cars splits are pre-summed per car on the backend. Do not fall
    // back to formulaSetting × fleet gross — aggregated percents are 0 and
    // a single % cannot be applied to combined income.
    const mgmtInc = Number(ie?.mgmtIncome) || 0;
    const ownerInc = Number(ie?.ownerIncome) || 0;
    const mgmtExp = ie?.carManagementTotalExpenses ?? 0;
    const ownerExp = ie?.carOwnerTotalExpenses ?? 0;

    return {
      month: m,
      gross,
      rentalIncome,
      mgmtIncome: mgmtInc,
      ownerIncome: ownerInc,
      mgmtExpenses: mgmtExp,
      ownerExpenses: ownerExp,
      netMgmt: mgmtInc - mgmtExp,
      netOwner: ownerInc - ownerExp,
      negativeBalance: ie?.negativeBalanceCarryOver ?? 0,
      daysRented: hist?.daysRented ?? 0,
      tripsTaken: hist?.tripsTaken ?? 0,
      carsAvailable: hist?.carsAvailableForRent ?? 0,
      parkingAirport: dd?.parkingAirport ?? 0,
      totalMiles: hist?.totalMiles ?? 0,
      avgLeadTimeDays: hist?.avgLeadTimeDays ?? 0,
      totalLeadTimeDays: hist?.totalLeadTimeDays ?? 0,
      tripsWithLeadTime: hist?.tripsWithLeadTime ?? 0,
    };
  });

  const totalMgmtIncome = monthlyComputed.reduce((s, m) => s + m.mgmtIncome, 0);
  const totalMgmtExpenses = monthlyComputed.reduce((s, m) => s + m.mgmtExpenses, 0);
  const totalOwnerIncome = monthlyComputed.reduce((s, m) => s + m.ownerIncome, 0);
  const totalOwnerExpenses = monthlyComputed.reduce((s, m) => s + m.ownerExpenses, 0);
  const totalDaysRented = monthlyComputed.reduce((s, m) => s + m.daysRented, 0);
  const totalCarsAvailable = monthlyComputed.reduce((s, m) => s + m.carsAvailable, 0);
  const totalGross = monthlyComputed.reduce((s, m) => s + m.gross, 0);
  const totalTripsTakenAll = monthlyComputed.reduce((s, m) => s + m.tripsTaken, 0);
  const yearNum = parseInt(year, 10) || new Date().getFullYear();
  const daysInMonth = (m: number) => new Date(yearNum, m, 0).getDate();

  // ── Table data ─────────────────────────────────────────────────────

  const tableColumns = [
    { key: "month", label: "Month and Year", align: "left" as const },
    { key: "rentalIncome", label: "Total Income", align: "right" as const },
    { key: "mgmtExpenses", label: "MGMT Expenses", align: "right" as const },
    { key: "mgmtSplit", label: "MGMT Split", align: "right" as const },
    { key: "ownerExpenses", label: "Car Owner Expenses", align: "right" as const },
    { key: "ownerSplit", label: "Car Owner Split", align: "right" as const },
    { key: "daysRented", label: "Days Rented", align: "right" as const },
    { key: "tripsTaken", label: "Trips Taken", align: "right" as const },
    { key: "availableDays", label: "Available Cars", align: "right" as const },
    { key: "totalMiles", label: "Total Miles", align: "right" as const, tooltip: "Miles driven per month from Turo trips. Priority: odometer delta (end − start) → actual miles driven → pre-trip estimated distance." },
    { key: "fleetUtilization", label: "Fleet Utilization (%)", align: "right" as const },
    { key: "avgEarningsPerTrip", label: "Avg Earnings / Trips Taken", align: "right" as const },
    { key: "avgLeadTime", label: "Avg lead time", align: "right" as const },
    { key: "avgEarningsPerMile", label: "Avg Earnings/Mile", align: "right" as const },
  ];

  const tableRows = monthlyComputed.map((mc) => {
    const availableDays = mc.carsAvailable * daysInMonth(mc.month);
    const utilizationPct =
      availableDays > 0 ? (mc.daysRented / availableDays) * 100 : 0;
    const avgPerTrip = mc.tripsTaken > 0 ? mc.gross / mc.tripsTaken : 0;
    const avgPerMile = mc.totalMiles > 0 ? mc.gross / mc.totalMiles : 0;
    return {
      month: (
        <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {formatShortMonth(mc.month)} {year}
        </span>
      ),
      rentalIncome: formatCurrency(mc.gross),
      mgmtExpenses: formatCurrency(mc.mgmtExpenses),
      mgmtSplit: formatCurrency(mc.mgmtIncome),
      ownerExpenses: formatCurrency(mc.ownerExpenses),
      ownerSplit: formatCurrency(mc.ownerIncome),
      daysRented: mc.daysRented.toLocaleString(),
      tripsTaken: mc.tripsTaken.toLocaleString(),
      availableDays: editingMonth === mc.month ? (
        <span className="inline-flex items-center justify-end gap-1">
          <Input
            type="number"
            min={0}
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 w-20 text-right text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const value = parseInt(editValue, 10);
              if (!isNaN(value) && value >= 0) {
                saveAvailableCars.mutate({ month: mc.month, value });
              }
            }}
            disabled={saveAvailableCars.isPending}
            className="text-green-600 hover:text-green-700"
            title="Save"
          >
            {saveAvailableCars.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditingMonth(null)}
            className="text-gray-400 hover:text-gray-600"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ) : (
        <span className="inline-flex items-center justify-end gap-1.5">
          {mc.carsAvailable.toLocaleString()}
          <button
            type="button"
            onClick={() => {
              setEditingMonth(mc.month);
              setEditValue(String(mc.carsAvailable));
            }}
            className="text-gray-400 hover:text-gray-600"
            title="Edit Available Cars"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <AvailableCarsEditHistory year={year} month={mc.month} />
        </span>
      ),
      totalMiles: mc.totalMiles.toLocaleString(),
      fleetUtilization: `${utilizationPct.toFixed(2)}%`,
      avgEarningsPerTrip: formatCurrency(mc.tripsTaken > 0 ? avgPerTrip : 0),
      avgLeadTime: (mc.avgLeadTimeDays > 0 ? mc.avgLeadTimeDays : 0).toFixed(2),
      avgEarningsPerMile: formatCurrency(mc.totalMiles > 0 ? avgPerMile : 0),
    };
  });

  const totalAvailableDaysAccurate = monthlyComputed.reduce(
    (s, m) => s + m.carsAvailable * daysInMonth(m.month),
    0,
  );
  const yearUtilization =
    totalAvailableDaysAccurate > 0
      ? (totalDaysRented / totalAvailableDaysAccurate) * 100
      : 0;
  const avgCarsAvailable = totalCarsAvailable / 12;
  const yearAvgPerTrip =
    totalTripsTakenAll > 0 ? totalGross / totalTripsTakenAll : 0;

  const totalMilesAll = monthlyComputed.reduce((s, m) => s + m.totalMiles, 0);
  const yearTotalLeadTime = monthlyComputed.reduce((s, m) => s + (m.totalLeadTimeDays ?? 0), 0);
  const yearTripsWithLeadTime = monthlyComputed.reduce((s, m) => s + (m.tripsWithLeadTime ?? 0), 0);
  const yearAvgLeadTime = yearTripsWithLeadTime > 0 ? yearTotalLeadTime / yearTripsWithLeadTime : 0;
  const yearAvgPerMile = totalMilesAll > 0 ? totalGross / totalMilesAll : 0;

  const totalRentalIncome = totalGross;

  const tableTotals = {
    month: "TOTAL",
    rentalIncome: formatCurrency(totalRentalIncome),
    mgmtExpenses: formatCurrency(totalMgmtExpenses),
    mgmtSplit: formatCurrency(totalMgmtIncome),
    ownerExpenses: formatCurrency(totalOwnerExpenses),
    ownerSplit: formatCurrency(totalOwnerIncome),
    daysRented: totalDaysRented.toLocaleString(),
    tripsTaken: totalTripsTakenAll.toLocaleString(),
    availableDays: avgCarsAvailable.toLocaleString(undefined, { maximumFractionDigits: 1 }),
    totalMiles: totalMilesAll.toLocaleString(),
    fleetUtilization: `${yearUtilization.toFixed(2)}%`,
    avgEarningsPerTrip: formatCurrency(
      totalTripsTakenAll > 0 ? yearAvgPerTrip : 0,
    ),
    avgLeadTime: (yearAvgLeadTime > 0 ? yearAvgLeadTime : 0).toFixed(2),
    avgEarningsPerMile: formatCurrency(totalMilesAll > 0 ? yearAvgPerMile : 0),
  };

  // ── Chart data ─────────────────────────────────────────────────────

  const mgmtBarData = monthlyComputed.map((mc) => ({
    month: `${formatShortMonth(mc.month)} ${year}`,
    Income: mc.mgmtIncome,
    Expenses: mc.mgmtExpenses,
  }));

  const ownerBarData = monthlyComputed.map((mc) => ({
    month: `${formatShortMonth(mc.month)} ${year}`,
    Income: mc.ownerIncome,
    Expenses: mc.ownerExpenses,
  }));

  const activityBarData = monthlyComputed.map((mc) => ({
    month: `${formatShortMonth(mc.month)} ${year}`,
    "Days Rented": mc.daysRented,
    "Trips Taken": mc.tripsTaken,
  }));

  const parkingBarData = monthlyComputed.map((mc) => ({
    month: formatShortMonth(mc.month),
    "Parking Airport": mc.parkingAirport,
  }));

  // ── Donut data ─────────────────────────────────────────────────────

  const incomeDonut = [
    { name: "Management Income", value: totalMgmtIncome, color: "#D3BC8D" },
    { name: "Car Owner Income", value: totalOwnerIncome, color: "#111111" },
  ];

  const expenseDonut = [
    { name: "Management Expenses", value: totalMgmtExpenses, color: "#D3BC8D" },
    { name: "Car Owner Expenses", value: totalOwnerExpenses, color: "#111111" },
  ];

  const totalAvailableDays = totalCarsAvailable * 30;
  const unusedDays = Math.max(0, totalAvailableDays - totalDaysRented);
  const activityDonut = [
    { name: "Days Rented", value: totalDaysRented, color: "#D3BC8D" },
    { name: "Days Unused", value: unusedDays, color: "#666666" },
  ];
  const totalGrossIncome = monthlyComputed.reduce((s, m) => s + m.gross, 0);
  const totalTripsTaken = monthlyComputed.reduce((s, m) => s + m.tripsTaken, 0);
  const managementProfit = totalMgmtIncome - totalMgmtExpenses;
  const ownerProfit = totalOwnerIncome - totalOwnerExpenses;
  const utilizationRate = totalAvailableDays > 0 ? (totalDaysRented / totalAvailableDays) * 100 : 0;
  const avgDaysRentedPerMonth = totalDaysRented / 12;
  const chartTrendData = monthlyComputed.map((mc) => ({
    month: formatShortMonth(mc.month),
    "Fleet Utilization %": mc.carsAvailable > 0 ? (mc.daysRented / (mc.carsAvailable * 30)) * 100 : 0,
  }));

  // ── Render helpers ───────────────────────────────────────────────────

  // Featured month: last completed month of the selected year.
  // Current year → previous calendar month (Sept 2026 → Aug). Past year → Dec.
  const now = new Date();
  const currentYearNum = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1; // 1-indexed
  const featuredMonthNum =
    yearNum < currentYearNum ? 12
    : yearNum === currentYearNum ? currentMonthNum - 1
    : 0;
  const featuredMonth = featuredMonthNum >= 1
    ? monthlyComputed.find((m) => m.month === featuredMonthNum) ?? null
    : null;
  const featuredMonthLabel = featuredMonth
    ? `${formatFullMonth(featuredMonth.month)} ${year}`
    : "";

  const displayMonthNum = featuredMonthNum >= 1 ? featuredMonthNum : 12;
  const displayMonthEntry = featuredMonth
    ?? monthlyComputed.find((m) => m.month === displayMonthNum)
    ?? null;
  const displayMgmtIncome = displayMonthEntry?.mgmtIncome ?? 0;
  const displayMgmtExpenses = displayMonthEntry?.mgmtExpenses ?? 0;
  const displayOwnerIncome = displayMonthEntry?.ownerIncome ?? 0;
  const displayOwnerExpenses = displayMonthEntry?.ownerExpenses ?? 0;

  const completedMonths =
    yearNum < currentYearNum
      ? monthlyComputed
      : yearNum === currentYearNum
        ? monthlyComputed.filter((m) => m.month < currentMonthNum)
        : [];

  const avg = (sum: number) => completedMonths.length > 0 ? sum / completedMonths.length : 0;
  const avgMgmtIncome = avg(completedMonths.reduce((s, m) => s + m.gross, 0));
  const worstMgmtCashFlow = completedMonths.length > 0 ? Math.min(...completedMonths.map((m) => m.mgmtIncome)) : 0;
  const bestMgmtCashFlow = completedMonths.length > 0 ? Math.max(...completedMonths.map((m) => m.mgmtIncome)) : 0;
  const worstOwnerCashFlow = completedMonths.length > 0 ? Math.min(...completedMonths.map((m) => m.ownerIncome)) : 0;
  const bestOwnerCashFlow = completedMonths.length > 0 ? Math.max(...completedMonths.map((m) => m.ownerIncome)) : 0;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="mb-8 px-4">
      <SectionHeader title="INCOME AND EXPENSES" />


      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-red-600">
            Failed to load income &amp; expenses data. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && ieData && (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-stretch">
            <div className="xl:col-span-1 flex h-full flex-col justify-between gap-3">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Total Management Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Income" value={formatCurrency(totalGross)} variant="dark" className="h-20" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="gold" className="h-20" />
                </div>
              </div>

              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Management Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Income" value={formatCurrency(totalGross)} variant="dark" className="h-20" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${featuredMonthLabel} Total Income`} value={formatCurrency(featuredMonth?.gross ?? 0)} variant="dark" className="h-20" />
                  <SummaryCard label={`${featuredMonthLabel} Mgmt Expenses`} value={formatCurrency(featuredMonth?.mgmtExpenses ?? 0)} variant="white" className="h-20" />
                  <SummaryCard label={`${featuredMonthLabel} Mgmt Profit`} value={formatCurrency(featuredMonth?.netMgmt ?? 0)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label="Average Rental Income" value={formatCurrency(avgMgmtIncome)} variant="dark" className="h-20" />
                  <SummaryCard label="Worst Month Cash Flow" value={formatCurrency(worstMgmtCashFlow)} variant="white" className="h-20" />
                  <SummaryCard label="Best Month Cash Flow" value={formatCurrency(bestMgmtCashFlow)} variant="gold" className="h-20" />
                </div>
              </div>

              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Car Owner Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Income" value={formatCurrency(totalGross)} variant="dark" className="h-20" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${featuredMonthLabel} Total Income`} value={formatCurrency(featuredMonth?.gross ?? 0)} variant="dark" className="h-20" />
                  <SummaryCard label={`${featuredMonthLabel} Owner Expenses`} value={formatCurrency(featuredMonth?.ownerExpenses ?? 0)} variant="white" className="h-20" />
                  <SummaryCard label={`${featuredMonthLabel} Owner Profit`} value={formatCurrency(featuredMonth?.netOwner ?? 0)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label="Average Rental Income" value={formatCurrency(avgMgmtIncome)} variant="dark" className="h-20" />
                  <SummaryCard label="Worst Month Cash Flow" value={formatCurrency(worstOwnerCashFlow)} variant="white" className="h-20" />
                  <SummaryCard label="Best Month Cash Flow" value={formatCurrency(bestOwnerCashFlow)} variant="gold" className="h-20" />
                </div>
              </div>
            </div>

            <div className="xl:col-span-2 flex h-full min-h-0 flex-col bg-white">
              <h3 className="mb-2 shrink-0 text-sm font-bold uppercase tracking-wide text-black">
                Monthly Income and Expenses
              </h3>
              <div className="relative min-h-0 flex-1">
                <div className="-mx-3 h-full overflow-x-auto px-3 sm:mx-0 sm:px-0 xl:absolute xl:inset-0">
                  <table className="h-full w-full min-w-[880px] border-collapse border-y border-[#D3BC8D]">
                  <thead>
                    <tr className="bg-black border-y border-[#D3BC8D]">
                      {tableColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-center align-middle text-xs font-bold uppercase text-white whitespace-nowrap"
                          title={(col as any).tooltip}
                        >
                          {col.label}{(col as any).tooltip && (
                            <span className="ml-1 opacity-60 text-[10px] normal-case font-normal">ⓘ</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr key={idx} className="bg-white border-y border-[#D3BC8D]">
                        {tableColumns.map((col) => (
                          <td
                            key={col.key}
                            className="px-3 py-2 text-center align-middle text-sm text-gray-900"
                          >
                            {row[col.key as keyof typeof row]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-[#D3BC8D] font-bold border-y border-[#D3BC8D]">
                      {tableColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 text-center align-middle text-sm text-black"
                        >
                          {tableTotals[col.key as keyof typeof tableTotals]}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-6 sm:gap-y-8 xl:[grid-template-rows:repeat(3,200px)] [grid-auto-rows:200px]">

            <div className="xl:col-span-1 grid grid-cols-2 gap-2">
              <DonutChart
                data={[
                  { name: "Total Car Mngmt Expenses", value: totalMgmtExpenses },
                  { name: "Total Car Mngmt Profit", value: Math.max(0, totalMgmtIncome - totalMgmtExpenses) },
                ]}
              />
              <DonutChart
                data={[
                  { name: "Total Car Mngmt Expenses", value: displayMgmtExpenses },
                  { name: "Total Car Mngmt Profit", value: Math.max(0, displayMgmtIncome - displayMgmtExpenses) },
                ]}
              />
            </div>

            <div className="xl:col-span-2 flex flex-col">
              <LineChartCard
                title="Management Income and Expenses"
                data={mgmtBarData}
                lines={[
                  { dataKey: "Income", stroke: "#D3BC8D" },
                  { dataKey: "Expenses", stroke: "#D9D9D9" },
                ]}
              />
            </div>

            <div className="xl:col-span-1 grid grid-cols-2 gap-2">
              <DonutChart
                data={[
                  { name: "Total Car Owner Expenses", value: totalOwnerExpenses },
                  { name: "Total Car Owner Profit", value: Math.max(0, totalOwnerIncome - totalOwnerExpenses) },
                ]}
              />
              <DonutChart
                data={[
                  { name: "Total Car Owner Expenses", value: displayOwnerExpenses },
                  { name: "Total Car Owner Profit", value: Math.max(0, displayOwnerIncome - displayOwnerExpenses) },
                ]}
              />
            </div>

            <div className="xl:col-span-2 flex flex-col">
              <LineChartCard
                title="Car Owner Income and Expenses"
                data={ownerBarData}
                lines={[
                  { dataKey: "Income", stroke: "#D3BC8D" },
                  { dataKey: "Expenses", stroke: "#D9D9D9" },
                ]}
              />
            </div>

            <div className="xl:col-span-1">
              <HorizontalBarChart
                items={[
                  { label: "Total Trips Taken", value: totalTripsTaken },
                  { label: "Total Days Rented", value: totalDaysRented },
                ]}
              />
            </div>

            <div className="xl:col-span-2 flex flex-col">
              <BarChartCard
                title="Days Rented and Trips Taken"
                data={activityBarData}
                bars={[
                  { dataKey: "Days Rented", fill: "#D3BC8D" },
                  { dataKey: "Trips Taken", fill: "#D9D9D9" },
                ]}
                yAxisPrefix=""
              />
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && !ieData && (
        <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-500">No data available for {year}.</p>
        </div>
      )}
    </div>
  );
}
