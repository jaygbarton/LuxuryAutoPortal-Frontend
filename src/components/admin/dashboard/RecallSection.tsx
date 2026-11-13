import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import {
  daysOpen, fetchRecalls, formatRecallDay, RECALLS_PATH, recallVehicleName, type Recall,
} from "@/pages/admin/operations/recalls";

/**
 * Dashboard: vehicles currently under an open safety recall (Operations →
 * Recall, status New), longest-unlisted first, so a recalled car can't sit
 * unlisted unnoticed for months.
 */
export default function RecallSection() {
  const { data = [], isLoading, isError, error } = useQuery<Recall[]>({
    queryKey: [RECALLS_PATH, "new"],
    queryFn: () => fetchRecalls({ status: "new" }),
  });
  const open = [...data].sort((a, b) => daysOpen(b) - daysOpen(a));

  return (
    <div className="mb-8">
      <SectionHeader title="RECALL" subtitle={isLoading ? undefined : `${open.length} vehicle${open.length === 1 ? "" : "s"} under an open safety recall`} />
      <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading recalls…</p>
        ) : isError ? (
          <p className="p-4 text-sm text-red-600" role="alert">{(error as Error)?.message || "Recalls could not be loaded."}</p>
        ) : open.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No open recalls.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Plate #</th>
                <th className="px-3 py-2">Days Open</th>
                <th className="px-3 py-2">Assigned To</th>
                <th className="px-3 py-2">Scheduled Repair</th>
              </tr>
            </thead>
            <tbody>
              {open.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {recallVehicleName(r)}
                    {!r.carId && <span className="ml-2 text-xs text-amber-600">(not matched)</span>}
                  </td>
                  <td className="px-3 py-2">{r.plate || "--"}</td>
                  <td className={`px-3 py-2 ${daysOpen(r) >= 30 ? "font-semibold text-red-600" : ""}`}>{daysOpen(r)}</td>
                  <td className="px-3 py-2">{r.assignedTo || <span className="text-muted-foreground">Unassigned</span>}</td>
                  <td className="px-3 py-2">{formatRecallDay(r.scheduledRepairDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Link href="/admin/operations?tab=recall" className="mt-2 inline-block text-sm text-primary underline">Open Recall →</Link>
    </div>
  );
}
