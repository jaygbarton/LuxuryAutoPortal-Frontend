import { useState } from "react";
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

const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const YEAR_OPTIONS = ["2024", "2025", "2026", "2027"];

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthLabel(month: number, year: number): string {
  const date = new Date(year, month);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

export default function EmployeeStatsSection() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));

  const numMonth = Number(month);
  const numYear = Number(year);
  const daysInMonth = getDaysInMonth(numMonth, numYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Placeholder: all zeros
  const data = TASK_CATEGORIES.map((category) => ({
    category,
    daily: Array(daysInMonth).fill(0) as number[],
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="EMPLOYEE STATS REPORT" />

      <div className="bg-white px-4 py-4">
        {/* Month/Year selector */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Month:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[150px] border-[#FFD700]/30 bg-white text-black">
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
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-black text-white">
                <th className="sticky left-0 z-10 min-w-[200px] bg-black px-3 py-2 text-left font-semibold">
                  Employee Stats - {getMonthLabel(numMonth, numYear)}
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="w-8 min-w-[32px] px-1 py-2 text-center font-semibold"
                  >
                    {d}
                  </th>
                ))}
                <th className="min-w-[50px] px-2 py-2 text-center font-bold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const total = row.daily.reduce((sum, v) => sum + v, 0);
                return (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="sticky left-0 z-10 min-w-[200px] border-r border-gray-200 px-3 py-1.5 text-left font-medium text-gray-800"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "rgb(249 250 251)" }}
                    >
                      {row.category}
                    </td>
                    {row.daily.map((val, dayIdx) => (
                      <td
                        key={dayIdx}
                        className="px-1 py-1.5 text-center text-gray-600"
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
