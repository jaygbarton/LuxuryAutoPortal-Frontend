/**
 * Staff Time Sheet (Hubstaff-style).
 *
 *  • One button: "Clock in" when not clocked in, "Clock out" when clocked in.
 *  • Clock-out opens a small modal so the employee picks:
 *      – "Clock out for break"  → server closes the session and the employee
 *        stays clocked OUT until they click "Clock in" again. Break time is
 *        therefore NOT counted as worked time.
 *      – "End of shift"         → server closes the session; they stay clocked out.
 *  • Multiple clock-in / clock-out sessions per day are supported.
 *  • Sessions list at the bottom is filterable by date / date range.
 *  • All clock times are displayed in **Utah / America/Denver** time.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, LogIn, LogOut, Coffee, ArrowLeft, ClipboardList, BarChart2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";

const UTAH_TZ = "America/Denver";

// ── End-of-shift questionnaire ─────────────────────────────────────────
type QType = "numeric" | "text" | "energy";
interface ShiftQuestion {
  id: string;
  label: string;
  type: QType;
}

const ENERGY_OPTIONS = ["Very low", "Low", "Okay", "Good", "Great"];

// NOTE: numeric `id`s MUST match the canonical keys in the backend's
// STATS_CATEGORIES (adminTimeSheetService.ts). The Employee Stats Report
// aggregates `time.time_form_details` by these exact keys.
const SHIFT_QUESTIONS: ShiftQuestion[] = [
  { id: "how_many_car_picked_up_from_airport_returning", label: "How Many Cars Picked Up From Airport Returning?", type: "numeric" },
  { id: "how_many_cleaning_going_out", label: "How Many Cleaning Going Out?", type: "numeric" },
  { id: "how_many_cars_re_parked", label: "How Many Cars Re-Parked?", type: "numeric" },
  { id: "how_many_gas_station_trip", label: "How Many Gas Station Trips?", type: "numeric" },
  { id: "how_many_trip_swaps_client_location", label: "How Many Trip Swaps – Client?", type: "numeric" },
  { id: "how_many_auto_body_pick_up_or_drop_off", label: "How Many Auto Body Pick Up?", type: "numeric" },
  { id: "how_many_mechanic_pick_up_or_drop_off", label: "How Many Mechanic Pick Up?", type: "numeric" },
  { id: "how_many_oil_lube_pick_up_or_drop_off", label: "How Many Oil & Lube Pick Up?", type: "numeric" },
  { id: "how_many_tire_pick_up_or_drop_off", label: "How Many Tire Pick Up or Drop Off?", type: "numeric" },
  { id: "how_many_windshield_pick_up_or_drop_off", label: "How Many Windshield Pick Up?", type: "numeric" },
  { id: "how_many_off_boarding_owner_removal", label: "How Many Off Boarding Owners?", type: "numeric" },
  { id: "how_many_on_boarding_new_car_received", label: "How Many On Boarding New?", type: "numeric" },
  { id: "how_many_picture_of_new_car", label: "How Many Pictures of New Cars?", type: "numeric" },
  { id: "how_many_battery", label: "How Many Battery?", type: "numeric" },
  { id: "how_many_license_emissions", label: "How Many License & Emissions?", type: "numeric" },
  { id: "how_many_towing_yard_impounded", label: "How Many Towing Yard – Impound?", type: "numeric" },
  { id: "how_many_supply_trips_wiper_blades_fluids_oil", label: "How Many Supply Trips – Wipes/etc.?", type: "numeric" },
  { id: "how_many_cleaning_extras_car_seats_coolers_ski_racks", label: "How Many Cleaning Extras (Roof Racks, etc.)?", type: "numeric" },
  { id: "energy_today", label: "How was my energy today?", type: "energy" },
  { id: "grateful_for", label: "I am grateful for…", type: "text" },
  { id: "additional_comments", label: "Additional Comments on Day", type: "text" },
];

const NUMERIC_OPTIONS = Array.from({ length: 21 }, (_, i) => String(i)); // 0..20

function buildEmptyAnswers(): Record<string, string> {
  return SHIFT_QUESTIONS.reduce<Record<string, string>>((acc, q) => {
    acc[q.id] = "";
    return acc;
  }, {});
}

interface SessionRow {
  time_aid: number;
  time_date: string;
  time_in: string | null;
  time_out: string | null;
  time_total_hours: string | null;
  time_end_reason: "break" | "shift_end" | null;
  time_form_details?: string | null;
}

interface FormDetail {
  key?: string;
  name: string;
  value?: string | number;
  description?: string;
}

interface LastResponse {
  success: boolean;
  data: {
    openSession: SessionRow | null;
    lastRecord: SessionRow | null;
    isClockedIn: boolean;
  };
}

interface SessionsResponse {
  success: boolean;
  data: { sessions: SessionRow[]; hourlyRate?: number };
}

// ── Time helpers (display in Utah TZ) ───────────────────────────────────

function parseDb(d: string | null | undefined): Date | null {
  if (!d) return null;
  const s = String(d).trim();
  // Date-only strings (YYYY-MM-DD) are Mountain calendar dates.
  // Parse at noon UTC — safely within the same Mountain day through any DST shift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const x = new Date(s + "T12:00:00Z");
    return isNaN(x.getTime()) ? null : x;
  }
  // Datetime strings are stored as UTC. Append "Z" so every browser treats
  // them as UTC rather than local time.
  const dt = s.replace(" ", "T");
  const utc = dt.endsWith("Z") || dt.includes("+") ? dt : dt + "Z";
  const x = new Date(utc);
  return isNaN(x.getTime()) ? null : x;
}

function utahDate(d: string | null | undefined, fallback = "—"): string {
  const x = parseDb(d);
  if (!x) return fallback;
  return x.toLocaleDateString("en-US", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function utahTime(d: string | null | undefined, fallback = "—"): string {
  const x = parseDb(d);
  if (!x) return fallback;
  return x.toLocaleTimeString("en-US", {
    timeZone: UTAH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Today as YYYY-MM-DD in Utah TZ. */
function utahToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  const s = parseDb(start);
  const e = parseDb(end);
  if (!s) return "—";
  const stop = e ?? new Date();
  let secs = Math.max(0, Math.floor((stop.getTime() - s.getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  secs -= h * 3600;
  const m = Math.floor(secs / 60);
  const sec = secs - m * 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Seconds between two timestamps; falls back to "now" when end is null. */
function secondsBetween(start: string | null | undefined, end: string | null | undefined): number {
  const s = parseDb(start);
  if (!s) return 0;
  const e = parseDb(end) ?? new Date();
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
}

/** Render a duration in seconds as e.g. "5h 25m" (gla-v3 style). */
function formatHm(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Render total seconds as H:MM:SS — matches individual-row duration format. */
function formatHms(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** YYYY-MM-DD in Utah TZ derived from a stored timestamp (reliable even when time_date is null). */
function utahDateKey(d: string | null | undefined): string {
  const x = parseDb(d);
  if (!x) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UTAH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
}

/**
 * Compute totals across the visible sessions.
 *  • workedSec — sum of every session's duration (live for open sessions).
 *  • breakSec  — gap between a session that ended in 'break' and the next session
 *               that started for the same employee on the same calendar day.
 *               Trailing break sessions (still on break) contribute 0.
 */
function computeTotals(sessions: SessionRow[]): { workedSec: number; breakSec: number } {
  let workedSec = 0;
  for (const s of sessions) workedSec += secondsBetween(s.time_in, s.time_out);

  // Sessions arrive newest-first; iterate chronologically to find break gaps.
  const chrono = [...sessions].reverse();
  let breakSec = 0;
  for (let i = 0; i < chrono.length; i++) {
    const cur = chrono[i];
    if (cur.time_end_reason !== "break" || !cur.time_out) continue;
    const next = chrono[i + 1];
    if (!next || !next.time_in) continue;
    // Derive calendar dates from the actual clock timestamps so the check
    // works even when time_date is null or stored as a full datetime string.
    const curDay = utahDateKey(cur.time_out);
    const nextDay = utahDateKey(next.time_in);
    if (curDay !== nextDay) continue;
    breakSec += secondsBetween(cur.time_out, next.time_in);
  }
  return { workedSec, breakSec };
}

// ── Page ────────────────────────────────────────────────────────────────

export default function StaffTime() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [actionLoading, setActionLoading] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [endNotes, setEndNotes] = useState("");
  const [shiftStep, setShiftStep] = useState<"choose" | "questionnaire">("choose");
  const [answers, setAnswers] = useState<Record<string, string>>(buildEmptyAnswers);
  const [statsSession, setStatsSession] = useState<SessionRow | null>(null);

  const today = utahToday();
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  // Force re-render every second so the running session's duration ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastQuery = useQuery<LastResponse>({
    queryKey: ["/api/me/time-sheet/last"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/time-sheet/last"), {
        credentials: "include",
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load time sheet");
      }
      return r.json();
    },
    retry: false,
    // Pick up admin-side edits/deletes from /admin/hr/time without manual refresh.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const open = lastQuery.data?.data.openSession ?? null;
  const isClockedIn = !!lastQuery.data?.data.isClockedIn;

  const sessionsKey = useMemo(
    () => ["/api/me/time-sheet/sessions", fromDate, toDate] as const,
    [fromDate, toDate]
  );
  const sessionsQuery = useQuery<SessionsResponse>({
    queryKey: sessionsKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const r = await fetch(
        buildApiUrl(`/api/me/time-sheet/sessions?${params.toString()}`),
        { credentials: "include" }
      );
      if (!r.ok) throw new Error("Failed to load sessions");
      return r.json();
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const sessions = sessionsQuery.data?.data.sessions ?? [];
  const hourlyRate = Number(sessionsQuery.data?.data.hourlyRate ?? 0);

  // Totals row — recomputed every render (cheap) so the live open session's
  // contribution ticks every second along with the rest of the page.
  const totals = computeTotals(sessions);
  const totalPay = (totals.workedSec / 3600) * hourlyRate;

  // ── Actions ──
  const clockIn = async () => {
    setActionLoading(true);
    try {
      const r = await fetch(buildApiUrl("/api/me/time-sheet/clock-in"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Error",
          description: json.error || "Could not clock in",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Clocked in", description: json.message ?? "Have a great shift!" });
      qc.invalidateQueries({ queryKey: ["/api/me/time-sheet/last"] });
      qc.invalidateQueries({ queryKey: ["/api/me/time-sheet/sessions"] });
    } finally {
      setActionLoading(false);
    }
  };

  const submitClockOut = async (
    endReason: "break" | "shift_end",
    detailsArray: Array<{
      key?: string;
      name: string;
      value?: string | number;
      description?: string;
    }>
  ) => {
    setActionLoading(true);
    try {
      const r = await fetch(buildApiUrl("/api/me/time-sheet/clock-out"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endReason,
          time_form_details: JSON.stringify(detailsArray),
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Error",
          description: json.error || "Could not clock out",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: endReason === "break" ? "On break" : "Clocked out",
        description:
          json.message ??
          (endReason === "break"
            ? "Timer paused. Clock back in when you return."
            : ""),
      });
      setClockOutOpen(false);
      setShiftStep("choose");
      setAnswers(buildEmptyAnswers());
      setEndNotes("");
      qc.invalidateQueries({ queryKey: ["/api/me/time-sheet/last"] });
      qc.invalidateQueries({ queryKey: ["/api/me/time-sheet/sessions"] });
    } finally {
      setActionLoading(false);
    }
  };

  const onClockOutBreak = () => {
    const notes = endNotes.trim();
    const details = notes
      ? [{ key: "notes", name: "Notes", value: notes, description: notes }]
      : [];
    void submitClockOut("break", details);
  };

  const onProceedToQuestionnaire = () => {
    setShiftStep("questionnaire");
  };

  const onSubmitShiftEnd = () => {
    // Build entries that the backend's stats report can aggregate by `key`.
    // For numeric questions we coerce the chosen value to a number so the
    // server's parseFormDetails treats it as a count.
    const details = SHIFT_QUESTIONS.map((q) => {
      const raw = answers[q.id]?.trim() ?? "";
      const value =
        q.type === "numeric"
          ? raw === ""
            ? 0
            : Number(raw) || 0
          : raw;
      return {
        key: q.id,
        name: q.label,
        value,
        description: raw,
      };
    });
    const notes = endNotes.trim();
    if (notes) {
      details.push({ key: "notes", name: "Notes", value: notes, description: notes });
    }
    void submitClockOut("shift_end", details);
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const onMainButton = () => {
    if (actionLoading) return;
    if (isClockedIn) {
      setClockOutOpen(true);
    } else {
      void clockIn();
    }
  };

  const setQuickRange = (kind: "today" | "week" | "month") => {
    const now = new Date();
    const utahNowStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: UTAH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    if (kind === "today") {
      setFromDate(utahNowStr);
      setToDate(utahNowStr);
      return;
    }
    if (kind === "week") {
      const d = new Date(utahNowStr + "T00:00:00");
      const dow = d.getDay();
      const start = new Date(d);
      start.setDate(d.getDate() - dow);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      setFromDate(startStr);
      setToDate(utahNowStr);
      return;
    }
    if (kind === "month") {
      const [y, m] = utahNowStr.split("-");
      setFromDate(`${y}-${m}-01`);
      setToDate(utahNowStr);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Time Sheet</h1>
            <p className="text-muted-foreground">
              Clock in and out throughout the day. Times shown in Utah (Mountain) time.
            </p>
          </div>
          <Button
            onClick={onMainButton}
            disabled={actionLoading || lastQuery.isLoading}
            className="gap-2 min-w-[140px]"
            variant={isClockedIn ? "destructive" : "default"}
          >
            {actionLoading || lastQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isClockedIn ? (
              <LogOut className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isClockedIn ? "Clock out" : "Clock in"}
          </Button>
        </div>

        {lastQuery.error && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3 text-sm text-destructive">
              {lastQuery.error instanceof Error
                ? lastQuery.error.message
                : "Failed to load time sheet"}
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              Current status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lastQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isClockedIn && open ? (
              <>
                <p>
                  <span className="text-muted-foreground">Status: </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Clocked in
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Started: </span>
                  {utahDate(open.time_in)} {utahTime(open.time_in)}
                </p>
                <p>
                  <span className="text-muted-foreground">Elapsed: </span>
                  <span className="font-mono tabular-nums">
                    {formatDuration(open.time_in, null)}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                You're currently clocked out. Press <span className="font-medium">Clock in</span>{" "}
                to start a session.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sessions list with filters */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 space-y-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              Sessions
            </CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-44"
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                No sessions in this range.
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Stats</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s, idx) => {
                      const isOpenSession = !s.time_out;
                      const duration = isOpenSession
                        ? formatDuration(s.time_in, null)
                        : formatDuration(s.time_in, s.time_out);
                      return (
                        <TableRow key={s.time_aid}>
                          <TableCell className="text-center text-muted-foreground text-xs">
                            {sessions.length - idx}
                          </TableCell>
                          <TableCell>{utahDate(s.time_in)}</TableCell>
                          <TableCell className="font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium">
                            {duration}
                          </TableCell>
                          <TableCell>
                            {utahTime(s.time_in)}
                            {" - "}
                            {isOpenSession ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                in progress
                              </span>
                            ) : (
                              utahTime(s.time_out)
                            )}
                          </TableCell>
                          <TableCell>
                            {isOpenSession ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : s.time_end_reason === "break" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                <Coffee className="w-3 h-3" />
                                Break
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Shift end</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!isOpenSession ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs h-7 px-2 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
                                onClick={() => setStatsSession(s)}
                              >
                                <BarChart2 className="w-3.5 h-3.5" />
                                View stats
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell />
                      <TableCell className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium">Total</TableCell>
                      <TableCell>
                        <div className="font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium">
                          {formatHms(totals.workedSec)}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums ">
                          {(totals.workedSec / 3600).toFixed(2)} hrs
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          Break:{" "}
                          <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                            {formatHms(totals.breakSec)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                            {(totals.breakSec / 3600).toFixed(2)} hrs
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hourlyRate > 0 ? (
                          <>
                            <div className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                              {formatUsd(totalPay)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @ {formatUsd(hourlyRate)}/hr
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Rate not set</span>
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clock-out modal */}
      <Dialog
        open={clockOutOpen}
        onOpenChange={(v) => {
          if (!v) {
            setClockOutOpen(false);
            setShiftStep("choose");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {shiftStep === "questionnaire" && (
                <button
                  type="button"
                  onClick={() => setShiftStep("choose")}
                  className="rounded p-1 hover:bg-muted"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {shiftStep === "questionnaire" ? (
                <>
                  <ClipboardList className="w-5 h-5 text-primary" />
                  End-of-shift report
                </>
              ) : (
                "Clock out"
              )}
            </DialogTitle>
          </DialogHeader>

          {shiftStep === "choose" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Are you stepping away for a break or ending your shift?
              </p>

              <div className="space-y-1">
                <Label htmlFor="end-notes">Notes (optional)</Label>
                <textarea
                  id="end-notes"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="What did you work on?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  disabled={actionLoading}
                  onClick={onClockOutBreak}
                  className="gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Coffee className="w-4 h-4" />
                  )}
                  Clock out for break
                </Button>
                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={onProceedToQuestionnaire}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  End of shift
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                "Break" pauses your timer — you'll need to click Clock in again when you return,
                and break time is not counted as worked time. "End of shift" requires a quick
                report before you clock out.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Answer any questions that apply to your shift before clocking out. All fields are optional.
              </p>

              <div className="space-y-3">
                {SHIFT_QUESTIONS.map((q) => {
                  return (
                    <div key={q.id} className="space-y-1">
                      <Label htmlFor={`q-${q.id}`}>
                        {q.label}
                      </Label>
                      {q.type === "numeric" && (
                        <Select
                          value={answers[q.id] || undefined}
                          onValueChange={(v) => setAnswer(q.id, v)}
                        >
                          <SelectTrigger id={`q-${q.id}`}>
                            <SelectValue placeholder="Select number" />
                          </SelectTrigger>
                          <SelectContent>
                            {NUMERIC_OPTIONS.map((n) => (
                              <SelectItem key={n} value={n}>
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {q.type === "energy" && (
                        <Select
                          value={answers[q.id] || undefined}
                          onValueChange={(v) => setAnswer(q.id, v)}
                        >
                          <SelectTrigger id={`q-${q.id}`}>
                            <SelectValue placeholder="Select energy level" />
                          </SelectTrigger>
                          <SelectContent>
                            {ENERGY_OPTIONS.map((e) => (
                              <SelectItem key={e} value={e}>
                                {e}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {q.type === "text" && (
                        <textarea
                          id={`q-${q.id}`}
                          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          placeholder="Type your answer…"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShiftStep("choose")}
                  disabled={actionLoading}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={onSubmitShiftEnd}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  Submit & Clock out
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Stats viewer modal */}
      <Dialog open={!!statsSession} onOpenChange={(v) => { if (!v) setStatsSession(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Shift stats — {statsSession ? utahDate(statsSession.time_date || statsSession.time_in) : ""}
            </DialogTitle>
          </DialogHeader>
          {statsSession && (() => {
            let details: FormDetail[] = [];
            try {
              const raw = statsSession.time_form_details;
              if (raw) details = JSON.parse(raw) as FormDetail[];
            } catch { /* ignore parse errors */ }
            const numeric = details.filter(
              (d) => d.key && d.key !== "notes" && d.key !== "grateful_for" && d.key !== "additional_comments" && d.key !== "energy_today"
            );
            const others = details.filter(
              (d) => !d.key || ["notes", "grateful_for", "additional_comments", "energy_today"].includes(d.key)
            );
            return (
              <div className="space-y-5 pt-1">
                {numeric.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Activity counts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {numeric.map((d, i) => (
                        <div
                          key={d.key ?? i}
                          className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <span className="text-sm text-muted-foreground leading-snug">{d.name}</span>
                          <span className="text-sm font-semibold text-primary ml-3 tabular-nums">
                            {d.value ?? "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Other responses
                    </h3>
                    <div className="space-y-2">
                      {others.map((d, i) => (
                        <div key={d.key ?? i} className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-0.5">
                          <p className="text-xs text-muted-foreground">{d.name}</p>
                          <p className="text-sm text-foreground">{d.description || d.value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {details.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No stats recorded for this session.</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
