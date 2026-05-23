/**
 * My Work Schedule — month calendar showing only the current employee's shifts.
 * Tries /api/me/work-schedule (returns a list of shifts for the chosen month);
 * falls back to an empty calendar grid if the endpoint isn't available yet.
 */
import { Fragment, useState } from "react";
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

      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
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

      {isLoading ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full table-fixed border-collapse border border-gray-400 [&_td]:border [&_td]:border-gray-400 [&_th]:border [&_th]:border-gray-400">
            <thead>
              <tr>
                <th
                  colSpan={7}
                  className="bg-black px-3 py-2 text-center text-sm font-bold uppercase text-[#FFCC00]"
                >
                  {monthLabel}
                </th>
              </tr>
              <tr className="bg-black">
                {WEEK_DAYS.map((d) => (
                  <th
                    key={d}
                    className="w-[14.2857%] border border-gray-600 px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
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
                  <Fragment key={weekNum}>
                    {/* Day-number row — solid yellow */}
                    <tr className="bg-[#FFCC00]">
                      {weekRow.map((cell, idx) => (
                        <td
                          key={`num-${weekNum}-${idx}`}
                          className="w-[14.2857%] border border-gray-400 px-2 py-2 text-center text-sm font-bold text-black"
                        >
                          {cell.day === 0 ? "" : cell.day}
                        </td>
                      ))}
                    </tr>
                    {/* Shift row — white */}
                    <tr className="bg-white">
                      {weekRow.map((cell, idx) => {
                        const myShifts = cell.originalDateCode
                          ? shiftsByCode[cell.originalDateCode] ?? []
                          : [];
                        return (
                          <td
                            key={`shift-${weekNum}-${idx}`}
                            className="w-[14.2857%] border border-gray-400 px-2 py-2 align-top text-center text-xs text-gray-800"
                          >
                            {myShifts.map((s) => (
                              <div key={s.work_sched_aid}>
                                <div className="font-semibold">{s.fullname ?? ""}</div>
                                <div className="text-gray-600">
                                  {fmtTime(s.work_sched_start_time)} - {fmtTime(s.work_sched_end_time)}
                                </div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
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
  );
}
