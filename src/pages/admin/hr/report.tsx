/**
 * Admin HR – Employee Stats Report.
 *
 * Aggregates counts of submitted activities from employee end-of-day forms
 * (time.time_form_details) across configurable time periods (day/week/
 * month/year) and per-employee (or all employees).
 *
 * Categories reported:
 *   - Cars picked up from the airport for return
 *   - Cleaning trips going out
 *   - Cars re-parked
 *   - Gas station trips
 *   - Trip swaps – client location
 *   - Auto body pick-ups or drop-offs
 *   - Mechanic pick-ups or drop-offs
 *   - Oil & lube pick-ups or drop-offs
 *   - Tire pick-ups or drop-offs
 *   - Windshield pick-ups or drop-offs
 *   - Offboarding – owner removal
 *   - Onboarding – new car received
 *   - Pictures of new cars
 *   - Battery-related tasks
 *   - License & emissions tasks
 *   - Towing to yard – impounded vehicles
 *   - Supply trips – wiper blades, fluids, oil, etc.
 *   - Cleaning extras – seats, coolers, ski racks, etc.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

type Period = "day" | "week" | "month" | "year";

interface EmployeeOption {
  employee_aid: number;
  employee_first_name: string;
  employee_last_name: string;
}

interface StatsBucket {
  bucket: string;
  label: string;
}

interface StatsRow {
  key: string;
  label: string;
  counts: number[];
  total: number;
}

interface StatsReport {
  categories: { key: string; label: string }[];
  buckets: StatsBucket[];
  employees: { id: number; name: string }[];
  rows: StatsRow[];
  grandTotalByBucket: number[];
  grandTotal: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Compute a sensible default date range for a given period. */
