import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { History, ArrowRight } from "lucide-react";

interface CarHistoryAuditRow {
  id: number;
  carId: number;
  year: number;
  month: number;
  field: "carsAvailableForRent" | "daysRented" | "tripsTaken";
  oldValue: string | number | null;
  newValue: string | number | null;
  /** 1 when written by the per-car → fleet-wide mirror rather than typed here. */
  mirrored: number;
  actorRole: string | null;
  actorEmail: string | null;
  createdAt: string;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FIELD_LABEL: Record<string, string> = {
  carsAvailableForRent: "Available Cars",
  daysRented: "Days Rented",
  tripsTaken: "Trips Taken",
};

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "2-digit", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// MySQL DECIMAL comes back as a string — coerce before formatting, and keep
// "—" only for a genuinely absent previous value (a first-ever edit), not 0.
function fmtValue(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

/**
 * Edit history for the dashboard's manually-editable Available Cars number.
 *
 * Available Cars is a fleet-wide figure stored on the car_id = 0 sentinel row
 * and also writable from each per-car Income & Expenses page (which mirrors onto
 * the sentinel), so "who changed this" was previously unanswerable from the data
 * alone. Read-only; the backend applies the same scoping as editing the value.
 */
export function AvailableCarsEditHistory({
  year,
  month,
}: {
  year: number | string;
  /** Omit to show the whole year's trail; pass a month to scope to that cell. */
  month?: number;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; history: CarHistoryAuditRow[] }>({
    queryKey: ["/api/income-expense/history-audit", 0, year, month ?? "all"],
    queryFn: async () => {
      const monthQs = month ? `&month=${month}` : "";
      const res = await fetch(
        buildApiUrl(
          `/api/income-expense/history-audit/0?year=${year}${monthQs}&field=carsAvailableForRent`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load edit history");
      return res.json();
    },
    enabled: open,
  });

  const rows = data?.history ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 align-middle text-gray-400 hover:text-gray-600"
        title="Available Cars edit history"
      >
        <History className="w-3 h-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Available Cars — Edit History</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Who changed the Available Cars number{month ? ` for ${MONTHS[month]} ${year}` : ` in ${year}`},
              and what it was before — newest first.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No edits recorded yet for {month ? `${MONTHS[month]} ${year}` : year}.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const who = r.actorEmail || r.actorRole || "Unknown";
                  return (
                    <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-foreground">
                            {MONTHS[r.month]} {r.year}
                          </span>
                          <span className="text-muted-foreground">
                            · {FIELD_LABEL[r.field] ?? r.field}
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium">
                            <span className="text-muted-foreground line-through">
                              {fmtValue(r.oldValue)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-green-700">{fmtValue(r.newValue)}</span>
                          </span>
                          {r.mirrored === 1 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              from car page
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          by {who}
                          {r.actorRole && (
                            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                              {r.actorRole}
                            </span>
                          )}
                          <span className="ml-2">{fmtWhen(r.createdAt)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
