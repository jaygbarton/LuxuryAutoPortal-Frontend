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

// ── Donut chart center label ───────────────────────────────────────────

function CenterLabel({ viewBox, value }: { viewBox?: { cx: number; cy: number }; value: string }) {
  if (!viewBox) return null;
  return (
    <text
      x={viewBox.cx}
      y={viewBox.cy}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-gray-800 text-sm font-bold"
    >
      {value}
    </text>
  );
}

// ── Donut chart wrapper ────────────────────────────────────────────────

interface DonutChartProps {
  title: string;
  data: { name: string; value: number; color: string }[];
  centerValue: string;
  formatValue?: (v: number) => string;
}

function DonutChart({ title, data, centerValue, formatValue = formatCurrency }: DonutChartProps) {
  return (
    <div className="min-w-[200px] flex-1 rounded-lg bg-white p-4">
      <h4 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-gray-600">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            label={false}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
            <CenterLabel value={centerValue} />
          </Pie>
          <Tooltip
            formatter={(v: number) => formatValue(v)}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-700">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span>{d.name}</span>
            <span className="font-semibold">{formatValue(d.value)}</span>
          </div>
        ))}
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
    <div className="rounded-lg bg-white p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-600">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
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
          <Legend />
          {bars.map((b) => (
            <Bar key={b.dataKey} dataKey={b.dataKey} fill={b.fill} radius={[2, 2, 0, 0]} />
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
    <div className="rounded-lg bg-white p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-800">
        {title}
      </h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis
            tick={{ fontSize: 11 }}
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
              dot={{ r: 3, fill: l.stroke }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export default function IncomeExpensesSection({
  year,
  onYearChange,
}: IncomeExpensesSectionProps) {
  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: [`/api/income-expense/all-cars/${year}`],
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
    month: formatFullMonth(mc.month),
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
    month: formatShortMonth(mc.month),
    Income: mc.mgmtIncome,
    Expenses: mc.mgmtExpenses,
  }));

  const ownerBarData = monthlyComputed.map((mc) => ({
    month: formatShortMonth(mc.month),
    Income: mc.ownerIncome,
    Expenses: mc.ownerExpenses,
  }));

  const activityBarData = monthlyComputed.map((mc) => ({
    month: formatShortMonth(mc.month),
    "Days Rented": mc.daysRented,
    "Trips Taken": mc.tripsTaken,
  }));

  const parkingBarData = monthlyComputed.map((mc) => ({
    month: formatShortMonth(mc.month),
    "Parking Airport": mc.parkingAirport,
  }));

  // ── Donut data ─────────────────────────────────────────────────────

  const incomeDonut = [
    { name: "Management Income", value: totalMgmtIncome, color: "#FFD700" },
    { name: "Car Owner Income", value: totalOwnerIncome, color: "#B8860B" },
  ];

  const expenseDonut = [
    { name: "Management Expenses", value: totalMgmtExpenses, color: "#FFD700" },
    { name: "Car Owner Expenses", value: totalOwnerExpenses, color: "#B8860B" },
  ];

  const totalAvailableDays = totalCarsAvailable * 30;
  const unusedDays = Math.max(0, totalAvailableDays - totalDaysRented);
  const activityDonut = [
    { name: "Days Rented", value: totalDaysRented, color: "#FFD700" },
    { name: "Days Unused", value: unusedDays, color: "#666666" },
  ];

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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Summary Cards */}
            <div className="xl:col-span-1 space-y-3">
              {/* Total Management Income and Expenses */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">
                  Total Management Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="gold" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="dark" />
                </div>
              </div>

              {/* Management Income and Expenses */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">
                  Management Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Management Income" value={formatCurrency(totalMgmtIncome)} variant="gold" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="dark" />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Mgmt Income`} value={formatCurrency(prevMonth?.mgmtIncome ?? 0)} variant="gold" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Expenses`} value={formatCurrency(prevMonth?.mgmtExpenses ?? 0)} variant="white" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Profit`} value={formatCurrency((prevMonth?.mgmtIncome ?? 0) - (prevMonth?.mgmtExpenses ?? 0))} variant="dark" />
                </div>
              </div>

              {/* Car Owner Income and Expenses */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">
                  Car Owner Income and Expenses
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Car Owner Income" value={formatCurrency(totalOwnerIncome)} variant="gold" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="dark" />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Owner Income`} value={formatCurrency(prevMonth?.ownerIncome ?? 0)} variant="gold" />
                  <SummaryCard label={`${prevMonthLabel} Owner Expenses`} value={formatCurrency(prevMonth?.ownerExpenses ?? 0)} variant="white" />
                  <SummaryCard label={`${prevMonthLabel} Owner Profit`} value={formatCurrency((prevMonth?.ownerIncome ?? 0) - (prevMonth?.ownerExpenses ?? 0))} variant="dark" />
                </div>
              </div>
            </div>

            {/* Right: Monthly Income & Expenses Table */}
            <div className="xl:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-black mb-1.5">
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
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
                    <tr className="bg-[#FFD700] font-bold">
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

          {/* ── Row 2: Donut Charts (left) + Line Charts (right) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left: Donut Charts — TOTAL for the year */}
            <div className="grid grid-cols-2 gap-4">
              <DonutChart
                title="TOTAL CAR MGMT INCOME & EXPENSES"
                data={[
                  { name: "Mgmt Income", value: totalMgmtIncome, color: "#FFD700" },
                  { name: "Mgmt Expenses", value: totalMgmtExpenses, color: "#374151" },
                ]}
                centerValue={formatCurrency(totalMgmtIncome - totalMgmtExpenses)}
              />
              <DonutChart
                title="TOTAL CAR MGMT EXPENSES"
                data={[
                  { name: "Mgmt Expenses", value: totalMgmtExpenses, color: "#FFD700" },
                  { name: "Mgmt Income", value: totalMgmtIncome, color: "#374151" },
                ]}
                centerValue={formatCurrency(totalMgmtExpenses)}
              />
              <DonutChart
                title="TOTAL CAR OWNER INCOME AND EXPENSES"
                data={[
                  { name: "Owner Income", value: totalOwnerIncome, color: "#FFD700" },
                  { name: "Owner Expenses", value: totalOwnerExpenses, color: "#374151" },
                ]}
                centerValue={formatCurrency(totalOwnerIncome - totalOwnerExpenses)}
              />
              <DonutChart
                title="TOTAL CAR OWNER EXPENSES"
                data={[
                  { name: "Owner Expenses", value: totalOwnerExpenses, color: "#FFD700" },
                  { name: "Owner Income", value: totalOwnerIncome, color: "#374151" },
                ]}
                centerValue={formatCurrency(totalOwnerExpenses)}
              />
            </div>

            {/* Right: Line Charts — Previous month data */}
            <div className="space-y-4">
              <LineChartCard
                title={`${prevMonthLabel ? prevMonthLabel.toUpperCase() : "PREVIOUS MONTH"} CAR MGMT INCOME & EXPENSES`}
                data={mgmtBarData}
                lines={[
                  { dataKey: "Income", stroke: "#FFD700" },
                  { dataKey: "Expenses", stroke: "#B8860B" },
                ]}
              />
              <LineChartCard
                title={`${prevMonthLabel ? prevMonthLabel.toUpperCase() : "PREVIOUS MONTH"} CAR OWNER INCOME AND EXPENSES`}
                data={ownerBarData}
                lines={[
                  { dataKey: "Income", stroke: "#FFD700" },
                  { dataKey: "Expenses", stroke: "#B8860B" },
                ]}
              />
            </div>
          </div>

          {/* ── Row 3: Days Rented horizontal bar + bar chart ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: Horizontal summary bars */}
            <div className="xl:col-span-1 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600 w-24 shrink-0">Total Trips Taken</span>
                <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                  <div
                    className="bg-[#FFD700] h-full rounded"
                    style={{ width: `${Math.min(100, (monthlyComputed.reduce((s, m) => s + m.tripsTaken, 0) / Math.max(1, totalDaysRented)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-800 w-16 text-right">
                  {monthlyComputed.reduce((s, m) => s + m.tripsTaken, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600 w-24 shrink-0">Total Days Rented</span>
                <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                  <div className="bg-[#FFD700] h-full rounded w-full" />
                </div>
                <span className="text-xs font-bold text-gray-800 w-16 text-right">
                  {totalDaysRented.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Right: Days Rented bar chart */}
            <div className="xl:col-span-2">
              <BarChartCard
                title="DAYS RENTED AND TRIPS TAKEN"
                data={activityBarData}
                bars={[
                  { dataKey: "Days Rented", fill: "#FFD700" },
                  { dataKey: "Trips Taken", fill: "#B8860B" },
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