function defaultRange(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = new Date(today);
  const from = new Date(today);
  if (period === "day") {
    from.setDate(today.getDate() - 13); // 2 weeks
  } else if (period === "week") {
    from.setDate(today.getDate() - 7 * 8); // 8 weeks
  } else if (period === "month") {
    from.setMonth(today.getMonth() - 11); // 12 months
    from.setDate(1);
  } else {
    from.setFullYear(today.getFullYear() - 4); // 5 years
    from.setMonth(0, 1);
  }
  return { from: toDateInput(from), to: toDateInput(to) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(String(d).replace(" ", "T")).toLocaleDateString();
  } catch {
    return "—";
  }
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function AdminHrReport() {
  const [period, setPeriod] = useState<Period>("day");
  const [employeeId, setEmployeeId] = useState<string>("all");
  const initial = useMemo(() => defaultRange("day"), []);
  const [fromDate, setFromDate] = useState<string>(initial.from);
  const [toDate, setToDate] = useState<string>(initial.to);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    const r = defaultRange(p);
    setFromDate(r.from);
    setToDate(r.to);
  };

  // ── Employees ──
  const { data: empData } = useQuery<{ success: boolean; data: EmployeeOption[] }>({
    queryKey: ["/api/employees", "stats-report"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees?limit=1000"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });
  const employees = empData?.data ?? [];

  // ── Stats ──
  const statsParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    if (employeeId) p.set("employeeId", employeeId);
    return p.toString();
  }, [period, fromDate, toDate, employeeId]);

  const {
    data: statsResp,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<{ success: boolean; data: StatsReport }>({
    queryKey: ["/api/admin/hr/stats-report", statsParams],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/stats-report?${statsParams}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stats report");
      return res.json();
    },
    enabled: !!fromDate && !!toDate,
  });
  const stats = statsResp?.data;

  // ── Submissions (raw list) ──
  const listParams = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    if (employeeId && employeeId !== "all") p.set("employeeId", employeeId);
    return p.toString();
  }, [fromDate, toDate, employeeId]);

  const { data: listData, isLoading: listLoading } = useQuery<{
    success: boolean;
    data: any[];
    total: number;
  }>({
    queryKey: ["/api/admin/hr/report", listParams],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/report?${listParams}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });
  const submissionRows = listData?.data ?? [];

  // ── CSV export (stats) ──
  const exportCsv = () => {
    if (!stats) return;
    const header = ["Category", ...stats.buckets.map((b) => b.label), "Total"];
    const lines: string[] = [header.map(csvCell).join(",")];
    for (const row of stats.rows) {
      lines.push(
        [row.label, ...row.counts.map((n) => String(n)), String(row.total)]
          .map(csvCell)
          .join(",")
      );
    }
    lines.push(
      ["TOTAL", ...stats.grandTotalByBucket.map((n) => String(n)), String(stats.grandTotal)]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-stats-${period}-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Employee Stats Report</h1>
          <p className="text-muted-foreground text-sm">
            Counts of activities from submitted end-of-day forms, aggregated per day, week,
            month, or year and filtered per employee.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Period</label>
                <Select value={period} onValueChange={(v) => handlePeriodChange(v as Period)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Daily</SelectItem>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Employee</label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.employee_aid} value={String(e.employee_aid)}>
                        {`${e.employee_first_name ?? ""} ${e.employee_last_name ?? ""}`.trim() ||
                          `Employee ${e.employee_aid}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportCsv} disabled={!stats}>
                Export CSV
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {statsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : statsError || !stats ? (
                  <p className="text-destructive text-center py-6">Failed to load report.</p>
                ) : stats.buckets.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">
                    Select a date range to see the report.
                  </p>
                ) : (
                  <StatsTable stats={stats} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {listLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : submissionRows.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">
                    No submissions in this range.
                  </p>
                ) : (
                  <div className="overflow-auto max-h-[60vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time in</TableHead>
                          <TableHead>Time out</TableHead>
                          <TableHead className="text-right">Total hrs</TableHead>
                          <TableHead>Form details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissionRows.map((r: any) => (
                          <TableRow key={r.time_aid}>
                            <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                            <TableCell>{formatDate(r.time_date)}</TableCell>
                            <TableCell>
                              {r.time_in
                                ? new Date(String(r.time_in).replace(" ", "T")).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {r.time_out
                                ? new Date(String(r.time_out).replace(" ", "T")).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.time_total_hours != null
                                ? Number(r.time_total_hours).toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell className="max-w-[320px] text-muted-foreground text-xs">
                              <FormDetailsPreview raw={r.time_form_details} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {listData?.total != null && listData.total > submissionRows.length && (
                  <p className="text-muted-foreground text-sm mt-2">
                    Showing {submissionRows.length} of {listData.total} records.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// ── Stats table ──────────────────────────────────────────────────────────

/** Strip the year from a bucket label so headers stay compact.
 *  "Apr 28, 2026" → "Apr 28" | "2026 · Week 18" → "Wk 18" | "April 2026" → "Apr" | "2026" → "2026" */
function shortBucketLabel(label: string): string {
  // Daily: "Apr 28, 2026" or "Apr 28 2026"
  const daily = label.match(/^([A-Za-z]{3}\s+\d{1,2})[,\s]+\d{4}$/);
  if (daily) return daily[1];
  // Weekly: "2026 · Week 18" or "2026 · Wk 18"
  const weekly = label.match(/\bWeek\s*(\d+)\b/i) ?? label.match(/\bWk\s*(\d+)\b/i);
  if (weekly) return `Wk ${weekly[1]}`;
  // Monthly: "April 2026" or "Apr 2026"
  const monthly = label.match(/^([A-Za-z]+)\s+\d{4}$/);
  if (monthly) return monthly[1].slice(0, 3);
  return label;
}

function StatsTable(props: { stats: StatsReport }) {
  const { stats } = props;
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-black text-white">
            <th className="sticky left-0 z-10 min-w-[240px] bg-black px-3 py-2 text-left font-semibold">
              Category
            </th>
            {stats.buckets.map((b) => (
              <th
                key={b.bucket}
                className="min-w-[56px] px-2 py-2 text-center font-semibold whitespace-nowrap"
                title={b.label}
              >
                {shortBucketLabel(b.label)}
              </th>
            ))}
            <th className="min-w-[56px] bg-black px-2 py-2 text-center font-bold text-[#d3bc8d]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.rows.map((row, idx) => (
            <tr key={row.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td
                className="sticky left-0 z-10 min-w-[240px] border-r border-border px-3 py-1.5 text-left font-medium text-gray-800"
                style={{
                  backgroundColor: idx % 2 === 0 ? "white" : "rgb(249 250 251)",
                }}
              >
                {row.label}
              </td>
              {row.counts.map((v, i) => (
                <td
                  key={i}
                  className={
                    "px-2 py-1.5 text-center " +
                    (v > 0 ? "font-semibold text-amber-700" : "text-gray-300")
                  }
                >
                  {v > 0 ? v : "—"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-bold text-black">
                {row.total > 0 ? row.total : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Form details preview ────────────────────────────────────────────────

function FormDetailsPreview(props: { raw: string | null | undefined }) {
  if (!props.raw) return <span>—</span>;
  let parsed: any;
  try {
    parsed = typeof props.raw === "string" ? JSON.parse(props.raw) : props.raw;
  } catch {
    const s = String(props.raw);
    return <span>{s.length > 120 ? s.slice(0, 120) + "…" : s}</span>;
  }
  if (!parsed) return <span>—</span>;
  const entries: { k: string; v: unknown }[] = [];
  if (Array.isArray(parsed)) {
    for (const it of parsed) {
      if (it && typeof it === "object")
        entries.push({ k: (it.key || it.name || "") as string, v: it.value ?? it.count });
    }
  } else if (typeof parsed === "object") {
    for (const [k, v] of Object.entries(parsed)) entries.push({ k, v });
  }
  const positives = entries.filter(
    (e) => e.v != null && e.v !== "" && Number(e.v) > 0
  );
  if (positives.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="block truncate">
      {positives
        .map((e) => `${e.k.replace(/_/g, " ")}: ${e.v}`)
        .join(" · ")}
    </span>
  );
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
