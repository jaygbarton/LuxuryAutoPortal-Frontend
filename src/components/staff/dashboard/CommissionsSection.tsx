/**
 * Commissions — 12-month commissions matrix per PDF design.
 * Tries /api/me/commissions?year=YYYY; falls back to zero-filled rows.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CommissionRow {
  type: string;
  monthly: number[];
  total: number;
}

interface CommissionsResponse {
  success: boolean;
  data: { rows: CommissionRow[] };
}

const COMMISSION_TYPES = [
  "Parking Airport",
  "Uber & Lyft",
  "Electric, Gas, Uber - Reimbursed",
  "Ski Rack's",
  "New Car 1%",
  "New Car - Onboard",
  "Relist Car",
  "Annual Inspections",
  "Insurance",
  "Car Registrations",
  "Car Swap",
  "Zero Parking Fee",
  "Invoice",
  "Bouncie",
  "Maintenance",
  "Exit Parking Ticket",
  "Last Minute Commissions",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt$(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: currentYear + 1 - 2023 + 1 },
  (_, i) => String(2023 + i)
);

export default function CommissionsSection() {
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery<CommissionsResponse>({
    queryKey: ["/api/me/commissions", year],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(`/api/me/commissions?year=${year}`), {
        credentials: "include",
      });
      if (r.status === 404 || r.status === 501) return { success: true, data: { rows: [] } };
      if (!r.ok) throw new Error("Failed to load commissions");
      return r.json();
    },
    retry: false,
  });

  const apiRows = data?.data?.rows ?? [];

  const displayRows = COMMISSION_TYPES.map((type) => {
    const apiRow = apiRows.find((r) => r.type.toLowerCase() === type.toLowerCase());
    const monthly = apiRow ? apiRow.monthly.slice(0, 12) : Array(12).fill(0);
    while (monthly.length < 12) monthly.push(0);
    const total = monthly.reduce((s: number, v: number) => s + v, 0);
    return { type, monthly, total };
  });

  const grandMonthly = Array(12).fill(0);
  for (const row of displayRows) for (let i = 0; i < 12; i++) grandMonthly[i] += row.monthly[i];
  const grandTotal = grandMonthly.reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="mb-8">
      <SectionHeader
        title="COMMISSIONS"
        subtitle="Your monthly commissions by type."
      />

      <div className="bg-white px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-black text-white">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-left font-semibold">
                    Type
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="min-w-[90px] px-2 py-2 text-center font-semibold">
                      {m} {year}
                    </th>
                  ))}
                  <th className="min-w-[90px] bg-black px-2 py-2 text-center font-bold text-[#d3bc8d]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td
                      className="sticky left-0 z-10 min-w-[220px] border-r border-gray-200 px-3 py-1.5 text-left text-xs font-medium text-gray-800"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "rgb(249 250 251)" }}
                    >
                      {row.type}
                    </td>
                    {row.monthly.map((val, mIdx) => (
                      <td
                        key={mIdx}
                        className={`px-2 py-1.5 text-right font-mono ${
                          val > 0 ? "text-gray-900" : "text-gray-300"
                        }`}
                      >
                        {fmt$(val)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-black">
                      {fmt$(row.total)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#d3bc8d] font-bold">
                  <td className="sticky left-0 z-10 min-w-[220px] bg-[#d3bc8d] px-3 py-2 text-left font-bold text-black">
                    TOTAL
                  </td>
                  {grandMonthly.map((val, mIdx) => (
                    <td key={mIdx} className="px-2 py-2 text-right font-mono font-bold text-black">
                      {fmt$(val)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-mono font-bold text-black">
                    {fmt$(grandTotal)}
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
