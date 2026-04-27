/**
 * Earnings History — pay-period totals (recent) and monthly totals (annual).
 * Pulls from /api/me/payslips. Period is derived from payrun_list_created
 * (or payrun period dates when available).
 */
import { useMemo, useState } from "react";
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

interface PayslipRow {
  payrun_list_aid: number;
  payrun_list_id?: number;
  payrun_number?: string;
  payrun_status?: number;
  payrun_list_status?: number;
  payrun_list_gross: string;
  payrun_list_deduction: string;
  payrun_list_net: string;
  payrun_list_created?: string;
  payrun_date_from?: string;
  payrun_date_to?: string;
}

interface PayslipsResponse {
  success: boolean;
  data: PayslipRow[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt$(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseAmount(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
}

function periodLabel(row: PayslipRow): string {
  if (row.payrun_date_from && row.payrun_date_to) {
    try {
      const from = new Date(row.payrun_date_from);
      const to = new Date(row.payrun_date_to);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
        const toStr = to.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        return `${fromStr} - ${toStr}`;
      }
    } catch {
      /* fall through */
    }
  }
  if (row.payrun_list_created) {
    try {
      const d = new Date(row.payrun_list_created);
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch {
      /* ignore */
    }
  }
  return row.payrun_number ?? "—";
}

function rowYear(row: PayslipRow): number | null {
  const ref = row.payrun_date_to || row.payrun_date_from || row.payrun_list_created;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

function rowMonth(row: PayslipRow): number | null {
  const ref = row.payrun_date_to || row.payrun_date_from || row.payrun_list_created;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getMonth();
}

export default function EarningsHistorySection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery<PayslipsResponse>({
    queryKey: ["/api/me/payslips"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/payslips"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load payslips");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const all = data?.data ?? [];

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(String(currentYear));
    for (const row of all) {
      const y = rowYear(row);
      if (y) set.add(String(y));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [all, currentYear]);

  const yearRows = useMemo(
    () => all.filter((r) => String(rowYear(r) ?? "") === year),
    [all, year]
  );

  const periodRows = useMemo(
    () =>
      [...yearRows].sort((a, b) => {
        const da = new Date(a.payrun_date_to || a.payrun_list_created || 0).getTime();
        const db = new Date(b.payrun_date_to || b.payrun_list_created || 0).getTime();
        return db - da;
      }),
    [yearRows]
  );

  const monthly = useMemo(() => {
    const buckets = Array(12).fill(0);
    for (const r of yearRows) {
      const m = rowMonth(r);
      if (m == null) continue;
      buckets[m] += parseAmount(r.payrun_list_net);
    }
    return buckets;
  }, [yearRows]);

  const periodTotal = periodRows.reduce((s, r) => s + parseAmount(r.payrun_list_net), 0);
  const monthlyTotal = monthly.reduce((s, v) => s + v, 0);

  return (
    <div className="mb-8">
      <SectionHeader title="TOTAL EARNINGS" subtitle="Monthly totals (left) and bi-weekly pay periods (right)." />

      {/* Year filter */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Year:</span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px] border-gray-300 bg-white text-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-gray-200 bg-white text-black">
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* TOTAL EARNINGS — monthly totals (LEFT, matches PDF) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold uppercase text-gray-700">
              Total Earnings — {year}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="px-3 py-2 text-left font-semibold">Month and Year</th>
                    <th className="px-3 py-2 text-right font-semibold">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((amt, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 text-gray-800">
                        {MONTHS[i]} {year}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          amt > 0 ? "text-gray-900" : "text-gray-300"
                        }`}
                      >
                        {amt > 0 ? fmt$(amt) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#d3bc8d] font-bold">
                    <td className="px-3 py-2 text-black">TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono text-black">
                      {fmt$(monthlyTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PAY PERIOD — bi-weekly payslips (RIGHT, matches PDF) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold uppercase text-gray-700">
              Pay Period — {year}
            </h3>
            {periodRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">
                No payslips recorded for {year}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="px-3 py-2 text-left font-semibold">Month and Year</th>
                      <th className="px-3 py-2 text-right font-semibold">Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((r, i) => (
                      <tr key={r.payrun_list_aid} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-gray-800">{periodLabel(r)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">
                          {fmt$(parseAmount(r.payrun_list_net))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#d3bc8d] font-bold">
                      <td className="px-3 py-2 text-black">TOTAL</td>
                      <td className="px-3 py-2 text-right font-mono text-black">
                        {fmt$(periodTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
