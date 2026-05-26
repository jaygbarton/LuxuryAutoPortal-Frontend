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
  /** Backend may return this when the user couldn't be resolved to an HR
   *  employee record — that's the most common cause of a blank calendar
   *  despite the admin having assigned shifts. */
  diagnostic?: {
    reason: "no_employee_record";
    message: string;
  };
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

  // Approved time-off for the current employee in the selected month. Renders
  // as a rose "Day Off" chip in the same calendar cells as shifts, mirroring
  // the admin Work Schedule page so what the admin assigns is what the
  // employee sees. Endpoint /api/staff/leave honors viewAsEmployee.
  const [yearStr, monthStr] = month.split("-");
  const monthYearNum = Number(yearStr);
  const monthNumNum = Number(monthStr);
  const fromDate = `${month}-01`;
  const toDate = `${month}-${String(
    new Date(monthYearNum, monthNumNum, 0).getDate(),
  ).padStart(2, "0")}`;
  const { data: leavesData } = useQuery<{
    data?: Array<{ leave_aid: number; leave_date: string; leave_is_status: number }>;
  }>({
    queryKey: ["/api/staff/leave", month, "approved"],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: "1",
        fromDate,
        toDate,
        limit: "200",
      });
      const r = await fetch(buildApiUrl(`/api/staff/leave?${params}`), {
        credentials: "include",
      });
      if (!r.ok) return { data: [] };
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

  // YYYY-MM-DD → true when the employee has an approved day off.
  // Two sources: the employee_leave table (via /api/staff/leave) and the
  // work_sched sentinel rows with work_sched_time = 'Day Off' (already in
  // the shifts array from /api/me/work-schedule). We merge both so the
  // calendar matches what the admin Work Schedule page shows.
  const leavesByDate: Record<string, boolean> = {};
  for (const l of leavesData?.data ?? []) {
    if (l.leave_is_status !== 1) continue;
    const date = l.leave_date?.slice(0, 10);
    if (date) leavesByDate[date] = true;
  }
  for (const s of shifts) {
    if (String(s.work_sched_time).trim().toLowerCase() === "day off") {
      const date = s.work_sched_date?.slice(0, 10);
      if (date) leavesByDate[date] = true;
    }
  }

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
                        const isDayOff = cell.originalDate
                          ? !!leavesByDate[cell.originalDate]
                          : false;
                        return (
                          <td
                            key={`shift-${weekNum}-${idx}`}
                            className="w-[14.2857%] border border-gray-400 px-2 py-2 align-top text-center text-xs text-gray-800 h-16 min-h-[4rem]"
                          >
                            {isDayOff && (
                              <div className="mb-1 inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                                Day Off
                              </div>
                            )}
                            {myShifts
                              .filter((s) => String(s.work_sched_time).trim().toLowerCase() !== "day off")
                              .map((s) => (
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

      {/* Diagnostic message takes priority over the generic empty state —
          if the backend told us the user isn't linked to an employee record,
          the calendar will ALWAYS be blank regardless of month, and a
          generic "no shifts" line would mislead. */}
      {!isLoading && data?.diagnostic?.reason === "no_employee_record" && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong className="font-semibold">Calendar can&apos;t find your shifts.</strong>{" "}
          {data.diagnostic.message}
        </div>
      )}

      {!isLoading &&
        !data?.diagnostic &&
        shifts.length === 0 &&
        Object.keys(leavesByDate).length === 0 && (
          <p className="mt-3 text-center text-xs italic text-gray-400">
            No shifts or time off scheduled this month.
          </p>
        )}
    </div>
  );
}
