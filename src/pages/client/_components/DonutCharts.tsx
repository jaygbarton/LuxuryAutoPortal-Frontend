import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE_LIGHT, MONTHS_SHORT, PIE_DONUT_COLORS } from "./constants";
import { fmt } from "./utils";
import type { MonthlyTripRow, YearTotals } from "./types";

interface DonutChartsProps {
  yearTotals: YearTotals;
  currentMonthData: MonthlyTripRow | undefined;
  selectedYear: string;
  currentMonth: number;
  isLoading: boolean;
}

export function DonutCharts({ yearTotals, currentMonthData, selectedYear, currentMonth, isLoading }: DonutChartsProps) {
  const donutYearData = useMemo(() => {
    const profit   = Math.max(0, yearTotals.profit);
    const expenses = Math.max(0, yearTotals.expenses);
    return profit + expenses > 0
      ? [{ name: "Profit", value: profit }, { name: "Expenses", value: expenses }]
      : [];
  }, [yearTotals]);

  const donutMonthData = useMemo(() => {
    const profit   = Math.max(0, currentMonthData?.profit ?? 0);
    const expenses = Math.max(0, currentMonthData?.expenses ?? 0);
    return profit + expenses > 0
      ? [{ name: "Profit", value: profit }, { name: "Expenses", value: expenses }]
      : [];
  }, [currentMonthData]);

  const sharedPieProps = {
    cx: "50%" as const,
    cy: "50%" as const,
    innerRadius: 58,
    outerRadius: 82,
    dataKey: "value",
    label: false as const,
    labelLine: false,
    startAngle: 90,
    endAngle: -270,
    isAnimationActive: true,
  };

  function DonutRing({ data, centerLabel }: { data: { name: string; value: number }[]; centerLabel: string }) {
    return (
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie {...sharedPieProps} data={data.length > 0 ? data : [{ name: "No data", value: 1 }]}>
              {data.length > 0
                ? data.map((_, i) => <Cell key={i} fill={PIE_DONUT_COLORS[i % PIE_DONUT_COLORS.length]} />)
                : <Cell fill="#e5e7eb" stroke="#d1d5db" strokeWidth={1} />
              }
            </Pie>
            {data.length > 0 && (
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE_LIGHT}
                itemStyle={{ color: "#1a1a1a" }}
                labelStyle={{ color: "#555", fontWeight: 600 }}
                formatter={(val: number, name: string) => [fmt(val), name]}
              />
            )}
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span style={{ color: "#1a1a1a" }}>{value}</span>}
              payload={data.length > 0 ? undefined : [{ value: "No data yet", type: "square" as const, color: "#9ca3af" }]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 0, bottom: 28 }}>
          {data.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 leading-none mb-0.5">Profit</p>
              <p className="text-base font-extrabold text-gray-900 leading-none">{centerLabel}</p>
            </>
          ) : (
            <p className="text-xs text-gray-400 font-medium">No data</p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1">Total Car Owner Profit and Expenses</h3>
        <DonutRing data={donutYearData} centerLabel={fmt(yearTotals.profit)} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1">
          {MONTHS_SHORT[currentMonth - 1]} {selectedYear} Car Owner Profit and Expenses
        </h3>
        <DonutRing data={donutMonthData} centerLabel={fmt(currentMonthData?.profit ?? 0)} />
      </div>
    </div>
  );
}
