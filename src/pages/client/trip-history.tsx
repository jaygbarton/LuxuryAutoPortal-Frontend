import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

interface ClientTrip {
  id: number;
  reservation_id: string;
  car_name: string | null;
  plate_number: string | null;
  guest_name: string | null;
  trip_start: string | null;
  trip_end: string | null;
  earnings: number | null;
  status: string | null;
  delivery_location: string | null;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const LIMIT = 20;

export default function ClientTripHistory() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ success: boolean; data: ClientTrip[]; total: number }>({
    queryKey: ["/api/client/trips", page],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/client/trips?page=${page}&limit=${LIMIT}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });

  const trips = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-primary leading-tight">
            Trip History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Turo rental history for your vehicle{trips.length !== 1 ? "s" : ""}.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {total > 0 ? `${total} trip${total !== 1 ? "s" : ""}` : "Trips"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : trips.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                No trips found for your vehicle.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead>Reservation</TableHead>
                        <TableHead>Car</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Trip Start</TableHead>
                        <TableHead>Trip End</TableHead>
                        <TableHead>Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((t) => (
                        <TableRow key={t.id} className="border-border">
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {t.reservation_id || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {t.car_name || "—"}
                            {t.plate_number && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({t.plate_number})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{t.guest_name || "—"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fmt(t.trip_start)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{fmt(t.trip_end)}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {t.earnings != null ? `$${Number(t.earnings).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                t.status === "completed"
                                  ? "bg-green-500/10 text-green-700 border-green-500/30"
                                  : t.status === "booked"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                  : "bg-gray-500/10 text-gray-600 border-gray-500/30"
                              }
                            >
                              {t.status ?? "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
