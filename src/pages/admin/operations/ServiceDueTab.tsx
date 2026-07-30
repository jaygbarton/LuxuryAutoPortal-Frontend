import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { CarServiceDue } from "./types";

// Staleness thresholds (days) for the two headline service types. Anything
// past DUE reads amber; past OVERDUE reads red; never-serviced always reads red.
const THRESHOLDS: Record<"oil_change" | "tires", { due: number; overdue: number }> = {
  oil_change: { due: 90, overdue: 180 },   // ~3mo / ~6mo
  tires: { due: 180, overdue: 365 },        // ~6mo / ~1yr
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Never";
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Never";
  }
}

function staleness(days: number | null, kind: "oil_change" | "tires"): "red" | "amber" | "green" {
  if (days == null) return "red";
  const t = THRESHOLDS[kind];
  if (days >= t.overdue) return "red";
  if (days >= t.due) return "amber";
  return "green";
}

const STALE_CLASSES: Record<"red" | "amber" | "green", string> = {
  red: "bg-red-500/15 text-red-500 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  green: "bg-green-500/15 text-green-500 border-green-500/30",
};

function ServiceCell({
  date,
  days,
  kind,
}: {
  date: string | null;
  days: number | null;
  kind: "oil_change" | "tires";
}) {
  const level = staleness(days, kind);
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STALE_CLASSES[level]}`}>
        {days == null ? "Never serviced" : `${days} day${days === 1 ? "" : "s"} ago`}
      </span>
      <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
    </div>
  );
}

export function ServiceDueTab() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<{ success: boolean; data: CarServiceDue[] }>({
    queryKey: ["/api/operations/maintenance/service-due"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance/service-due"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load service-due report");
      return res.json();
    },
  });

  const rows = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.car_name, r.car_plate].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const overdueOilCount = rows.filter((r) => staleness(r.days_since_oil_change, "oil_change") === "red").length;
  const overdueTireCount = rows.filter((r) => staleness(r.days_since_tires, "tires") === "red").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Service Due"
          subtitle="Last completed maintenance per car — sorted with the most overdue first."
          variant="plain"
          className="mb-0"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Cars Tracked" value={String(rows.length)} variant="dark" />
        <SummaryCard label="Oil Change Overdue" value={String(overdueOilCount)} variant="gold" />
        <SummaryCard label="Tires Overdue" value={String(overdueTireCount)} variant="white" />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="mb-4 flex flex-col gap-1 max-w-sm">
          <label className="text-muted-foreground text-xs">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Car name or plate..."
            className="bg-card border-border text-foreground h-9"
          />
        </div>

        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading service history...</p>
        ) : error ? (
          <p className="text-center py-12 text-destructive">Failed to load service-due report.</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No cars found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Car</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Last Oil Change</TableHead>
                  <TableHead>Last Tires</TableHead>
                  <TableHead>Last Any Service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.car_id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/cars/${r.car_id}/maintenance`} className="text-[#D3BC8D] hover:underline">
                        {r.car_name || `Car #${r.car_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.car_plate || "--"}</TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_oil_change} days={r.days_since_oil_change} kind="oil_change" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_tires} days={r.days_since_tires} kind="tires" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.last_any_service)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
