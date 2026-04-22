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

// ── Types ────────────────────────────────────────────────────────────────

interface MonthlyCategoryStat {
  category: string;
  monthly: number[];
  total: number;
}

interface EmployeeOption {
  id: number;
  name: string;
}

interface MonthlyStatsResponse {
  success: boolean;
  data: {
    categories: string[];
    employees: EmployeeOption[];
    stats: MonthlyCategoryStat[];
  };
}

// ── Constants ────────────────────────────────────────────────────────────

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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthlyEmployeeStatsSectionProps {
  year: string;
}

// ── Loading skeleton ─────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function MonthlyEmployeeStatsSection({
  year,
}: MonthlyEmployeeStatsSectionProps) {
  const [employeeId, setEmployeeId] = useState("all");

  const { data, isLoading, isError } = useQuery<MonthlyStatsResponse>({
    queryKey: ["/api/admin/employee-stats/monthly", year, employeeId],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(
          `/api/admin/employee-stats/monthly?year=${year}&employeeId=${employeeId}`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch monthly employee stats");
      return res.json();
    },
  });

  const apiStats = data?.data?.stats ?? [];
  const employees = data?.data?.employees ?? [];

  const displayData = TASK_CATEGORIES.map((category) => {
    const apiRow = apiStats.find(
      (s) => s.category.toLowerCase() === category.toLowerCase(),
    );
    const monthly = apiRow
      ? apiRow.monthly.slice(0, 12)
      : Array(12).fill(0);
    while (monthly.length < 12) monthly.push(0);
    const total = monthly.reduce((sum: number, v: number) => sum + v, 0);
    return { category, monthly, total };
  });

  // Grand total row
  const grandTotalMonthly = Array(12).fill(0);
  for (const row of displayData) {
    for (let i = 0; i < 12; i++) {
      grandTotalMonthly[i] += row.monthly[i];
    }
  }
  const grandTotal = grandTotalMonthly.reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="mb-8">
      <SectionHeader title="MONTHLY EMPLOYEE STATS REPORT" />

      <div className="bg-white px-4 py-4">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Year: {year}</span>
          <span className="text-xs text-gray-400">(synced with Income section)</span>

          <span className="ml-4 text-sm font-medium text-gray-700">Employee:</span>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-[180px] border-gray-300 bg-white text-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-gray-200 bg-white text-black">
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && <LoadingSkeleton />}

        {isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-6 py-8 text-center">
            <p className="text-sm text-red-600">Failed to load monthly employee stats.</p>
          </div>
        )}

        {!isLoading && !isError && (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-left font-semibold">
                    Total Monthly Employee Stats — {year}
                  </th>
                  {MONTHS.map((m) => (
                    <th
                      key={m}
                      className="min-w-[70px] px-2 py-2 text-center font-semibold"
                    >
                      {m} {year}
                    </th>
                  ))}
                  <th className="min-w-[60px] bg-black px-2 py-2 text-center font-bold text-[#d3bc8d]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td
                      className="sticky left-0 z-10 min-w-[220px] border-r border-gray-200 px-3 py-1.5 text-left text-xs font-medium text-gray-800"
                      style={{
                        backgroundColor:
                          idx % 2 === 0 ? "white" : "rgb(249 250 251)",
                      }}
                    >
                      {row.category}
                    </td>
                    {row.monthly.map((val, mIdx) => (
                      <td
                        key={mIdx}
                        className={`px-2 py-1.5 text-center ${
                          val > 0
                            ? "font-semibold text-amber-700"
                            : "text-gray-300"
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
                {/* Grand Total Row */}
                <tr className="bg-[#d3bc8d] font-bold">
                  <td className="sticky left-0 z-10 min-w-[220px] bg-[#d3bc8d] px-3 py-2 text-left text-xs font-bold text-black">
                    TOTAL
                  </td>
                  {grandTotalMonthly.map((val, mIdx) => (
                    <td
                      key={mIdx}
                      className="px-2 py-2 text-center text-xs font-bold text-black"
                    >
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
