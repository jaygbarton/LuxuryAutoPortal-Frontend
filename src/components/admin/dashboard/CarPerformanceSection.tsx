import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "./SectionHeader";
import { useCoHost } from "@/hooks/use-co-host";

const MONTHS = [
  "All", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface CarRow {
  carId: number;
  make: string;
  model: string;
  year: number | null;
  vin: string;
  plate: string;
  rentalIncome: number;
  mgmtExpenses: number;
  mgmtSplit: number;
  ownerExpenses: number;
  ownerSplit: number;
  daysRented: number;
  tripsTaken: number;
  availableDays: number;
  fleetUtilization: number;
  aveEarnings: number;
  avgDaysRented: number;
}

const fmt = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

interface Props {
  year: string;
}

export default function CarPerformanceSection({ year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = All
  const { coHostId } = useCoHost();

  const { data, isLoading } = useQuery<{ success: boolean; data: CarRow[] }>({
    queryKey: ["/api/income-expense/car-performance", year, selectedMonth, coHostId ?? "all"],
    queryFn: async () => {
      const url = selectedMonth > 0
        ? buildApiUrl(`/api/income-expense/car-performance/${year}?month=${selectedMonth}`)
        : buildApiUrl(`/api/income-expense/car-performance/${year}`);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch car performance");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = data?.data ?? [];

  const totals = useMemo(() => ({
    rentalIncome: rows.reduce((s, r) => s + r.rentalIncome, 0),
    mgmtExpenses: rows.reduce((s, r) => s + r.mgmtExpenses, 0),
    mgmtSplit: rows.reduce((s, r) => s + r.mgmtSplit, 0),
    ownerExpenses: rows.reduce((s, r) => s + r.ownerExpenses, 0),
    ownerSplit: rows.reduce((s, r) => s + r.ownerSplit, 0),
    daysRented: rows.reduce((s, r) => s + r.daysRented, 0),
    tripsTaken: rows.reduce((s, r) => s + r.tripsTaken, 0),
    availableDays: rows.reduce((s, r) => s + r.availableDays, 0),
    aveEarnings: rows.length > 0
      ? rows.reduce((s, r) => s + r.aveEarnings, 0) / rows.length
      : 0,
    avgDaysRented: rows.length > 0
      ? rows.reduce((s, r) => s + r.avgDaysRented, 0) / rows.length
      : 0,
  }), [rows]);

  const monthLabel = selectedMonth === 0 ? year : `${MONTHS[selectedMonth]} ${year}`;

  return (
    <div className="mb-8">
      <SectionHeader
        title={`CAR PERFORMANCE RANKING ${monthLabel.toUpperCase()} ALL CARS`}
        subtitle="Filter by month and arranged from highest to lowest rental income"
      />

      {/* Month filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i)}
            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
              selectedMonth === i
                ? "bg-[#D3BC8D] text-black border-[#D3BC8D]"
                : "bg-white text-gray-700 border-gray-300 hover:border-[#D3BC8D]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#D3BC8D]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-black text-white">
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">#</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Make</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Model</th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap">Yr</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">VIN</th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Plate#</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Rental Income</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">MGMT Expenses</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">MGMT Split</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Car Owner Expenses</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Car Owner Split</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Days Rented</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Trips Taken</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Cars Available</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Fleet Utilization (%)</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Ave Earnings</th>
                <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Avg Days Rented</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.carId}
                  className={`border-b border-[#D3BC8D] ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <td className="px-3 py-1.5 text-center font-semibold text-[#D3BC8D]">{idx + 1}</td>
                  <td className="px-3 py-1.5 text-left">{r.make || "—"}</td>
                  <td className="px-3 py-1.5 text-left">{r.model || "—"}</td>
                  <td className="px-3 py-1.5 text-center">{r.year ?? "—"}</td>
                  <td className="px-3 py-1.5 text-left font-mono">{r.vin || "—"}</td>
                  <td className="px-3 py-1.5 text-left font-mono">{r.plate || "—"}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.rentalIncome)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.mgmtExpenses)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.mgmtSplit)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.ownerExpenses)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.ownerSplit)}</td>
                  <td className="px-3 py-1.5 text-right">{r.daysRented}</td>
                  <td className="px-3 py-1.5 text-right">{r.tripsTaken}</td>
                  <td className="px-3 py-1.5 text-right">{r.availableDays}</td>
                  <td className="px-3 py-1.5 text-right">{r.fleetUtilization.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.aveEarnings)}</td>
                  <td className="px-3 py-1.5 text-right">{r.avgDaysRented.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#D3BC8D] font-bold border-t-2 border-[#D3BC8D]">
                <td colSpan={6} className="px-3 py-2 text-center text-black">TOTAL</td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.rentalIncome)}</td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.mgmtExpenses)}</td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.mgmtSplit)}</td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.ownerExpenses)}</td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.ownerSplit)}</td>
                <td className="px-3 py-2 text-right text-black">{totals.daysRented}</td>
                <td className="px-3 py-2 text-right text-black">{totals.tripsTaken}</td>
                <td className="px-3 py-2 text-right text-black">{totals.availableDays}</td>
                <td className="px-3 py-2 text-right text-black">
                  {totals.availableDays > 0
                    ? ((totals.daysRented / totals.availableDays) * 100).toFixed(2) + "%"
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right text-black">{fmt(totals.aveEarnings)}</td>
                <td className="px-3 py-2 text-right text-black">{totals.avgDaysRented.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
