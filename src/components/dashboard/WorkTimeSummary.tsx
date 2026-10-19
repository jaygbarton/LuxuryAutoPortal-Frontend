import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, CalendarDays } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

export interface WorkTimeData {
  hasEmployee: boolean;
  isClockedIn: boolean;
  elapsedSeconds: number | null;
  period: { start: string; end: string } | null;
  periodStatus: string;
  periodSource?: string;
  workedHours: number | null;
  activeHours: number;
}
function duration(seconds: number, includeSeconds = false) {
  const total = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(total / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m${includeSeconds ? ` ${total % 60}s` : ""}`;
}
function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

/** Status only: clock actions stay on the Time Sheet page. */
export function WorkTimeSummary() {
  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    queryKey: ["/api/me/time-sheet/dashboard"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/time-sheet/dashboard"), { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Time summary unavailable");
      const body = await res.json();
      if (!body.success) throw new Error("Time summary unavailable");
      return body.data as WorkTimeData;
    },
    refetchInterval: 30_000,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: 1,
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  // Stop advancing stale status instead of presenting it as a confirmed shift.
  const stale = !!data && now - dataUpdatedAt > 90_000;
  const unavailable = isError || stale;
  const delta = !unavailable && data?.isClockedIn ? Math.max(0, (now - dataUpdatedAt) / 1000) : 0;
  const status = isPending ? "Loading status…" : unavailable ? "Status unavailable" : !data?.hasEmployee ? "Time tracking not linked" : data.isClockedIn ? "Clocked in" : "Clocked out";
  const confirmed = !isPending && !unavailable && data?.hasEmployee;
  const statusColor = confirmed
    ? data.isClockedIn ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-red-200 bg-red-100 text-red-800"
    : "border-primary/30 bg-primary/10 text-foreground";
  return (
    <section aria-label="Your time summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex min-h-40 min-w-0 flex-col items-center justify-center rounded-xl border border-primary/40 bg-gradient-to-br from-white to-primary/10 p-4 text-center sm:p-5">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4 text-[#9a742e]" />Your clock status</p>
        <p role="status" className={`mt-3 rounded-full border px-4 py-1.5 text-xl font-semibold ${statusColor}`}>{status}</p>
        {!unavailable && data?.hasEmployee && <p className="mt-2 text-sm font-medium tabular-nums text-muted-foreground">{data.isClockedIn ? data.elapsedSeconds === null ? "Start time unavailable" : `${duration(data.elapsedSeconds + delta, true)} on the clock` : "No active shift"}</p>}
        {unavailable && <p className="mt-1 text-sm text-muted-foreground">Unable to confirm your latest status. Reconnecting automatically.</p>}
        {data && !data.hasEmployee && <p className="mt-1 text-sm text-muted-foreground">An employee profile must be linked to your account.</p>}
      </div>
      <div className="flex min-h-40 min-w-0 flex-col items-center justify-center rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-white p-4 text-center sm:p-5">
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4 text-[#9a742e]" />Current pay period</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-[#846027]">{isPending ? "Loading hours…" : unavailable ? "Hours unavailable" : data?.workedHours != null ? duration(data.workedHours * 3600 + (data.activeHours > 0 ? delta : 0)) : "Hours not available"}</p>
        {data?.period && <p className="mt-1 text-sm text-muted-foreground">{dateLabel(data.period.start)} – {dateLabel(data.period.end)}</p>}
        {!isPending && !unavailable && data?.hasEmployee && !data.period && <p className="mt-1 text-sm text-muted-foreground">{data.periodStatus === "ambiguous" ? "Overlapping pay periods need review in Payroll." : "Payroll needs a previous pay-period end date."}</p>}
        {!unavailable && data?.workedHours != null && <p className="mt-2 text-xs text-muted-foreground">{data.activeHours > 0 ? "Includes your shift in progress. " : ""}{data.periodSource === "schedule" ? "15-day schedule; updates to admin-entered payroll dates. " : ""}Payroll dates use Mountain Time.</p>}
      </div>
    </section>
  );
}
