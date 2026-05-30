/**
 * My Employee Stats — daily breakdown for the current employee.
 * Tries /api/me/employee-stats first; falls back to empty grid if unavailable.
 */
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

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

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function MyEmployeeStatsSection() {
  const now = new Date();
  const month = String(now.getMonth() + 1);
  const year = String(now.getFullYear());

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

  return (
    <div className="mb-8">
      <SectionHeader
        title="EMPLOYEE STATS REPORT — INDIVIDUAL"
        subtitle="Your daily activity counts for the selected month."
      />

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs [&_td]:border-x [&_td]:border-[#D3BC8D] [&_th]:border-x [&_th]:border-[#D3BC8D]">
            <thead>
              <tr className="bg-black border-y border-[#D3BC8D]">
                <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-left font-bold uppercase text-white">
                  Employee Stats - {monthLabel(numMonth, numYear)}
                </th>
                {days.map((d) => (
                  <th key={d} className="w-8 min-w-[32px] px-1 py-2 text-center font-bold text-white">
                    {d}
                  </th>
                ))}
                <th className="min-w-[50px] bg-black px-2 py-2 text-center font-bold text-white">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx} className="bg-white border-y border-[#D3BC8D]">
                  <td className="sticky left-0 z-10 min-w-[220px] bg-white px-3 py-1.5 text-left text-xs font-medium text-black">
                    {row.category}
                  </td>
                  {row.daily.map((val, dayIdx) => (
                    <td key={dayIdx} className="px-1 py-1.5 text-center text-black">
                      {val > 0 ? val : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-bold text-black">
                    {row.total > 0 ? row.total : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
