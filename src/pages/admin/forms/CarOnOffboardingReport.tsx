/**
 * Car Onboarding / Offboarding Report
 * Shows only actual form submissions from car_onboarding_submissions and
 * car_offboarding_submissions tables — NOT car status changes.
 * Only entries submitted on/after July 1st of the current year are shown.
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

const CUTOFF = new Date(new Date().getFullYear(), 6, 1); // July 1st of current year

interface OnboardingSubmission {
  id: number;
  date: string;
  name: string;
  carMakeModelYear: string;
  plateNumber: string;
  dropOffDate: string;
  createdAt: string;
  status: string;
}

interface OffboardingSubmission {
  id: number;
  date: string;
  name: string;
  vehicleMakeModelYear: string;
  licensePlate: string;
  returnDate: string;
  createdAt: string;
  status: string;
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

function isAfterCutoff(d: string | null): boolean {
  if (!d) return false;
  const date = new Date(d);
  return !isNaN(date.getTime()) && date >= CUTOFF;
}

export default function CarOnOffboardingReport() {
  const { data: onboardingData, isLoading: loadingOn } = useQuery<{
    submissions: OnboardingSubmission[];
    total: number;
  }>({
    queryKey: ["car-onboarding-submissions-report"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/car-onboarding/submissions?page=1&limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch onboarding submissions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: offboardingData, isLoading: loadingOff } = useQuery<{
    submissions: OffboardingSubmission[];
    total: number;
  }>({
    queryKey: ["car-offboarding-submissions-report"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/car-offboarding/submissions?page=1&limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch offboarding submissions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const onboardingRows = (onboardingData?.submissions ?? []).filter((r) =>
    isAfterCutoff(r.createdAt),
  );
  const offboardingRows = (offboardingData?.submissions ?? []).filter((r) =>
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
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden lg:table-cell">Plate #</TableHead>
                    <TableHead className="hidden lg:table-cell">Drop-Off Date</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onboardingRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="text-sm font-medium">
                        {row.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.carMakeModelYear || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.plateNumber || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {formatDate(row.dropOffDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.createdAt)}
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
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden lg:table-cell">Plate #</TableHead>
                    <TableHead className="hidden lg:table-cell">Return Date</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offboardingRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="text-sm font-medium">
                        {row.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.vehicleMakeModelYear || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {row.licensePlate || "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">
                        {formatDate(row.returnDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(row.createdAt)}
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
