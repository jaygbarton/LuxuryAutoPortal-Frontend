import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MONTHS_SHORT, CHART_GOLD, CHART_TOOLTIP_STYLE, CHART_LEGEND_STYLE, CHART_AXIS_TICK, CHART_GRID_COLOR } from "./constants";
import { fmt } from "./utils";
import type { NadaDepreciation } from "./types";

interface NadaChartProps {
  nadaRecords: NadaDepreciation[];
  yearNum: number;
  isLoading: boolean;
}

export function NadaChart({ nadaRecords, yearNum, isLoading }: NadaChartProps) {
  const chartData = useMemo(() => {
    return MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const dateKey  = `${yearNum}-${String(monthNum).padStart(2, "0")}`;
      const record   = nadaRecords.find((r) => r.nadaDepreciationDate === dateKey);
      return { month: m, retail: record?.nadaDepreciationAmount ?? null };
    });
  }, [nadaRecords, yearNum]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#d3bc8d" }}>
          NADA Change %
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-52">
            <Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d]" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nadaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#d3bc8d" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#d3bc8d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
              <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={{ stroke: "#444" }} tickLine={false} />
              <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: "#eee", fontWeight: 600 }}
                formatter={(val) => (val != null ? fmt(val as number) : "N/A")}
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
  );
}
