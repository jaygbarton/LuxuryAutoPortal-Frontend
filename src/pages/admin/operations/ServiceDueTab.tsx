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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CarServiceDue } from "./types";

type ServiceKind = "oil_change" | "tires" | "brakes" | "windshield" | "mechanic" | "license_registration";

// Staleness thresholds (days) per service type. Anything past DUE reads amber;
// past OVERDUE reads red; never-serviced always reads red. Brakes/windshield/
// mechanic/license wear much slower than oil/tires, so they get longer
// windows — flag for Cathy to adjust if these defaults don't match real
// service intervals.
const THRESHOLDS: Record<ServiceKind, { due: number; overdue: number }> = {
  oil_change: { due: 90, overdue: 180 },          // ~3mo / ~6mo
  tires: { due: 180, overdue: 365 },              // ~6mo / ~1yr
  brakes: { due: 180, overdue: 365 },             // ~6mo / ~1yr
  windshield: { due: 365, overdue: 730 },         // ~1yr / ~2yr
  mechanic: { due: 180, overdue: 365 },           // ~6mo / ~1yr
  license_registration: { due: 365, overdue: 400 }, // ~1yr, matches annual renewal
};

// Registration is a countdown to a future expiration date, not a "days
// since" figure — inverted sense from THRESHOLDS above.
const REGISTRATION_THRESHOLDS = { overdue: 0, due: 30 } as const; // expired, or expiring within 30 days

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Never";
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return "Never";
  }
}

function staleness(days: number | null, kind: ServiceKind): "red" | "amber" | "green" {
  if (days == null) return "red";
  const t = THRESHOLDS[kind];
  if (days >= t.overdue) return "red";
  if (days >= t.due) return "amber";
  return "green";
}

// Registration counts DOWN to a future expiration date (negative = expired),
// the inverse of staleness() above which counts UP from a past service date.
function registrationStatus(daysUntil: number | null): "red" | "amber" | "green" {
  if (daysUntil == null) return "red";
  if (daysUntil <= REGISTRATION_THRESHOLDS.overdue) return "red";
  if (daysUntil <= REGISTRATION_THRESHOLDS.due) return "amber";
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
  kind: ServiceKind;
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

function RegistrationCell({
  date,
  daysUntil,
}: {
  date: string | null;
  daysUntil: number | null;
}) {
  const level = registrationStatus(daysUntil);
  const label =
    daysUntil == null
      ? "No expiration on file"
      : daysUntil < 0
        ? `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`
        : `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STALE_CLASSES[level]}`}>
        {label}
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
  const overdueBrakesCount = rows.filter((r) => staleness(r.days_since_brakes, "brakes") === "red").length;
  const overdueWindshieldCount = rows.filter((r) => staleness(r.days_since_windshield, "windshield") === "red").length;
  const overdueMechanicCount = rows.filter((r) => staleness(r.days_since_mechanic, "mechanic") === "red").length;
  const overdueLicenseRegCount = rows.filter((r) => staleness(r.days_since_license_registration, "license_registration") === "red").length;
  const expiringRegistrationCount = rows.filter((r) => registrationStatus(r.days_until_registration_expiration) !== "green").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Service Due"
          subtitle="Last serviced per car, from Income & Expenses records — sorted with the most overdue first."
          variant="plain"
          className="mb-0"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <SummaryCard label="Cars Tracked" value={String(rows.length)} variant="dark" />
        <SummaryCard label="Oil Change Overdue" value={String(overdueOilCount)} variant="gold" />
        <SummaryCard label="Tires Overdue" value={String(overdueTireCount)} variant="white" />
        <SummaryCard label="Brakes Overdue" value={String(overdueBrakesCount)} variant="gold" />
        <SummaryCard label="Windshield Overdue" value={String(overdueWindshieldCount)} variant="white" />
        <SummaryCard label="Mechanic Overdue" value={String(overdueMechanicCount)} variant="gold" />
        <SummaryCard label="License & Reg. Overdue" value={String(overdueLicenseRegCount)} variant="white" />
        <SummaryCard label="Registration Expiring" value={String(expiringRegistrationCount)} variant="gold" />
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
                  <TableHead>Status</TableHead>
                  <TableHead>Car</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>VIN #</TableHead>
                  <TableHead>Last Oil Change</TableHead>
                  <TableHead>Last Tires</TableHead>
                  <TableHead>Last Brakes</TableHead>
                  <TableHead>Last Windshield</TableHead>
                  <TableHead>Last Mechanic</TableHead>
                  <TableHead>Last License &amp; Reg.</TableHead>
                  <TableHead>Registration Expiration</TableHead>
                  <TableHead>Last Any Service</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.car_id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-medium",
                          r.car_status === "ACTIVE"
                            ? "bg-green-500/20 text-green-700 border-green-500/30"
                            : "bg-gray-500/20 text-gray-700 border-gray-500/30"
                        )}
                      >
                        {r.car_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/admin/cars/${r.car_id}/maintenance`} className="text-[#D3BC8D] hover:underline">
                        {r.car_name || `Car #${r.car_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.car_plate || "--"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{r.car_vin || "--"}</TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_oil_change} days={r.days_since_oil_change} kind="oil_change" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_tires} days={r.days_since_tires} kind="tires" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_brakes} days={r.days_since_brakes} kind="brakes" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_windshield} days={r.days_since_windshield} kind="windshield" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_mechanic} days={r.days_since_mechanic} kind="mechanic" />
                    </TableCell>
                    <TableCell>
                      <ServiceCell date={r.last_license_registration} days={r.days_since_license_registration} kind="license_registration" />
                    </TableCell>
                    <TableCell>
                      <RegistrationCell date={r.registration_expiration} daysUntil={r.days_until_registration_expiration} />
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
