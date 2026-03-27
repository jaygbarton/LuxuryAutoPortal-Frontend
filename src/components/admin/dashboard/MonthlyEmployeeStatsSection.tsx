import { SectionHeader } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
] as const;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const YEAR_OPTIONS = ["2024", "2025", "2026", "2027"];

interface MonthlyEmployeeStatsSectionProps {
  year: string;
}

export default function MonthlyEmployeeStatsSection({ year }: MonthlyEmployeeStatsSectionProps) {
  // Placeholder: all zeros
  const data = TASK_CATEGORIES.map((category) => ({
    category,
    monthly: Array(12).fill(0) as number[],
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="MONTHLY EMPLOYEE STATS REPORT" />

      <div className="bg-white px-4 py-4">
        {/* Year display (synced with Income section) */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Year:</span>
          <Select value={year} disabled>
            <SelectTrigger className="w-[120px] border-[#FFD700]/30 bg-white text-black">
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
          <span className="text-xs text-gray-400">(synced with Income section)</span>
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-black text-white">
                <th className="sticky left-0 z-10 min-w-[200px] bg-black px-3 py-2 text-left font-semibold">
                  Total Monthly Employee Stats
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="min-w-[70px] px-2 py-2 text-center font-semibold"
                  >
                    {m} {year}
                  </th>
                ))}
                <th className="min-w-[60px] px-2 py-2 text-center font-bold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const total = row.monthly.reduce((sum, v) => sum + v, 0);
                return (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td
                      className="sticky left-0 z-10 min-w-[200px] border-r border-gray-200 px-3 py-1.5 text-left font-medium text-gray-800"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "rgb(249 250 251)" }}
                    >
                      {row.category}
                    </td>
                    {row.monthly.map((val, mIdx) => (
                      <td
                        key={mIdx}
                        className="px-2 py-1.5 text-center text-gray-600"
                      >
                        {val}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold text-black">
                      {total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
