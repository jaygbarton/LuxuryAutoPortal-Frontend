/**
 * My Monthly Stats — annual breakdown by month for the current employee.
 * Tries /api/me/employee-stats/monthly first; falls back to empty grid.
 */
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

interface MonthlyCategoryStat {
  category: string;
  monthly: number[];
  total: number;
}

interface MonthlyStatsResponse {
  success: boolean;
  data: { stats: MonthlyCategoryStat[] };
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const currentYear = new Date().getFullYear();

export default function MyMonthlyStatsSection() {
  const year = String(currentYear);

  const { data, isLoading } = useQuery<MonthlyStatsResponse>({
    queryKey: ["/api/me/employee-stats/monthly", year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/me/employee-stats/monthly?year=${year}`),
        { credentials: "include" }
      );
      if (res.status === 404 || res.status === 501) {
        return { success: true, data: { stats: [] } };
      }
      if (!res.ok) throw new Error("Failed to fetch monthly stats");
      return res.json();
    },
    retry: false,
  });

  const apiStats = data?.data?.stats ?? [];

  const displayData = TASK_CATEGORIES.map((category) => {
    const apiRow = apiStats.find((s) => s.category.toLowerCase() === category.toLowerCase());
    const monthly = apiRow ? apiRow.monthly.slice(0, 12) : Array(12).fill(0);
    while (monthly.length < 12) monthly.push(0);
    const total = monthly.reduce((s: number, v: number) => s + v, 0);
    return { category, monthly, total };
  });

  const grandMonthly = Array(12).fill(0);
  for (const row of displayData)
    for (let i = 0; i < 12; i++) grandMonthly[i] += row.monthly[i];
  const grandTotal = grandMonthly.reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="mb-8">
      <SectionHeader
        title="MONTHLY EMPLOYEE STATS — INDIVIDUAL"
        subtitle="Your activity totals by month for the selected year."
      />

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#FFCC00] border-collapse text-xs">
            <thead>
              <tr className="bg-black border-y border-[#FFCC00]">
                <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-left font-bold uppercase text-white">
                  Employee Stats - {year}
                </th>
                {MONTHS.map((m) => (
                  <th key={m} className="min-w-[70px] px-2 py-2 text-center font-bold text-white">
                    {m} {year}
                  </th>
                ))}
                <th className="min-w-[60px] bg-black px-2 py-2 text-center font-bold text-[#FFCC00]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx} className="bg-white border-y border-[#FFCC00]">
                  <td className="sticky left-0 z-10 min-w-[220px] bg-white px-3 py-1.5 text-left text-xs font-medium text-black">
                    {row.category}
                  </td>
                  {row.monthly.map((val, mIdx) => (
                    <td key={mIdx} className="px-2 py-1.5 text-center text-black">
                      {val > 0 ? val : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold text-black">
                    {row.total > 0 ? row.total : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#FFCC00] font-bold border-y border-[#FFCC00]">
                <td className="sticky left-0 z-10 min-w-[220px] bg-[#FFCC00] px-3 py-2 text-left text-xs font-bold text-black">
                  TOTAL
                </td>
                {grandMonthly.map((val, mIdx) => (
                  <td key={mIdx} className="px-2 py-2 text-center text-xs font-bold text-black">
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
  );
}
