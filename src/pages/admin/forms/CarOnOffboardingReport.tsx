/**
 * Car Onboarding / Offboarding Report
 * Admin-only summary tables of recent Car On-boarding and Off-boarding
 * submissions, shown above the Car Block Off section on the Forms page.
 *
 * Per request, only entries submitted on/after July 1st of the current year
 * are shown ("show the new entries only starting July 1st").
 */

import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Car, LogOut } from "lucide-react";

// Cutoff: only show entries submitted on/after July 1st of the current year.
// Computed once at module load so the report rolls forward each year.
const CUTOFF = new Date(new Date().getFullYear(), 6, 1); // month is 0-indexed → 6 = July

interface OnboardingCar {
  id: number;
  createdAt: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  vin: string | null;
  carMakeModel: string;
  year: number | null;
  licensePlate: string | null;
  onboardingDate: string | null;
}

interface OffboardingCar {
  id: number;
  createdAt: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  vin: string | null;
  carMakeModel: string;
  year: number | null;
  licensePlate: string | null;
  offboardAt: string | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** True when `d` is a valid date on/after the July-1st cutoff. */
function isAfterCutoff(d: string | null): boolean {
  if (!d) return false;
  const date = new Date(d);
  return !isNaN(date.getTime()) && date >= CUTOFF;
}

function vehicleLabel(carMakeModel: string, year: number | null): string {
  return [carMakeModel?.trim(), year].filter(Boolean).join(" ").trim() || "—";
}

export default function CarOnOffboardingReport() {
  const { data: onboardingData, isLoading: loadingOn } = useQuery<{
    success: boolean;
    data: OnboardingCar[];
  }>({
    queryKey: ["car-onboarding-report"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/cars/onboarding?page=1&limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch onboarding submissions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: offboardingData, isLoading: loadingOff } = useQuery<{
    success: boolean;
    data: OffboardingCar[];
  }>({
    queryKey: ["car-offboarding-report"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/cars/offboarding-forms?page=1&limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch offboarding submissions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const onboardingRows = (onboardingData?.data ?? []).filter((r) =>
    isAfterCutoff(r.createdAt),
  );
  const offboardingRows = (offboardingData?.data ?? []).filter((r) =>
    isAfterCutoff(r.createdAt),
  );

  const cutoffLabel = CUTOFF.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Car Onboarding */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
            <Car className="h-5 w-5" />
            Car Onboarding Submissions
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            New entries submitted on or after {cutoffLabel}.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOn ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : onboardingRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No onboarding submissions on or after {cutoffLabel}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Phone</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden xl:table-cell">VIN#</TableHead>
                    <TableHead className="hidden lg:table-cell">Plate #</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Onboarding Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="text-sm font-medium">
                        {row.clientName || "—"}
                      </TableCell>
                      <TableCell
                        className="text-sm hidden md:table-cell max-w-[180px] truncate"
                        title={row.clientEmail || "—"}
                      >
                        {row.clientEmail || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.clientPhone || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {vehicleLabel(row.carMakeModel, row.year)}
                      </TableCell>
                      <TableCell className="text-sm hidden xl:table-cell font-mono text-xs">
                        {row.vin || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.licensePlate || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.onboardingDate || row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Car Offboarding */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-primary flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Car Offboarding Submissions
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            New entries submitted on or after {cutoffLabel}.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOff ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : offboardingRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No offboarding submissions on or after {cutoffLabel}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Phone</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden xl:table-cell">VIN#</TableHead>
                    <TableHead className="hidden lg:table-cell">Plate #</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Offboarding Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offboardingRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="text-sm font-medium">
                        {row.clientName || "—"}
                      </TableCell>
                      <TableCell
                        className="text-sm hidden md:table-cell max-w-[180px] truncate"
                        title={row.clientEmail || "—"}
                      >
                        {row.clientEmail || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.clientPhone || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {vehicleLabel(row.carMakeModel, row.year)}
                      </TableCell>
                      <TableCell className="text-sm hidden xl:table-cell font-mono text-xs">
                        {row.vin || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.licensePlate || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.offboardAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
