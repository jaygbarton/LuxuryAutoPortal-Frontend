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
import { Button } from "@/components/ui/button";
import { History, Upload, Trash2, RefreshCw } from "lucide-react";

interface AuditRow {
  id: number;
  area: "earnings" | "income_expense";
  action: "upload" | "delete" | "replace";
  carId: number;
  year: number | null;
  month: number | null;
  category: string | null;
  field: string | null;
  filename: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  createdAt: string;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const ACTION_META: Record<string, { label: string; icon: typeof Upload; cls: string }> = {
  upload:  { label: "Uploaded", icon: Upload,    cls: "text-green-700" },
  delete:  { label: "Deleted",  icon: Trash2,    cls: "text-red-700" },
  replace: { label: "Replaced", icon: RefreshCw, cls: "text-blue-700" },
};

/**
 * Receipt edit-history viewer. Shows who uploaded / deleted / replaced a receipt
 * for a car (Earnings + I&E), and when. Read-only; visible to anyone who can view
 * the car (admin / co-host / client-owner) — the backend scopes access.
 *
 * Render the trigger button anywhere; pass the carId (and optional year to scope).
 */
export function ReceiptEditHistory({ carId, year }: { carId: number; year?: number | string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; history: AuditRow[] }>({
    queryKey: ["/api/receipt-audit", carId, year ?? "all"],
    queryFn: async () => {
      const qs = year ? `?year=${year}` : "";
      const res = await fetch(buildApiUrl(`/api/receipt-audit/${carId}${qs}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load receipt history");
      return res.json();
    },
    enabled: open && !!carId,
  });

  const rows = data?.history ?? [];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <History className="w-4 h-4" />
        Receipt History
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Receipt Edit History</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Who uploaded, replaced, or deleted receipts{year ? ` in ${year}` : ""} — newest first.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No receipt changes recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => {
                  const meta = ACTION_META[r.action] ?? ACTION_META.upload;
                  const Icon = meta.icon;
                  const when = r.month ? `${MONTHS[r.month]} ${r.year ?? ""}`.trim() : (r.year ? String(r.year) : "");
                  const area = r.area === "earnings" ? "Earnings" : "Income & Expenses";
                  const who = r.actorEmail || (r.actorRole ?? "Unknown");
                  return (
                    <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.cls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className={`font-medium ${meta.cls}`}>{meta.label}</span>
                          <span className="text-foreground">{area}</span>
                          {when && <span className="text-muted-foreground">· {when}</span>}
                          {r.field && r.field !== "screenshot" && r.field !== "chart" && (
                            <span className="text-muted-foreground">· {r.field}</span>
                          )}
                        </div>
                        {r.filename && (
                          <div className="text-xs text-muted-foreground truncate">{r.filename}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          by {who}
                          {r.actorRole && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{r.actorRole}</span>}
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
