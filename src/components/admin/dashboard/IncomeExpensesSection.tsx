import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
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
    const ie = getMonthEntry(ieData?.incomeExpenses ?? [], m);
    const hist = getMonthEntry(ieData?.history ?? [], m);
    const dd = getMonthEntry(ieData?.directDelivery ?? [], m);

    const gross = ie ? grossRentalIncome(ie) : 0;
    const mgmtInc = fs ? managementIncome(gross, fs) : 0;
    const ownerInc = fs ? carOwnerIncome(gross, fs) : 0;
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

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="mb-8">
      <SectionHeader title="INCOME AND EXPENSES" />

      {/* Year Selector */}
      <div className="mt-4 flex items-center gap-3 px-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-[#FFD700]">
          Year
        </span>
        <Select value={year} onValueChange={onYearChange}>
          <SelectTrigger className="w-[120px] border-[#FFD700]/30 bg-white text-black">
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
        <div className="mt-4 rounded-md bg-red-900/30 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-red-400">
            Failed to load income &amp; expenses data. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && ieData && (
        <div className="mt-4 space-y-4 px-4">
          {/* Summary Cards — Row 1: Management */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total Management Income"
              value={formatCurrency(totalMgmtIncome)}
              variant="gold"
            />
            <SummaryCard
              label="Total Management Expenses"
              value={formatCurrency(totalMgmtExpenses)}
              variant="dark"
            />
            <SummaryCard
              label="Net Management Income"
              value={formatCurrency(totalMgmtIncome - totalMgmtExpenses)}
              variant="gold"
              className={
                totalMgmtIncome - totalMgmtExpenses < 0
                  ? "bg-red-900/60 text-white"
                  : undefined
              }
            />
          </div>

          {/* Summary Cards — Row 2: Car Owner */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total Car Owner Income"
              value={formatCurrency(totalOwnerIncome)}
              variant="dark"
            />
            <SummaryCard
              label="Total Car Owner Expenses"
              value={formatCurrency(totalOwnerExpenses)}
              variant="gold"
            />
            <SummaryCard
              label="Net Car Owner Income"
              value={formatCurrency(totalOwnerIncome - totalOwnerExpenses)}
              variant="dark"
            />
          </div>

          {/* Donut Charts */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <DonutChart
              title="Income Distribution"
              data={incomeDonut}
              centerValue={formatCurrency(totalMgmtIncome + totalOwnerIncome)}
            />
            <DonutChart
              title="Expense Distribution"
              data={expenseDonut}
              centerValue={formatCurrency(totalMgmtExpenses + totalOwnerExpenses)}
            />
            <DonutChart
              title="Rental Activity"
              data={activityDonut}
              centerValue={`${totalDaysRented} days`}
              formatValue={(v) => `${v.toLocaleString()} days`}
            />
          </div>

          {/* Monthly Table */}
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200">
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
                <tr className="bg-gray-100 font-bold">
                  {tableColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-sm text-gray-900 ${
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

          {/* Bar Charts */}
          <BarChartCard
            title="MANAGEMENT INCOME AND EXPENSES"
            data={mgmtBarData}
            bars={[
              { dataKey: "Income", fill: "#FFD700" },
              { dataKey: "Expenses", fill: "#374151" },
            ]}
          />

          <BarChartCard
            title="CAR OWNER INCOME AND EXPENSES"
            data={ownerBarData}
            bars={[
              { dataKey: "Income", fill: "#FFD700" },
              { dataKey: "Expenses", fill: "#374151" },
            ]}
          />

          <BarChartCard
            title="DAYS RENTED AND TRIPS TAKEN"
            data={activityBarData}
            bars={[
              { dataKey: "Days Rented", fill: "#FFD700" },
              { dataKey: "Trips Taken", fill: "#6B7280" },
            ]}
            yAxisPrefix=""
          />

          <BarChartCard
            title="AIRPORT PARKING EXPENSES"
            data={parkingBarData}
            bars={[{ dataKey: "Parking Airport", fill: "#FFD700" }]}
          />
        </div>
      )}

      {!isLoading && !isError && !ieData && (
        <div className="mt-4 rounded-md bg-[#111111] px-6 py-8 text-center">
          <p className="text-sm text-white/60">No data available for {year}.</p>
        </div>
      )}
    </div>
  );
}
