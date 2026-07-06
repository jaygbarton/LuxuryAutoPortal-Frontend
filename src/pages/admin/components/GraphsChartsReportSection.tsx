import React, { useMemo } from "react";
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
} from "recharts";
import type { IncomeExpenseData } from "@/pages/admin/income-expenses/types";

interface GraphsChartsReportSectionProps {
  title?: string;
  className?: string;
  incomeExpenseData?: IncomeExpenseData;
  selectedYear: string;
  calculateCarManagementSplit: (month: number) => number;
  calculateCarOwnerSplit: (month: number) => number;
  calculateCarManagementTotalExpenses: (month: number) => number;
  calculateCarOwnerTotalExpenses: (month: number) => number;
  getMonthValue: (arr: any[], month: number, field: string) => number;
  /** Hides the GLA-internal "Car Management Profit" / "Car Management Total
   *  Expenses" charts — per Cathy/Jin, clients should only see charts about
   *  their own car (Rental Income, Car Owner Profit/Expenses, History). */
  isClient?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function GraphsChartsReportSection({
  title = "GRAPHS AND CHART REPORT",
  className,
  incomeExpenseData,
  selectedYear,
  calculateCarManagementSplit,
  calculateCarOwnerSplit,
  calculateCarManagementTotalExpenses,
  calculateCarOwnerTotalExpenses,
  getMonthValue,
  isClient = false,
}: GraphsChartsReportSectionProps) {
  // Prepare monthly data for charts
  const monthlyData = useMemo(() => {
    if (!incomeExpenseData) return [];
    
    return MONTHS.map((month, index) => {
      const monthNum = index + 1;
      const rentalIncome = getMonthValue(incomeExpenseData.incomeExpenses || [], monthNum, "rentalIncome");
      const carManagementSplit = calculateCarManagementSplit(monthNum);
      const carOwnerSplit = calculateCarOwnerSplit(monthNum);
      const carManagementTotalExpenses = calculateCarManagementTotalExpenses(monthNum);
      const carOwnerTotalExpenses = calculateCarOwnerTotalExpenses(monthNum);
      const daysRented = getMonthValue(incomeExpenseData.history || [], monthNum, "daysRented");
      const tripsTaken = getMonthValue(incomeExpenseData.history || [], monthNum, "tripsTaken");
      // Profit should equal the split values (not split minus expenses)
      const carManagementProfit = carManagementSplit;
      const carOwnerProfit = carOwnerSplit;
      const avePerRental = tripsTaken > 0 ? rentalIncome / tripsTaken : 0;

      return {
        month: month,
        "Rental Income": rentalIncome,
        "Car Management Profit": carManagementProfit,
        "Car Owner Profit": carOwnerProfit,
        "Car Management Total Expenses": carManagementTotalExpenses,
        "Car Owner Total Expenses": carOwnerTotalExpenses,
        "Days Rented": daysRented,
        "Trips Taken": tripsTaken,
        "Ave Per Rental": avePerRental,
      };
    });
  }, [incomeExpenseData, selectedYear, calculateCarManagementSplit, calculateCarOwnerSplit, calculateCarManagementTotalExpenses, calculateCarOwnerTotalExpenses, getMonthValue]);

  // Calculate yearly totals
  const yearlyTotals = useMemo(() => {
    const totals = monthlyData.reduce(
      (acc, data) => ({
        "Rental Income": acc["Rental Income"] + data["Rental Income"],
        "Car Management Profit": acc["Car Management Profit"] + data["Car Management Profit"],
        "Car Owner Profit": acc["Car Owner Profit"] + data["Car Owner Profit"],
        "Car Management Total Expenses": acc["Car Management Total Expenses"] + data["Car Management Total Expenses"],
        "Car Owner Total Expenses": acc["Car Owner Total Expenses"] + data["Car Owner Total Expenses"],
        "Days Rented": acc["Days Rented"] + data["Days Rented"],
        "Trips Taken": acc["Trips Taken"] + data["Trips Taken"],
        "Ave Per Rental": acc["Trips Taken"] > 0 ? acc["Rental Income"] / acc["Trips Taken"] : 0,
      }),
      {
        "Rental Income": 0,
        "Car Management Profit": 0,
        "Car Owner Profit": 0,
        "Car Management Total Expenses": 0,
        "Car Owner Total Expenses": 0,
        "Days Rented": 0,
        "Trips Taken": 0,
        "Ave Per Rental": 0,
      }
    );
    return totals;
  }, [monthlyData]);

  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTooltip = (value: number, name: string) => {
    if (name.includes("Days") || name.includes("Trips")) {
      return [value.toString(), name];
    }
    return [formatCurrency(value), name];
  };

  return (
    <div className={className}>
      <h1 className="text-3xl font-serif text-primary italic mb-6">{title}</h1>

      {/* Rental Income Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Rental Income</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Yearly Total: {formatCurrency(yearlyTotals["Rental Income"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Rental Income" fill="#38bdf8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Car Management Profit Chart — GLA-internal, hidden from clients */}
      {!isClient && (
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Car Management Profit</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Yearly Total: {formatCurrency(yearlyTotals["Car Management Profit"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Car Management Profit" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Car Owner Profit Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Car Owner Profit</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Yearly Total: {formatCurrency(yearlyTotals["Car Owner Profit"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Car Owner Profit" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Car Owner Total Expenses Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Car Owner Total Expenses</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Yearly Total: {formatCurrency(yearlyTotals["Car Owner Total Expenses"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Car Owner Total Expenses" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Car Management Total Expenses Chart — GLA-internal, hidden from clients */}
      {!isClient && (
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Car Management Total Expenses</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Yearly Total: {formatCurrency(yearlyTotals["Car Management Total Expenses"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Car Management Total Expenses" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* History Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">History</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Days Rented - Yearly Total: {yearlyTotals["Days Rented"]}</div>
          <div>Trips Taken - Yearly Total: {yearlyTotals["Trips Taken"]}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Line type="monotone" dataKey="Days Rented" stroke="#06b6d4" strokeWidth={2} />
            <Line type="monotone" dataKey="Trips Taken" stroke="#ec4899" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CAR RENTAL VALUE PER MONTH Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-muted-foreground mb-4">CAR RENTAL VALUE PER MONTH</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          <div>Total Car Rental Income - Yearly Total: {formatCurrency(yearlyTotals["Rental Income"])}</div>
          <div>Trips Taken - Yearly Total: {yearlyTotals["Trips Taken"]}</div>
          <div>Ave Per Rental Per Trips Taken - Yearly Average: {formatCurrency(yearlyTotals["Ave Per Rental"])}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="month" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                color: "#fff",
              }}
              formatter={formatTooltip}
            />
            <Legend wrapperStyle={{ color: "#9ca3af" }} />
            <Bar dataKey="Rental Income" fill="#38bdf8" name="Total Car Rental Income" />
            <Bar dataKey="Trips Taken" fill="#ec4899" name="Trips Taken" />
            <Bar dataKey="Ave Per Rental" fill="#10b981" name="Ave Per Rental Per Trips Taken" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
