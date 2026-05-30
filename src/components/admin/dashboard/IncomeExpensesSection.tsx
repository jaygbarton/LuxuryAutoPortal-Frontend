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

// Light = larger share, Dark = smaller share. Per-slice color is decided
// from the value's rank, not the array order, to match the design.
const DONUT_COLOR_LIGHT = "#F5E6A8";
const DONUT_COLOR_DARK = "#E8C547";

function DonutChart({ data, formatValue = formatCurrency }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const maxValue = Math.max(...data.map((d) => d.value), 0);

  // Amount on each slice, description+% outside with no lines.
  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, name } = props;
    const RADIAN = Math.PI / 180;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

    // Amount — centred on the slice band
    const r = (innerRadius + outerRadius) / 2;
    const ax = cx + r * Math.cos(-midAngle * RADIAN);
    const ay = cy + r * Math.sin(-midAngle * RADIAN);

    // Description — placed beyond the outer edge, no line
    const labelR = outerRadius + 28;
    const lx = cx + labelR * Math.cos(-midAngle * RADIAN);
    const ly = cy + labelR * Math.sin(-midAngle * RADIAN);
    const anchor = lx > cx ? "start" : lx < cx ? "end" : "middle";

    return (
      <g>
        {/* Money amount on the slice */}
        <text x={ax} y={ay} textAnchor="middle" dominantBaseline="central"
          style={{ fontWeight: 700, fontSize: 11, fill: "#000000" }}>
          {formatValue(value)}
        </text>
        {/* Description + % outside the ring, no line */}
        <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="central"
          style={{ fontSize: 9, fill: "#000000" }}>
          <tspan x={lx} dy="-0.6em">{name}</tspan>
          <tspan x={lx} dy="1.2em">{pct}%</tspan>
        </text>
      </g>
    );
  };

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 30, right: 60, bottom: 30, left: 60 }}>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={0}
            label={renderLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.value === maxValue ? DONUT_COLOR_LIGHT : DONUT_COLOR_DARK}
                stroke="none"
              />
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
      {/* Bars area fills available height — each bar splits the area evenly */}
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
                className="h-full bg-[#E8C547] rounded-r-md"
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

