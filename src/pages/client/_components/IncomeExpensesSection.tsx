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

      {/* Summary card rows — labels on the cards themselves (value top, label bottom) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-2">

        {/* Income/Expenses summary */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <SummaryCard variant="black" label="Total Car Owner Rental Income" value={fmt(yearTotals.income)} />
            <SummaryCard variant="light" label="Total Car Owner Expenses"      value={fmt(yearTotals.expenses)} />
            <SummaryCard variant="gold"  label="Total Car Owner Profit"        value={fmt(yearTotals.profit)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SummaryCard variant="black" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Car Owner Rental Income`} value={fmt(currentMonthData?.income ?? 0)} />
            <SummaryCard variant="light" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Owner Expenses`}           value={fmt(currentMonthData?.expenses ?? 0)} />
            <SummaryCard variant="gold"  label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYear} Owner Profit`}             value={fmt(currentMonthData?.profit ?? 0)} valueColor={(currentMonthData?.profit ?? 0) < 0 ? "#ef4444" : "#1a1a1a"} />
          </div>
        </div>

        {/* Days/Trips summary */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <SummaryCard variant="black" label="Total Days Rented"   value={String(yearTotalsTrips.days)} />
            <SummaryCard variant="light" label="Total Trips Taken"   value={String(yearTotalsTrips.trips)} />
            <SummaryCard variant="gold"  label="Ave / Trips Taken"   value={yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "$0.00"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SummaryCard variant="black" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYearTrips} Days Rented`}    value={String(currentMonthDaysTripsData?.days ?? 0)} />
            <SummaryCard variant="light" label={`${MONTHS_SHORT[currentMonth - 1]} ${selectedYearTrips} Trips Taken`}    value={String(currentMonthDaysTripsData?.trips ?? 0)} />
            <SummaryCard variant="gold"  label="Ave / Trips Taken"                                                       value={(currentMonthDaysTripsData?.trips ?? 0) > 0 ? fmt((currentMonthDaysTripsData?.income ?? 0) / (currentMonthDaysTripsData?.trips ?? 1)) : "$0.00"} />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 items-start">

        {/* Income and Expenses table */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <table className="w-full min-w-[480px] border-y border-[#D3BC8D] border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "128px" }} />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }} className="border-y border-[#D3BC8D]">
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Month and Year</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Car owner rental income</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Car owner expenses</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Car owner split</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingIncome || isLoadingTrips ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d] mx-auto" /></td></tr>
              ) : (
                <>
                  {monthlyTripData.map((row) => (
                    <tr key={row.month} className="bg-white border-y border-[#D3BC8D]">
                      <td className="text-sm py-2 px-3 text-center font-medium text-black">
                        {row.month}
                      </td>
                      <td className="text-sm py-2 px-3 text-center text-black">{fmt(row.income)}</td>
                      <td className="text-sm py-2 px-3 text-center text-black">{fmt(row.expenses)}</td>
                      <td className="text-sm py-2 px-3 text-center font-medium text-black">{fmt(row.profit)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#D3BC8D" }} className="border-y border-[#D3BC8D]">
                    <td className="text-sm font-extrabold text-black py-2.5 px-3 text-center">Total</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{fmt(yearTotals.income)}</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{fmt(yearTotals.expenses)}</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{fmt(yearTotals.profit)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Days Rented and Trips Taken table */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <table className="w-full min-w-[480px] border-y border-[#D3BC8D] border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "128px" }} />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }} className="border-y border-[#D3BC8D]">
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Month and Year</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Days Rented</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Trips Taken</th>
                <th className="text-white font-bold text-xs py-3 px-3 text-center">Ave / Trips Taken</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTrips ? (
                <tr><td colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#d3bc8d] mx-auto" /></td></tr>
              ) : (
                <>
                  {monthlyDaysTripsData.map((row) => (
                    <tr key={row.month} className="bg-white border-y border-[#D3BC8D]">
                      <td className="text-sm py-2 px-3 text-center font-medium text-black">
                        {row.month}
                      </td>
                      <td className="text-sm py-2 px-3 text-center text-black">{row.days}</td>
                      <td className="text-sm py-2 px-3 text-center text-black">{row.trips}</td>
                      <td className="text-sm py-2 px-3 text-center text-black">{row.trips > 0 ? fmt(row.avgPerTrip) : "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#D3BC8D" }} className="border-y border-[#D3BC8D]">
                    <td className="text-sm font-extrabold text-black py-2.5 px-3 text-center">Total</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{yearTotalsTrips.days}</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{yearTotalsTrips.trips}</td>
                    <td className="text-sm font-bold text-black py-2.5 px-3 text-center">{yearTotalsTrips.trips > 0 ? fmt(yearTotalsTrips.income / yearTotalsTrips.trips) : "—"}</td>
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
