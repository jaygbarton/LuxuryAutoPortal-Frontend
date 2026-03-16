import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import { useState } from "react";

function formatDate(d: string | undefined, fallback = "--") {
  if (!d) return fallback;
  try {
    const x = new Date(d);
    return isNaN(x.getTime()) ? fallback : x.toLocaleDateString();
  } catch {
    return fallback;
  }
}

function formatTime(d: string | undefined, fallback = "--") {
  if (!d) return fallback;
  try {
    const x = new Date(d);
    return isNaN(x.getTime()) ? fallback : x.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return fallback;
  }
}

function decimalToHrsMin(decimal: number | string | undefined): string {
  if (decimal === undefined || decimal === null || decimal === "") return "--";
  const n = Number(decimal);
  if (isNaN(n)) return "--";
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type NextAction = "time_in" | "lunch_out" | "lunch_in" | "time_out" | "already_out" | "no_schedule";

interface LastRecord {
  time_date?: string;
  time_working_hours?: string;
  time_in?: string;
  time_in_status?: number;
  time_hours_per_day?: string;
  time_in_hours?: string;
  time_lunch_out?: string | null;
  time_lunch_in?: string | null;
  time_lunch_hours?: string | null;
  time_out?: string | null;
  time_out_hours?: string | null;
  time_total_hours?: string;
  time_amount?: string;
  time_form_details?: string | null;
}

export default function StaffTime() {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timeOutModalOpen, setTimeOutModalOpen] = useState(false);
  const [timeFormDetails, setTimeFormDetails] = useState<string>("[]"); // JSON array of { name, description }

  const { data: lastData, isLoading } = useQuery<{
    success: boolean;
    data: { lastRecord: LastRecord | null; nextAction: NextAction };
  }>({
    queryKey: ["/api/me/time-sheet/last"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/time-sheet/last"), { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load time sheet");
      }
      return res.json();
    },
    retry: false,
  });

  const last = lastData?.data?.lastRecord ?? null;
  const nextAction = lastData?.data?.nextAction ?? "time_in";

  const getButtonLabel = () => {
    switch (nextAction) {
      case "time_in":
        return "Time in";
      case "lunch_out":
        return "Lunch out";
      case "lunch_in":
        return "Lunch in";
      case "time_out":
        return "Time out";
      case "already_out":
        return "Already clocked out";
      case "no_schedule":
        return "No schedule for today";
      default:
        return "Time in";
    }
  };

  const runAction = async (body: { time_form_details?: string }) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/me/time-sheet/action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json.error || "Action failed");
        return;
      }
      setTimeOutModalOpen(false);
      setTimeFormDetails("[]");
      queryClient.invalidateQueries({ queryKey: ["/api/me/time-sheet/last"] });
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionClick = () => {
    if (nextAction === "already_out" || nextAction === "no_schedule") return;
    if (nextAction === "time_out") {
      setTimeOutModalOpen(true);
      return;
    }
    runAction({});
  };

  const handleTimeOutSubmit = () => {
    let details = timeFormDetails.trim();
    try {
      JSON.parse(details);
    } catch {
      details = "[]";
    }
    runAction({ time_form_details: details });
  };

  const canPunch = nextAction !== "already_out" && nextAction !== "no_schedule" && !actionLoading;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Time Sheet</h1>
            <p className="text-muted-foreground">Clock in, lunch, and clock out.</p>
          </div>
          <Button onClick={handleActionClick} disabled={!canPunch} className="gap-2">
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            {getButtonLabel()}
          </Button>
        </div>

        {actionError && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3 text-sm text-destructive">{actionError}</CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              Current status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !last ? (
              <p className="text-muted-foreground">
                {nextAction === "no_schedule"
                  ? "You don't have working hours for today. Contact HR to add a schedule."
                  : "No active time record. Use the button above to clock in."}
              </p>
            ) : (
              <div className="grid gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Schedule: </span>
                  {last.time_working_hours ?? "--"}
                </p>
                <p>
                  <span className="text-muted-foreground">Time in: </span>
                  {formatDate(last.time_date)} {formatTime(last.time_in)}
                  {last.time_in_status === 1 && (
                    <span className="text-amber-600 ml-1">(Late: {decimalToHrsMin(last.time_in_hours)})</span>
                  )}
                </p>
                {last.time_lunch_out && (
                  <p>
                    <span className="text-muted-foreground">Lunch out: </span>
                    {formatTime(last.time_lunch_out)}
                  </p>
                )}
                {last.time_lunch_in && (
                  <p>
                    <span className="text-muted-foreground">Lunch in: </span>
                    {formatTime(last.time_lunch_in)}
                    {last.time_lunch_hours != null && (
                      <span className="text-muted-foreground"> ({decimalToHrsMin(Number(last.time_lunch_hours))} break)</span>
                    )}
                  </p>
                )}
                {last.time_out && (
                  <p>
                    <span className="text-muted-foreground">Time out: </span>
                    {formatDate(last.time_date)} {formatTime(last.time_out)}
                    {last.time_total_hours != null && (
                      <span className="text-muted-foreground"> — Total: {decimalToHrsMin(Number(last.time_total_hours))}</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={timeOutModalOpen} onOpenChange={setTimeOutModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Time out — form details</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Please fill in the form details before clocking out (required). Use a JSON array of objects with{" "}
            <code className="text-xs">name</code> and <code className="text-xs">description</code>, e.g.{" "}
            <code className="text-xs">[{`{"name":"Task","description":"Done"}`}]</code>
          </p>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={timeFormDetails}
            onChange={(e) => setTimeFormDetails(e.target.value)}
            placeholder='[{"name":"Task 1","description":"Description"},...]'
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTimeOutModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTimeOutSubmit} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit time out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
