import React from "react";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SummaryCard } from "./SummaryCard";
import { MONTHS_SHORT } from "./constants";
import { fmt } from "./utils";
import type { MonthlyTripRow, MonthlyDaysTripsRow, YearTotals, YearTotalsTrips } from "./types";

interface IncomeExpensesSectionProps {
  selectedYear: string;
  selectedYearTrips: string;
  yearOptions: number[];
  onYearChange: (y: string) => void;
  onYearTripsChange: (y: string) => void;
  monthlyTripData: MonthlyTripRow[];
  monthlyDaysTripsData: MonthlyDaysTripsRow[];
  yearTotals: YearTotals;
  yearTotalsTrips: YearTotalsTrips;
  currentMonthData: MonthlyTripRow | undefined;
  currentMonthDaysTripsData: MonthlyDaysTripsRow | undefined;
  currentMonth: number;
  isLoadingIncome: boolean;
  isLoadingTrips: boolean;
}

export function IncomeExpensesSection({
  selectedYear,
  selectedYearTrips,
  yearOptions,
  onYearChange,
  onYearTripsChange,
  monthlyTripData,
  monthlyDaysTripsData,
  yearTotals,
  yearTotalsTrips,
  currentMonthData,
  currentMonthDaysTripsData,
  currentMonth,
  isLoadingIncome,
  isLoadingTrips,
}: IncomeExpensesSectionProps) {
  return (
    <>
      {/* Section titles + year selectors */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-end mb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase text-foreground tracking-wide">Income and Expenses</h2>
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase text-foreground tracking-wide">Days Rented and Trips Taken</h2>
          <Select value={selectedYearTrips} onValueChange={onYearTripsChange}>
            <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary card rows */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-2">

        {/* Income/Expenses summary */}
        <div>
          <div className="grid mb-1" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px" }}>
            <div />
            <div className="text-center text-sm font-semibold text-foreground">Car Owner Rental income</div>
            <div className="text-center text-sm font-semibold text-foreground">Car Owner Expenses</div>
            <div className="text-center text-sm font-semibold">Car Owner Profit</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px", marginBottom: "2px" }}>
            <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">Total</div>
            <SummaryCard variant="black" label="" value={fmt(yearTotals.income)} />
            <SummaryCard variant="light" label="" value={fmt(yearTotals.expenses)} />
            <SummaryCard variant="gold"  label="" value={fmt(yearTotals.profit)} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px" }}>
            <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">
              {MONTHS_SHORT[currentMonth - 1]} {selectedYear}
            </div>
            <SummaryCard variant="black" label="" value={fmt(currentMonthData?.income ?? 0)} />
            <SummaryCard variant="light" label="" value={fmt(currentMonthData?.expenses ?? 0)} />
            <SummaryCard variant="gold"  label="" value={fmt(currentMonthData?.profit ?? 0)} valueColor={(currentMonthData?.profit ?? 0) < 0 ? "#ef4444" : "#1a1a1a"} />
          </div>
        </div>

        {/* Days/Trips summary */}
        <div>
          <div className="grid mb-1" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px" }}>
            <div />
            <div className="text-center text-sm font-semibold text-foreground">Days Rented</div>
            <div className="text-center text-sm font-semibold text-foreground">Trips Taken</div>
            <div className="text-center text-sm font-semibold" style={{ color: "#C9A227" }}>Ave / Trip</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px", marginBottom: "2px" }}>
            <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">Total</div>
            <SummaryCard variant="black" label="" value={String(yearTotalsTrips.days)} />
            <SummaryCard variant="light" label="" value={String(yearTotalsTrips.trips)} />
            <SummaryCard variant="gold"  label="" value={yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "$0.00"} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "128px 1fr 1fr 1fr", gap: "2px" }}>
            <div className="flex items-center justify-center text-sm font-semibold text-foreground bg-[#f0ece0] border border-[#d8d0b8] rounded-lg px-2">
              {MONTHS_SHORT[currentMonth - 1]} {selectedYearTrips}
            </div>
            <SummaryCard variant="black" label="" value={String(currentMonthDaysTripsData?.days ?? 0)} />
            <SummaryCard variant="light" label="" value={String(currentMonthDaysTripsData?.trips ?? 0)} />
            <SummaryCard variant="gold"  label="" value={(currentMonthDaysTripsData?.trips ?? 0) > 0 ? fmt((currentMonthDaysTripsData?.income ?? 0) / (currentMonthDaysTripsData?.trips ?? 1)) : "$0.00"} />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* Income and Expenses table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "128px" }} />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-white font-bold text-xs py-3 px-3 text-left">Month and Year</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner rental income</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner expenses</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Car owner split</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingIncome || isLoadingTrips ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d] mx-auto" /></td></tr>
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
                    <td className={`text-sm font-bold py-2.5 px-3 text-right ${yearTotals.profit >= 0 ? "text-[#d3bc8d]" : "text-[#f87171]"}`}>{fmt(yearTotals.profit)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Days Rented and Trips Taken table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "128px" }} />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-white font-bold text-xs py-3 px-3 text-left">Month and Year</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Days Rented</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Trips Taken</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-right">Ave / Trips Taken</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTrips ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d] mx-auto" /></td></tr>
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
                    <td className="text-sm font-bold text-[#d3bc8d] py-2.5 px-3 text-right">{yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "—"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </>
  );
}
