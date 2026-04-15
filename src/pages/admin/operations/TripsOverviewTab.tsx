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
import type { TuroTrip, OperationTask, TaskType } from "./types";

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
    trip_start?: string;
    trip_end?: string;
    return_location?: string;
    delivery_location?: string;
  }>({});

  const { data, isLoading } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 100 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=100"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  const { data: tasksData } = useQuery<{ data: OperationTask[] }>({
    queryKey: ["/api/operations/tasks", "all", "all"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/tasks?limit=500"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  const trips = data?.data || [];
  const allTasks = tasksData?.data || [];
  const activeTrips = trips.filter((t) => t.status?.toLowerCase() === "booked" || t.status?.toLowerCase() === "active");
  const completedTrips = trips.filter((t) => t.status?.toLowerCase() === "completed");
  const cancelledTrips = trips.filter((t) => t.status?.toLowerCase() === "cancelled");

  const getTasksForTrip = (tripId: number) => {
    return allTasks.filter(t => t.turo_trip_id === tripId);
  };

  const hasTaskType = (tripId: number, taskType: TaskType) => {
    return allTasks.some(t => t.turo_trip_id === tripId && t.task_type === taskType);
  };

  const openTaskModal = (trip: TuroTrip, taskType: TaskType) => {
    setTaskPrefill({
      turo_trip_id: trip.id,
      reservation_id: trip.reservationId,
      car_name: trip.carName || "",
      guest_name: trip.guestName || "",
      task_type: taskType,
      trip_start: trip.tripStart,
      trip_end: trip.tripEnd,
      return_location: trip.returnLocation || "",
      delivery_location: trip.deliveryLocation || trip.pickupLocation || "",
    });
    setTaskModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Trips Overview" variant="plain" />

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Active Trips" value={String(activeTrips.length)} variant="gold" />
        <SummaryCard label="Completed" value={String(completedTrips.length)} variant="dark" />
        <SummaryCard label="Cancelled" value={String(cancelledTrips.length)} variant="white" />
      </div>

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
                  <TableHead className="text-foreground font-medium">Assigned</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading trips...</TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No trips found</TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => {
                    const tripTasks = getTasksForTrip(trip.id);
                    const hasCleaning = hasTaskType(trip.id, "cleaning");
                    const hasDelivery = hasTaskType(trip.id, "delivery");
                    const hasPickup = hasTaskType(trip.id, "pickup");

                    return (
                      <TableRow key={trip.id} className="border-border hover:bg-card/50 transition-colors">
                        <TableCell className="text-foreground font-mono text-sm">{trip.reservationId || "--"}</TableCell>
                        <TableCell className="text-foreground">{trip.carName || "--"}</TableCell>
                        <TableCell className="text-muted-foreground">{trip.guestName || "--"}</TableCell>
                        <TableCell className="text-foreground text-sm">{formatDateTime(trip.tripStart)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={trip.pickupLocation || trip.deliveryLocation || ""}>{trip.pickupLocation || trip.deliveryLocation || "--"}</TableCell>
                        <TableCell className="text-foreground text-sm">{formatDateTime(trip.tripEnd)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={trip.returnLocation || ""}>{trip.returnLocation || "--"}</TableCell>
                        <TableCell><StatusBadge status={trip.status} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {hasCleaning && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20" title="Cleaning assigned">
                                <Sparkles className="w-3 h-3 text-yellow-500" />
                              </span>
                            )}
                            {hasDelivery && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20" title="Delivery assigned">
                                <Truck className="w-3 h-3 text-blue-400" />
                              </span>
                            )}
                            {hasPickup && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20" title="Pickup assigned">
                                <Package className="w-3 h-3 text-green-500" />
                              </span>
                            )}
                            {tripTasks.length === 0 && <span className="text-muted-foreground text-xs">--</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "cleaning")}
                              className={`h-8 px-2 ${hasCleaning ? "text-yellow-500" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Cleaning"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "delivery")}
                              className={`h-8 px-2 ${hasDelivery ? "text-blue-400" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Delivery"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "pickup")}
                              className={`h-8 px-2 ${hasPickup ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Pickup"
                            >
                              <Package className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />
    </div>
  );
}
