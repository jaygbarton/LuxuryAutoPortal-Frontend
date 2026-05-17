import { useQuery } from "@tanstack/react-query";
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
import { buildApiUrl } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader, SummaryCard } from "@/components/admin/dashboard";
import {
  formatCurrency,
  formatShortMonth,
  formatFullMonth,
} from "./utils";
import { cn } from "@/lib/utils";
import type {
  IncomeExpenseData,
  IncomeExpenseMonth,
  FormulaSetting,
} from "@/pages/admin/income-expenses/types";

// ── Types ──────────────────────────────────────────────────────────────

interface IncomeExpensesSectionProps {
  year: string;
  onYearChange: (year: string) => void;
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

function managementIncome(gross: number, fs: FormulaSetting): number {
  return gross * (fs.carManagementSplitPercent / 100);
}

function carOwnerIncome(gross: number, fs: FormulaSetting): number {
  return gross * (fs.carOwnerSplitPercent / 100);
}

// Pre-computed fields from aggregated API (per-car splits summed on backend)
interface IncomeExpenseMonthWithSplits extends IncomeExpenseMonth {
  mgmtIncome?: number;
  ownerIncome?: number;
}

// ── Year range ─────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear + 1 - 2019 + 1 },
  (_, i) => String(2019 + i),
);

// ── Shimmer loading state ──────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-700 ${className ?? ""}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4">
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
  data: { name: string; value: number; color: string }[];
  formatValue?: (v: number) => string;
}

function DonutChart({ data, formatValue = formatCurrency }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, value, name } = props;
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    const sx = cx + outerRadius * cos;
    const sy = cy + outerRadius * sin;
    const mx = cx + (outerRadius + 12) * cos;
    const my = cy + (outerRadius + 12) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 18;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke="#999999"
          strokeWidth={1}
          fill="none"
        />
        <text
          x={ex + (cos >= 0 ? 4 : -4)}
          y={ey}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fill="#000000"
        >
          <tspan x={ex + (cos >= 0 ? 4 : -4)} dy="-0.6em" style={{ fontWeight: 700, fontSize: 13 }}>
            {formatValue(value)}
          </tspan>
          <tspan x={ex + (cos >= 0 ? 4 : -4)} dy="1.3em" style={{ fontSize: 11 }}>
            {name}
          </tspan>
          <tspan x={ex + (cos >= 0 ? 4 : -4)} dy="1.3em" style={{ fontSize: 11 }}>
            {pct}%
          </tspan>
        </text>
      </g>
    );
  };

  return (
    <div className="flex justify-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={0}
            label={renderLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} stroke="none" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
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
    <div className="bg-white">
      <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-black" style={{ letterSpacing: "0.3px" }}>
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={280}>
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
            <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} barSize={12} />
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
    <div className="bg-white">
      <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-black" style={{ letterSpacing: "0.3px" }}>
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={280}>
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
              type="monotone"
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
    <div className="w-full">
      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div
              className="shrink-0 text-xs text-black"
              style={{ width: labelColWidth }}
            >
              {item.label}
            </div>
            <div className="relative h-10 flex-1 bg-transparent">
              <div
                className="h-full bg-[#E8C547]"
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

