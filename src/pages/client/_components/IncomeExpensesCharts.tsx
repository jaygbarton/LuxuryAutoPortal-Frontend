import React from "react";
import { Loader2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHART_GOLD, CHART_GOLD2, CHART_RED,
  CHART_TOOLTIP_STYLE, CHART_LEGEND_STYLE, CHART_AXIS_TICK, CHART_GRID_COLOR,
} from "./constants";
import { fmt } from "./utils";
import type { MonthlyTripRow, MonthlyDaysTripsRow } from "./types";

interface IncomeExpensesChartsProps {
  monthlyTripData: MonthlyTripRow[];
  monthlyDaysTripsData: MonthlyDaysTripsRow[];
  selectedYear: string;
  selectedYearTrips: string;
  isLoadingIncome: boolean;
  isLoadingTrips: boolean;
}

export function IncomeExpensesCharts({
  monthlyTripData,
  monthlyDaysTripsData,
  selectedYear,
  selectedYearTrips,
  isLoadingIncome,
  isLoadingTrips,
}: IncomeExpensesChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Line Chart: Income, Profit, Expenses */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Monthly Car Owner Rental Income, Car Owner Profit and Expenses — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingIncome || isLoadingTrips ? (
            <div className="flex items-center justify-center h-56">
              <Loader2 className="w-5 h-5 animate-spin text-[#D3BC8D]" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTripData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={CHART_AXIS_TICK} angle={-45} textAnchor="end" interval={0} height={60} axisLine={{ stroke: "#444" }} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#eee", fontWeight: 600 }} formatter={(val: number, name: string) => [fmt(val), name]} />
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
          {isLoadingTrips ? (
            <div className="flex items-center justify-center h-56">
              <Loader2 className="w-5 h-5 animate-spin text-[#D3BC8D]" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyDaysTripsData} margin={{ top: 8, right: 16, left: -20, bottom: 48 }} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={CHART_AXIS_TICK} angle={-45} textAnchor="end" interval={0} height={60} axisLine={{ stroke: "#444" }} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: "#eee", fontWeight: 600 }} />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} iconType="square" />
                <Bar dataKey="days"  name="Days Rented" fill={CHART_GOLD}  radius={[2, 2, 0, 0]} />
                <Bar dataKey="trips" name="Trips Taken" fill={CHART_GOLD2} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
