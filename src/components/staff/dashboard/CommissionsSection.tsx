/**
 * Commissions — 12-month commissions matrix per PDF design.
 * Tries /api/me/commissions?year=YYYY; falls back to zero-filled rows.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { COMMISSION_TYPES as SHARED_COMMISSION_TYPES } from "@/lib/commissionTypes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

interface CommissionRecord {
  id: number;
  type: string;
  amount: number;
  date: string;
  remarks: string;
  isPaid: number;
}

interface CommissionsResponse {
  success: boolean;
  data: { rows: CommissionRow[] };
}

interface CommissionsListResponse {
  success: boolean;
  data: { records: CommissionRecord[] };
}

const COMMISSION_TYPES = SHARED_COMMISSION_TYPES;

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

  const { data: listData, isLoading: listLoading } = useQuery<CommissionsListResponse>({
    queryKey: ["/api/me/commissions/list", year],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(`/api/me/commissions/list?year=${year}`), {
        credentials: "include",
      });
      if (r.status === 404 || r.status === 501) return { success: true, data: { records: [] } };
      if (!r.ok) throw new Error("Failed to load commission records");
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
    <div className="mb-8 px-4">
      <SectionHeader title="COMMISSIONS" />

      <div className="bg-white py-4">
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs">
                <thead>
                  <tr className="bg-black border-y border-[#D3BC8D]">
                    <th className="sticky left-0 z-10 min-w-[220px] bg-black px-3 py-2 text-center font-semibold text-white">
                      Type
                    </th>
                    {MONTHS.map((m) => (
                      <th key={m} className="min-w-[90px] px-2 py-2 text-center font-semibold text-white">
                        {m} {year}
                      </th>
                    ))}
                    <th className="min-w-[90px] bg-black px-2 py-2 text-center font-bold text-white">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, idx) => (
                    <tr key={idx} className="bg-white border-y border-[#D3BC8D]">
                      <td className="sticky left-0 z-10 min-w-[220px] bg-white px-3 py-1.5 text-center text-xs font-medium text-black">
                        {row.type}
                      </td>
                      {row.monthly.map((val, mIdx) => (
                        <td key={mIdx} className="px-2 py-1.5 text-center font-mono text-black">
                          {fmt$(val)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-mono font-bold text-black">
                        {fmt$(row.total)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#D3BC8D] font-bold border-y border-[#D3BC8D]">
                    <td className="sticky left-0 z-10 min-w-[220px] bg-[#D3BC8D] px-3 py-2 text-center font-bold text-black">
                      TOTAL
                    </td>
                    {grandMonthly.map((val, mIdx) => (
                      <td key={mIdx} className="px-2 py-2 text-center font-mono font-bold text-black">
                        {fmt$(val)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-mono font-bold text-black">
                      {fmt$(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Commissions trend line chart */}
            <div className="mt-6 bg-white">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={grandMonthly.map((val: number, i: number) => ({ month: `${MONTHS[i]} ${year}`, Commissions: val }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#E8E8E8" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#000000" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#6B6B6B" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                  />
                  <Tooltip formatter={(v: number) => fmt$(v)} />
                  <Line
                    type="linear"
                    dataKey="Commissions"
                    stroke="#D3BC8D"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#D3BC8D", stroke: "#D3BC8D" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Individual commission records */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-black mb-3">Commission Records</h3>
              {listLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#d3bc8d]" />
                </div>
              ) : (listData?.data?.records ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No commission records for {year}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs">
                    <thead>
                      <tr className="bg-black border-y border-[#D3BC8D]">
                        <th className="px-3 py-2 text-left font-semibold text-white">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-white">Type</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Amount</th>
                        <th className="px-3 py-2 text-center font-semibold text-white">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-white">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(listData?.data?.records ?? []).map((rec) => (
                        <tr key={rec.id} className="bg-white border-y border-[#D3BC8D]">
                          <td className="px-3 py-1.5 text-black">
                            {rec.date ? new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-black">{rec.type || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-black">{fmt$(rec.amount)}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rec.isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {rec.isPaid ? "Paid" : "Pending"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-600">{rec.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