export default function IncomeExpensesSection({ year }: IncomeExpensesSectionProps) {
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
      // Turo-derived metrics (back-end fills these in via enrichWithTuro-
      // MonthlyMetrics on /api/income-expense/all-cars). Default to 0 so the
      // page degrades gracefully when the enrich step fails.
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

  // ── Days-in-month helper for the "Available Days" column ─────────────
  // Available Days = cars_available_for_rent * days_in_that_month. This is
  // the fleet's theoretical capacity in car-days; Fleet Utilization (%) is
  // then daysRented / availableDays.
  const yearNum = parseInt(year, 10) || new Date().getFullYear();
  const daysInMonth = (m: number) => new Date(yearNum, m, 0).getDate();

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
    { key: "availableDays", label: "Available Days", align: "right" as const },
    { key: "totalMiles", label: "Total Miles", align: "right" as const },
    { key: "fleetUtilization", label: "Fleet Utilization (%)", align: "right" as const },
    { key: "avgEarningsPerTrip", label: "Avg Earnings / Trips Taken", align: "right" as const },
    { key: "avgLeadTime", label: "Avg lead time", align: "right" as const },
    { key: "avgEarningsPerMile", label: "Avg Earnings/Mile", align: "right" as const },
  ];

  // All six new columns now have real data via enrichWithTuroMonthlyMetrics
  // on the backend (totalMiles + avgLeadTimeDays come back on history[]).
  // Months with no Turo activity will simply render 0 / "—".
  const PLACEHOLDER = "—";

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
      availableDays: availableDays.toLocaleString(),
      totalMiles:
        mc.totalMiles > 0 ? mc.totalMiles.toLocaleString() : PLACEHOLDER,
      fleetUtilization:
        availableDays > 0 ? `${utilizationPct.toFixed(2)}%` : PLACEHOLDER,
      avgEarningsPerTrip:
        mc.tripsTaken > 0 ? formatCurrency(avgPerTrip) : PLACEHOLDER,
      avgLeadTime:
        mc.avgLeadTimeDays > 0
          ? mc.avgLeadTimeDays.toFixed(2)
          : PLACEHOLDER,
      avgEarningsPerMile:
        mc.totalMiles > 0 ? formatCurrency(avgPerMile) : PLACEHOLDER,
    };
  });

  // Year-end totals row. For the three computed metrics we average over the
  // year (rather than re-deriving from per-month rounded values) so totals
  // reflect what the user would compute by hand. Use accurate per-month days
  // rather than the older `* 30` approximation that lives further down.
  const totalAvailableDaysAccurate = monthlyComputed.reduce(
    (s, m) => s + m.carsAvailable * daysInMonth(m.month),
    0,
  );
  const yearUtilization =
    totalAvailableDaysAccurate > 0
      ? (totalDaysRented / totalAvailableDaysAccurate) * 100
      : 0;
  const yearAvgPerTrip =
    totalTripsTakenAll > 0 ? totalGross / totalTripsTakenAll : 0;

  const totalMilesAll = monthlyComputed.reduce((s, m) => s + m.totalMiles, 0);
  // Weighted year total: sum all individual lead-time days / sum all trips that
  // had a lead-time value. This is "total lead time / trips taken" as requested,
  // and avoids the bias of averaging monthly averages.
  const yearTotalLeadTime = monthlyComputed.reduce((s, m) => s + (m.totalLeadTimeDays ?? 0), 0);
  const yearTripsWithLeadTime = monthlyComputed.reduce((s, m) => s + (m.tripsWithLeadTime ?? 0), 0);
  const yearAvgLeadTime = yearTripsWithLeadTime > 0 ? yearTotalLeadTime / yearTripsWithLeadTime : 0;
  const yearAvgPerMile = totalMilesAll > 0 ? totalGross / totalMilesAll : 0;

  const tableTotals = {
    month: "TOTAL",
    rentalIncome: formatCurrency(totalGross),
    mgmtExpenses: formatCurrency(totalMgmtExpenses),
    mgmtSplit: formatCurrency(totalMgmtIncome),
    ownerExpenses: formatCurrency(totalOwnerExpenses),
    ownerSplit: formatCurrency(totalOwnerIncome),
    daysRented: totalDaysRented.toLocaleString(),
    tripsTaken: totalTripsTakenAll.toLocaleString(),
    availableDays: totalAvailableDaysAccurate.toLocaleString(),
    totalMiles:
      totalMilesAll > 0 ? totalMilesAll.toLocaleString() : PLACEHOLDER,
    fleetUtilization:
      totalAvailableDaysAccurate > 0
        ? `${yearUtilization.toFixed(2)}%`
        : PLACEHOLDER,
    avgEarningsPerTrip:
      totalTripsTakenAll > 0 ? formatCurrency(yearAvgPerTrip) : PLACEHOLDER,
    avgLeadTime: yearAvgLeadTime > 0 ? yearAvgLeadTime.toFixed(2) : PLACEHOLDER,
    avgEarningsPerMile:
      totalMilesAll > 0 ? formatCurrency(yearAvgPerMile) : PLACEHOLDER,
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

          {/* ── Row 1: Summary Cards (left) + Monthly Table (right) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
            {/* Left: Summary Cards — distribute evenly to match table height */}
            <div className="xl:col-span-1 flex flex-col justify-between h-full">
              {/* Total Management Income and Expenses */}
              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Total Management Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" className="h-20" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="gold" className="h-20" />
                </div>
              </div>

              {/* Management Income and Expenses */}
              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Management Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" className="h-20" />
                  <SummaryCard label="Total Management Expenses" value={formatCurrency(totalMgmtExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Management Profit" value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Rental Income`} value={formatCurrency(prevMonth?.gross ?? 0)} variant="dark" className="h-20" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Expenses`} value={formatCurrency(prevMonth?.mgmtExpenses ?? 0)} variant="white" className="h-20" />
                  <SummaryCard label={`${prevMonthLabel} Mgmt Profit`} value={formatCurrency((prevMonth?.mgmtIncome ?? 0) - (prevMonth?.mgmtExpenses ?? 0))} variant="gold" className="h-20" />
                </div>
              </div>

              {/* Car Owner Income and Expenses */}
              <div className="flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  Car Owner Income and Expenses
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <SummaryCard label="Total Rental Income" value={formatCurrency(monthlyComputed.reduce((s, m) => s + m.gross, 0))} variant="dark" className="h-20" />
                  <SummaryCard label="Total Car Owner Expenses" value={formatCurrency(totalOwnerExpenses)} variant="white" className="h-20" />
                  <SummaryCard label="Total Car Owner Profit" value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)} variant="gold" className="h-20" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  <SummaryCard label={`${prevMonthLabel} Rental Income`} value={formatCurrency(prevMonth?.gross ?? 0)} variant="dark" className="h-20" />
                  <SummaryCard label={`${prevMonthLabel} Owner Expenses`} value={formatCurrency(prevMonth?.ownerExpenses ?? 0)} variant="white" className="h-20" />
                  <SummaryCard label={`${prevMonthLabel} Owner Profit`} value={formatCurrency((prevMonth?.ownerIncome ?? 0) - (prevMonth?.ownerExpenses ?? 0))} variant="gold" className="h-20" />
                </div>
              </div>
            </div>

            {/* Right: Monthly Income & Expenses Table */}
            <div className="xl:col-span-2 bg-white">
              <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                Monthly Income and Expenses
              </h3>
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <table className="w-full min-w-[880px] border-y border-[#D3BC8D] border-collapse">
                  <thead>
                    <tr className="bg-black border-y border-[#D3BC8D]">
                      {tableColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-center text-xs font-bold uppercase text-white whitespace-nowrap"
                        >
                          {col.label}
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
                            className="px-3 py-2 text-center text-sm text-gray-900"
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
                          className="px-3 py-2 text-center text-sm text-black"
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

          {/* ── Row 2: Donuts (1/3) + Line/Bar charts (2/3) — 3 locked rows ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-6 sm:gap-y-8 xl:[grid-template-rows:repeat(3,280px)] [grid-auto-rows:280px]">

            {/* Row 1 left — Mgmt donuts */}
            <div className="xl:col-span-1 grid grid-cols-2 gap-2">
              <DonutChart
                data={[
                  { name: "Total Car Mngmt Expenses", value: totalMgmtExpenses },
                  { name: "Total Car Mngmt Profit", value: Math.max(0, totalMgmtIncome - totalMgmtExpenses) },
                ]}
              />
              <DonutChart
                data={[
                  { name: "Total Car Mngmt Profit", value: Math.max(0, displayMgmtIncome - displayMgmtExpenses) },
                  { name: "Total Car Mngmt Expenses", value: displayMgmtExpenses },
                ]}
              />
            </div>

            {/* Row 1 right — Management line chart */}
            <div className="xl:col-span-2 flex flex-col">
              <LineChartCard
                title="Management Income and Expenses"
                data={mgmtBarData}
                lines={[
                  { dataKey: "Income", stroke: "#E8C547" },
                  { dataKey: "Expenses", stroke: "#F5E6A8" },
                ]}
              />
            </div>

            {/* Row 2 left — Car Owner donuts */}
            <div className="xl:col-span-1 grid grid-cols-2 gap-2">
              <DonutChart
                data={[
                  { name: "Total Car Owner Expenses", value: totalOwnerExpenses },
                  { name: "Total Car Owner Profit", value: Math.max(0, totalOwnerIncome - totalOwnerExpenses) },
                ]}
              />
              <DonutChart
                data={[
                  { name: "Total Car Owner Profit", value: Math.max(0, displayOwnerIncome - displayOwnerExpenses) },
                  { name: "Total Car Owner Expenses", value: displayOwnerExpenses },
                ]}
              />
            </div>

            {/* Row 2 right — Car Owner line chart */}
            <div className="xl:col-span-2 flex flex-col">
              <LineChartCard
                title="Car Owner Income and Expenses"
                data={ownerBarData}
                lines={[
                  { dataKey: "Income", stroke: "#E8C547" },
                  { dataKey: "Expenses", stroke: "#B8860B" },
                ]}
              />
            </div>

            {/* Row 3 left — Horizontal bar chart */}
            <div className="xl:col-span-1">
              <HorizontalBarChart
                items={[
                  { label: "Total Trips Taken", value: totalTripsTaken },
                  { label: "Total Days Rented", value: totalDaysRented },
                ]}
              />
            </div>

            {/* Row 3 right — Days Rented bar chart */}
            <div className="xl:col-span-2 flex flex-col">
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
        <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-500">No data available for {year}.</p>
        </div>
      )}
    </div>
  );
}
