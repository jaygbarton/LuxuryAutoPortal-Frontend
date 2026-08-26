import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { getActiveTimezone } from "@/hooks/use-timezone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

export type OperationsEntityType =
  | "task"
  | "inspection"
  | "maintenance"
  | "claim"
  | "car_repaired"
  | "ticket_violation"
  | "car_pending_issue"
  | "service_date"
  | "car_registration";

interface AuditRow {
  id: number;
  entityType: OperationsEntityType;
  entityId: number;
  action: "create" | "update" | "delete";
  actorId: number | null;
  actorName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: getActiveTimezone(),
      month: "2-digit", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Fields we never want to show in a diff — noisy or not meaningful to a human. */
const IGNORED_FIELDS = new Set([
  "id", "created_at", "updated_at", "createdAt", "updatedAt",
  "google_event_id", "photos", "cr_photos", "tv_photos",
]);

/** Compute the changed-field list between two row snapshots. */
function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field: key, from, to });
    }
  }
  return changes;
}

/**
 * Bare edit-history timeline (no dialog/button wrapper) — who changed what
 * and when, diffed from the before/after row snapshot the backend logs on
 * every update. Use this directly when embedding inside a tab's existing
 * history/detail dialog; use <OperationEditHistory> for a standalone
 * trigger button + dialog.
 */
export function OperationEditHistoryList({
  entityType,
  entityId,
}: {
  entityType: OperationsEntityType;
  entityId: number;
}) {
  const { data, isLoading } = useQuery<{ success: boolean; history: AuditRow[] }>({
    queryKey: ["/api/operations/audit", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/operations/audit?entityType=${entityType}&entityId=${entityId}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load edit history");
      return res.json();
    },
    enabled: !!entityId,
  });

  const rows = data?.history ?? [];

  if (isLoading) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No edits recorded yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const changes = diffFields(r.before, r.after);
        return (
          <li key={r.id} className="py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground capitalize">{r.action}d</span>
              <span className="text-xs text-muted-foreground">
                by {r.actorName || "Unknown"}
                <span className="ml-2">{fmtWhen(r.createdAt)}</span>
              </span>
            </div>
            {changes.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {changes.map((c) => (
                  <li key={c.field} className="text-xs">
                    <span className="text-muted-foreground">{c.field}: </span>
                    <span className="text-red-600 line-through">{fmtValue(c.from)}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="text-green-700">{fmtValue(c.to)}</span>
                  </li>
                ))}
              </ul>
            ) : r.action === "update" ? (
              <p className="mt-1 text-xs text-muted-foreground">No tracked field changes.</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Standalone edit-history trigger: a small history-icon button that opens a
 * dialog containing <OperationEditHistoryList>. Use this for tabs that don't
 * already have their own history/detail dialog to embed the list into.
 */
export function OperationEditHistory({
  entityType,
  entityId,
}: {
  entityType: OperationsEntityType;
  entityId: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Edit History"
      >
        <History className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit History</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Who changed what, and when — newest first.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {open && <OperationEditHistoryList entityType={entityType} entityId={entityId} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
