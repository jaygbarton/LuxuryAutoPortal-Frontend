/**
 * My Employee Stats — daily breakdown for the current employee.
 * Tries /api/me/employee-stats first; falls back to empty grid if unavailable.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryStat {
  category: string;
  daily: number[];
  total: number;
}

interface MyStatsResponse {
  success: boolean;
  data: {
    stats: CategoryStat[];
  };
}

const TASK_CATEGORIES = [
  "How Many Cars Picked up From Airport Returning?",
  "How Many Cleaning Going Out?",
  "How Many Cars Re-Parked?",
  "How Many Gas Station Trip?",
  "How Many Trip Swaps - Client Location?",
  "How Many Auto Body Pick Up or Drop Off?",
  "How Many Mechanic Pick Up or Drop Off?",
  "How Many Oil & Lube Pick Up or Drop Off?",
  "How Many Tire Pick Up or Drop Off?",
  "How Many Windshield Pick Up or Drop Off?",
  "How Many Off Boarding Owner Removal?",
  "How Many On Boarding New Car Received?",
  "How Many Picture of New Car?",
  "How Many Battery?",
  "How Many License & Emissions?",
  "How Many Towing Yard - Impounded?",
  "How Many Supply Trips - Wiper Blades/Fluids/Oil?",
  "How Many Cleaning Extras Car? Seats/Coolers/Ski Racks?",
];

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear + 1 - 2023 + 1 },
  (_, i) => String(2023 + i)
);

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function MyEmployeeStatsSection() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const numMonth = Number(month);
  const numYear = Number(year);
  const daysInMonth = getDaysInMonth(numMonth, numYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const { data, isLoading } = useQuery<MyStatsResponse>({
    queryKey: ["/api/me/employee-stats", month, year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/me/employee-stats?month=${month}&year=${year}`),
        { credentials: "include" }
      );
      if (res.status === 404 || res.status === 501) {
        return { success: true, data: { stats: [] } };
      }
      if (!res.ok) throw new Error("Failed to fetch employee stats");
      return res.json();
    },
    retry: false,
  });

  const apiStats = data?.data?.stats ?? [];

  const displayData = TASK_CATEGORIES.map((category) => {
    const apiRow = apiStats.find((s) => s.category.toLowerCase() === category.toLowerCase());
    const daily = apiRow ? apiRow.daily.slice(0, daysInMonth) : Array(daysInMonth).fill(0);
    while (daily.length < daysInMonth) daily.push(0);
    const total = daily.reduce((s: number, v: number) => s + v, 0);
    return { category, daily, total };
  });

  const grandDaily = Array(daysInMonth).fill(0);
  for (const row of displayData) for (let i = 0; i < daysInMonth; i++) grandDaily[i] += row.daily[i];
  const grandTotal = grandDaily.reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="mb-8">
      <SectionHeader
        title="EMPLOYEE STATS REPORT — INDIVIDUAL"
        subtitle="Your daily activity counts for the selected month."
      />

      <div className="bg-white px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Month:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[150px] border-gray-300 bg-white text-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-gray-200 bg-white text-black">
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm font-medium text-gray-700">Year:</span>
          <Select value={year} onValueChange={setYear}>
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

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-left font-semibold">
                    Employee Stats — {monthLabel(numMonth, numYear)}
                  </th>
                  {days.map((d) => (
                    <th key={d} className="w-8 min-w-[32px] px-1 py-2 text-center font-semibold">
                      {d}
                    </th>
                  ))}
                  <th className="min-w-[50px] bg-black px-2 py-2 text-center font-bold text-[#d3bc8d]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td
                      className="sticky left-0 z-10 min-w-[220px] border-r border-gray-200 px-3 py-1.5 text-left text-xs font-medium text-gray-800"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "rgb(249 250 251)" }}
                    >
                      {row.category}
                    </td>
                    {row.daily.map((val, dayIdx) => (
                      <td
                        key={dayIdx}
                        className={`px-1 py-1.5 text-center ${
                          val > 0 ? "font-semibold text-amber-700" : "text-gray-300"
                        }`}
                      >
                        {val > 0 ? val : "—"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold text-black">
                      {row.total > 0 ? row.total : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#d3bc8d] font-bold">
                  <td className="sticky left-0 z-10 min-w-[220px] bg-[#d3bc8d] px-3 py-2 text-left text-xs font-bold text-black">
                    TOTAL
                  </td>
                  {grandDaily.map((val, dayIdx) => (
                    <td key={dayIdx} className="px-1 py-2 text-center text-xs font-bold text-black">
                      {val > 0 ? val : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-sm font-bold text-black">
                    {grandTotal > 0 ? grandTotal : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