export default function IncomeExpensesSection({
  year,
  onYearChange,
}: IncomeExpensesSectionProps) {
  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["/api/income-expense/all-cars", year],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/income-expense/all-cars/${year}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to fetch income data: ${res.status}`);
      return res.json();
    },
  });

  const ieData = data?.data;
  const fs = ieData?.formulaSetting;

  // ── Compute aggregates ─────────────────────────────────────────────

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const monthlyComputed = months.map((m) => {
    const ie = getMonthEntry(ieData?.incomeExpenses ?? [], m) as IncomeExpenseMonthWithSplits | undefined;
    const hist = getMonthEntry(ieData?.history ?? [], m);
    const dd = getMonthEntry(ieData?.directDelivery ?? [], m);

    const gross = ie ? grossRentalIncome(ie) : 0;
    // Use pre-computed splits from backend (aggregated per-car) when available,
    // otherwise fall back to local calculation (single-car view)
    const mgmtInc = (ie?.mgmtIncome != null && ie.mgmtIncome > 0)
      ? ie.mgmtIncome
      : (fs ? managementIncome(gross, fs) : 0);
    const ownerInc = (ie?.ownerIncome != null && ie.ownerIncome > 0)
      ? ie.ownerIncome
      : (fs ? carOwnerIncome(gross, fs) : 0);
    const mgmtExp = ie?.carManagementTotalExpenses ?? 0;
    const ownerExp = ie?.carOwnerTotalExpenses ?? 0;

    return {
      month: m,
      gross,
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
    };
  });

  const totalMgmtIncome = monthlyComputed.reduce((s, m) => s + m.mgmtIncome, 0);
  const totalMgmtExpenses = monthlyComputed.reduce((s, m) => s + m.mgmtExpenses, 0);
  const totalOwnerIncome = monthlyComputed.reduce((s, m) => s + m.ownerIncome, 0);
  const totalOwnerExpenses = monthlyComputed.reduce((s, m) => s + m.ownerExpenses, 0);
  const totalDaysRented = monthlyComputed.reduce((s, m) => s + m.daysRented, 0);
  const totalCarsAvailable = monthlyComputed.reduce((s, m) => s + m.carsAvailable, 0);

  // ── Table data ─────────────────────────────────────────────────────

  const tableColumns = [
    { key: "month", label: "Month and Year", align: "left" as const },
    { key: "rentalIncome", label: "Rental Income", align: "right" as const },
    { key: "mgmtExpenses", label: "MGMT Expenses", align: "right" as const },
    { key: "mgmtSplit", label: "MGMT Split", align: "right" as const },
    { key: "ownerExpenses", label: "Car Owner Expenses", align: "right" as const },
    { key: "ownerSplit", label: "Car Owner Split", align: "right" as const },
    { key: "daysRented", label: "Days Rented", align: "right" as const },
    { key: "tripsTaken", label: "Trips Taken", align: "right" as const },
  ];

  const tableRows = monthlyComputed.map((mc) => ({
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
  }));

  const tableTotals = {
    month: "TOTAL",
    rentalIncome: formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0)),
    mgmtExpenses: formatCurrency(totalMgmtExpenses),
    mgmtSplit: formatCurrency(totalMgmtIncome),
    ownerExpenses: formatCurrency(totalOwnerExpenses),
    ownerSplit: formatCurrency(totalOwnerIncome),
    daysRented: totalDaysRented.toLocaleString(),
    tripsTaken: monthlyComputed.reduce((s, m) => s + m.tripsTaken, 0).toLocaleString(),
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
    { name: "Management Income", value: totalMgmtIncome, color: "#FFCC00" },
    { name: "Car Owner Income", value: totalOwnerIncome, color: "#111111" },
  ];

  const expenseDonut = [
    { name: "Management Expenses", value: totalMgmtExpenses, color: "#FFCC00" },
    { name: "Car Owner Expenses", value: totalOwnerExpenses, color: "#111111" },
  ];

  const totalAvailableDays = totalCarsAvailable * 30;
  const unusedDays = Math.max(0, totalAvailableDays - totalDaysRented);
  const activityDonut = [
    { name: "Days Rented", value: totalDaysRented, color: "#FFCC00" },
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

  // Show previous calendar month (e.g. if now is March 2026, show February 2026)
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthNum = prevMonthDate.getMonth() + 1; // 1-indexed
  const prevMonthYear = prevMonthDate.getFullYear();
  // If viewing the same year as the previous month, use it; otherwise fall back to last month with data
  const prevMonth = String(prevMonthYear) === year
    ? monthlyComputed.find((m) => m.month === prevMonthNum) ?? null
    : null;
  const prevMonthLabel = prevMonth
    ? `${formatFullMonth(prevMonth.month)} ${year}`
    : prevMonthDate && String(prevMonthYear) === year
      ? `${formatFullMonth(prevMonthNum)} ${year}`
      : "";

  // Right-side donut charts: show the most recent month for the selected year
  const displayMonthNum = String(prevMonthYear) === year ? prevMonthNum : 12;
  const displayMonthEntry = monthlyComputed.find((m) => m.month === displayMonthNum) ?? null;
  const displayMonthLabel = `${formatShortMonth(displayMonthNum)} ${year}`;
  const displayMgmtIncome = displayMonthEntry?.mgmtIncome ?? 0;
  const displayMgmtExpenses = displayMonthEntry?.mgmtExpenses ?? 0;
  const displayOwnerIncome = displayMonthEntry?.ownerIncome ?? 0;
  const displayOwnerExpenses = displayMonthEntry?.ownerExpenses ?? 0;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="mb-8">
      <SectionHeader title="INCOME AND EXPENSES" />

      {/* Year Selector */}
      <div className="mt-4 flex items-center gap-3 px-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-gray-800">
          Year
        </span>
        <Select value={year} onValueChange={onYearChange}>
          <SelectTrigger className="w-[120px] border-gray-300 bg-white text-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-200 bg-white text-black">
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-red-600">
            Failed to load income &amp; expenses data. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && ieData && (
        <div className="mt-4 space-y-6 px-4">

          {/* ── Row 1: Summary Cards (left) + Monthly Table (right) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Left: Summary Cards — no outer box, stacked sections */}
            <div className="xl:col-span-1 flex flex-col gap-5">
              {/* Total Management Income and Expenses */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Total Management Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="gold" />
                </div>
              </div>

              {/* Management Income and Expenses */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Management Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="gold" />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Rental Income`} value={formatCurrency(prevMonth?.gross ?? 0)} variant="dark" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Expenses`} value={formatCurrency(prevMonth?.mgmtExpenses ?? 0)} variant="white" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Profit`} value={formatCurrency((prevMonth?.mgmtIncome ?? 0) - (prevMonth?.mgmtExpenses ?? 0))} variant="gold" />
                </div>
              </div>

              {/* Car Owner Income and Expenses */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Car Owner Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="gold" />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Rental Income`} value={formatCurrency(prevMonth?.gross ?? 0)} variant="dark" />
                  <SummaryCard label={`${prevMonthLabel} Owner Expenses`} value={formatCurrency(prevMonth?.ownerExpenses ?? 0)} variant="white" />
                  <SummaryCard label={`${prevMonthLabel} Owner Profit`} value={formatCurrency((prevMonth?.ownerIncome ?? 0) - (prevMonth?.ownerExpenses ?? 0))} variant="gold" />
                </div>
              </div>
            </div>

            {/* Right: Monthly Income & Expenses Table */}
            <div className="xl:col-span-2 bg-white">
              <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                Monthly Income and Expenses
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-black">
                      {tableColumns.map((col) => (
                        <th
                          key={col.key}
                          className={`px-3 py-2 text-xs font-bold uppercase text-white ${
                            col.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <tr key={idx} className={cn(idx % 2 === 0 ? "bg-white" : "bg-gray-50", "transition hover:bg-amber-50/40")}>
                        {tableColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-3 py-2 text-sm text-gray-900 ${
                              col.align === "right" ? "text-right" : "text-left"
                            }`}
                          >
                            {row[col.key as keyof typeof row]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-[#FFCC00] font-bold">
                      {tableColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 text-sm text-black ${
                            col.align === "right" ? "text-right" : "text-left"
                          }`}
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

          {/* ── Row 2: Donuts + Horizontal bars (40%) + Line/Bar charts (60%) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-12">
            {/* Left column — 2/5 (40%) */}
            <div className="xl:col-span-2 space-y-8">
              {/* 2x2 Donut grid */}
              <div className="grid grid-cols-2 gap-2">
                <DonutChart
                  data={[
                    { name: "Total Car Mngmt Expenses", value: totalMgmtExpenses, color: "#E8C547" },
                    { name: "Total Car Mngmt Profit", value: Math.max(0, totalMgmtIncome - totalMgmtExpenses), color: "#F5E6A8" },
                  ]}
                />
                <DonutChart
                  data={[
                    { name: "Total Car Mngmt Profit", value: Math.max(0, displayMgmtIncome - displayMgmtExpenses), color: "#E8C547" },
                    { name: "Total Car Mngmt Expenses", value: displayMgmtExpenses, color: "#F5E6A8" },
                  ]}
                />
                <DonutChart
                  data={[
                    { name: "Total Car Owner Expenses", value: totalOwnerExpenses, color: "#E8C547" },
                    { name: "Total Car Owner Profit", value: Math.max(0, totalOwnerIncome - totalOwnerExpenses), color: "#F5E6A8" },
                  ]}
                />
                <DonutChart
                  data={[
                    { name: "Total Car Owner Profit", value: Math.max(0, displayOwnerIncome - displayOwnerExpenses), color: "#E8C547" },
                    { name: "Total Car Owner Expenses", value: displayOwnerExpenses, color: "#F5E6A8" },
                  ]}
                />
              </div>

              {/* Horizontal bar chart with x-axis */}
              <HorizontalBarChart
                items={[
                  { label: "Total Trips Taken", value: totalTripsTaken },
                  { label: "Total Days Rented", value: totalDaysRented },
                ]}
              />
            </div>

            {/* Right column — 3/5 (60%) — stacked charts */}
            <div className="xl:col-span-3 space-y-8">
              <LineChartCard
                title="Management Income and Expenses"
                data={mgmtBarData}
                lines={[
                  { dataKey: "Income", stroke: "#E8C547" },
                  { dataKey: "Expenses", stroke: "#F5E6A8" },
                ]}
              />
              <LineChartCard
                title="Car Owner Income and Expenses"
                data={ownerBarData}
                lines={[
                  { dataKey: "Income", stroke: "#E8C547" },
                  { dataKey: "Expenses", stroke: "#B8860B" },
                ]}
              />
              <BarChartCard
                title="Days Rented and Trips Taken"
                data={activityBarData}
                bars={[
                  { dataKey: "Days Rented", fill: "#E8C547" },
                  { dataKey: "Trips Taken", fill: "#C9A227" },
                ]}
                yAxisPrefix=""
              />
            </div>
          </div>
        </div>
      )}

      {!isLoading && !isError && !ieData && (
        <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 px-6 py-8 text-center">
          <p className="text-sm text-gray-500">No data available for {year}.</p>
        </div>
      )}
    </div>
  );
}
