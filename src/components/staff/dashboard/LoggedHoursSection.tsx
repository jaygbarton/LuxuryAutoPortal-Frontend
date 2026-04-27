/**
 * Logged Hours History — clock-in/out sessions with computed amount.
 * Displays times in Utah/Mountain time. Amount = worked hours × rate.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const UTAH_TZ = "America/Denver";

interface SessionRow {
  time_aid: number;
  time_date: string | null;
  time_in: string | null;
  time_out: string | null;
  time_total_hours: string | null;
  time_end_reason: "break" | "shift_end" | null;
}

interface SessionsResponse {
  success: boolean;
  data: { sessions: SessionRow[] };
}

interface MeEmployeeResponse {
  success: boolean;
  data: { employee_job_pay_salary_rate?: string | null };
}

function utahToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDb(d: string | null | undefined): Date | null {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const x = new Date(s + "T12:00:00Z");
    return isNaN(x.getTime()) ? null : x;
  }
  const dt = s.replace(" ", "T");
  const utc = dt.endsWith("Z") || dt.includes("+") ? dt : dt + "Z";
  const x = new Date(utc);
  return isNaN(x.getTime()) ? null : x;
}

function utahDate(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "—";
  return x.toLocaleDateString("en-US", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function utahTime(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "—";
  return x.toLocaleTimeString("en-US", {
    timeZone: UTAH_TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function durationHours(startIso: string | null, endIso: string | null): number {
  const s = parseDb(startIso);
  const e = parseDb(endIso);
  if (!s || !e) return 0;
  return Math.max(0, (e.getTime() - s.getTime()) / 3600000);
}

function formatHM(hours: number): string {
  const total = Math.floor(hours * 60);
  const h = Math.floor(total / 60);
  const m = total - h * 60;
  return `${h}h ${m}m`;
}

interface DailyRow {
  date: string;
  timeIn: string | null;
  breakOut: string | null;
  breakIn: string | null;
  timeOut: string | null;
  totalBreakHours: number;
  workedHours: number;
}

/**
 * Group sessions by Utah-calendar date, then determine first time-in,
 * first break window, and last time-out. Sum worked hours across the day's
 * non-break segments.
 */
function buildDailyRows(sessions: SessionRow[]): DailyRow[] {
  const byDate: Record<string, SessionRow[]> = {};
  for (const s of sessions) {
    const d = parseDb(s.time_date || s.time_in);
    if (!d) continue;
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: UTAH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    (byDate[key] ??= []).push(s);
  }

  return Object.entries(byDate)
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => {
        const ai = parseDb(a.time_in)?.getTime() ?? 0;
        const bi = parseDb(b.time_in)?.getTime() ?? 0;
        return ai - bi;
      });

      const firstIn = sorted[0]?.time_in ?? null;
      const lastOut = [...sorted].reverse().find((s) => s.time_out)?.time_out ?? null;
      const firstBreakSession = sorted.find((s) => s.time_end_reason === "break" && s.time_out);
      const breakOut = firstBreakSession?.time_out ?? null;
      const idxOfBreak = firstBreakSession ? sorted.indexOf(firstBreakSession) : -1;
      const breakIn =
        idxOfBreak >= 0 && idxOfBreak + 1 < sorted.length
          ? sorted[idxOfBreak + 1]?.time_in ?? null
          : null;

      let totalBreakHours = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].time_end_reason === "break" && sorted[i].time_out && sorted[i + 1].time_in) {
          totalBreakHours += durationHours(sorted[i].time_out, sorted[i + 1].time_in);
        }
      }

      let workedHours = 0;
      for (const s of sorted) {
        if (s.time_in && s.time_out) workedHours += durationHours(s.time_in, s.time_out);
      }

      return { date, timeIn: firstIn, breakOut, breakIn, timeOut: lastOut, totalBreakHours, workedHours };
    })
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

export default function LoggedHoursSection() {
  const today = utahToday();
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [to, setTo] = useState<string>(today);

  const { data: empData } = useQuery<MeEmployeeResponse>({
    queryKey: ["/api/me/employee"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/employee"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const rate = parseFloat(String(empData?.data?.employee_job_pay_salary_rate ?? 0)) || 0;

  const { data, isLoading } = useQuery<SessionsResponse>({
    queryKey: ["/api/me/time-sheet/sessions", from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await fetch(buildApiUrl(`/api/me/time-sheet/sessions?${params}`), {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const sessions = data?.data?.sessions ?? [];
  const rows = useMemo(() => buildDailyRows(sessions), [sessions]);

  const totalWorked = rows.reduce((s, r) => s + r.workedHours, 0);
  const totalAmount = rows.reduce((s, r) => s + r.workedHours * rate, 0);

  const setQuickRange = (kind: "today" | "week" | "month") => {
    if (kind === "today") {
      setFrom(today);
      setTo(today);
      return;
    }
    if (kind === "week") {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() - 6);
      setFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setTo(today);
      return;
    }
    if (kind === "month") {
      const [y, m] = today.split("-");
      setFrom(`${y}-${m}-01`);
      setTo(today);
    }
  };

  return (
    <div className="mb-8">
      <SectionHeader title="LOGGED HOURS HISTORY" />

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-gray-500">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickRange("today")}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange("week")}>
              This week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange("month")}>
              This month
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No logged hours in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Time in</th>
                  <th className="px-3 py-2 text-left font-semibold">Break Out</th>
                  <th className="px-3 py-2 text-left font-semibold">Break In</th>
                  <th className="px-3 py-2 text-center font-semibold">Total Break</th>
                  <th className="px-3 py-2 text-left font-semibold">Time Out</th>
                  <th className="px-3 py-2 text-right font-semibold">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-[#d3bc8d]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const amt = r.workedHours * rate;
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{utahDate(r.timeIn)}</div>
                        <div className="text-gray-500">{utahTime(r.timeIn)}</div>
                      </td>
                      <td className="px-3 py-2">
                        {r.breakOut ? (
                          <>
                            <div className="text-gray-700">{utahDate(r.breakOut)}</div>
                            <div className="text-gray-500">{utahTime(r.breakOut)}</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.breakIn ? (
                          <>
                            <div className="text-gray-700">{utahDate(r.breakIn)}</div>
                            <div className="text-gray-500">{utahTime(r.breakIn)}</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-gray-700">
                        {formatHM(r.totalBreakHours)}
                      </td>
                      <td className="px-3 py-2">
                        {r.timeOut ? (
                          <>
                            <div className="text-gray-700">{utahDate(r.timeOut)}</div>
                            <div className="text-gray-500">{utahTime(r.timeOut)}</div>
                          </>
                        ) : (
                          <span className="font-medium text-emerald-600">In progress</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        ${rate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">
                        ${amt.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#d3bc8d] font-bold">
                  <td className="px-3 py-2" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-black">—</td>
                  <td className="px-3 py-2 text-black">{formatHM(totalWorked)} worked</td>
                  <td className="px-3 py-2 text-right text-black">—</td>
                  <td className="px-3 py-2 text-right text-black">${totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
