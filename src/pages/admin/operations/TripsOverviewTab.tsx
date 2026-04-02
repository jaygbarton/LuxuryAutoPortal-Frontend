import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { Truck, Sparkles, Package } from "lucide-react";
import type { TuroTrip, TaskType } from "./types";

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return dateStr;
  }
};

export function TripsOverviewTab() {
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<{
    turo_trip_id?: number;
    reservation_id?: string;
    car_name?: string;
    guest_name?: string;
    task_type?: TaskType;
  }>({});

  const { data, isLoading } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 100 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=100"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  const trips = data?.data || [];
  const activeTrips = trips.filter((t) => t.status?.toLowerCase() === "booked" || t.status?.toLowerCase() === "active");
  const completedTrips = trips.filter((t) => t.status?.toLowerCase() === "completed");
  const cancelledTrips = trips.filter((t) => t.status?.toLowerCase() === "cancelled");

  const openTaskModal = (trip: TuroTrip, taskType: TaskType) => {
    setTaskPrefill({
      turo_trip_id: trip.id,
      reservation_id: trip.reservation_id,
      car_name: trip.car_name,
      guest_name: trip.guest_name,
      task_type: taskType,
    });
    setTaskModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Trips Overview" variant="plain" />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Active Trips" value={String(activeTrips.length)} variant="gold" />
        <SummaryCard label="Completed" value={String(completedTrips.length)} variant="dark" />
        <SummaryCard label="Cancelled" value={String(cancelledTrips.length)} variant="white" />
      </div>

      {/* Trips Table */}
      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="text-sm text-muted-foreground mb-3">Total: {trips.length} trips</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium">Car</TableHead>
                  <TableHead className="text-foreground font-medium">Guest</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Start</TableHead>
                  <TableHead className="text-foreground font-medium">Start Location</TableHead>
                  <TableHead className="text-foreground font-medium">Trip End</TableHead>
                  <TableHead className="text-foreground font-medium">Return Location</TableHead>
                  <TableHead className="text-foreground font-medium">Status</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading trips...</TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No trips found</TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id} className="border-border hover:bg-card/50 transition-colors">
                      <TableCell className="text-foreground font-mono text-sm">{trip.reservation_id}</TableCell>
                      <TableCell className="text-foreground">{trip.car_name}</TableCell>
                      <TableCell className="text-muted-foreground">{trip.guest_name}</TableCell>
                      <TableCell className="text-foreground text-sm">{formatDateTime(trip.trip_start)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={trip.start_location}>{trip.start_location || "--"}</TableCell>
                      <TableCell className="text-foreground text-sm">{formatDateTime(trip.trip_end)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={trip.return_location}>{trip.return_location || "--"}</TableCell>
                      <TableCell><StatusBadge status={trip.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTaskModal(trip, "cleaning")}
                            className="text-muted-foreground hover:text-primary h-8 px-2"
                            title="Assign Cleaning"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTaskModal(trip, "delivery")}
                            className="text-muted-foreground hover:text-primary h-8 px-2"
                            title="Assign Delivery"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTaskModal(trip, "pickup")}
                            className="text-muted-foreground hover:text-primary h-8 px-2"
                            title="Assign Pickup"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Task Assignment Modal */}
      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />
    </div>
  );
}
