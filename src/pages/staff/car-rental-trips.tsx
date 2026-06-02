import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Car, Eye, Loader2 } from "lucide-react";
import { useState } from "react";

function formatDate(d: string | undefined, fallback = "--") {
  if (!d) return fallback;
  try {
    const x = new Date(d);
    if (isNaN(x.getTime())) return fallback;
    return (
      x.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      x.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return fallback;
  }
}

interface TripItem {
  booked_aid?: string;
  dateVal?: string;
  car_name?: string;
  car_make?: string;
  car_model?: string;
  trip_start?: string;
  trip_end?: string;
  isStatus?: string;
  guest_name?: string;
  [key: string]: unknown;
}

export default function StaffCarRentalTrips() {
  const [filterVal, setFilterVal] = useState("all");
  const [viewItem, setViewItem] = useState<TripItem | null>(null);

  const { data, isLoading } = useQuery<{ success?: boolean; data?: TripItem[] }>({
    queryKey: ["staff-car-rental-trips", filterVal],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/staff/car-rental/trips?filter=${filterVal}`),
        { credentials: "include" }
      );
      if (res.status === 404 || res.status === 501) return { success: true, data: [] };
      if (!res.ok) throw new Error("Failed to load trips");
      return res.json();
    },
    retry: false,
  });

  const rows: TripItem[] = (data?.data ?? []);

  const statusBadge = (status: string | undefined) => {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s === "inprogress") return <Badge className="bg-blue-100 text-blue-800">In progress</Badge>;
    if (s === "starting") return <Badge className="bg-amber-100 text-amber-800">Starting</Badge>;
    if (s === "ending") return <Badge className="bg-amber-100 text-amber-800">Ending</Badge>;
    if (s === "endded") return <Badge className="bg-green-100 text-green-800">Ended</Badge>;
    if (s === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Car rental – Trips</h1>
          <p className="text-muted-foreground">View booked trips and trip details.</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Car className="w-5 h-5" />
              Trips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterVal} onValueChange={setFilterVal}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inprogress">In progress</SelectItem>
                  <SelectItem value="starting">Starting</SelectItem>
                  <SelectItem value="ending">Ending</SelectItem>
                  <SelectItem value="endded">Ended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-border overflow-auto max-h-[55vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No trips found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Car</TableHead>
                      <TableHead>Trip start</TableHead>
                      <TableHead>Trip end</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item, idx) => (
                      <TableRow key={(item.booked_aid ?? idx)}>
                        <TableCell>{idx + 1}.</TableCell>
                        <TableCell>{formatDate(item.dateVal)}</TableCell>
                        <TableCell>
                          {(item.car_name ?? ([item.car_make, item.car_model].filter(Boolean).join(" ") || "--"))}
                        </TableCell>
                        <TableCell>{formatDate(item.trip_start)}</TableCell>
                        <TableCell>{formatDate(item.trip_end)}</TableCell>
                        <TableCell>{statusBadge(item.isStatus)}</TableCell>
                        <TableCell>{(item.guest_name ?? "--")}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewItem(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trip details</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Date:</span> {formatDate(viewItem.dateVal)}</p>
              <p><span className="font-medium">Car:</span> {(viewItem.car_name ?? ([viewItem.car_make, viewItem.car_model].filter(Boolean).join(" ") || "--"))}</p>
              <p><span className="font-medium">Trip start:</span> {formatDate(viewItem.trip_start)}</p>
              <p><span className="font-medium">Trip end:</span> {formatDate(viewItem.trip_end)}</p>
              <p><span className="font-medium">Status:</span> {statusBadge(viewItem.isStatus)}</p>
              <p><span className="font-medium">Guest:</span> {(viewItem.guest_name ?? "--")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
