/**
 * My Work Schedule — month calendar showing only the current employee's shifts.
 * Tries /api/me/work-schedule (returns a list of shifts for the chosen month);
 * falls back to an empty calendar grid if the endpoint isn't available yet.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import {
  getArrayTotalDaysInMonthAndYear,
  getMonthYearNow,
  getWeeksCount,
  getWeekRow,
  WEEK_DAYS,
} from "@/lib/work-schedule-calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MyShift {
  work_sched_aid: number;
  work_sched_date: string;
  work_sched_code: string;
  work_sched_start_time: string;
  work_sched_end_time: string;
  work_sched_time?: string;
  fullname?: string;
}

interface MyShiftsResponse {
  success: boolean;
  data: MyShift[];
}

function fmtTime(t: string | undefined): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (isNaN(h)) return t;
  const period = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return `${hh}:${m}${period}`;
}

export default function MyWorkScheduleSection() {
  const [month, setMonth] = useState(getMonthYearNow());

  const { data, isLoading } = useQuery<MyShiftsResponse>({
    queryKey: ["/api/me/work-schedule", month],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(`/api/me/work-schedule?month=${month}`), {
        credentials: "include",
      });
      if (r.status === 404 || r.status === 501) return { success: true, data: [] };
      if (!r.ok) throw new Error("Failed to load schedule");
      return r.json();
    },
    retry: false,
  });

  const shifts = data?.data ?? [];

  const shiftsByCode = shifts.reduce<Record<string, MyShift[]>>((acc, s) => {
    const code = s.work_sched_code || (s.work_sched_date ?? "").replace(/-/g, "");
    if (!code) return acc;
    (acc[code] ??= []).push(s);
    return acc;
  }, {});

  const dayCells = getArrayTotalDaysInMonthAndYear(month);
  const weeksCount = getWeeksCount(dayCells);
  const weeks = Array.from({ length: weeksCount }, (_, i) => i + 1);

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <div className="mb-8">
      <SectionHeader
        title="WORK SCHEDULE"
        subtitle="Your assigned shifts for the selected month."
      />

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-base font-semibold text-gray-900">{monthLabel}</p>
          <div className="flex items-center gap-2">
            <Label htmlFor="my-sched-month" className="text-sm font-medium shrink-0">
              Month
            </Label>
            <Input
              id="my-sched-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-auto rounded border border-gray-200">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  {WEEK_DAYS.map((d) => (
                    <th
                      key={d}
                      className="w-[14.2857%] border-b border-gray-200 bg-gray-100 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((weekNum) => {
                  const weekRow = getWeekRow(dayCells, weekNum);
                  return (
                    <tr key={weekNum}>
                      {weekRow.map((cell, idx) => {
                        const myShifts = cell.originalDateCode
                          ? shiftsByCode[cell.originalDateCode] ?? []
                          : [];
                        const isEmptyCell = cell.day === 0;

                        return (
                          <td
                            key={cell.originalDateCode || `w${weekNum}-${idx}`}
                            className={`w-[14.2857%] border-b border-r border-gray-200 p-2 align-top last:border-r-0 ${
                              isEmptyCell ? "bg-gray-50" : ""
                            }`}
                          >
                            {!isEmptyCell && (
                              <div className="min-h-[5.5rem] space-y-1">
                                <span className="inline-flex h-6 w-6 items-center justify-center text-xs font-bold text-gray-700">
                                  {cell.day}
                                </span>
                                {myShifts.map((s) => (
                                  <div
                                    key={s.work_sched_aid}
                                    className="rounded-md border border-[#d3bc8d]/40 bg-[#d3bc8d]/15 px-1.5 py-1"
                                  >
                                    <div className="truncate text-[11px] font-semibold text-gray-800">
                                      {s.fullname ?? "Shift"}
                                    </div>
                                    <div className="truncate text-[10px] text-gray-600">
                                      {fmtTime(s.work_sched_start_time)} - {fmtTime(s.work_sched_end_time)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && shifts.length === 0 && (
          <p className="mt-3 text-center text-xs italic text-gray-400">
            No shifts assigned for this month.
          </p>
        )}
      </div>
    </div>
  );
}
